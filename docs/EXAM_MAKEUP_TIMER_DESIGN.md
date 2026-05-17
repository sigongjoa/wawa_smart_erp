# 시험 결시 · 개별 타이머 재시험 설계 (v1)

**상태**: SPEC ONLY (구현 X)
**전제 조사**: 본 문서 §0 "현황" 참조 — Explore 에이전트가 코드베이스 스캔한 결과
**다음 단계**: 본 문서 합의 후 `/sc:implement` 로 마이그레이션 → 핸들러 → UI 순서 구현

---

## 0. 현황 한 줄 요약

| 영역 | 상태 |
|------|------|
| 결시 등록 (`exam_status='absent'`) | ✅ 구현 |
| 재시험 일정 배정 (`rescheduled_date/start/end`) | ✅ 구현 |
| 재시험 adhoc_sessions 자동 생성 | ✅ 구현 (reason='시험재시험') |
| 재시험 응시 시 **개별 타이머** | ❌ **미구현** ← 본 설계 대상 |
| 재시험 완료 → exam_status='completed' 자동 갱신 | ❌ 미구현 |
| 학생 화면에서 "내 재시험" 보기 | ❌ 미구현 |

---

## 1. 문제 정의

### 시나리오 (실제 운영 — 정정됨)
- **평일 정규 수업이 그대로 진행 중** (다른 학생들은 평소처럼 학습)
- 그 안에 시험을 결시한 학생 한두 명이 함께 출석 중
- 교사가 그 학생만 따로 "**지금부터 시험 모드**" 로 전환 → 본인 책상에서 시험지 풀고 본인 화면(태블릿)에 자기 타이머
- 시험 시간은 기존 정기고사 시간(예: 50분) **그대로**
- 시험 도중에도 옆자리 학생들은 정상 수업 (수업 타이머는 별도로 계속 돔)
- 한 수업 시간(예: 90분)에 50분짜리 시험을 끼워 푸는 형태

### 요구
1. **수업 입실(realtime_session) 과 시험 응시(exam_attempt) 동시 병행** — 학생은 이미 입실 상태이고, 그 위에 시험 타이머가 별도로 시작됨
2. **개별 시작·종료** — 학생별로 교사가 트리거 (3명 결시생 있으면 카드 3개 시작 버튼)
3. **자동 종료** — 50분 지나면 자동 마감 (UI 빨간 테두리 + 학생 화면 강제 제출 화면)
4. **일시정지** — 교사 승인 시 pause/resume (사유 기록 필수, 화장실 등)
5. **자동 응시 처리** — 종료 시 `exam_assignments.exam_status = 'completed'`
6. **수업 시간(realtime_session) 은 영향 없음** — 학생은 시험 끝나고도 수업 계속
7. **테넌트 격리** — 학원·담당 교사 검증
8. **학생 PIN 로그인 환경 호환** — 학생 화면은 PIN 인증 (이미 입실해 있는 동일 세션)

---

## 2. 데이터 모델 (마이그레이션 033)

### 2.1 신규 테이블: `exam_attempts`

기존 `realtime_sessions` 를 재활용하지 않는 이유:
- 수업 입실(realtime_session) **과 동시에** 시험 응시(exam_attempt) 가 진행되어야 함 → 두 lifecycle 가 병행
- realtime_session 일시정지 ≠ exam_attempt 일시정지 (시험만 화장실로 멈출 수도, 수업은 계속)
- 시험은 제출/만료/채점 자체 상태머신 보유

→ **별도 테이블 + realtime_session_id 로 느슨한 연결**

```sql
CREATE TABLE exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_assignment_id INTEGER NOT NULL,        -- FK → exam_assignments(id)
  student_id INTEGER NOT NULL,                -- FK (denorm; 격리 검증 빠르게)
  academy_id INTEGER NOT NULL,                -- 테넌트 격리
  realtime_session_id INTEGER,                -- 어떤 수업 입실 중에 친 시험인지 (nullable: 추후 회고 분석용)

  duration_minutes INTEGER NOT NULL,          -- 이 시험의 총 제한시간 (정기고사 원본 시간 그대로 복사)

  status TEXT NOT NULL DEFAULT 'ready',
    -- ready    : 배정만 됨, 미시작
    -- running  : 진행 중
    -- paused   : 일시정지
    -- submitted: 학생 제출
    -- expired  : 시간 종료 (자동)
    -- voided   : 무효 처리

  started_at TEXT,                            -- ISO8601 (running/이후)
  ended_at TEXT,                              -- 종료 시각 (submitted/expired/voided)

  pause_history TEXT DEFAULT '[]',            -- JSON: [{pausedAt, resumedAt, reason, byUserId}]
  total_paused_seconds INTEGER DEFAULT 0,    -- 누적 정지 시간 (자동 계산)

  proctor_user_id INTEGER,                    -- 시작 처리한 감독 교사 (audit)
  submit_note TEXT,                           -- 제출 시 비고 (옵션)

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (exam_assignment_id) REFERENCES exam_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (academy_id) REFERENCES academies(id)
);

CREATE INDEX idx_exam_attempts_assignment ON exam_attempts(exam_assignment_id);
CREATE INDEX idx_exam_attempts_status_acad ON exam_attempts(academy_id, status);
CREATE UNIQUE INDEX uq_attempt_per_assignment ON exam_attempts(exam_assignment_id);
  -- 한 배정에 attempt 1개만 (재시도 정책 결정 전까지)
```

**핵심 결정**:
- `total_paused_seconds` 를 컬럼으로 두는 이유: 종료 판단 시 `now > started_at + duration + paused_seconds` 만 비교하면 됨 (JSON 파싱 불필요). pause/resume 이벤트마다 갱신.
- `expired` 는 클라이언트가 보고하지 않고 **read 쿼리 시 자동 계산** + 백그라운드 cron 으로 batch 갱신 (Cloudflare Workers Cron Trigger).
- `uq_attempt_per_assignment` UNIQUE 제약 → "재배정 시 무효처리 정책" 결정 후 완화 가능 (지금은 단순화).

### 2.2 기존 테이블 — 변경 없음

본 시나리오에서는 학생이 **정규 수업 입실(realtime_session) 중** 에 시험을 치므로:
- `adhoc_sessions` 추가 불필요 (별도 회차 안 만듦)
- `exam_assignments.rescheduled_date` 도 사실상 "정규 수업 중에 치를 예정" 의미
- `realtime_sessions` 도 변경 없음 — exam_attempts 가 단방향 FK 보유

→ 기존 정기고사 시간(`exam_papers.duration_minutes` 또는 hardcoded 50분)을 attempt 생성 시 복사.

---

## 3. API 설계

베이스: `/api/exam-attempts/*` (신규 핸들러 `workers/src/routes/exam-attempt-handler.ts`)

| 메서드 | 경로 | 권한 | 용도 |
|--------|------|------|------|
| `POST` | `/api/exam-attempts` | instructor/admin | 시험 시작 (ready→running) |
| `POST` | `/api/exam-attempts/:id/pause` | instructor/admin | 일시정지 (사유 필수) |
| `POST` | `/api/exam-attempts/:id/resume` | instructor/admin | 재개 |
| `POST` | `/api/exam-attempts/:id/submit` | student PIN OR instructor | 제출 |
| `POST` | `/api/exam-attempts/:id/void` | admin only | 무효 처리 |
| `GET`  | `/api/exam-attempts/today` | instructor | 오늘 내 담당 attempt 전체 |
| `GET`  | `/api/exam-attempts/:id` | instructor + 본인 학생 | 단건 조회 (학생용 폴링) |
| `POST` | `/api/exam-attempts/expire-batch` | cron only | 만료 일괄 처리 |

### 3.1 시작 요청 예시

```http
POST /api/exam-attempts
Authorization: Bearer <jwt>
{
  "examAssignmentId": 142,
  "durationMinutes": 50
}
```

응답:
```json
{
  "id": 17,
  "status": "running",
  "startedAt": "2026-04-18T05:00:12Z",
  "deadlineAt": "2026-04-18T05:50:12Z",
  "pausedSeconds": 0
}
```

### 3.2 학생 폴링 (PIN 인증)

학생 화면은 5초마다 `GET /api/exam-attempts/:id` 호출 → 서버가 `remainingSeconds` 계산해서 내려줌.

```json
{
  "id": 17,
  "status": "running",
  "remainingSeconds": 2418,
  "isPaused": false,
  "studentName": "김민준"
}
```

> **WebSocket 안 쓰는 이유**: Cloudflare Workers + D1 환경에서 5초 폴링이면 충분. 동시 시험 인원 < 30명이라 부하 없음.

### 3.3 만료 자동 처리 (Cron)

`workers/src/cron/expire-exam-attempts.ts`:
```typescript
export async function expireExpiredAttempts(env) {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE exam_attempts
       SET status='expired', ended_at=?, updated_at=?
     WHERE status IN ('running','paused')
       AND datetime(started_at, '+' || (duration_minutes*60 + total_paused_seconds) || ' seconds') < ?
  `).bind(now, now, now).run();
}
```

`wrangler.toml` 에 1분 단위 cron 등록.

### 3.4 종료 시 후처리

`submit` / `expire` 시:
```sql
UPDATE exam_assignments
   SET exam_status = 'completed'
 WHERE id = ?
```
점수 입력은 별도 흐름 (기존 ExamManagementPage 채점 모달 재활용).

---

## 4. UI 설계

### 4.1 교사 화면 (Desktop) — 신규 전용 페이지

**신규 페이지**: `apps/desktop/src/pages/ExamTimerPage.tsx`
**진입 경로**: 사이드바 "시험 타이머" 메뉴 (기존 TimerPage 와 분리)
**철학**: 수업 입실 관리(TimerPage) 와 시험 응시 관리(ExamTimerPage) 완전 분리. 교사는 시험 감독 시 이 페이지만 띄워놓음.

#### 레이아웃 (좌: 학생 선택 / 우: 활성 타이머 카드)

```
┌─────────────────────────────────────────────────────────┐
│ 시험 타이머                                  [4월 정기고사 ▾]│
├─────────────┬───────────────────────────────────────────┤
│ 응시 가능 학생 │ 진행 중인 시험                            │
│             │                                           │
│ ☐ 김민준    │ ┌─────────────────┐  ┌─────────────────┐ │
│   4학년3반  │ │ 김민준 · 영어    │  │ 이서연 · 수학    │ │
│   영어 50분 │ │  ┌────────────┐ │  │  ┌────────────┐ │ │
│             │ │  │  28 : 32   │ │  │  │  41 : 08   │ │ │
│ ☐ 이서연    │ │  │ running    │ │  │  │ paused     │ │ │
│   4학년1반  │ │  └────────────┘ │  │  └────────────┘ │ │
│   수학 60분 │ │  [⏸정지][✓제출] │  │  [▶재개][✓제출] │ │
│             │ └─────────────────┘  └─────────────────┘ │
│ ☐ 박지호    │                                           │
│   4학년2반  │ ┌─────────────────┐                       │
│   영어 50분 │ │ 박지호 · 영어    │                       │
│             │ │   ─ : ─         │                       │
│ [선택 시작] │ │  expired         │                       │
│             │ │  [채점하러 가기]  │                       │
│             │ └─────────────────┘                       │
└─────────────┴───────────────────────────────────────────┘
```

#### 좌측: 학생 선택 패널
- 필터: 시험 종류(`exam_periods`) 드롭다운 → 그 시험에 결시 배정된(`exam_status='absent'` 또는 `'rescheduled'`) 본인 담당 학생만 리스트
- 다중 체크 가능 → 하단 `[선택 시작]` 으로 한 번에 N명 시작
- 학생당 정보: 이름·반·시험과목·시간(원본 정기고사 시간 그대로 표시)
- 이미 attempt 진행 중인 학생은 회색 + "진행 중" 라벨

#### 우측: 활성 타이머 카드
- 그리드 자동 배치 (1~6명 가정, `repeat(auto-fill, minmax(280px, 1fr))`)
- 각 카드 1초 자체 카운트다운 (서버 폴링 5초)
- 상태별 색상: ready=회색 / running=파랑 / paused=노랑 / expired=빨강 / submitted=초록
- `remainingSeconds <= 60` → 카드 빨간 테두리 + 깜빡임
- `remainingSeconds <= 0` → 자동 `expired`, "채점하러 가기" 버튼 (ExamManagementPage 점수 입력 페이지로)
- 일시정지 시 사유 입력 모달 (필수)
- 제출 시 confirm 다이얼로그 (실수 방지)

#### 동선
1. 교사가 사이드바 "시험 타이머" 클릭
2. 상단 시험 종류 선택 → 좌측에 결시 학생 자동 로드
3. 시험 응시할 학생 체크 → "선택 시작" → 우측에 카드 등장
4. 시험 진행 중 일시정지/재개 자유 (사유 기록)
5. 시간 종료 또는 학생 제출 → 카드가 expired/submitted 로 변경
6. 채점하러 가기 → 점수 입력 → exam_assignments.exam_status='completed' 확정

### 4.2 학생 화면 — 자동 시험 모드 진입

**신규 페이지**: `apps/student/src/pages/ExamTimerPage.tsx`
**진입 방식**:
- 학생은 평소처럼 PIN 로그인 후 학습 화면(HomePage 등)에서 수업
- 교사가 "시험 시작" 누르면 → 학생 화면이 **자동 전환** (HomePage 폴링 5초마다 본인의 active exam_attempt 체크)
- 시험 모드 진입 시 모든 다른 메뉴 잠금 (전체화면 카운트다운만)
- 시험 종료(submit/expired) 시 자동으로 원래 화면 복귀

레이아웃 (전체화면):
```
┌────────────────────────┐
│  김민준 학생            │
│  4월 정기고사 · 영어     │
├────────────────────────┤
│                        │
│       28 : 32          │  ← 거대한 카운트다운
│                        │
│  남은 시간              │
├────────────────────────┤
│  ⏸ 일시정지 중이에요     │  ← paused일 때만
│  사유: 화장실           │
├────────────────────────┤
│  [✓ 제출]              │  ← 누르면 confirm 모달
└────────────────────────┘
```

핵심:
- 폴링 1회 실패 시 즉시 재시도, 3회 실패 시 "교사를 부르세요" 표시
- `remainingSeconds <= 0` 시 자동 제출 시도 (서버는 expired로 받음)
- `prefers-reduced-motion` 시에도 카운트다운만 유지 (장식 애니메이션 없음)

---

## 5. 권한 / 테넌트 격리

| 행위 | 검증 |
|------|------|
| 시작·정지·재개 | `exam_assignment.academy_id == jwt.academyId` AND (admin OR `student_teachers` 매칭) |
| 학생 폴링 | PIN 세션의 `student_id == exam_attempt.student_id` |
| 제출 | 학생 본인 OR 담당 교사 |
| 무효 처리 | admin 만 |

기존 패턴 그대로 적용 (commit `c2d3e36` 참조).

---

## 6. 결정 시급 항목 (구현 전 합의 필요)

1. **재시도 정책**: 한 배정에 attempt 1개만? 아니면 voided 후 재배정 허용?
   → 본 설계는 1개 (UNIQUE 제약). 합의 후 완화 가능.

2. **일시정지 한도**: 무제한 / 누적 N분 / 횟수 제한?
   → 본 설계는 무제한 + 사유 의무. 합의 시 `total_paused_seconds <= duration*0.2` 같은 캡 추가.

3. **학생 본인 제출 허용?** 아니면 교사만?
   → 본 설계는 둘 다 허용. 학생 제출이 부담이면 교사만으로 좁히기 가능.

4. **expired 시 점수 처리**: 자동 0점? 아니면 채점 대기?
   → 본 설계는 채점 대기 (`exam_status=completed` 만 변경, score 입력은 별도).

---

## 7. 구현 순서 (`/sc:implement` 시 권장)

1. 마이그레이션 033 작성 (exam_attempts 테이블) + 로컬 wrangler d1 migrations apply
2. `workers/src/routes/exam-attempt-handler.ts` 작성 (POST/GET/PATCH 6개)
3. wrangler.toml cron trigger + `workers/src/cron/expire-exam-attempts.ts`
4. **데스크톱 신규 페이지** `apps/desktop/src/pages/ExamTimerPage.tsx` (좌: 학생 선택 / 우: 활성 카드 그리드) + 사이드바 "시험 타이머" 메뉴 등록 + 라우터
5. 학생 `apps/student/src/pages/ExamTimerPage.tsx` + HomePage 폴링 → 자동 진입 라우팅
6. E2E 시나리오: 학생 입실 → 교사 시험 시작 → 학생 화면 자동 전환 → 일시정지/재개 → 제출 → exam_status='completed' + 학생 화면 원복 검증

---

## 8. 비범위 (이번에 안 함)

- 시험지 자체 디지털화 (PDF/객관식 자동채점) — 별도 트랙
- 부정행위 탐지 (탭 전환 감지 등) — 신뢰 기반 운영 우선
- 다중 감독관 동시 모니터링 — 1명 감독 가정
- 모바일 학생 화면 (지금은 데스크톱/태블릿 가정)
