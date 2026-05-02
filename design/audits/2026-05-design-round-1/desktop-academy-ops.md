---
name: desktop-academy-ops audit
description: 강사 앱 학원 운영 카테고리 audit (Academy/Settings/Teachers/Invites)
---

# Audit — desktop-academy-ops

- **이슈**: [#116](https://github.com/sigongjoa/wawa_smart_erp/issues/116)
- **부모 epic**: #108
- **날짜**: 2026-05-02
- **대상 페이지**:
  - `apps/desktop/src/pages/AcademyPage.tsx` (36)
  - `apps/desktop/src/pages/SettingsPage.tsx` (95)
  - `apps/desktop/src/pages/VocabAdminPage.tsx` (63)
  - `apps/desktop/src/components/academy/AcademyInfoForm.tsx` (128)
  - `apps/desktop/src/components/academy/InvitePendingList.tsx` (196)
  - `apps/desktop/src/components/academy/TeacherAddModal.tsx` (115)
  - `apps/desktop/src/components/academy/TeacherEditModal.tsx` (209)
  - `apps/desktop/src/components/academy/TeacherList.tsx` (145)

## Audit Health Score

| # | Dimension | 점수 | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3/4 | useConfirm 3곳 적용, 폼 라벨 `htmlFor` 사용 양호 |
| 2 | Performance | 4/4 | 페이지·컴포넌트 모두 적정 사이즈 (36~209줄) |
| 3 | Theming | 4/4 | inline hex 40→0 |
| 4 | Responsive | 3/4 | 글로벌 미디어 의존 |
| 5 | Anti-Patterns | 4/4 | window.confirm 3→0 (useConfirm) |
| **Total** | | **18/20 (Good)** | 코드 품질 깔끔, 본 라운드 최고점 |

## Before / After 정량

| 지표 | Before | After |
|---|---|---|
| 인라인 hex 컬러 | 40 | **0** |
| `window.confirm()` | 3 | **0** (useConfirm) |
| `<div onClick>` | 0 | 0 |
| 이모지 아이콘 | 0 | 0 |

## 검사 결과

### Theming — 40 hex 토큰화

**핫스팟**: AcademyInfoForm·InvitePendingList·TeacherList·TeacherEditModal — 폼·테이블 위주 컴포넌트라 inline 색이 많았음.

**매핑**:
- `#888`/`#9ca3af` → `var(--text-tertiary)`
- `#555`/`#666` → `var(--text-secondary)`
- `#444` → `var(--text-primary)`
- `#ddd`/`#ccc`/`#e5e7eb` → `var(--border-primary)`
- `#eee`/`#f5f5f5` → `var(--border-secondary)` / `var(--bg-tertiary)`
- `#fff` → `var(--bg-secondary)` / `var(--text-on-primary)`
- `#fafafa`/`#f9f9f9` → `var(--bg-tertiary)`
- `#f0f7ff` (info bg) → `var(--info-surface)`
- `#4a90d9` → `var(--info)`
- `#ede9fe` (purple bg, 관리자 배지) → `var(--primary-surface)`
- `#6d28d9` → `var(--primary)`
- `#fef3c7` (warning bg) → `var(--warning-surface)`
- `#22c55e` → `var(--success)`, `#16a34a` → `var(--success)`
- `#dc2626` → `var(--danger)`, `#e53e3e` → `var(--danger)`
- `#fecaca` (border) → `var(--danger-surface)`

### Anti-Patterns — `window.confirm()` 3곳

`apps/desktop/src/components/Toast.tsx`의 `useConfirm()` 훅 적용:

- **TeacherEditModal**:
  - PIN 재설정 확인 dialog
  - 비활성화 확인 dialog
- **InvitePendingList**:
  - 초대 코드 취소 확인 dialog

각 컴포넌트 return 끝에 `{ConfirmDialog}` 추가.

**효과**:
- `role="dialog" aria-modal="true"` (a11y 자동)
- Escape 키 자동 지원
- DESKTOP.md 운영 도구 톤 일관성 (native dialog 제거)

### Accessibility

**좋은 점**:
- 모든 입력에 `htmlFor` 라벨 매칭 (`edit-name`, `edit-subjects` 등)
- VocabAdminPage `aria-label` 2건 적용
- `disabled` 속성 + `disabled={isSelf}` 자기 자신 권한 변경 방지

**기존 부족** (P3):
- TeacherList 테이블에 `<caption>` 없음 — 스크린 리더 컨텍스트
- 임시 PIN 표시 영역에 `aria-live` 추가 검토

### Performance

- 페이지·컴포넌트 모두 적정 (36~209줄, 평균 130줄)
- 인라인 style 모두 동적 또는 합리적 정적 (그리드 레이아웃 등)

### Responsive

- 페이지 자체 `@media` 0건
- 글로벌 index.css 미디어 쿼리에 의존
- Playwright 1024·768·375 캡처 백그라운드 실행 중

## 발견 P0/P1/P2/P3

### P0
- **없음**

### P1 (수정 완료)
- **[P1] inline hex 40곳** → 토큰 ✓
- **[P1] window.confirm() 3곳** → useConfirm ✓

### P2 (다음 라운드)
- 폼·테이블 inline style을 클래스 추출 (정적 스타일)

### P3 (Polish)
- TeacherList `<caption>` 추가
- 임시 PIN 영역 `aria-live` 검토
- `<details>` 사용한 Invite 사용 이력 — 키보드 토글 시 포커스 명시

## 변경 결과

- `apps/desktop/src/pages/SettingsPage.tsx` — inline 색 토큰화
- `apps/desktop/src/components/academy/AcademyInfoForm.tsx` — 라벨 색 토큰화
- `apps/desktop/src/components/academy/InvitePendingList.tsx` — 색 + window.confirm → useConfirm
- `apps/desktop/src/components/academy/TeacherAddModal.tsx` — inline 색 정리
- `apps/desktop/src/components/academy/TeacherEditModal.tsx` — 색 + window.confirm 2곳 → useConfirm
- `apps/desktop/src/components/academy/TeacherList.tsx` — 배지/상태 색 토큰화

## 빌드 검증

- desktop vite build ✓
- Playwright 6 케이스 백그라운드 실행 중

## 카테고리 점수

**18/20 (Good)** — 본 라운드 최고점. 페이지 사이즈가 적정하고 inline hex 정리만 처리하면 됐던 깔끔한 카테고리. 라운드 누적 alert/confirm 제거 **20건** (HomePage 3 + Proof 4 + AssignmentDetail 4 + vocab 6 + academy 3).
