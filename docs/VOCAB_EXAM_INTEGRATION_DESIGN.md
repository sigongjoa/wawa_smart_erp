# 상위권 어휘풀 + 자동 채점 시험 통합 설계

> **관련 이슈**: wawa_smart_erp#56 (상위권 어휘풀/전공어), word-gacha#8 (배포 페이지 자동 채점)
> **스택**: Cloudflare Workers + D1 + React(desktop/student) + R2
> **멀티테넌트**: 모든 테이블 `academy_id` 격리 유지

---

## 1. 현재 상태 분석

### 1.1 재사용 가능한 자산
| 컴포넌트 | 위치 | 역할 |
|---|---|---|
| `vocab_words` | migrations/032 | 학생별 단어장 (5-box Leitner) |
| `vocab_print_jobs` | migrations/032 | 출제 기록 (word_ids_json) |
| `vocab_grade_results` | migrations/032 | O/X 채점 → box 갱신 |
| `vocab-handler.ts` | workers/src/routes | CRUD + 출제 + 채점 |
| `vocab-play-handler.ts` | workers/src/routes | 학생 앱 학습 플레이 |
| `exam-attempt-handler.ts` | workers/src/routes | 시험 응시 세션 (타이머/이탈) |
| `gacha_students` | migrations/019 | 학생 엔티티 |

### 1.2 부재한 부분 (신규 설계 대상)
- 어휘 **tier**(basic/advanced/major) 및 **전공 태그** 모델
- 어휘풀(전체 단어 pool) ↔ 학생 개인 단어장(`vocab_words`) 분리
- **Exam Mode**: 배포 페이지에서 타이머 기반 응시
- **채점 엔진**: 객관식/철자(Levenshtein)/빈칸/영영뜻 통합
- **부정행위 감지**: 풀스크린/탭 전환/포커스 이탈 기록
- ERP ↔ word-gacha(student 앱) **시험 배포/회신 REST**

---

## 2. 데이터 모델 확장

### 2.1 신규 마이그레이션 `037_vocab_pool.sql`

```sql
-- 학원 공용 어휘풀 (시드 + 자체 추가)
CREATE TABLE vocab_pool (
  id TEXT PRIMARY KEY,                -- vp_xxx
  academy_id TEXT NOT NULL,           -- NULL 허용 시 전역 시드. 본 설계에선 학원별 복사
  english TEXT NOT NULL,
  korean TEXT NOT NULL,
  pos TEXT,                           -- 품사
  cefr TEXT,                          -- A1|A2|B1|B2|C1|C2
  tier TEXT NOT NULL DEFAULT 'basic', -- basic|advanced|major
  frequency INTEGER,                  -- 빈도 랭크 (낮을수록 흔함)
  etymology TEXT,                     -- 어원
  synonyms_json TEXT,                 -- ["..."]
  antonyms_json TEXT,
  example_en TEXT,
  example_ko TEXT,
  source TEXT,                        -- 교재/출처 메타
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_vocab_pool_tier ON vocab_pool(academy_id, tier);
CREATE UNIQUE INDEX uq_vocab_pool_english ON vocab_pool(academy_id, english);

-- 태그 (전공/시험 분류). 다대다.
CREATE TABLE vocab_tags (
  id TEXT PRIMARY KEY,                -- vt_xxx
  academy_id TEXT NOT NULL,
  name TEXT NOT NULL,                 -- 의예, 공대, 경영, 수능, SAT, TOEFL ...
  category TEXT NOT NULL              -- major|exam|topic
);
CREATE UNIQUE INDEX uq_vocab_tags_name ON vocab_tags(academy_id, name);

CREATE TABLE vocab_pool_tags (
  pool_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (pool_id, tag_id),
  FOREIGN KEY (pool_id) REFERENCES vocab_pool(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES vocab_tags(id) ON DELETE CASCADE
);

-- 학생별 지망 태그 (자동 배정 기준)
CREATE TABLE student_vocab_profile (
  student_id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  target_tier TEXT NOT NULL DEFAULT 'basic',
  target_tags_json TEXT,              -- ["의예","SAT"]
  daily_quota INTEGER NOT NULL DEFAULT 20,
  updated_at DATETIME,
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE
);

-- 기존 vocab_words에 풀 참조 추가 (NULL 허용: 자유 추가 단어와 공존)
ALTER TABLE vocab_words ADD COLUMN pool_id TEXT REFERENCES vocab_pool(id);
ALTER TABLE vocab_words ADD COLUMN tier TEXT NOT NULL DEFAULT 'basic';
```

### 2.2 신규 마이그레이션 `038_vocab_exam.sql`

```sql
-- 시험지 (ERP에서 생성, student 앱에 배포)
CREATE TABLE vocab_exams (
  id TEXT PRIMARY KEY,                -- ve_xxx
  academy_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_by TEXT NOT NULL,           -- teacher user_id
  source_tier TEXT,                   -- basic|advanced|major (옵션)
  source_tags_json TEXT,              -- 태그 기반 출제
  duration_sec INTEGER NOT NULL,      -- 제한시간
  total_items INTEGER NOT NULL,
  grading_policy_json TEXT NOT NULL,  -- { typo_tolerance, case_sensitive, partial_credit }
  published_at DATETIME,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_vocab_exams_academy ON vocab_exams(academy_id, published_at);

-- 시험 문항 (확정된 스냅샷 — 풀이 변경에 비영향)
CREATE TABLE vocab_exam_items (
  id TEXT PRIMARY KEY,                -- vei_xxx
  exam_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  pool_id TEXT,                       -- 추적용
  q_type TEXT NOT NULL,               -- mcq_en2ko | mcq_ko2en | spell | cloze | def_match
  prompt TEXT NOT NULL,
  choices_json TEXT,                  -- MCQ용 ["A","B","C","D"]
  answer TEXT NOT NULL,               -- 정답 (spell: 영단어, cloze: 정답어)
  answer_alts_json TEXT,              -- 허용 대체답 ["color","colour"]
  weight INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (exam_id) REFERENCES vocab_exams(id) ON DELETE CASCADE
);
CREATE INDEX idx_vocab_exam_items_exam ON vocab_exam_items(exam_id, seq);

-- 학생 배포 (멀티테넌트 격리 + 응시 권한)
CREATE TABLE vocab_exam_assignments (
  id TEXT PRIMARY KEY,                -- vea_xxx
  exam_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  due_at DATETIME,
  status TEXT NOT NULL DEFAULT 'assigned', -- assigned|in_progress|submitted|graded|expired
  retry_allowed INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (exam_id) REFERENCES vocab_exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_vocab_exam_assign ON vocab_exam_assignments(exam_id, student_id);

-- 응시 세션 (타이머 + 부정행위 이벤트 누적)
CREATE TABLE vocab_exam_attempts (
  id TEXT PRIMARY KEY,                -- veatt_xxx
  assignment_id TEXT NOT NULL,
  started_at DATETIME NOT NULL,
  submitted_at DATETIME,
  elapsed_sec INTEGER,
  score_raw REAL,                     -- 0..1
  score_weighted INTEGER,             -- sum(weight * correct)
  total_weight INTEGER,
  cheat_events_json TEXT,             -- [{type:"blur",ts:...}]
  client_meta_json TEXT,              -- ua, screen, tz
  FOREIGN KEY (assignment_id) REFERENCES vocab_exam_assignments(id) ON DELETE CASCADE
);
CREATE INDEX idx_vocab_exam_attempts_assign ON vocab_exam_attempts(assignment_id);

-- 문항별 응답 (오답 → 복습 큐 자동 편입 기준)
CREATE TABLE vocab_exam_responses (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  given TEXT,
  correct INTEGER NOT NULL,           -- 0|1
  partial REAL,                       -- 부분점수 0..1
  distance INTEGER,                   -- Levenshtein (spell류)
  graded_by TEXT NOT NULL DEFAULT 'auto', -- auto|teacher
  FOREIGN KEY (attempt_id) REFERENCES vocab_exam_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id)    REFERENCES vocab_exam_items(id) ON DELETE CASCADE
);
CREATE INDEX idx_vocab_exam_responses_attempt ON vocab_exam_responses(attempt_id);
```

### 2.3 관계 다이어그램

```
vocab_pool ─┬─ vocab_pool_tags ─ vocab_tags
            └─ vocab_words (학생 개인 단어장, pool_id FK)
                           │
student_vocab_profile ─────┘ (tier/tag 기반 자동 출제)

vocab_exams ─ vocab_exam_items
   │
   └─ vocab_exam_assignments (학생 배포)
         │
         └─ vocab_exam_attempts ─ vocab_exam_responses
                   │                      │
                   │                      └─ (오답) → vocab_words.box -= 1
                   └─ cheat_events_json
```

---

## 3. 아키텍처: ERP ↔ student 앱 데이터 흐름

### 3.1 시퀀스 — 시험 생성/배포/응시/채점/회신

```
[Teacher-ERP(desktop)]  [Workers API]  [D1]  [Student App(word-gacha)]

1. 시험지 생성
   POST /api/vocab/exams
   { tier:"advanced", tags:["의예"], duration:600, count:30 }
        │
        ├── vocab_pool에서 tier+tag 조건 매칭 + 가중치 샘플링
        ├── vocab_exams + vocab_exam_items 스냅샷 저장
        └── ← { exam_id }

2. 학생 배포
   POST /api/vocab/exams/{id}/assign
   { student_ids:[...], due_at }
        └── vocab_exam_assignments 벌크 insert

3. 학생 응시 시작
                                                 GET /api/play/vocab/exams
                                                 → 내게 할당된 exam 리스트
                                                 POST /api/play/vocab/exams/{aid}/start
        ├── attempt 생성, started_at 기록
        └── ← { attempt_id, items: [...문항...] }

4. 응시 중 이벤트 (옵션)
                                                 POST /api/play/vocab/exams/{aid}/events
                                                 { type:"blur", ts }
        └── cheat_events_json append

5. 제출 & 자동 채점
                                                 POST /api/play/vocab/exams/{aid}/submit
                                                 { responses:[{item_id,given}] }
        ├── 채점 엔진 실행 (순수 함수)
        ├── vocab_exam_responses insert
        ├── vocab_exam_attempts.score_* 업데이트
        ├── assignment.status = 'graded'
        ├── 오답 word → vocab_words.box 감소 / 신규 추가
        └── ← { score, breakdown, wrong_words }

6. ERP 리포트 조회
   GET /api/vocab/exams/{id}/report
        └── 반별 통계 + 학생별 오답 히트맵
```

### 3.2 동일 Workers 인스턴스 — "ERP↔student 회신"은 내부 DB 공유

student 앱(word-gacha)은 **별도 repo지만 동일 Cloudflare Workers + D1** 을 호출. 따라서 "회신 REST"는 명시적 push가 아닌 **공유 D1 읽기**로 해결. 필요 시 `/api/vocab/exams/{id}/attempts/live` SSE로 실시간 대시보드 갱신.

---

## 4. 채점 엔진 설계

### 4.1 순수 함수 인터페이스 (`workers/src/lib/vocab-grader.ts`)

```ts
export type GradingPolicy = {
  typoTolerance: number;        // Levenshtein 허용 거리 (기본 0)
  caseSensitive: boolean;       // 기본 false
  partialCredit: {
    plural: boolean;            // s/es 허용
    pos: boolean;               // 품사 변형 허용 (run/ran)
  };
};

export type GradeItemInput = {
  qType: 'mcq_en2ko'|'mcq_ko2en'|'spell'|'cloze'|'def_match';
  answer: string;
  answerAlts: string[];
  given: string;
};

export type GradeItemResult = {
  correct: 0 | 1;
  partial: number;              // 0..1
  distance?: number;
};

export function gradeItem(i: GradeItemInput, p: GradingPolicy): GradeItemResult;
```

### 4.2 유형별 로직

| qType | 로직 |
|---|---|
| `mcq_*` | `given === answer` 정확 비교 |
| `spell` | normalize(case, trim) → Levenshtein ≤ typoTolerance → correct. 초과 시 partial=`1-d/len` (<0.5면 0) |
| `cloze` | spell과 동일 + `answer_alts` 순회 |
| `def_match` | 단어↔영영뜻 매칭; 동의어 사전 사용 (D1 `vocab_pool.synonyms_json`) |

**부분점수**: `plural` 옵션 ON이면 `answer+('s'|'es')` 와 일치 시 0.8. `pos` ON이면 표제어 비교 (간단한 stemmer, 외부 라이브러리 없이).

### 4.3 Leitner 연동

제출 직후:
- `correct=1` → `vocab_words.box = min(box+1, 5)`
- `correct=0` → `box = max(box-1, 1)` + `wrong_count++`
- 어휘풀에만 있고 개인 단어장에 없던 단어가 오답이면 → **자동 `vocab_words` INSERT (box=1, added_by='exam')**

---

## 5. 부정행위 방지

### 5.1 클라이언트 (student 앱)

```ts
// Exam Mode 진입 시
document.documentElement.requestFullscreen();
window.addEventListener('blur', () => log('blur'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) log('hidden');
});
window.addEventListener('beforeunload', () => log('unload'));

// 로그는 버퍼링 → 5초마다 POST /events
```

### 5.2 서버 정책

| 이벤트 임계 | 조치 |
|---|---|
| blur 3회 | 경고 표시 |
| blur 5회 | `attempt.flagged=1`, 교사 리뷰 필요 |
| 전체화면 이탈 | attempt 일시중지 → 재개 시 남은 시간만 복원 |
| 동일 assignment 재시작 | `retry_allowed=0`이면 거부 |

서버는 `elapsed_sec`을 **서버 타임스탬프**로만 계산 (클라이언트 시계 신뢰 금지).

---

## 6. API 스펙 (요약)

### 6.1 교사 (ERP)
```
POST   /api/vocab/pool                 어휘 추가 (단건/CSV)
GET    /api/vocab/pool?tier=&tag=      어휘풀 조회
POST   /api/vocab/tags
PUT    /api/vocab/profile/{studentId}  지망태그/일일쿼터
POST   /api/vocab/exams                시험 자동 생성 (tier+tag+count)
GET    /api/vocab/exams/{id}
POST   /api/vocab/exams/{id}/assign    학생 배포
GET    /api/vocab/exams/{id}/report    통계 리포트
```

### 6.2 학생 (student 앱)
```
GET    /api/play/vocab/exams           내 할당 시험
POST   /api/play/vocab/exams/{aid}/start
POST   /api/play/vocab/exams/{aid}/events
POST   /api/play/vocab/exams/{aid}/submit
GET    /api/play/vocab/exams/{aid}/result
```

모든 엔드포인트: `requireAuth` + `academy_id` 필터 강제 (기존 `getAcademyId` 유틸 재사용).

---

## 7. React 구현 지점

### 7.1 desktop (교사)
- `apps/desktop/src/pages/VocabPoolPage.tsx` — tier/tag 관리, CSV 업로드
- `apps/desktop/src/pages/VocabExamBuilderPage.tsx` — tier+tag+count → 자동 생성 프리뷰
- `apps/desktop/src/pages/VocabExamReportPage.tsx` — 반 통계, 학생별 히트맵

### 7.2 student (word-gacha 배포 페이지)
- `apps/student/src/pages/VocabExamListPage.tsx`
- `apps/student/src/pages/VocabExamRunnerPage.tsx` — 풀스크린/타이머/이탈 감지
- `apps/student/src/pages/VocabExamResultPage.tsx`

---

## 8. 리포트 연동

- 학생 프로필(`gacha_students` 상세 페이지)에 `최근 시험 점수`, `전공어 커버리지 %`, `오답 Top10` 섹션 추가
- 주간 리포트(`report-handler.ts`)에 `vocab_exam_attempts` 집계 합류
- PDF export: 기존 `exam-paper-handler.ts` 패턴 재사용

---

## 9. 단계별 롤아웃

| 단계 | 산출물 | 이슈 |
|---|---|---|
| P1 | `037_vocab_pool.sql` + vocab pool CRUD + CSV 업로드 | #56 |
| P2 | 지망태그/자동 배정 + 일일 학습 연동 | #56 |
| P3 | `038_vocab_exam.sql` + 시험 생성/배포 API | #8 |
| P4 | student 앱 Exam Mode UI + 부정행위 감지 | #8 |
| P5 | 채점 엔진 + Leitner 연동 + 리포트 | #8 |
| P6 | 반별 통계 대시보드 + PDF export | #56, #8 |

---

## 10. 리스크 & 결정사항

| 리스크 | 완화 |
|---|---|
| 어휘 시드 중복 (학원 A가 추가한 pool이 학원 B에 노출) | `academy_id NOT NULL` + 시드는 학원 생성 시 복사 삽입 |
| spell 채점의 유니코드/공백 엣지케이스 | normalize: NFC + 양끝 trim + 연속 공백 단일화 |
| 타이머 신뢰성 | 서버 `started_at`만 신뢰, 클라이언트 종료 시간 무시 |
| 부정행위 오탐 (모바일 알림 blur) | 임계값 튜닝 + 교사 리뷰 플로우 |
| student 앱 별 repo 동기화 | 동일 D1 공유 — API 계약(OpenAPI) 을 `docs/api/vocab-exam.yaml`로 단일화 |

---

## 다음 단계
`/sc:implement P1` — 037 마이그레이션 + `workers/src/routes/vocab-pool-handler.ts` 작성부터 시작.
