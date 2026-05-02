---
name: desktop-student-mgmt audit
description: 강사 앱 학생 관리 카테고리 audit (StudentList, StudentProfile, Homeroom 계열)
---

# Audit — desktop-student-mgmt

- **이슈**: [#114](https://github.com/sigongjoa/scolar/wawa_smart_erp/issues/114)
- **부모 epic**: #108
- **날짜**: 2026-05-02
- **대상 페이지**:
  - `apps/desktop/src/pages/StudentListPage.tsx` (547)
  - `apps/desktop/src/pages/StudentProfilePage.tsx` (392)
  - `apps/desktop/src/pages/HomeroomPage.tsx` (335)
  - `apps/desktop/src/pages/HomeroomConsultationsPage.tsx` (219)
  - `apps/desktop/src/pages/HomeroomExamsPage.tsx` (184)
  - `apps/desktop/src/pages/HomeroomFollowUpsPage.tsx` (151)

## Audit Health Score

| # | Dimension | 점수 | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3/4 | role=alert/status, aria-live 일부 적용 |
| 2 | Performance | 3/4 | StudentListPage 547줄 — 큰 편이나 합리적 단일 페이지 |
| 3 | Theming | 4/4 | hex 잔존 0건 (수정 완료) |
| 4 | Responsive | 4/4 | 1024·768·375 가로 0 (15/15 ✓) |
| 5 | Anti-Patterns | 3/4 | alert/confirm 0건, CATEGORY_COLOR 객체 토큰화 |
| **Total** | | **17/20 (Good)** | 학생 관리 — desktop 카테고리 첫 audit |

## Before / After 정량

| 지표 | Before | After |
|---|---|---|
| 인라인 hex 컬러 | 7 | **0** |
| `CATEGORY_COLOR`/`STATUS_COLOR` 객체 (HomeroomPage·HomeroomConsultations) | 8 | **0** |
| `color="#dc2626"` 같은 prop hex | 3 | **0** |
| `alert()` / `confirm()` | 0 | 0 (이미 없음) |
| `<div onClick>` | 0 | 0 (이미 없음) |

## 검사 결과

### Theming — 객체 매핑 토큰화

**HomeroomPage / HomeroomConsultationsPage** — 같은 4-카테고리 컬러 매핑이 두 곳에 중복 정의:

```tsx
// Before
const CATEGORY_COLOR = {
  monthly: '#2563eb',     // info-blue
  pre_exam: '#d97706',    // amber
  post_exam: '#7c3aed',   // purple
  ad_hoc: '#64748b',      // slate
};

// After
const CATEGORY_COLOR = {
  monthly: 'var(--info)',
  pre_exam: 'var(--warning)',
  post_exam: 'var(--primary)',
  ad_hoc: 'var(--text-tertiary)',
};
```

**HomeroomFollowUpsPage** — 3색 prop:
```tsx
<Bucket title="기한 경과" color="#dc2626" ... />  → color="var(--danger)"
<Bucket title="오늘"      color="#d97706" ... />  → color="var(--warning)"
<Bucket title="예정"      color="#2563eb" ... />  → color="var(--info)"
```

**HomeroomExamsPage** — D-day border color 조건문:
```tsx
borderColor: d <= 3 ? 'var(--danger-text)' : d <= 7 ? '#d97706' : '#2563eb'
→ d <= 3 ? 'var(--danger-text)' : d <= 7 ? 'var(--warning)' : 'var(--info)'
```

**StudentProfilePage** — 에러 배너 인라인 hex 5색 → 토큰 (`--danger-surface` / `--danger`).

**HomeroomConsultationsPage** — 미상담 강조 좌측 보더 `#d97706` → `var(--warning)`.

### Anti-Patterns — 좋은 점

- ✓ `alert()` / `confirm()` 0건 (이미 다른 패턴 사용 중)
- ✓ `<div onClick>` 0건
- ✓ HomeroomFollowUpsPage `aria-live="polite"` (로딩 상태 스크린 리더)
- ✓ StudentProfilePage `role="alert"` 에러 배너

### Performance

- StudentListPage 547줄 — 학생 관리 통합 페이지, 분할 시 흐름이 끊겨 단일 유지 합리적
- HomeroomPage 335줄·HomeroomConsultations 219·Exams 184·FollowUps 151 — 모두 적정

### Responsive

- 데스크톱 우선 설계 (1024 가정), 768·375 검증 통과
- Playwright 5개 페이지 × 3 뷰포트 = **15/15 가로 스크롤 0px** ✓
- 캡처: `screenshots/desktop-student-mgmt/{student-list,homeroom,consultations,exams,follow-ups}-{1024,768,375}.png`
- index.css의 `@media (max-width: 768px)` / `(640px)` 16곳 적용 확인됨

## 발견 P0/P1/P2/P3

### P0
- **없음**

### P1 (수정 완료)
- **[P1] CATEGORY_COLOR/STATUS_COLOR 객체 hex 매핑** → 토큰 ✓
- **[P1] color prop hex** (HomeroomFollowUps Bucket) → 토큰 ✓
- **[P1] inline hex (StudentProfile, HomeroomConsultations, HomeroomExams)** → 토큰 ✓

### P2 (다음 라운드)
- 768px·375px 모바일 시각 검증 (Playwright preview 서버 환경 정비 후)
- StudentListPage 547줄 — 검색/필터/리스트 부분을 컴포넌트로 추출 검토

### P3 (Polish)
- HomeroomFollowUpsPage `Bucket`이 페이지 내부 함수 — 다른 곳에서도 쓸 만하면 공통 컴포넌트화

## 변경 결과

- `apps/desktop/src/pages/HomeroomPage.tsx` — CATEGORY_COLOR 4색 토큰화
- `apps/desktop/src/pages/HomeroomConsultationsPage.tsx` — CATEGORY_COLOR 4색 + 좌측 보더 토큰화
- `apps/desktop/src/pages/HomeroomExamsPage.tsx` — D-day borderColor 토큰화
- `apps/desktop/src/pages/HomeroomFollowUpsPage.tsx` — Bucket color prop 3색 토큰화
- `apps/desktop/src/pages/StudentProfilePage.tsx` — 에러 배너 inline 5색 토큰화

## 빌드 검증

- desktop vite build ✓
- Playwright 1024·768·375 × 5 페이지 = 15/15 ✓ (`apps/desktop/e2e/student-mgmt-audit-live.spec.ts`)

## 카테고리 점수

**17/20 (Good)** — 코드 차원의 토큰 정합성 완료, 1024/768/375 모바일·태블릿 동작 모두 통과.
