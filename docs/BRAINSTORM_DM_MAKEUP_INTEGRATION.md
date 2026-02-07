# WAWA Smart ERP - DM & 보강관리 시스템 이식 브레인스토밍

> 작성일: 2026-02-07
> 상태: 설계 단계

---

## 1. 의사결정 요약

| 항목 | 결정 |
|------|------|
| DM UI 형태 | 플로팅 채팅 위젯 (화면 우하단) |
| 보강관리 배치 | 독립 모듈 (`makeup`) |
| 보강 Notion DB | 기존 AbsenceHistory DB 재활용 |
| DM 실시간성 | 10초 폴링 |

---

## 2. DM (쪽지) 시스템 이식 설계

### 2.1 아키텍처 개요

```
┌──────────────────────────────────────────────────────────┐
│  AppShell (모든 페이지 공통)                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Header  [시간표] [학생관리] [월말평가] [채점] ...  💬 │  │
│  ├──────┬─────────────────────────────────────────────┤  │
│  │      │                                             │  │
│  │ Side │          현재 모듈 페이지                     │  │
│  │ bar  │                                             │  │
│  │      │                                             │  │
│  │      │                              ┌────────────┐│  │
│  │      │                              │ 플로팅 DM   ││  │
│  │      │                              │ 채팅 위젯   ││  │
│  │      │                              │ (접기/펼치기)││  │
│  │      │                              └────────────┘│  │
│  └──────┴─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Notion DB 스키마 (Messages)

**DB ID**: `30073635-f415-8036-91d3-d516ec284ad6`

| 프로퍼티 | Notion 타입 | 설명 |
|----------|------------|------|
| `SenderID` | rich_text | 보낸 선생님의 Notion page ID |
| `ReceiverID` | rich_text | 받는 선생님의 Notion page ID |
| `Content` | rich_text | 메시지 내용 |
| `CreatedTime` | created_time | 자동 생성 시간 |

### 2.3 TypeScript 타입 정의 (추가할 타입)

```typescript
// DM 메시지
export interface DirectMessage {
  id: string;
  senderId: string;
  senderName?: string;
  receiverId: string;
  receiverName?: string;
  content: string;
  createdAt: string;
  isRead?: boolean;          // 향후 읽음 확인 확장용
}

// DM 대화 상대
export interface DMContact {
  teacherId: string;
  teacherName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

// DM 스토어 상태
export interface DMState {
  contacts: DMContact[];
  currentChatPartnerId: string | null;
  messages: DirectMessage[];
  isOpen: boolean;            // 위젯 열림/닫힘
  isMinimized: boolean;       // 최소화 상태
  unreadTotal: number;        // 전체 미읽은 메시지 수
}
```

### 2.4 컴포넌트 구조

```
src/components/dm/
├── DMWidget.tsx              # 메인 플로팅 위젯 컨테이너
├── DMChatWindow.tsx          # 채팅 창 (메시지 목록 + 입력)
├── DMContactList.tsx         # 선생님 목록 (대화 상대)
├── DMMessageBubble.tsx       # 개별 메시지 버블
├── DMFloatingButton.tsx      # 우하단 플로팅 버튼 (알림 배지)
└── DMHeader.tsx              # 채팅창 상단 (상대방 이름, 닫기 버튼)
```

### 2.5 플로팅 위젯 동작 흐름

```
[플로팅 버튼 💬 (배지: 3)]
        │ 클릭
        ▼
┌─────────────────────┐
│  DM 위젯 (380x500)   │
│  ┌─────────────────┐ │
│  │ 💬 쪽지          │ │  ← 헤더 (뒤로가기, 닫기)
│  ├─────────────────┤ │
│  │ 서재용 선생님  (2)│ │  ← 연락처 목록
│  │ 지혜영 원장    (1)│ │     (미읽은 수 표시)
│  │ 김수학 선생님     │ │
│  ├─────────────────┤ │
│  │ [대화 상대 클릭]  │ │
│  ▼                   │ │
│  ┌─────────────────┐ │
│  │ ← 서재용 선생님  │ │  ← 채팅 헤더
│  ├─────────────────┤ │
│  │  안녕하세요      │ │  ← 상대방 메시지 (좌)
│  │      네 안녕하세요│ │  ← 내 메시지 (우)
│  │  내일 보강 가능? │ │
│  ├─────────────────┤ │
│  │ [메시지 입력...]  │ │  ← 입력창 + 전송 버튼
│  └─────────────────┘ │
└─────────────────────┘
```

### 2.6 Zustand Store 설계 (dmStore.ts)

```typescript
// stores/dmStore.ts
interface DMStore {
  // 상태
  isOpen: boolean;
  isMinimized: boolean;
  contacts: DMContact[];
  currentChatPartnerId: string | null;
  messages: DirectMessage[];
  unreadTotal: number;
  isLoading: boolean;

  // 액션
  toggleWidget: () => void;
  minimizeWidget: () => void;
  selectContact: (teacherId: string) => void;
  goBackToContacts: () => void;
  sendMessage: (receiverId: string, content: string) => Promise<void>;
  fetchContacts: () => Promise<void>;
  fetchMessages: (partnerId: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}
```

### 2.7 Notion API 함수 (추가할 서비스)

```typescript
// services/notion.ts에 추가

// DM 메시지 조회 (양방향)
export async function fetchDMMessages(
  senderId: string,
  receiverId: string
): Promise<DirectMessage[]>

// DM 메시지 전송
export async function sendDMMessage(
  senderId: string,
  receiverId: string,
  content: string
): Promise<ApiResult<DirectMessage>>

// 최근 대화 목록 조회 (각 선생님별 마지막 메시지)
export async function fetchDMContacts(
  currentUserId: string
): Promise<DMContact[]>
```

### 2.8 CSS 스타일링 (기존 디자인 시스템 준수)

```css
/* index.css에 추가 */

/* DM 플로팅 버튼 */
.dm-floating-btn { ... }
.dm-floating-btn .dm-badge { ... }

/* DM 위젯 컨테이너 */
.dm-widget { position: fixed; bottom: 80px; right: 24px; width: 380px; ... }
.dm-widget.minimized { height: 48px; }

/* DM 연락처 */
.dm-contact-item { ... }
.dm-contact-item:hover { ... }
.dm-contact-unread { ... }

/* DM 메시지 버블 */
.dm-message { ... }
.dm-message.sent { ... }    /* 내가 보낸 메시지 - 오른쪽, primary 색상 */
.dm-message.received { ... } /* 받은 메시지 - 왼쪽, 회색 배경 */

/* DM 입력창 */
.dm-input-area { ... }
```

### 2.9 AppShell 통합 위치

```tsx
// components/AppShell.tsx 수정
import DMWidget from './dm/DMWidget';

export default function AppShell() {
  return (
    <div className="app-shell">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <DMWidget />  {/* ← 모든 페이지에서 렌더링 */}
    </div>
  );
}
```

### 2.10 폴링 전략

```
- 앱 마운트 시: 10초 간격으로 미읽은 메시지 수 폴링 (전체 연락처용)
- 채팅창 열림 시: 10초 간격으로 현재 대화 메시지 폴링
- 탭 비활성 시: 폴링 중단 (document.visibilityState 활용)
- 위젯 닫힘 시: 미읽은 수만 폴링 (메시지 내용은 폴링하지 않음)
```

---

## 3. 보강관리 시스템 이식 설계

### 3.1 모듈 구조

```
src/modules/makeup/
├── Dashboard.tsx          # 보강 대시보드 (요약 통계)
├── Pending.tsx            # 대기 중인 보강 목록
├── Completed.tsx          # 완료된 보강 목록
├── Settings.tsx           # 보강관리 설정
└── components/
    ├── AddAbsenceModal.tsx     # 결시 기록 추가 모달
    └── ScheduleRetestModal.tsx # 재시험 일정 등록 모달
```

### 3.2 Notion DB (기존 AbsenceHistory 재활용)

**기존 컬럼 상수** (`constants/notion.ts`):
```typescript
NOTION_COLUMNS_ABSENCE_HISTORY = {
  NAME: '이름',
  STUDENT: '학생',
  ORIGINAL_DATE: '원래시험일',
  ABSENCE_REASON: '결시사유',
  RETEST_DATE: '재시험일',
  RETEST_COMPLETED: '재시험완료',
  YEAR_MONTH: '년월',
}
```

**notion_config.json에 추가 필요**:
```json
{
  "notionAbsenceHistoryDb": "<DB_ID_HERE>",
  "notionDmMessagesDb": "30073635-f415-8036-91d3-d516ec284ad6"
}
```

> **보강 DB ID 확인 필요**: 기존 Notion 워크스페이스에서 결시이력 DB를 찾아야 합니다.
> AppSettings에 `notionAbsenceHistoryDb` 필드가 이미 정의되어 있으므로,
> 해당 DB가 이미 존재할 가능성이 높습니다.

### 3.3 사이드바 메뉴

```typescript
// Sidebar.tsx moduleMenus에 추가
makeup: [
  { id: 'dashboard', label: '대시보드', icon: 'dashboard', path: '/makeup' },
  { id: 'pending', label: '대기 중', icon: 'pending_actions', path: '/makeup/pending' },
  { id: 'completed', label: '완료', icon: 'task_alt', path: '/makeup/completed' },
  { id: 'settings', label: '설정', icon: 'settings', path: '/makeup/settings' },
],
```

### 3.4 Header 탭 추가

```typescript
// Header.tsx modules에 추가
{ id: 'makeup', label: '보강관리', icon: 'event_repeat', path: '/makeup' },
```

### 3.5 타입 업데이트

```typescript
// types/index.ts
export type ModuleType = 'timer' | 'report' | 'grader' | 'schedule' | 'student' | 'makeup';

// AbsenceHistory는 이미 존재 - 그대로 활용
```

### 3.6 Zustand Store (makeupStore.ts)

```typescript
interface MakeupStore {
  // 상태
  pendingList: AbsenceHistory[];
  completedList: AbsenceHistory[];
  isLoading: boolean;

  // 액션
  fetchPending: () => Promise<void>;
  fetchCompleted: () => Promise<void>;
  addAbsence: (data: Partial<AbsenceHistory>) => Promise<ApiResult>;
  scheduleRetest: (id: string, retestDate: string) => Promise<ApiResult>;
  markComplete: (id: string) => Promise<ApiResult>;
}
```

### 3.7 Notion API 함수 (추가/확장)

```typescript
// services/notion.ts에 추가

// 대기 중인 보강 조회 (재시험완료 = false)
export async function fetchPendingMakeups(): Promise<AbsenceHistory[]>

// 완료된 보강 조회 (재시험완료 = true)
export async function fetchCompletedMakeups(): Promise<AbsenceHistory[]>

// 결시 기록 추가
export async function createAbsenceRecord(data: ...): Promise<ApiResult>

// 재시험 일정 등록 (재시험일 업데이트)
export async function updateRetestDate(id: string, date: string): Promise<ApiResult>

// 재시험 완료 처리 (재시험완료 = true)
export async function markRetestComplete(id: string): Promise<ApiResult>
```

### 3.8 페이지 디자인 (기존 패턴 준수)

보강관리 페이지들은 기존 ERP의 디자인 패턴을 정확히 따릅니다:

```tsx
// Pending.tsx 예시 구조
<div>
  <div className="page-header">
    <div className="page-header-row">
      <div>
        <h1 className="page-title">대기 중인 보강</h1>
        <p className="page-description">재시험이 필요한 학생 목록입니다</p>
      </div>
      <div className="page-actions">
        <button className="btn btn-primary" onClick={openAddModal}>
          <span className="material-symbols-outlined">add</span>
          결시 기록 추가
        </button>
      </div>
    </div>
  </div>

  <div className="search-bar">
    <input className="search-input" placeholder="학생 이름 검색..." />
  </div>

  <table className="data-table">
    <thead>
      <tr>
        <th>학생명</th>
        <th>원래 시험일</th>
        <th>결시 사유</th>
        <th>재시험일</th>
        <th>액션</th>
      </tr>
    </thead>
    <tbody>
      {/* 기존 data-table 패턴 */}
    </tbody>
  </table>
</div>
```

---

## 4. 통합 구현 순서 (권장)

### Phase 1: 인프라 준비
1. `types/index.ts`에 ModuleType 확장 + DM 타입 추가
2. `notion_config.json`에 DM Messages DB ID 추가
3. `constants/notion.ts`에 DM 컬럼 상수 추가
4. `AppSettings`에 `notionDmMessagesDb` 필드 추가

### Phase 2: 보강관리 모듈 (일반 모듈 패턴)
1. `src/modules/makeup/` 디렉토리 생성
2. `stores/makeupStore.ts` 생성
3. `services/notion.ts`에 보강 관련 CRUD 함수 추가
4. 각 페이지 컴포넌트 구현 (Pending, Completed, Dashboard, Settings)
5. `Sidebar.tsx`, `Header.tsx`, `App.tsx` 라우팅 추가

### Phase 3: DM 플로팅 위젯 (글로벌 컴포넌트)
1. `stores/dmStore.ts` 생성
2. `services/notion.ts`에 DM 관련 함수 추가
3. `src/components/dm/` 컴포넌트 구현
4. `index.css`에 DM 위젯 스타일 추가
5. `AppShell.tsx`에 `<DMWidget />` 추가
6. 폴링 로직 구현 (10초 간격, visibility 감지)

### Phase 4: 통합 테스트 & 마무리
1. DM 위젯이 모든 모듈 페이지에서 정상 동작 확인
2. 보강관리 CRUD 기능 테스트
3. Notion API rate limit 확인 (DM 폴링 + 기존 API 호출)
4. 반응형 레이아웃 확인

---

## 5. 주의사항 & 리스크

### Notion API Rate Limit
- Notion API: 3 requests/second
- DM 10초 폴링 + 보강관리 CRUD = 추가 API 부하
- **대응**: 배치 쿼리 활용, 불필요한 폴링 최소화

### 스타일 변환 (Tailwind → CSS Custom Properties)
- 원본의 Tailwind 클래스를 모두 기존 디자인 시스템으로 변환
- `bg-card` → 기존 `.card` 클래스
- `text-primary` → `var(--primary)`
- `rounded-lg` → `var(--radius-lg)`

### 인증 통합
- DM 시스템의 별도 PIN 인증 제거
- ERP의 `currentUser` (reportStore)를 공유하여 로그인 상태 활용
- 로그인하지 않은 상태에서 DM 위젯 숨김

### Express 백엔드 제거
- 원본 DM의 Express 서버 불필요
- 프론트엔드에서 직접 Notion API 호출 (기존 패턴)
- `window.wawaAPI?.notionFetch` IPC 채널 활용

---

## 6. 파일 변경 목록 (예상)

### 수정 파일
| 파일 | 변경 내용 |
|------|----------|
| `types/index.ts` | ModuleType 확장, DM 타입 추가 |
| `notion_config.json` | DB ID 2개 추가 |
| `constants/notion.ts` | DM 컬럼 상수 추가 |
| `services/notion.ts` | DM + 보강 API 함수 추가 |
| `components/Sidebar.tsx` | makeup 모듈 메뉴 추가 |
| `components/Header.tsx` | makeup 탭 추가 |
| `components/AppShell.tsx` | DMWidget 추가 |
| `App.tsx` | makeup 라우트 추가 |
| `index.css` | DM 위젯 + 보강 페이지 스타일 |

### 신규 파일
| 파일 | 설명 |
|------|------|
| `stores/dmStore.ts` | DM 상태 관리 |
| `stores/makeupStore.ts` | 보강관리 상태 관리 |
| `components/dm/DMWidget.tsx` | 플로팅 위젯 메인 |
| `components/dm/DMChatWindow.tsx` | 채팅 창 |
| `components/dm/DMContactList.tsx` | 연락처 목록 |
| `components/dm/DMMessageBubble.tsx` | 메시지 버블 |
| `components/dm/DMFloatingButton.tsx` | 플로팅 버튼 |
| `modules/makeup/Dashboard.tsx` | 보강 대시보드 |
| `modules/makeup/Pending.tsx` | 대기 중 목록 |
| `modules/makeup/Completed.tsx` | 완료 목록 |
| `modules/makeup/Settings.tsx` | 보강 설정 |
| `modules/makeup/components/AddAbsenceModal.tsx` | 결시 추가 모달 |
| `modules/makeup/components/ScheduleRetestModal.tsx` | 재시험 일정 모달 |
