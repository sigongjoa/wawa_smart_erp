# WAWA Smart ERP - 통합 디자인 시스템

> 모든 모듈에서 일관된 UI/UX를 위한 디자인 가이드라인

---

## 1. 디자인 토큰 (Design Tokens)

### 1.1 Colors

```css
:root {
  /* Primary */
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --primary-light: #eff6ff;
  --primary-hover: #1d4ed8;

  /* Semantic Colors */
  --success: #10b981;
  --success-light: #ecfdf5;
  --warning: #f59e0b;
  --warning-light: #fffbeb;
  --danger: #ef4444;
  --danger-light: #fef2f2;
  --info: #3b82f6;
  --info-light: #eff6ff;

  /* Neutral */
  --background: #f8fafc;
  --surface: #ffffff;
  --border: #e2e8f0;
  --border-light: #f1f5f9;

  /* Text */
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --text-inverse: #ffffff;
}
```

### 1.2 Typography

```css
:root {
  /* Font Family */
  --font-sans: 'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Font Size */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */

  /* Font Weight */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Line Height */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
}
```

### 1.3 Spacing

```css
:root {
  /* 8px 기반 스페이싱 시스템 */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
}
```

### 1.4 Border Radius

```css
:root {
  --radius-sm: 0.375rem;   /* 6px - small elements */
  --radius-md: 0.5rem;     /* 8px - inputs, buttons */
  --radius-lg: 0.75rem;    /* 12px - cards, containers */
  --radius-xl: 1rem;       /* 16px - large cards */
  --radius-full: 9999px;   /* pills, avatars */
}
```

### 1.5 Shadows

```css
:root {
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}
```

### 1.6 Transitions

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}
```

---

## 2. 레이아웃 구조

### 2.1 전체 레이아웃

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER (h=64px, sticky top)                                     │
│  - 로고 (왼쪽)                                                    │
│  - 모듈 네비게이션 (중앙)                                         │
│  - 사용자 정보 / 알림 / 설정 (오른쪽)                              │
├──────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌──────────────────────────────────────────────┐  │
│ │  SIDEBAR   │ │              MAIN CONTENT                    │  │
│ │  w=240px   │ │                                              │  │
│ │            │ │  ┌──────────────────────────────────────┐    │  │
│ │  페이지     │ │  │  PAGE HEADER                         │    │  │
│ │  네비게이션 │ │  │  - Breadcrumb                        │    │  │
│ │            │ │  │  - Title + Description               │    │  │
│ │            │ │  │  - Action Buttons                    │    │  │
│ │            │ │  └──────────────────────────────────────┘    │  │
│ │            │ │                                              │  │
│ │            │ │  ┌──────────────────────────────────────┐    │  │
│ │            │ │  │  CONTENT AREA                        │    │  │
│ │            │ │  │  (Cards, Tables, Forms...)           │    │  │
│ │            │ │  └──────────────────────────────────────┘    │  │
│ └────────────┘ └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 반응형 브레이크포인트

```css
/* Mobile First */
--breakpoint-sm: 640px;   /* Small devices */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
--breakpoint-2xl: 1536px; /* Large screens */
```

---

## 3. 컴포넌트 스펙

### 3.1 Header (글로벌 헤더)

```tsx
// 모듈 전환을 담당하는 최상위 헤더
interface HeaderProps {
  currentModule: 'timer' | 'report' | 'grader' | 'schedule';
  user: { name: string; role: string; avatar?: string };
}
```

**스타일 규칙:**
- 높이: 64px
- 배경: white
- 하단 테두리: 1px solid var(--border)
- 로고 영역: flex items-center gap-2.5
- 활성 모듈: 하단 2px primary 테두리

### 3.2 Sidebar (사이드바)

```tsx
interface SidebarProps {
  items: Array<{
    icon: string;
    label: string;
    path: string;
    badge?: number;
  }>;
  activeItem: string;
}
```

**스타일 규칙:**
- 너비: 240px
- 배경: white
- 우측 테두리: 1px solid var(--border)
- 메뉴 아이템 패딩: 12px 16px
- 활성 아이템: bg-primary-light, text-primary, font-semibold
- 호버: bg-slate-50

### 3.3 Stat Card (통계 카드)

```tsx
interface StatCardProps {
  icon: string;
  iconColor: 'blue' | 'green' | 'rose' | 'purple' | 'amber';
  label: string;
  value: number | string;
  unit?: string;
  trend?: { value: number; direction: 'up' | 'down' };
}
```

**스타일 규칙:**
- 패딩: 24px
- 테두리: 1px solid var(--border)
- radius: var(--radius-lg)
- 아이콘 컨테이너: 48px, rounded-xl, bg-{color}-50
- 값: text-2xl font-bold
- 호버: shadow-md transition

### 3.4 Data Table (데이터 테이블)

```tsx
interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => ReactNode;
}

interface DataTableProps {
  columns: TableColumn[];
  data: any[];
  selectable?: boolean;
  pagination?: { page: number; pageSize: number; total: number };
  tabs?: Array<{ key: string; label: string; count?: number }>;
  filters?: ReactNode;
  onRowClick?: (row: any) => void;
}
```

**스타일 규칙:**
- 컨테이너: bg-white rounded-lg border shadow-sm
- 헤더 (th):
  - 배경: bg-slate-50/50
  - 텍스트: 11px uppercase font-bold tracking-wider text-slate-500
  - 패딩: 16px 24px
  - 하단 테두리: 1px solid var(--border)
- 바디 (td):
  - 패딩: 16px 24px
  - 하단 테두리: 1px solid var(--border-light)
- 행 호버: bg-slate-50/50
- 탭: 하단 2px primary 테두리로 활성 표시
- 페이지네이션: 하단 영역, bg-slate-50/30

### 3.5 Status Badge

```tsx
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  dot?: boolean;
}
```

**스타일 규칙:**
```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
  border: 1px solid;
}

/* Variants */
.status-success { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
.status-warning { background: #fffbeb; color: #92400e; border-color: #fde68a; }
.status-danger  { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
.status-info    { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
.status-neutral { background: #f8fafc; color: #475569; border-color: #e2e8f0; }

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
```

### 3.6 Grade Badge

```tsx
type GradeType = '중1' | '중2' | '중3' | '고1' | '고2' | '고3' | '기타';

interface GradeBadgeProps {
  grade: GradeType;
}
```

**스타일 규칙:**
```css
.grade-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  color: white;
  min-width: 36px;
}

/* Grade Colors */
.grade-중1 { background: #3b82f6; }  /* blue-500 */
.grade-중2 { background: #a855f7; }  /* purple-500 */
.grade-중3 { background: #ef4444; }  /* red-500 */
.grade-고1 { background: #f59e0b; }  /* amber-500 */
.grade-고2 { background: #10b981; }  /* emerald-500 */
.grade-고3 { background: #f97316; }  /* orange-500 */
.grade-기타 { background: #64748b; } /* slate-500 */
```

### 3.7 Button

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
  onClick?: () => void;
}
```

**스타일 규칙:**
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  cursor: pointer;
  border: none;
}

/* Sizes */
.btn-sm { padding: 6px 12px; font-size: 13px; }
.btn-md { padding: 10px 16px; font-size: 14px; }
.btn-lg { padding: 12px 24px; font-size: 15px; }

/* Variants */
.btn-primary {
  background: var(--primary);
  color: white;
  box-shadow: var(--shadow-sm);
}
.btn-primary:hover { background: var(--primary-dark); }

.btn-secondary {
  background: white;
  color: var(--text-primary);
  border: 1px solid var(--border);
}
.btn-secondary:hover { background: var(--background); }

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover { background: var(--background); }

.btn-danger {
  background: var(--danger);
  color: white;
}
.btn-danger:hover { background: #dc2626; }
```

### 3.8 Input & Select

```css
.input, .select {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input:focus, .select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.input::placeholder {
  color: var(--text-muted);
}

/* Search Input with Icon */
.input-search {
  padding-left: 40px;
}
```

### 3.9 Card

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.card-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-light);
}

.card-body {
  padding: 24px;
}

.card-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-light);
  background: var(--background);
}
```

---

## 4. 아이콘 시스템

**사용 라이브러리:** Material Symbols Outlined

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1" rel="stylesheet" />
```

### 주요 아이콘 매핑

| 용도 | 아이콘 |
|------|--------|
| 대시보드 | `dashboard` |
| 학생 | `person` / `group` |
| 일정 | `calendar_today` / `event` |
| 시험 | `assignment` / `quiz` |
| 성적 | `grade` / `analytics` |
| 리포트 | `description` / `article` |
| 설정 | `settings` |
| 검색 | `search` |
| 추가 | `add` |
| 수정 | `edit` / `edit_square` |
| 삭제 | `delete` |
| 다운로드 | `download` |
| 업로드 | `upload` |
| 새로고침 | `refresh` |
| 알림 | `notifications` |
| 폴더 | `folder` |
| 전송 | `send` |

---

## 5. 모듈별 라우팅 구조

### 5.1 Timer 모듈 (`/timer`)

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/timer` | 대시보드 | 요일별 시간표 뷰 |
| `/timer/realtime` | 실시간 | 현재 수업 현황 |
| `/timer/students` | 학생별 | 학생별 시간표 |
| `/timer/settings` | 설정 | 시간표 설정 |

### 5.2 Report 모듈 (`/report`)

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/report` | 로그인 | 선생님 선택 |
| `/report/teacher` | 입력 | 코멘트 입력 |
| `/report/admin` | 관리자 | 관리자 대시보드 |
| `/report/preview` | 미리보기 | 리포트 미리보기 |
| `/report/send` | 전송 | 개별 전송 |
| `/report/bulk-send` | 일괄전송 | 대량 전송 |
| `/report/students` | 학생관리 | 학생 정보 관리 |
| `/report/exams` | 시험관리 | 시험 정보 관리 |
| `/report/schedule` | 일정관리 | 시험 일정 관리 |
| `/report/settings` | 설정 | 앱 설정 |

### 5.3 Grader 모듈 (`/grader`)

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/grader` | 단건채점 | OMR 단건 채점 |
| `/grader/batch` | 일괄채점 | PDF + OMR 일괄 |
| `/grader/stats` | 통계 | 채점 통계 |
| `/grader/settings` | 설정 | 채점 설정 |

### 5.4 Schedule 모듈 (`/schedule`)

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/schedule` | 오늘시험 | 오늘 시험 일정 |
| `/schedule/pending` | 미지정 | 일정 미지정 학생 |
| `/schedule/upcoming` | 예정 | 예정된 시험 |
| `/schedule/history` | 이력 | 결시 이력 |

---

## 6. 공통 패턴

### 6.1 페이지 헤더 패턴

```tsx
<div className="page-header">
  <nav className="breadcrumb">
    <span>학사 관리</span>
    <ChevronRight />
    <span className="current">리소스 및 일정</span>
  </nav>
  <div className="header-content">
    <div>
      <h1>학생 리소스 및 일정 관리</h1>
      <p className="description">학기별 수업 시간표와 학생별 학습 자료 통합 관리</p>
    </div>
    <div className="actions">
      <Button variant="secondary" icon="download">엑셀 다운로드</Button>
      <Button variant="primary" icon="add">신규 등록</Button>
    </div>
  </div>
</div>
```

### 6.2 필터 바 패턴

```tsx
<div className="filter-bar">
  <div className="filter-group">
    <label>보기 유형</label>
    <ToggleGroup value={viewType} onChange={setViewType}>
      <Toggle value="daily">요일별</Toggle>
      <Toggle value="realtime">실시간</Toggle>
      <Toggle value="student">학생별</Toggle>
    </ToggleGroup>
  </div>
  <Divider />
  <div className="filter-group">
    <label>학년 필터</label>
    <ToggleGroup value={grade} onChange={setGrade}>
      <Toggle value="all">전체</Toggle>
      <Toggle value="중1">중1</Toggle>
      {/* ... */}
    </ToggleGroup>
  </div>
</div>
```

### 6.3 테이블 액션 패턴

```tsx
<div className="table-actions">
  <IconButton icon="edit_square" tooltip="수정" onClick={onEdit} />
  <IconButton icon="delete" variant="danger" tooltip="삭제" onClick={onDelete} />
</div>
```

---

## 7. 접근성 가이드라인

1. **색상 대비**: 모든 텍스트는 WCAG AA 기준 충족 (4.5:1 이상)
2. **포커스 표시**: 모든 인터랙티브 요소에 명확한 포커스 링
3. **키보드 네비게이션**: Tab으로 모든 요소 접근 가능
4. **스크린 리더**: 적절한 ARIA 레이블 사용
5. **클릭 영역**: 최소 44x44px 터치 타겟

---

## 8. 파일 구조

```
apps/desktop/
├── shared/
│   ├── styles/
│   │   ├── tokens.css          # CSS 변수 정의
│   │   ├── reset.css           # CSS 리셋
│   │   ├── components.css      # 공통 컴포넌트 스타일
│   │   └── utilities.css       # 유틸리티 클래스
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── DataDisplay/
│   │   │   ├── DataTable.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   └── GradeBadge.tsx
│   │   ├── Inputs/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   └── ToggleGroup.tsx
│   │   └── Feedback/
│   │       ├── Modal.tsx
│   │       ├── Toast.tsx
│   │       └── Spinner.tsx
│   └── hooks/
│       ├── useMediaQuery.ts
│       └── useClickOutside.ts
│
└── modules/
    ├── timer/
    ├── report/
    ├── grader/
    └── schedule/
```

---

## 9. 개발 체크리스트

### 새 컴포넌트 추가 시

- [ ] 디자인 토큰 사용 (하드코딩 금지)
- [ ] 반응형 고려
- [ ] 호버/포커스/액티브 상태 정의
- [ ] 다크모드 대응 (향후)
- [ ] 접근성 속성 추가
- [ ] TypeScript 타입 정의

### 새 페이지 추가 시

- [ ] 페이지 헤더 패턴 적용
- [ ] 브레드크럼 경로 설정
- [ ] 사이드바 메뉴 항목 추가
- [ ] 로딩 상태 처리
- [ ] 에러 상태 처리
- [ ] 빈 상태 (Empty State) 처리

---

## 10. 버전 히스토리

| 버전 | 날짜 | 변경사항 |
|------|------|----------|
| 1.0 | 2026-02-02 | 초기 디자인 시스템 문서 작성 |

---

*이 문서는 WAWA Smart ERP의 모든 프론트엔드 개발 시 참조해야 하는 공식 디자인 가이드입니다.*
