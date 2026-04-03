# 학생 등원/수업 세션 관리 시스템 설계

> **버전**: v1.0  
> **날짜**: 2026-04-03  
> **상태**: 설계 검토 중

---

## 1. 현재 문제점

| 문제 | 영향 |
|------|------|
| 타이머 일시정지 불가 | 학생이 잠시 나갔다 와도 타이머가 계속 흘러감 → 실제 수업시간 왜곡 |
| 수업 시작/종료 기록 미영구화 | 앱 종료 시 모든 세션 데이터 소멸 → 출석 이력 없음 |
| 순수 수업시간 측정 불가 | 휴식/외출 시간이 포함되어 정확한 수업시간 파악 불가 |
| 세션 상태가 단순함 | waiting/active/completed/overtime 4개뿐 → 일시정지 표현 불가 |

---

## 2. 설계 목표

1. **타이머 일시정지/재개** — 학생이 외출할 때 타이머를 멈추고, 돌아오면 재개
2. **수업 시간 기록 영구화** — 수업 시작/종료/일시정지 모든 이벤트를 저장
3. **순수 수업시간 계산** — 일시정지 시간을 제외한 실제 수업시간 산출
4. **출석 이력 조회** — 날짜별/학생별 수업 기록 열람

---

## 3. 데이터 모델 설계

### 3.1 세션 상태 흐름

```
waiting → active ⇄ paused → completed
                  ↘ overtime → completed
```

### 3.2 타입 정의 (변경사항)

```typescript
// ========================================
// 새로운/수정된 타입들
// ========================================

// 세션 상태 - 'paused' 추가
export type SessionStatus = 'waiting' | 'active' | 'paused' | 'completed' | 'overtime';

// 일시정지 이벤트 기록
export interface PauseRecord {
  pausedAt: string;    // ISO datetime - 일시정지 시작
  resumedAt?: string;  // ISO datetime - 재개 시점 (아직 일시정지 중이면 undefined)
  reason?: string;     // 사유 (선택) - '외출', '휴식', '화장실' 등
}

// 수정된 RealtimeSession
export interface RealtimeSession {
  id: string;                    // ← 추가: 고유 세션 ID
  studentId: string;
  student: Student;
  
  // 시간 기록
  checkInTime: string;           // 등원 (수업 시작) 시각
  checkOutTime?: string;         // 하원 (수업 종료) 시각
  
  // 일시정지 이력
  pauseHistory: PauseRecord[];   // ← 추가: 모든 일시정지 기록
  
  // 상태
  status: SessionStatus;         // ← 수정: 'paused' 추가
  
  // 시간 계산 (분 단위)
  scheduledMinutes: number;      // 예정 수업시간
  elapsedMinutes: number;        // 총 경과시간 (일시정지 포함)
  netMinutes: number;            // ← 추가: 순수 수업시간 (일시정지 제외)
  totalPausedMinutes: number;    // ← 추가: 총 일시정지 시간
  
  // 메타데이터
  date: string;                  // ← 추가: YYYY-MM-DD 형식 날짜
  note?: string;                 // ← 추가: 메모 (선택)
}

// 출석 기록 (영구 저장용)
export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  grade: GradeType;
  date: string;                  // YYYY-MM-DD
  
  // 시간 기록
  checkInTime: string;           // ISO datetime
  checkOutTime: string;          // ISO datetime
  scheduledStartTime: string;    // 예정 시작 (HH:mm)
  scheduledEndTime: string;      // 예정 종료 (HH:mm)
  
  // 수업시간 요약
  scheduledMinutes: number;      // 예정 수업시간
  netMinutes: number;            // 순수 수업시간
  totalPausedMinutes: number;    // 총 일시정지 시간
  pauseCount: number;            // 일시정지 횟수
  
  // 일시정지 상세
  pauseHistory: PauseRecord[];
  
  // 상태
  wasLate: boolean;              // 지각 여부
  wasOvertime: boolean;          // 초과 수업 여부
  note?: string;
}

// 일별 출석 통계
export interface DayStats {
  total: number;
  waiting: number;
  active: number;
  paused: number;                // ← 추가
  completed: number;
}
```

### 3.3 순수 수업시간 계산 로직

```typescript
/**
 * 순수 수업시간 = 총 경과시간 - 총 일시정지시간
 * 
 * 총 일시정지시간 = Σ (resumedAt - pausedAt) for each PauseRecord
 *   - 현재 일시정지 중이면: now - pausedAt 도 포함
 */
function calculateNetMinutes(session: RealtimeSession, now: Date): number {
  const checkIn = new Date(session.checkInTime);
  const totalElapsed = (now.getTime() - checkIn.getTime()) / 1000 / 60;
  
  let totalPaused = 0;
  for (const pause of session.pauseHistory) {
    const pauseStart = new Date(pause.pausedAt);
    const pauseEnd = pause.resumedAt ? new Date(pause.resumedAt) : now;
    totalPaused += (pauseEnd.getTime() - pauseStart.getTime()) / 1000 / 60;
  }
  
  return Math.floor(totalElapsed - totalPaused);
}
```

---

## 4. Store 변경 설계

### 4.1 새로운 액션 추가

```typescript
interface ScheduleState {
  // ... 기존 필드 유지 ...
  
  // 출석 기록 (영구 저장)
  attendanceRecords: AttendanceRecord[];
  
  // ====== 새로운 액션 ======
  
  // 일시정지/재개
  pauseSession: (studentId: string, reason?: string) => void;
  resumeSession: (studentId: string) => void;
  
  // 기존 checkOut 수정 → 완료 시 AttendanceRecord 자동 생성
  checkOut: (studentId: string, note?: string) => void;
  
  // 출석 기록 조회
  getAttendanceByDate: (date: string) => AttendanceRecord[];
  getAttendanceByStudent: (studentId: string) => AttendanceRecord[];
}
```

### 4.2 핵심 액션 구현 설계

```typescript
// 일시정지
pauseSession: (studentId, reason) => {
  set((state) => ({
    realtimeSessions: state.realtimeSessions.map((s) =>
      s.studentId === studentId && s.status === 'active'
        ? {
            ...s,
            status: 'paused' as const,
            pauseHistory: [
              ...s.pauseHistory,
              { pausedAt: new Date().toISOString(), reason }
            ],
          }
        : s
    ),
  }));
},

// 재개
resumeSession: (studentId) => {
  set((state) => ({
    realtimeSessions: state.realtimeSessions.map((s) =>
      s.studentId === studentId && s.status === 'paused'
        ? {
            ...s,
            status: 'active' as const,
            pauseHistory: s.pauseHistory.map((p, i) =>
              i === s.pauseHistory.length - 1 && !p.resumedAt
                ? { ...p, resumedAt: new Date().toISOString() }
                : p
            ),
          }
        : s
    ),
  }));
},

// 체크아웃 (수정) → 출석기록 자동 생성
checkOut: (studentId, note) => {
  const state = get();
  const session = state.realtimeSessions.find(s => s.studentId === studentId);
  if (!session) return;
  
  const now = new Date();
  const netMinutes = calculateNetMinutes(session, now);
  const totalPausedMinutes = calculateTotalPaused(session, now);
  
  // 출석 기록 생성
  const record: AttendanceRecord = {
    id: generateId(),
    studentId: session.studentId,
    studentName: session.student.name,
    grade: session.student.grade,
    date: now.toISOString().split('T')[0],
    checkInTime: session.checkInTime,
    checkOutTime: now.toISOString(),
    scheduledStartTime: session.student.startTime,
    scheduledEndTime: session.student.endTime,
    scheduledMinutes: session.scheduledMinutes,
    netMinutes,
    totalPausedMinutes,
    pauseCount: session.pauseHistory.length,
    pauseHistory: session.pauseHistory,
    wasLate: /* checkInTime > scheduledStartTime + 5분 */,
    wasOvertime: netMinutes > session.scheduledMinutes,
    note,
  };

  set((state) => ({
    realtimeSessions: state.realtimeSessions.map((s) =>
      s.studentId === studentId
        ? { ...s, checkOutTime: now.toISOString(), status: 'completed', netMinutes, totalPausedMinutes }
        : s
    ),
    attendanceRecords: [...state.attendanceRecords, record],
  }));
},
```

### 4.3 Persist 설정 변경

```typescript
persist(
  (set, get) => ({ /* ... */ }),
  {
    name: 'timer-schedule-storage',
    partialize: (state) => ({
      students: state.students,
      notionSettings: state.notionSettings,
      attendanceRecords: state.attendanceRecords,  // ← 추가: 출석기록 영구저장
      // realtimeSessions는 당일 세션이므로 저장하지 않음
    }),
  }
)
```

---

## 5. UI 변경 설계

### 5.1 RealtimeView 카드 상태 추가

```
┌─────────────────────────────────┐
│  [대기 중]    [수업 중]    [일시정지]  │  ← 3개 패널 (기존 2개 → 3개)
│                                 │
│  대기 카드    수업 카드    정지 카드   │
│  → 클릭:     → 일시정지   → 재개     │
│    체크인       완료         완료     │
└─────────────────────────────────┘
```

### 5.2 수업 중 카드 변경

```
기존:                           변경 후:
┌──────────────┐              ┌──────────────┐
│ 김민준  고2   │              │ 김민준  고2   │
│ 01:23 남음   │              │ 01:23 남음   │
│ 경과: 37분   │              │ 순수: 32분 / 예정: 60분 │
│              │              │ 일시정지: 5분 (1회) │
│ [연장] [완료] │              │ [⏸ 정지] [✓ 완료] │
└──────────────┘              └──────────────┘
```

### 5.3 일시정지 카드 (신규)

```
┌──────────────────────────────┐
│ 이서연  중3        [paused]  │
│                              │
│ ⏸ 일시정지 중 (외출)         │
│ 정지 시간: 00:05:23          │
│ 순수 수업: 28분              │
│                              │
│ [▶ 재개]           [✓ 완료]  │
└──────────────────────────────┘
```

### 5.4 일시정지 사유 선택 (퀵 액션)

일시정지 버튼 클릭 시 간단한 사유 선택:

```
┌─────────────────────────┐
│ 일시정지 사유 (선택)      │
│                         │
│ [🚶 외출] [☕ 휴식]      │
│ [🚻 화장실] [📱 기타]    │
│                         │
│ [사유 없이 정지]          │
└─────────────────────────┘
```

### 5.5 Stats 바 변경

```
기존:    현재시간 | 대기중 3명 | 수업중 5명 | 완료 2명
변경후:  현재시간 | 대기중 3명 | 수업중 4명 | 일시정지 1명 | 완료 2명
```

---

## 6. 완료 시 기록 뷰 (신규 페이지)

### 6.1 출석 기록 페이지 (`AttendanceView.tsx`)

새로운 뷰 모드: `ViewMode`에 `'attendance'` 추가

```
┌─────────────────────────────────────────────────┐
│ 📋 출석 기록                    [2026-04-03 ▼]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  이름    학년  등원     하원     순수수업  정지   │
│  ─────────────────────────────────────────────  │
│  김민준  고2   14:02   16:05   118분    5분     │
│  이서연  중3   14:30   16:32   110분    12분    │
│  박준서  고1   15:00   17:03   120분    3분     │
│                                                 │
│  ▸ 김민준 상세                                   │
│    예정: 14:00~16:00 (120분)                    │
│    지각: +2분                                   │
│    일시정지 1회:                                 │
│      15:20~15:25 (5분) - 외출                   │
│    순수 수업시간: 118분                          │
│    초과: -                                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 7. 네비게이션 변경

```typescript
// ViewMode 타입 수정
export type ViewMode = 'day' | 'realtime' | 'student' | 'grade' | 'timeslot' | 'attendance';

// Layout.tsx 네비게이션에 추가
{ path: '/attendance', icon: 'fact_check', label: '출석기록', mode: 'attendance' }
```

---

## 8. 파일 변경 목록

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `types/index.ts` | **수정** | SessionStatus, PauseRecord, RealtimeSession, AttendanceRecord 타입 추가/수정 |
| `stores/scheduleStore.ts` | **수정** | pauseSession, resumeSession 액션 추가, checkOut 수정, attendanceRecords 추가, persist 설정 변경 |
| `pages/RealtimeView.tsx` | **수정** | 일시정지 패널 추가, 카드 UI 수정, 순수수업시간 표시 |
| `pages/AttendanceView.tsx` | **신규** | 출석 기록 조회 페이지 |
| `App.tsx` | **수정** | AttendanceView 라우트 추가 |
| `components/Layout.tsx` | **수정** | 출석기록 네비게이션 항목 추가 |
| `components/PauseReasonModal.tsx` | **신규** | 일시정지 사유 선택 모달 |

---

## 9. 구현 우선순위

### Phase 1 — 핵심 기능 (먼저 구현)
1. `types/index.ts` 타입 추가
2. `scheduleStore.ts` — pauseSession, resumeSession 액션
3. `RealtimeView.tsx` — 일시정지/재개 버튼 및 일시정지 패널

### Phase 2 — 데이터 영구화
4. `scheduleStore.ts` — attendanceRecords, checkOut 수정
5. persist 설정 변경

### Phase 3 — 기록 조회
6. `AttendanceView.tsx` 신규 페이지
7. `Layout.tsx`, `App.tsx` 네비게이션/라우팅

### Phase 4 — 부가기능
8. `PauseReasonModal.tsx` 사유 선택
9. 출석 통계/리포트

---

## 10. 설계 결정 사항

| 결정 | 이유 |
|------|------|
| 일시정지 이력을 배열로 관리 | 한 세션에서 여러 번 일시정지 가능 (외출 → 복귀 → 다시 외출) |
| 출석기록을 localStorage에 저장 | 현재 Notion 출석 DB 미구현 상태, 즉시 사용 가능하게 로컬 우선 |
| netMinutes 실시간 계산 | 저장값이 아닌 계산값으로 항상 정확한 수치 보장 |
| 사유를 선택식으로 | 타이핑 최소화, 빠른 조작 (수업 중 사용) |
| 완료 시 자동으로 AttendanceRecord 생성 | 별도 저장 동작 없이 자연스러운 워크플로우 |
