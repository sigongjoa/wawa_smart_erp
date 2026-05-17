# 분할 보강 (Split Makeup) 시스템 설계

## 1. 문제 정의

### 1.1 현재 한계
현재 보강 시스템은 **1 결석 = 1 보강 세션** 구조. 다음 시나리오 불가능:
- 1.5시간 결석 → 30분 × 3회로 나눠 보강
- 주중 자투리 시간을 활용한 보강 (월 20분 + 수 40분 + 금 30분)
- 진행 중 상태 (1h/1.5h 완료 = 67%)

### 1.2 현실 운영 요구
- 학부모 일정 제약: 한 번에 1.5h 빼기 어려움
- 학생 집중도: 긴 보강보다 분할이 효과적
- 공간 제약: 정규 수업 틈새에 끼워넣어야 함
- 학원 매출 보호: **시간 단위 정산**이 필요 (완료 시간 = 정산 시간)

### 1.3 스키마 제약
```sql
-- 현재 (migration 008)
CREATE TABLE makeups (
  id TEXT PRIMARY KEY,
  absence_id TEXT NOT NULL,
  scheduled_date DATE,
  completed_date DATE,
  status TEXT DEFAULT 'pending',
  UNIQUE(absence_id)              -- ← 1:1 강제
);
```

---

## 2. 설계 원칙

| 원칙 | 내용 |
|---|---|
| 하위 호환 | 기존 1:1 보강 데이터 손실 없이 마이그레이션 |
| 최소 침습 | 기존 API 엔드포인트 의미 유지, 세션 API 추가 |
| 자동 집계 | `completed_minutes / required_minutes` 자동 계산 |
| 타이머 연동 | `realtime_sessions.makeup_session_id`로 체크인 자동 반영 |
| 멀티 테넌트 | 기존 `students JOIN academy_id` 패턴 유지 |

---

## 3. 데이터 모델

### 3.1 테이블 구조

**전체 구조 (1 absence : 1 makeup : N makeup_sessions)**

```
absences (결석 사실)
  └─ makeups (보강 총량 — 필요 시간, 진행률)
        └─ makeup_sessions (개별 회차 — 시간대, 완료 여부)
              └─ realtime_sessions (체크인 로그)
```

### 3.2 마이그레이션 SQL (migration 028)

```sql
-- 028_makeup_split_sessions.sql

-- ── (1) makeups 테이블 확장 ──
ALTER TABLE makeups ADD COLUMN required_minutes INTEGER DEFAULT 0;
ALTER TABLE makeups ADD COLUMN completed_minutes INTEGER DEFAULT 0;

-- 기존 단일 시간 컬럼은 "대표 시간"으로 보존 (조회 편의)
-- scheduled_date, scheduled_start_time, scheduled_end_time은 세션 요약용

-- ── (2) makeup_sessions 신규 ──
CREATE TABLE IF NOT EXISTS makeup_sessions (
  id TEXT PRIMARY KEY,
  makeup_id TEXT NOT NULL,
  session_index INTEGER NOT NULL,           -- 1, 2, 3 회차
  scheduled_date DATE NOT NULL,
  scheduled_start_time TEXT NOT NULL,       -- 'HH:MM'
  scheduled_end_time TEXT NOT NULL,         -- 'HH:MM'
  duration_minutes INTEGER NOT NULL,        -- end - start (검증용)
  status TEXT DEFAULT 'scheduled',          -- scheduled | completed | cancelled
  completed_at TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (makeup_id) REFERENCES makeups(id) ON DELETE CASCADE
);

CREATE INDEX idx_makeup_sessions_makeup ON makeup_sessions(makeup_id);
CREATE INDEX idx_makeup_sessions_date ON makeup_sessions(scheduled_date);
CREATE INDEX idx_makeup_sessions_status ON makeup_sessions(status);

-- ── (3) 기존 데이터 백필 ──
-- 기존 makeups 중 scheduled_date가 있는 건은 session 1건으로 이관
INSERT INTO makeup_sessions (id, makeup_id, session_index, scheduled_date,
                              scheduled_start_time, scheduled_end_time,
                              duration_minutes, status, completed_at, notes)
SELECT
  'msess_' || substr(id, 1, 16),
  id,
  1,
  scheduled_date,
  COALESCE(scheduled_start_time, '00:00'),
  COALESCE(scheduled_end_time, '01:00'),
  60,  -- 기본 60분 (기존 데이터)
  CASE WHEN status = 'completed' THEN 'completed' ELSE 'scheduled' END,
  CASE WHEN status = 'completed' THEN completed_date || ' 00:00:00' ELSE NULL END,
  COALESCE(notes, '')
FROM makeups
WHERE scheduled_date IS NOT NULL;

-- ── (4) 기본값 채우기 ──
UPDATE makeups SET required_minutes = 60 WHERE required_minutes = 0;
UPDATE makeups SET completed_minutes = 60 WHERE status = 'completed';

-- ── (5) realtime_sessions에 session 참조 추가 ──
ALTER TABLE realtime_sessions ADD COLUMN makeup_session_id TEXT;
CREATE INDEX idx_realtime_sessions_makeup_session
  ON realtime_sessions(makeup_session_id);
```

### 3.3 상태 전이

```
makeups.status:
  pending   → 결석 등록 직후 (세션 0개)
  scheduled → 1개 이상 세션 예정됨 (미완료 존재)
  in_progress → 일부 완료, 일부 남음 (completed_minutes < required_minutes)
  completed → completed_minutes >= required_minutes

makeup_sessions.status:
  scheduled → 예정
  completed → 완료 (completed_at 설정)
  cancelled → 취소 (진행률 계산에서 제외)
```

### 3.4 불변식 (Invariants)

- `makeup_sessions.duration_minutes = (end_time - start_time)`
- `makeups.completed_minutes = SUM(sessions WHERE status='completed').duration_minutes`
- `makeups.status` 자동 계산 (트리거 또는 핸들러에서 갱신)
- `SUM(sessions.duration_minutes) <= required_minutes + tolerance(30)` — 과다 예약 방지 (UI 경고)

---

## 4. API 설계

### 4.1 신규 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/makeup/:id/sessions` | 보강 회차 목록 |
| POST | `/api/makeup/:id/sessions` | 회차 추가 |
| PATCH | `/api/makeup/:id/sessions/:sid` | 회차 수정 (시간 변경) |
| POST | `/api/makeup/:id/sessions/:sid/complete` | 회차 완료 처리 |
| DELETE | `/api/makeup/:id/sessions/:sid` | 회차 취소 |

### 4.2 요청/응답 스펙

**POST `/api/makeup/:id/sessions`**
```json
// Request
{
  "scheduled_date": "2026-04-20",
  "scheduled_start_time": "15:00",
  "scheduled_end_time": "15:30"
}

// Response 201
{
  "id": "msess_abc123",
  "makeup_id": "mkp_xyz",
  "session_index": 2,
  "scheduled_date": "2026-04-20",
  "scheduled_start_time": "15:00",
  "scheduled_end_time": "15:30",
  "duration_minutes": 30,
  "status": "scheduled"
}
```

**GET `/api/makeup/:id/sessions`**
```json
{
  "makeup": {
    "id": "mkp_xyz",
    "required_minutes": 90,
    "completed_minutes": 60,
    "progress": 0.67,
    "status": "in_progress"
  },
  "sessions": [
    { "id": "msess_1", "session_index": 1, "scheduled_date": "2026-04-18",
      "start": "15:00", "end": "15:30", "duration_minutes": 30, "status": "completed" },
    { "id": "msess_2", "session_index": 2, "scheduled_date": "2026-04-19",
      "start": "15:00", "end": "15:30", "duration_minutes": 30, "status": "completed" },
    { "id": "msess_3", "session_index": 3, "scheduled_date": "2026-04-20",
      "start": "15:00", "end": "15:30", "duration_minutes": 30, "status": "scheduled" }
  ]
}
```

**POST `/api/makeup/:id/sessions/:sid/complete`**
- 해당 세션 `status='completed'`, `completed_at=now()`
- 부모 makeup의 `completed_minutes` 재계산
- `completed_minutes >= required_minutes` → makeup.status='completed'
- 아니면 → makeup.status='in_progress'
- 학부모 알림톡 발송 (세션 완료 + 전체 진행률)

### 4.3 기존 엔드포인트 동작 변경

- `POST /api/absence` — 결석 등록 시 `makeups` 생성하되 `required_minutes = 수업 시간(분)` 자동 계산 (class_schedule에서 조회)
- `POST /api/makeup/:id/schedule` — **세션 1개 추가**로 의미 변경 (하위 호환: 기존 UI가 이걸 호출하면 자동으로 session 생성)
- `POST /api/makeup/:id/complete` — 남은 모든 세션을 완료 처리 (편의 API)

### 4.4 권한 (기존 패턴 유지)

모든 세션 API는 **makeup → absence → students → academy_id JOIN**으로 테넌트 격리.

```ts
// 권한 체크 헬퍼
async function assertMakeupAccess(db: D1Database, makeupId: string, academyId: string) {
  const row = await executeFirst(db,
    `SELECT m.id FROM makeups m
     JOIN absences a ON m.absence_id = a.id
     JOIN students s ON a.student_id = s.id
     WHERE m.id = ? AND s.academy_id = ?`,
    [makeupId, academyId]);
  if (!row) throw new NotFoundError('보강을 찾을 수 없습니다');
}
```

---

## 5. 핸들러 설계

### 5.1 새 파일 `workers/src/routes/makeup-session-handler.ts`

```ts
// 의사코드 — 구현은 /sc:implement 단계에서

export async function handleMakeupSession(
  method: string, pathname: string, request: Request, context: RequestContext
) {
  // /api/makeup/:id/sessions
  // /api/makeup/:id/sessions/:sid[/complete]

  const listMatch = pathname.match(/^\/api\/makeup\/([^/]+)\/sessions$/);
  const itemMatch = pathname.match(/^\/api\/makeup\/([^/]+)\/sessions\/([^/]+)$/);
  const completeMatch = pathname.match(/^\/api\/makeup\/([^/]+)\/sessions\/([^/]+)\/complete$/);

  if (completeMatch && method === 'POST') return completeSession(...);
  if (itemMatch) {
    if (method === 'PATCH') return updateSession(...);
    if (method === 'DELETE') return cancelSession(...);
  }
  if (listMatch) {
    if (method === 'GET') return listSessions(...);
    if (method === 'POST') return addSession(...);
  }
}
```

### 5.2 핵심 로직: `completeSession`

```ts
async function completeSession(makeupId, sessionId, context) {
  await assertMakeupAccess(context.env.DB, makeupId, academyId);

  // 1. 세션 완료
  await db.exec(
    `UPDATE makeup_sessions SET status='completed', completed_at=datetime('now')
     WHERE id = ? AND makeup_id = ?`, [sessionId, makeupId]);

  // 2. 진행률 재계산
  const { completed } = await executeFirst(db,
    `SELECT COALESCE(SUM(duration_minutes), 0) AS completed
     FROM makeup_sessions WHERE makeup_id = ? AND status = 'completed'`,
    [makeupId]);

  // 3. makeup 상태 갱신
  const { required } = await executeFirst(db,
    `SELECT required_minutes AS required FROM makeups WHERE id = ?`, [makeupId]);

  const newStatus = completed >= required ? 'completed'
                   : completed > 0 ? 'in_progress'
                   : 'scheduled';

  await db.exec(
    `UPDATE makeups SET completed_minutes = ?, status = ?,
       completed_date = CASE WHEN ? = 'completed' THEN date('now') ELSE completed_date END
     WHERE id = ?`,
    [completed, newStatus, newStatus, makeupId]);

  // 4. 학부모 알림 (전사 알림톡 큐로)
  if (newStatus === 'completed') enqueueParentNotif('makeup_fully_completed', ...);
  else enqueueParentNotif('makeup_session_completed', { progress: completed/required });

  return successResponse({ completed, required, status: newStatus });
}
```

---

## 6. UI 설계 (`AbsencePage.tsx`)

### 6.1 보강 카드 레이아웃 변경

**기존**
```
[학생명]  [결석일]  [사유]
[보강일 선택]  [완료 버튼]
```

**신규**
```
┌─────────────────────────────────────────────────────┐
│ 김학생 · 2026-04-15 결석 · 사유: 감기              │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░ 60 / 90분 (67%)              │
│                                                     │
│ 회차                                                │
│ ✅ 1회차 · 4/18 15:00-15:30 (30분)                 │
│ ✅ 2회차 · 4/19 15:00-15:30 (30분)                 │
│ ⏳ 3회차 · 4/20 15:00-15:30 (30분)  [완료] [취소] │
│                                                     │
│ [+ 회차 추가]                                       │
└─────────────────────────────────────────────────────┘
```

### 6.2 "회차 추가" 다이얼로그

```
┌─ 회차 추가 ─────────────────┐
│ 날짜     [2026-04-21]      │
│ 시작     [15:00]           │
│ 종료     [15:30]           │
│ → 분량: 30분                │
│                            │
│ 남은 시간: 30분 필요        │
│                            │
│ [취소] [추가]              │
└────────────────────────────┘
```

**검증**:
- `end > start`
- `duration <= 필요시간 - 이미 예약된 시간 + 허용오차(30)`
- 같은 학생 동일 시간대 중복 경고

### 6.3 진행률 시각화
- 0%: 회색
- 1-99%: 노랑 (in_progress)
- 100%: 초록 (completed)

### 6.4 상태 필터 확장
- `미보강` (pending, 세션 0)
- `예정` (scheduled, completed_minutes = 0)
- `진행중` (in_progress, 0 < completed < required) ← **신규**
- `완료` (completed)

---

## 7. 타이머 연동

### 7.1 현재
`realtime_sessions.makeup_id` → 보강 체크인 기록

### 7.2 변경
`realtime_sessions.makeup_session_id` → **특정 회차** 체크인 기록

### 7.3 자동 완료 시나리오
1. 학생이 보강 시간에 타이머 체크인 (해당 makeup_session_id 바인딩)
2. 체크아웃 시 `actual_duration`이 `scheduled duration`의 80% 이상이면
3. 해당 세션 자동 `completed` 처리 → makeup 진행률 자동 갱신
4. 선생은 예외 경우만 수동 처리

---

## 8. 마이그레이션 전략

### 8.1 롤아웃 순서
1. **Phase 1 (DB)**: migration 028 배포 → 기존 makeup이 session 1개로 자동 백필
2. **Phase 2 (API)**: `makeup-session-handler.ts` 배포, 기존 엔드포인트는 하위 호환 유지
3. **Phase 3 (UI)**: AbsencePage 재작업, 진행률 바 + 회차 목록
4. **Phase 4 (Timer)**: realtime_sessions 연동 → 자동 완료
5. **Phase 5 (Cleanup)**: 구 `scheduled_start_time/end_time` 컬럼 제거 (3개월 후)

### 8.2 하위 호환 체크리스트
- [ ] 기존 `GET /api/makeups` 응답에 `required_minutes`, `completed_minutes`, `progress` 필드 추가 (기존 필드 유지)
- [ ] 기존 `POST /api/makeup/:id/schedule`은 session 1개 생성으로 동작
- [ ] 기존 `POST /api/makeup/:id/complete`는 남은 세션 전부 완료
- [ ] 기존 UI (v1) 그대로 쓸 때도 동작 (단일 세션 = 기존 경험)

---

## 9. 엣지 케이스

| 케이스 | 처리 |
|---|---|
| 예정 시간 초과 예약 (과다 예약) | UI에서 경고, 허용오차 +30분까지 허용 |
| 세션 취소 후 재예약 | cancelled는 집계 제외, 새 세션 추가로 처리 |
| 보강 도중 결석 추가 발생 | 새 absence → 새 makeup (현재 makeup과 독립) |
| 학생이 보강 시간에 지각/조퇴 | actual_duration 기반 부분 완료 (운영 정책 결정 필요) |
| 타임존 | 모든 시간은 학원 로컬 (Asia/Seoul), DB는 HH:MM 문자열 |
| 회차 순서 재정렬 | session_index는 추가 시점 기준, 표시는 scheduled_date 정렬 |

---

## 10. 권한 매트릭스

| 작업 | instructor (담당) | instructor (비담당) | admin |
|---|---|---|---|
| 회차 조회 | ✓ | ✗ | ✓ |
| 회차 추가 | ✓ | ✗ | ✓ |
| 회차 수정 | ✓ | ✗ | ✓ |
| 회차 완료 | ✓ | ✗ | ✓ |
| 회차 취소 | ✓ | ✗ | ✓ |

*(담당 판정: student_teachers 테이블의 teacher_id)*

---

## 11. 테스트 계획

### 11.1 E2E 시나리오
1. 1.5h 결석 등록 → required_minutes=90 자동 설정
2. 30분 회차 3개 추가 → 각 예정 상태
3. 1회차 완료 → progress 33%, in_progress
4. 2회차 완료 → progress 67%, in_progress
5. 3회차 완료 → progress 100%, completed, 학부모 알림 발송
6. 테넌트 격리: 다른 학원 토큰으로 세션 조회 시 404

### 11.2 마이그레이션 테스트
1. 기존 단일 보강 데이터 10건 준비
2. migration 028 실행
3. 각 건이 session 1개로 변환 확인
4. 기존 UI로 조회/완료 동작 확인

---

## 12. 요약 — 구현 영향도

| 영역 | 변경 규모 |
|---|---|
| 마이그레이션 | 신규 1개 (028) |
| 백엔드 핸들러 | 신규 파일 1개 (~250 LOC), 기존 absence-handler 소폭 수정 |
| 프론트 UI | AbsencePage 재작업 (~300 LOC), 진행률 컴포넌트 신규 |
| 타이머 | realtime_sessions 컬럼 추가 + 자동 완료 로직 |
| 테스트 | E2E 6 케이스, 마이그레이션 검증 1 케이스 |

**총 예상 공수**: 2-3일

---

**Next Step**: 이 설계가 승인되면 `/sc:implement`로 구현 — 단계는 (1) migration 028, (2) makeup-session-handler, (3) UI 진행률 바 + 회차 관리, (4) 타이머 연동 순.
