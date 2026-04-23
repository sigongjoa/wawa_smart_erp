# 학생앱 시험 응시 기능 설계 (Student Exam Take-Flow)

> 선생님 ERP가 만든 기존 시험을 학생 앱에서 직접 풀어 제출하고 자동 채점까지 가는 흐름.
> 작성: 2026-04-23 / 근거 근거 현재 브랜치 master (commit `36cba08` 시점)

---

## 1. 현황 요약 (무엇을 재사용하고 무엇이 비어 있는가)

### 이미 존재하는 것 ✅
| 영역 | 자산 | 설명 |
|------|------|------|
| 시험 기간/시험지 메타 | `exam_periods`, `exam_papers`(021) | 제목·grade_filter만. **문제 내용 없음**. |
| 학생 배정 | `exam_assignments`(021+029) | `exam_date`, `exam_status(scheduled/in_progress/completed/absent)`, `drive_link`, `score` |
| PDF 유인물 | `paper_handouts`(027) + `paper_handout_distributions` | 중간/기말/수행평가 PDF. `file_key`로 R2 저장. 학생별 배포+열람시각. |
| 응시 타이머 | `exam_attempts`(033) | ready/running/paused/submitted/expired/voided + started_at + duration_minutes + pause_history. 서버 권위. |
| 학생 라우트 | `/api/play/exam-attempts/{active\|:id\|:id/submit}` | PIN 토큰 기반, 이미 구현됨 (`exam-attempt-handler.ts:433`). |
| 학생앱 라우트 | `ExamTimerPage.tsx` | 활성 attempt 폴링 + 남은시간 표시 + 제출 버튼. **문제 표시/답 입력은 없음**. |
| 파일 다운로드 | `GET /api/exam-papers/file/:key` | 선생님 JWT 전용. 서명URL 아님. |

### 비어 있는 것 ❌
1. **문제 내용 자체가 없음**: `exam_papers`에는 title만. 실제 문제는 선생님이 Google Drive나 R2 PDF로 따로 업로드. → 디지털 응시를 하려면 **paper_handouts PDF 1개를 해당 시험의 원본 문제지로 지정**하는 연결고리가 필요.
2. **답안 저장소 없음**: `exam_attempts`에 `submit_note`만 있고 객관식 답지/주관식 답지 필드 없음.
3. **정답키 없음**: 자동 채점의 근거가 되는 정답 테이블이 없음.
4. **학생 앱 UI**: 홈에 "곧 치를 시험" 카드 없음. 응시 페이지(PDF + OMR)가 없음.

---

## 2. 설계 결정 및 근거 (Tradeoffs)

### D1. 문제 소스 전략 — **paper_handouts PDF 재사용 + exam_paper_handout_link 조인**
- **선택**: paper_handouts.file_key의 R2 PDF를 그대로 활용.
- **근거**: 기존 선생님 워크플로(PDF 업로드) 유지. MVP에서 문제 DB 구축 공수 크고, 학교 시험지는 그림·수식이 많아 HTML 렌더 품질 리스크.
- **연결**: `exam_papers`에 `source_handout_id` 컬럼 1개 추가 → paper_handouts와 1:1 조인.
  - 대안 (보류): `exam_paper_handouts` 조인 테이블 (1:N) — 복수 PDF 지원 필요 시 확장.

### D2. 응시 방식 — **MVP: PDF 뷰어 + OMR 객관식 답안**
- **선택**: 학생은 PDF를 화면에서 읽고, 별도 패널에서 1~N번 객관식 답 선택(5지선다 기준).
- **근거**: 학교 지필평가 80~100%가 객관식. 주관식은 종이 시험과 병행 운영 가능.
- **주관식은 v2**: 필요시 `exam_answers.free_text TEXT` 확장.

### D3. 답안 저장 — **신규 `exam_answers` 테이블 (문제번호 단위)**
- **선택**: `(attempt_id, question_no, selected_choice)` 단위 레코드.
- **근거**: 
  - 각 문항별 timestamp 추적 가능 → 부정 방지/학습 분석
  - 재저장·부분 채점·문항별 응답률 통계 등 향후 확장 용이
  - JSON blob(`exam_attempts.answers_json`)보다 쿼리·집계 자유로움
- 저장은 **debounced upsert** (학생이 찍을 때마다 서버로 즉시)

### D4. 정답키 — **`exam_paper_answers` 테이블**
- `(exam_paper_id, question_no, correct_choice, points)` 기본. 추후 `correct_pattern` (정규식/멀티정답) 확장 가능.
- 선생님이 ERP에서 시험지 업로드 시 정답 입력 UI 필요 (이번 스코프 아님, 이번은 "입력 API+학생 측 읽기 금지"만 준비).

### D5. 타이머 권위 — **서버 권위 유지 (현상 유지)**
- `exam_attempts.started_at + duration_minutes` → 서버가 `remainingSeconds` 계산. 학생 클라는 5초 폴링 + 1초 local count.
- 자동 제출: 서버 사이드 cron (이미 있음: `* * * * *` workers trigger) 또는 학생 클라가 0에 도달 시 submit 호출. 두 경로 모두 서버에서 멱등 처리.

### D6. 응시 모드 분리 — **offline_only vs digital**
- `exam_assignments.mode` 신규 컬럼: `'offline'` (기존 종이 시험) / `'digital'` (학생 앱에서 응시). 기본 `offline`.
- 기존 모든 플로우는 그대로 + `mode='digital'`인 배정만 학생 홈에 노출.

---

## 3. API 설계

### 3.1 학생 PIN 토큰 (`/api/play/exam/*`, 신규 핸들러 `exam-play-handler.ts`)

```
GET  /api/play/exams                           — 본인에게 열려있는 시험 목록 (digital mode만)
  → [{ assignmentId, paperTitle, examDate, durationMinutes, attemptStatus, questionCount }]

GET  /api/play/exams/:assignmentId              — 상세(응시 준비 화면용)
  → { paper: {id, title}, durationMinutes, examDate, questionCount, handout: {fileUrl} | null, attempt?: ExamAttemptDto }

POST /api/play/exams/:assignmentId/start        — attempt 생성 + started_at=now + status=running
  제약: exam_date ≤ today ≤ exam_date+grace, exam_status=='scheduled' or 'in_progress'
  → { attempt: ExamAttemptDto }

GET  /api/play/exam-attempts/:id/pdf            — 시험지 PDF 스트림 (학생 본인 attempt 한정, Authorization 헤더 필요)
  → application/pdf (signed TTL=attempt 유효시간)

PUT  /api/play/exam-attempts/:id/answers/:qno   — 답 저장 (upsert)
  body: { choice: 1..5 | null }
  → { savedAt }

GET  /api/play/exam-attempts/:id/answers        — 현재 내 답안 스냅샷 (재진입 시)
  → { answers: [{ questionNo, choice, savedAt }] }

POST /api/play/exam-attempts/:id/submit          (기존) — 최종 제출 → 자동 채점 트리거
  → { status: 'submitted', score, correctCount, totalCount, breakdown: [...] }
```

### 3.2 선생님 JWT (`/api/exam-papers/*` 확장)

```
POST /api/exam-papers/:id/link-handout          — 시험지에 paper_handouts PDF 연결
  body: { handoutId }

PUT  /api/exam-papers/:id/answer-key            — 정답키 업로드
  body: { answers: [{questionNo, correctChoice, points}] }

PATCH /api/exam-mgmt/:periodId/assignments/:id — `mode: 'digital'|'offline'` 토글 (기존 라우트에 필드 추가)
```

### 3.3 재사용하는 기존 것

- `GET /api/play/exam-attempts/active` — 이미 구현, 그대로 사용 (HomePage 자동 진입)
- `GET /api/play/exam-attempts/:id` — 그대로
- `POST /api/play/exam-attempts/:id/submit` — 내부 로직에 **자동 채점** 추가

---

## 4. 데이터 모델 변경

### 4.1 신규 테이블 (마이그레이션 `042_exam_digital_taking.sql`)

```sql
-- 시험지 ↔ 문제PDF 연결 + 문제 수
ALTER TABLE exam_papers ADD COLUMN source_handout_id TEXT;   -- paper_handouts.id
ALTER TABLE exam_papers ADD COLUMN question_count  INTEGER;  -- 객관식 총 문항
ALTER TABLE exam_papers ADD COLUMN duration_minutes INTEGER DEFAULT 50;

-- 응시 모드
ALTER TABLE exam_assignments ADD COLUMN mode TEXT DEFAULT 'offline';
  -- 'offline' | 'digital'

-- 정답키 (문제지당)
CREATE TABLE exam_paper_answers (
  exam_paper_id  TEXT NOT NULL,
  question_no    INTEGER NOT NULL,
  correct_choice INTEGER,      -- 1..5 (null 이면 서답형)
  points         REAL DEFAULT 1.0,
  PRIMARY KEY (exam_paper_id, question_no),
  FOREIGN KEY (exam_paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE
);

-- 학생 답안 (응시건당 × 문항번호)
CREATE TABLE exam_answers (
  attempt_id    TEXT NOT NULL,
  question_no   INTEGER NOT NULL,
  selected_choice INTEGER,       -- 1..5 or null
  saved_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (attempt_id, question_no),
  FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE
);
CREATE INDEX idx_exam_answers_attempt ON exam_answers(attempt_id);

-- 채점 결과 캐시 (제출 시 계산)
ALTER TABLE exam_attempts ADD COLUMN auto_score      REAL;
ALTER TABLE exam_attempts ADD COLUMN auto_correct    INTEGER;
ALTER TABLE exam_attempts ADD COLUMN auto_total      INTEGER;
```

### 4.2 인덱스·제약 고려
- `exam_answers`: (attempt_id, question_no) PK → upsert `INSERT ... ON CONFLICT DO UPDATE`
- `exam_paper_answers`: `points REAL` 두어 부분 점수 대비
- 기존 `uq_attempt_per_assignment` (033)에 의해 한 배정당 attempt 1개 → 재응시 정책 결정 시 해제 필요

---

## 5. 학생 UX 플로우

```
홈 (HomePage)
 ├─ "곧 치를 시험" 카드 (digital mode only)
 │   오늘/이번주 예정된 것만 표시. 클릭 → 응시 준비
 └─ "응시 중인 시험" 뱃지 (active attempt 있으면 자동 강제 이동 — 기존 ExamTimerPage 로직 유지)

/exam/:assignmentId (응시 준비)
 ├─ 시험지 정보 (제목, 문항수, 시간, 시험일)
 ├─ 주의사항: 새로고침/이탈 금지, 자동 제출, 부정 감지
 └─ [시험 시작] 버튼 → POST /api/play/exams/:id/start → 200 이면 /exam/:id/take

/exam/:id/take (응시 중)  [신규 페이지: ExamTakePage]
 ┌────────────────────────┬─────────────────────────┐
 │ 좌: PDF 뷰어            │ 우: OMR 답안카드        │
 │  - fetch /attempt/:id/pdf│  1.  ①②③④⑤           │
 │  - pan/zoom, 페이지 이동 │  2.  ①②③④⑤           │
 │                         │  ...  (가로/세로 반응형)│
 │                         │  [남은 시간 12:34]      │
 │                         │  [제출] (확인 dialog)   │
 └────────────────────────┴─────────────────────────┘
 - 답 클릭 → PUT /attempt/:id/answers/:qno (debounced 300ms)
 - 5초마다 /attempt/:id polling → 남은시간 동기화, status 변경시 결과로 자동 이동
 - 0초 도달 시 자동 submit 호출 (서버에서 이미 expired면 멱등 무시)

/exam/:id/result (제출 완료)
 - 점수, 정답수/총문항, 문항별 correct/wrong ○×
 - [홈으로] / [해설 보기 — v2]

결시/이탈:
 - deadline 지나면 cron 또는 제출 시 서버가 status=expired로 전환 → 학생에게 "시간 초과로 제출됨" 토스트
 - 브라우저 닫기/새로고침 시 재진입 시 /active로 복원
```

---

## 6. 타이머/자동 제출/결시 처리

| 상황 | 트리거 | 처리 |
|------|-------|------|
| 학생 제출 | 버튼 | `POST /submit` → 자동 채점 → status=submitted |
| 시간 초과 (클라가 0 감지) | 클라 | `POST /submit` (서버가 멱등, expired로 변경) |
| 시간 초과 (학생 off) | 서버 cron `* * * * *` | `UPDATE exam_attempts SET status='expired'` + 자동 채점 |
| 시작 안 함 | exam_date+1일 경과 | cron: `exam_assignments.exam_status='absent'` (기존 로직 활용) |
| 이탈/새로고침 | 클라 마운트 | `/active` → 있으면 강제 진입, `/answers`로 저장본 복원 |

자동 채점 함수 (서버):
```ts
async function autoGrade(attemptId, paperId) {
  const answers = SELECT question_no, selected_choice FROM exam_answers WHERE attempt_id=?
  const key     = SELECT question_no, correct_choice, points FROM exam_paper_answers WHERE exam_paper_id=?
  let correct=0, total=0, scoreSum=0
  for (q of key) {
    total += 1
    if (q.correct_choice == null) continue // 서답형 skip
    const a = answers.find(a => a.question_no === q.question_no)
    if (a?.selected_choice === q.correct_choice) { correct++; scoreSum += q.points }
  }
  UPDATE exam_attempts SET auto_score=scoreSum, auto_correct=correct, auto_total=total
  UPDATE exam_assignments SET score=scoreSum WHERE id=?
}
```

---

## 7. 단계별 구현 플랜

### Phase 1 — DB + 서버 골격 (0.5d)
- [ ] `042_exam_digital_taking.sql` 마이그레이션 작성 + 원격 적용
- [ ] `exam-play-handler.ts` 신규 파일 (exams 라우트) 골격
- [ ] `exam-paper-handler.ts`에 link-handout / answer-key PATCH 추가
- [ ] index.ts 라우터 분기 추가 `/api/play/exams`

### Phase 2 — 응시 Lifecycle (1d)
- [ ] `start` 엔드포인트 (exam_attempts insert + status=running)
- [ ] `/pdf` 엔드포인트 (R2 스트림, 본인 attempt 검증)
- [ ] `/answers/:qno` PUT (upsert) + GET 전체
- [ ] `submit` 기존 핸들러에 `autoGrade` 호출 추가

### Phase 3 — 학생 UI (1.5d)
- [ ] `HomePage.tsx`에 "곧 치를 시험" 카드 섹션 추가
- [ ] `/exam/:id` 응시 준비 페이지 (`ExamReadyPage.tsx`)
- [ ] `/exam/:id/take` 응시 페이지 (`ExamTakePage.tsx`)
  - `react-pdf`로 PDF 뷰어 (이미 desktop에 있는 걸로 짐작 — 없으면 pdf.js 간단 wrapper)
  - OMR 답안카드 컴포넌트 (`AnswerSheet.tsx`)
- [ ] `/exam/:id/result` 결과 페이지 (`ExamResultPage.tsx`)

### Phase 4 — 선생님 Side (0.5d)
- [ ] ExamPapersPage에서 "문제지 PDF 연결" UI (handout selector)
- [ ] "정답키 입력" UI — 모달에서 1~N번 1~5 드롭다운
- [ ] ExamManagementPage의 배정 편집에서 `mode` 토글 버튼

### Phase 5 — 자동화 + E2E (0.5d)
- [ ] 자동 만료 cron 로직 추가 (`workers/src/cron/*`)
- [ ] E2E 유즈케이스 작성 (UC-F 학생 응시 전체 흐름, UC-G 자동 만료)
- [ ] 배포 + 원격 migration

**총 예상: 4d**

---

## 8. 신규 파일 목록

### Workers
- `workers/migrations/042_exam_digital_taking.sql`
- `workers/src/routes/exam-play-handler.ts` (신규)
- `workers/src/cron/expire-exam-attempts.ts` (신규 — 있으면 확장)

### 학생 앱
- `apps/student/src/pages/ExamReadyPage.tsx`
- `apps/student/src/pages/ExamTakePage.tsx`
- `apps/student/src/pages/ExamResultPage.tsx`
- `apps/student/src/components/PdfViewer.tsx`
- `apps/student/src/components/AnswerSheet.tsx`
- `apps/student/src/hooks/useExamAttempt.ts` (폴링·자동제출 공용 훅)

### 선생님 앱
- `apps/desktop/src/pages/ExamPapersPage.tsx` 확장 (Handout 연결 UI, 정답키 모달)
- `apps/desktop/src/components/AnswerKeyEditor.tsx` (신규)

### E2E
- `apps/student/e2e/exam-take-live.spec.ts`
- `apps/desktop/e2e/exam-answer-key-live.spec.ts`

---

## 9. 오픈 질문 / 리스크

1. **재응시 정책** — 현재 `uq_attempt_per_assignment`. 재시험은 assignment를 새로 생성해 운영 (exam_periods의 rescheduled). 만약 "동일 assignment 여러 attempt"가 필요하면 제약 해제 + attempt 번호 추가.
2. **부정 방지 수준** — MVP는 새로고침 복원만. 탭 전환 감지/전체화면 잠금 등은 v2.
3. **PDF 파일 크기** — 과목별 20+ MB 가능. R2 서명 URL로 직접 전달 or 스트림 프록시. 서명 URL이 효율적 (현재는 스트림 프록시 형식).
4. **모바일** — 학생 앱은 모바일 주사용. 좌우 split 대신 탭 전환(문제지/답안) UX 필요. 디자인 단계에서 모바일 우선.
5. **수식·그림 수동 채점** — 서답형 문항은 수동 채점용 `teacher_grading_pending` 상태 추가? 또는 선생님 ERP의 기존 "점수 입력" UI로 흡수?
6. **정답키 입력 부하** — 선생님이 한 시험지에 20~30문항 정답을 일일이 입력하는 부담. v2에서 CSV import / OMR 용지 사진 업로드 → AI OCR.

---

## 10. 기존 시스템과의 공존

- **기존 결시 타이머 유즈케이스 (종이 시험)**: `mode='offline'` 유지. ExamTimerPage는 그대로 작동.
- **신규 디지털 응시**: `mode='digital'`일 때만 학생 홈에 카드 노출. 동일 `exam_attempts` 테이블을 공유하므로 타이머/감독 로직은 재사용.
- **선생님 화면**: 기존 채점 입력(수동 점수) UI도 유지. 디지털 응시건은 `auto_score`가 채워져 있으니 기본값으로 표시.

---

## Next Step

이 설계로 OK면 `/sc:implement Phase 1` 또는 수동으로 Phase 1부터 구현 시작.
Phase 1~5 전체를 한 번에 진행하면 대략 4일 작업 분량.
