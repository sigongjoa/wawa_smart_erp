# 단어 시험지 학생 응시 루프 — 서버 기반 설계 (Phase 3b)

> 지금 `/vocab/grading`은 선생님이 localStorage에 시험지 만들어 **수기 O/X 채점**하는 도구. 이걸 **학생이 앱에서 직접 응시 → 자동 채점 → 선생님 결과 확인** 루프로 전환.
>
> 작성: 2026-04-23 / 이어질 이슈: Phase 3b

---

## 1. 현재 인프라 조사 결과

### 이미 있는 것 ✅
| 영역 | 내용 |
|-----|------|
| `vocab_print_jobs` 테이블 (032) | id, academy_id, student_id, word_ids_json, grammar_ids_json, pdf_r2_key, created_by, created_at |
| `vocab_grade_results` 테이블 (032) | id, print_job_id, word_id, correct, box_before, box_after, graded_at |
| `POST /api/vocab/print/pick` | 학생별 가중치 출제 + `vocab_print_jobs` 자동 INSERT |
| `POST /api/vocab/print/grade` | 선생님이 O/X 제출 → `vocab_grade_results` 기록 + `vocab_words.box`/`wrong_count` 업데이트 |
| `GET /api/vocab/print/:jobId` (추정: handleGetPrintJob) | 선생님이 단일 job 조회 |

### 비어 있는 것 ❌
1. **`vocab_print_jobs`에 응시 상태 컬럼 없음** — `pending`/`in_progress`/`submitted`/`voided` 구분 불가
2. **학생 PIN 경로 없음** — `/api/play/vocab/print/*` 엔드포인트 부재. 학생이 자기 시험지 조회/제출 불가
3. **학생이 UI로 답을 입력하는 페이지 없음**
4. **학생 홈에 "새 시험지" 알림 카드 없음**
5. **선생님 UI가 서버 잡을 리스트업하지 않음** (localStorage만 봄)

---

## 2. 설계 결정 (Tradeoffs)

### D1. 학생 UI — **word-gacha 안 신규 "시험" 탭 vs 전용 페이지**
**선택**: **word-gacha 하단 탭바에 "시험" 추가** (기존 탭바: 홈/학습/연습/도감/기록 → 홈/시험/학습/연습/도감 식으로 확장)
- 이유: 학생 앱은 이미 word-gacha에 통합돼 있고 기존 타이머/게이미피케이션 컨텍스트 유지. 별도 페이지는 과잉.
- 대안 (보류): 홈 카드만 노출 → 탭 없이 카드 클릭 시 전용 fullscreen 응시 모드.

### D2. 문제 유형 — **객관식 4지선다 vs 단답 자유 입력**
**선택**: **객관식 4지선다 (word-gacha 퀴즈 패턴 재사용)**
- 이유: word-gacha의 `quiz.js`가 이미 `buildQuestion(target, pool)`로 4지선다 생성 로직을 갖고 있음 → 그대로 재사용 가능. 자동 채점 간결.
- 대안 (v2): 철자 단답. 한글 ↔ 영어 양방향 선택 가능하게 `blank_type` 활용.

### D3. 채점 기준 — **정답 idx 일치**
선택지 중 타겟(단어의 meaning)을 제외한 3개는 같은 학생 풀에서 랜덤. `correctIndex` 기준 일치.

### D4. Box/wrong_count 업데이트 — **기존 `handlePrintGrade` 로직 그대로 재사용**
학생 제출 시 서버가 내부적으로 `handlePrintGrade` 로직을 호출 (API wrapper). 선생님 수기 O/X와 동일 트랜잭션.

### D5. 수기 O/X 선생님 기능 — **유지**
이미 제출된 시험지도 선생님이 "재채점" 가능 (예외 케이스용). 기본 워크플로는 자동.

### D6. 알림 방식 — **폴링 (5초)**
학생 홈이 이미 `getActiveExamAttempt`를 5초 폴링 중. 같은 훅에 `/api/play/vocab/print/pending` 추가.

---

## 3. 데이터 모델 변경

### 3.1 마이그레이션 `043_vocab_print_taking.sql`

```sql
-- 시험지 상태 lifecycle
ALTER TABLE vocab_print_jobs ADD COLUMN status TEXT DEFAULT 'pending';
  -- 'pending'    : 학생에게 배정됐지만 미시작
  -- 'in_progress': 학생이 시작함
  -- 'submitted'  : 학생 제출 (자동 채점 됨)
  -- 'voided'     : 선생님 무효 처리
ALTER TABLE vocab_print_jobs ADD COLUMN started_at TEXT;
ALTER TABLE vocab_print_jobs ADD COLUMN submitted_at TEXT;
ALTER TABLE vocab_print_jobs ADD COLUMN auto_correct INTEGER;
ALTER TABLE vocab_print_jobs ADD COLUMN auto_total INTEGER;

-- 학생이 문제별 선택한 답 저장 (재접속 시 이어 풀기용)
CREATE TABLE IF NOT EXISTS vocab_print_answers (
  print_job_id   TEXT NOT NULL,
  word_id        TEXT NOT NULL,
  selected_index INTEGER,        -- 0..3 학생이 고른 보기 인덱스
  correct_index  INTEGER,        -- 생성 시점의 정답 인덱스 (서버가 고정)
  choices_json   TEXT,           -- 4개 보기 snapshot (학생이 보는 순서)
  saved_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (print_job_id, word_id),
  FOREIGN KEY (print_job_id) REFERENCES vocab_print_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES vocab_words(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vocab_print_answers_job ON vocab_print_answers(print_job_id);

CREATE INDEX IF NOT EXISTS idx_vocab_print_status_student ON vocab_print_jobs(student_id, status, created_at);
```

### 3.2 기존 구조 재사용
- `vocab_print_jobs.word_ids_json` — 출제된 단어 id 배열 (유지)
- `vocab_grade_results` — 자동 채점 시 기존 handlePrintGrade가 INSERT하는 결과 행. 수기 O/X와 동일하게 쌓임.

---

## 4. API 설계

### 4.1 선생님 JWT (`/api/vocab/print/*` 확장)

**기존 유지**:
- `POST /api/vocab/print/pick` — 단일 학생 시험지 생성 (기존)
- `POST /api/vocab/print/grade` — 수기 O/X 제출 (기존)

**신규**:
- `POST /api/vocab/print/assign` — 여러 학생에게 한 번에 배정
  - body: `{ student_ids: string[], max_words?: number }`
  - 각 학생별로 pick 호출 후 status='pending'으로 저장. 트랜잭션 아니어도 됨(실패 학생은 제외).
  - 응답: `[{ job_id, student_id, word_count }]`
- `GET /api/vocab/print/jobs` — 학원 전체 시험지 목록 (선생님 UI용)
  - query: `status=pending|submitted|all`, `days=7` (최근 N일)
  - 응답: `[{ job_id, student_id, student_name, word_count, status, auto_correct, auto_total, submitted_at, created_at }]`
- `GET /api/vocab/print/:jobId/answers` — 학생 답안 상세 (선생님이 문항별 결과 보기)
  - 응답: `[{ word_id, english, korean, selected_index, correct_index, choices, correct: bool }]`
- `POST /api/vocab/print/:jobId/void` — 무효 처리

### 4.2 학생 PIN (`/api/play/vocab/print/*`, 신규)

- `GET /api/play/vocab/print/pending` — 본인 미완료 시험지 목록 (알림용 폴링)
  - 응답: `[{ job_id, word_count, created_at }]`  (status in pending, in_progress)
- `GET /api/play/vocab/print/:jobId` — 시험지 불러오기
  - 응답: `{ job_id, status, startedAt, questions: [{ word_id, prompt, choices[4], questionType }], currentAnswers: [{ word_id, selected_index }] }`
  - `questionType`: `'en->ko'` | `'ko->en'` (blank_type 따라 결정 — 양쪽 섞기 가능)
- `POST /api/play/vocab/print/:jobId/start` — 시작 마킹
  - status='in_progress', started_at=now, 첫 호출 시 choices 생성·고정해서 `vocab_print_answers`에 snapshot
  - 응답: `{ ... GET과 같음 }`
- `PUT /api/play/vocab/print/:jobId/answers/:wordId` — 답안 저장
  - body: `{ selected_index: 0..3 | null }`
  - upsert `vocab_print_answers.selected_index`
- `POST /api/play/vocab/print/:jobId/submit` — 제출 + 자동 채점
  - 서버 로직: `vocab_print_answers.selected_index === correct_index`인지 계산해 `handlePrintGrade`와 동일하게 `vocab_words.box/wrong_count` 업데이트 + `vocab_grade_results` INSERT + `vocab_print_jobs.status='submitted', auto_correct, auto_total, submitted_at` 기록
  - 응답: `{ correct, total, breakdown: [{ word_id, selected, correct, is_correct }] }`

---

## 5. 학생 UI 와이어프레임

### 5.1 홈 알림 카드 (word-gacha `index.html`)

```
┌────────────────────────────────────┐
│ 🔔 새 단어 시험지  (배지)           │
│   총 20문항 · 선생님이 오늘 출제     │
│   [ 시작하기 →  ]                    │
└────────────────────────────────────┘
```

- `hydrateFromServer` 또는 새 훅 `pollPrintJobs()` 에서 5초마다 `/api/play/vocab/print/pending` 호출
- 결과 있으면 홈 상단에 카드 삽입 (기존 `home-mode-card` 패턴 재사용)

### 5.2 응시 화면 (word-gacha 신규 페이지 `/print/:jobId`)

```
┌────────────────────────────────────┐
│ ◀ 나가기   Q 3/20   ⏱ ——           │  (타이머 선택적: 제한 시간 없음)
│ ━━━━━━━░░░░░░░░░░░░░             │ (진행바)
├────────────────────────────────────┤
│                                    │
│     "innovation" 의 뜻은?          │
│                                    │
│  ①  혁신                            │
│  ②  개선                            │
│  ③  발명                            │
│  ④  전통                            │
│                                    │
├────────────────────────────────────┤
│        [ 이전 ]   [ 다음 → ]        │
│   • • • • • ● • • • • • ...        │  (dot nav)
└────────────────────────────────────┘
```

- 선택 시 즉시 `PUT /answers/:wordId` (debounced 300ms)
- 마지막 문항에서 "제출" — confirm("제출하시겠어요? 수정 불가")
- 중간 이탈 → 같은 jobId로 돌아오면 `currentAnswers`로 이어 풀기

### 5.3 결과 화면

```
┌────────────────────────────────────┐
│         🎉 제출 완료                │
│                                    │
│       17 / 20 정답   (85%)          │
│                                    │
│  오답 3개 다시 보기 ▼              │
│    • innovation → 혁신             │
│    • implement  → 구현하다         │
│    • concrete   → 구체적인         │
│                                    │
│  [ 단어장으로 돌아가기 ]            │
└────────────────────────────────────┘
```

---

## 6. 선생님 `/vocab/grading` 변경점

기존: localStorage printJob → O/X 수기 채점  
변경: **서버 jobs 리스트 메인**, localStorage는 fallback

```
┌ 출제·채점 ─────────────────────────────┐
│ [+ 학생 선택 → 시험지 만들기]          │
├────────────────────────────────────────┤
│ 대기중 4 · 응시중 2 · 제출됨 7 (최근 7일)│
├────────────────────────────────────────┤
│ 상태  학생      문항 점수    제출시각   │
│ ──────────────────────────────────────│
│ 제출됨 홍길동   20   17/20  오늘 14:23  │ → 클릭 시 [문항 상세]
│ 응시중 김철수   20   진행중  —          │
│ 대기  이영희    20   —       —          │ → [재촉] [무효화]
│ ...                                     │
└────────────────────────────────────────┘
```

- API: `GET /api/vocab/print/jobs` 로 리스트
- "상세" 모달: `GET /api/vocab/print/:jobId/answers` — 문항별 ○/× + 수기 재채점 버튼
- 수기 재채점: 기존 `POST /api/vocab/print/grade` (body: `job_id`, `results: [{word_id, correct}]`) 유지

---

## 7. 단계별 구현 플랜 (MVP 범위)

### Phase 3b-1 · DB + 서버 (0.5d)
- [ ] `043_vocab_print_taking.sql` 마이그레이션 + 원격 적용
- [ ] `vocab-handler.ts` 선생님 신규: `/assign`, `GET /jobs`, `GET /:jobId/answers`, `/void`
- [ ] `vocab-play-handler.ts` 학생 신규: `/print/pending`, `/print/:jobId`, `/start`, `/answers/:wordId`, `/submit`

### Phase 3b-2 · 학생 UI (1d)
- [ ] word-gacha `wawa-bridge.js` 에 `loadPrintPending`, `loadPrintJob`, `startPrintJob`, `savePrintAnswer`, `submitPrintJob` 추가
- [ ] word-gacha 홈에 알림 카드 컴포넌트 + 5초 폴링
- [ ] word-gacha 신규 페이지/화면 `#print-taking` (진행바 + 문항 + 선택지 + 네비)
- [ ] 결과 화면 (오답 리스트)

### Phase 3b-3 · 선생님 UI (0.5d)
- [ ] `VocabGradeTab.tsx` 서버 잡 리스트 연동 — 상단 "대기중/응시중/제출됨" 카운트 + 테이블
- [ ] 기존 "학생 선택 → 시험지 만들기"를 `POST /assign` 호출로 변경 (localStorage 의존 제거)
- [ ] 상세 모달 신규 — 문항별 ○/× + 수기 재채점

### Phase 3b-4 · 배포 + E2E (0.5d)
- [ ] 원격 migration 043
- [ ] 3앱 배포
- [ ] E2E: 선생님 assign → 학생 홈 알림 → 응시 → 제출 → 선생님 상세 확인 (end-to-end)

**총 예상: 2.5d**

---

## 8. 오픈 질문 (결정 필요)

1. **제한 시간** — 단어 시험지에 타이머 둘지? MVP는 **무제한** 권장 (기존 결시 타이머와 구분)
2. **재응시** — 한 번 제출하면 끝인지, 선생님이 "다시" 버튼 주는지? MVP: **한 번만** (필요시 선생님이 새 시험지 배정)
3. **4지선다 풀** — 오답 3개를 같은 학생의 다른 단어에서 뽑나 vs 학원 전체 단어 풀에서 뽑나? MVP: **학원 전체 풀** (혼자만 외운 단어로 출제되면 힌트 너무 셈)
4. **blank_type 활용** — 영→한만 낼지, 양방향 섞을지? MVP: **영→한 고정** (객관식 뜻 고르기). 빈칸 철자 문제는 v2.
5. **학부모 통보** — 시험 제출 시 학부모 리포트에 포함할지? MVP: X
6. **기존 localStorage-only printJob 데이터** — 마이그레이션 없이 deprecate, 새 시스템으로 전환
