---
name: desktop-content-distribution audit
description: 강사 앱 교재·배포 카테고리 audit (Parent / Report / Board)
---

# Audit — desktop-content-distribution

- **이슈**: [#117](https://github.com/sigongjoa/wawa_smart_erp/issues/117)
- **부모 epic**: #108
- **날짜**: 2026-05-02
- **대상 페이지**:
  - `apps/desktop/src/pages/ReportPage.tsx` (702) — 리포트 입력
  - `apps/desktop/src/pages/ParentReportPage.tsx` (665) — 학부모 리포트 (외부 노출)
  - `apps/desktop/src/pages/ParentHomeworkPage.tsx` (314) — 학부모 과제
  - `apps/desktop/src/pages/ParentLessonsPage.tsx` (178) — 학부모 진도
  - `apps/desktop/src/pages/BoardPage.tsx` (530)
  - `apps/desktop/src/components/ParentTokenGate.tsx` (106) — 외부 노출 게이트

## Audit Health Score

| # | Dimension | 점수 | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 4/4 | aria-label 28건 (페이지당 평균 5건) |
| 2 | Performance | 3/4 | ParentReport·Report 600+줄, 분할 검토 가능 |
| 3 | Theming | 4/4 | inline hex 11→0 |
| 4 | Responsive | 3/4 | 외부 노출 페이지는 모바일 우선 적정 |
| 5 | Anti-Patterns | 4/4 | alert/confirm 0, ParentTokenGate 토큰화됨 (이전 작업) |
| **Total** | | **18/20 (Good)** | 외부 노출 페이지 정합성 회복 |

## Before / After 정량

| 지표 | Before | After |
|---|---|---|
| 인라인 hex 컬러 | 11 | **0** |
| `alert()` / `confirm()` | 0 | 0 (이미 없음) |
| `<div onClick>` | 3 | 3 (BoardPage modal-overlay/content — 정상 패턴) |
| aria 적용 | 28건 | 28건 (이미 양호) |

## 검사 결과

### Theming — 11 hex 토큰화 (Tailwind gray 매핑)

**ParentHomeworkPage 핫스팟** (10곳):
- `#fafbfc` (page bg) → `var(--bg-primary)`
- `#6b7280` → `var(--text-secondary)` (gray-500)
- `#1a1d24` → `var(--text-primary)`
- `#4b5563` → `var(--text-secondary)` (gray-600)
- `#374151` → `var(--text-primary)` (gray-700)
- `#1f2937` → `var(--text-primary)` (gray-800)
- `#9ca3af` → `var(--text-tertiary)` (gray-400)
- `border: 4px solid #fff` (이미지 보더) → `var(--bg-secondary)`

**ParentTokenGate**: `#999` → `var(--text-tertiary)`

### Anti-Patterns — 외부 노출 페이지 안전

- `<div onClick>` 3곳: 모두 `BoardPage`의 modal-overlay/click-out-close 패턴 — 안티패턴 아님
- alert/confirm 0건 (이전 라운드에서 처리됐거나 원래 없음)
- 외부 노출 (`ParentReportPage`, `ParentHomeworkPage`, `ParentLessonsPage`) — 디자인 일관성 첫인상 중요한 페이지들 정합성 OK

### Accessibility

**좋은 점**:
- ARIA 평균 5건/페이지 — 데스크톱 카테고리 중 가장 충실
- `ParentTokenGate` `role="alert"` (에러), `aria-live` 적용
- `ReportPage` 8건, `ParentReportPage` 8건 — 외부 학부모 노출 페이지 SR 친화

### Performance

- `ReportPage` 702줄 / `ParentReportPage` 665줄 — 큰 편이지만 인쇄/요약/전송 통합이라 분할 시 흐름 깨짐
- 다른 페이지는 적정 (106~530줄)

### Responsive

- 학부모 페이지(외부 노출)는 모바일 우선 가정 — 폰에서 클릭 많음
- BoardPage·ReportPage는 데스크톱 우선
- index.css 글로벌 미디어 쿼리 적용

## 발견 P0/P1/P2/P3

### P0
- **없음**

### P1 (수정 완료)
- **[P1] inline hex 11곳** → 토큰 ✓

### P2 (다음 라운드)
- ReportPage·ParentReportPage 분할 검토 (700+줄)
- 외부 노출 페이지의 OG meta·preview 디자인 점검

### P3 (Polish)
- ParentLessonsPage CSS 파일(224줄) 보유 — 인라인 스타일과 혼재 검토

## 변경 결과

- `apps/desktop/src/pages/ParentHomeworkPage.tsx` — 10 inline hex 토큰화
- `apps/desktop/src/components/ParentTokenGate.tsx` — `#999` 토큰화
- (다른 파일들은 이미 정합성 양호)

## 빌드 검증

- desktop vite build ✓
- Playwright 6 케이스 백그라운드 실행 중

## 카테고리 점수

**18/20 (Good)** — 외부 노출 페이지가 많은 카테고리지만 ARIA·anti-pattern 측면에서 이미 잘 관리되고 있었음. 본 라운드에서는 inline hex 정리만 처리.
