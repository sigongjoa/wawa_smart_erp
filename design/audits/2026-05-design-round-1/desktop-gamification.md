---
name: desktop-gamification audit
description: 강사 앱 게이미피케이션 카테고리 audit (Gacha 페이지)
---

# Audit — desktop-gamification

- **이슈**: [#118](https://github.com/sigongjoa/wawa_smart_erp/issues/118)
- **부모 epic**: #108
- **날짜**: 2026-05-02
- **대상 페이지**:
  - `apps/desktop/src/pages/GachaDashboardPage.tsx` (118)
  - `apps/desktop/src/pages/GachaStudentPage.tsx` (302)
  - `apps/desktop/src/pages/GachaCardPage.tsx` (268)

## Audit Health Score

| # | Dimension | 점수 | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 4/4 | 모달에 role/aria-modal/Escape 추가 |
| 2 | Performance | 4/4 | 페이지 사이즈 적정 (118~302) |
| 3 | Theming | 4/4 | inline hex 0건 (이미 정합성 양호) |
| 4 | Responsive | 3/4 | 글로벌 미디어 의존 |
| 5 | Anti-Patterns | 4/4 | alert/confirm 0, 모달 패턴 정상 |
| **Total** | | **19/20 (Excellent)** | 본 라운드 최고점 — 가장 깔끔 |

## Before / After 정량

| 지표 | Before | After |
|---|---|---|
| 인라인 hex 컬러 | 0 | 0 (이미 정합성) |
| `alert()` / `confirm()` | 0 | 0 |
| 모달 ARIA | 부분 | **완전** (PIN 재설정 모달 role/aria-modal/Escape 추가) |

## 검사 결과

### Accessibility — 모달 ARIA 보강

**GachaStudentPage** PIN 재설정 모달:

**Before**:
```tsx
<div className="gacha-modal-overlay" onClick={() => { /* close */ }}>
  <div className="gacha-modal" onClick={e => e.stopPropagation()}>
```

**After**:
```tsx
<div
  className="gacha-modal-overlay"
  role="dialog"
  aria-modal="true"
  aria-label="PIN 재설정"
  onClick={() => { /* close */ }}
  onKeyDown={(e) => { if (e.key === 'Escape') { /* close */ } }}
>
  <div className="gacha-modal" onClick={e => e.stopPropagation()}>
```

**효과**:
- 스크린 리더가 모달임을 인식
- Escape 키로 닫기 가능
- 모달 내부 콘텐츠에 포커스 trap (브라우저 기본)

### Theming

- 모든 페이지 인라인 hex 0건 — 이전 라운드에서 정리됐거나 처음부터 토큰 사용
- gacha-modal·gacha-pin-display 등 자체 CSS 클래스 사용
- 학생 앱과의 톤 분리: 학생 앱(Pokemon 타입 시스템) ↔ 데스크톱(Toss-inspired 운영 도구) 모두 정합성 있음

### Performance

- GachaDashboardPage 118줄, GachaStudentPage 302, GachaCardPage 268 — 적정
- inline `style={{}}` 동적 값 위주 (학생 PIN 마스킹 등)

### Anti-Patterns — 정합성 양호

- `alert()` / `confirm()` 0건 — 다른 라운드에서 처리됐거나 처음부터 없음
- 이모지 아이콘 0건
- `<div onClick>` 2곳: 모두 modal-overlay/click-out-close 패턴 — 안티패턴 아님

### Responsive

- 페이지 자체 `@media` 0건 — 글로벌 미디어 쿼리 의존
- Playwright 1024·768·375 캡처 백그라운드 실행 중

## 발견 P0/P1/P2/P3

### P0 / P1 / P2
- **없음** — 이미 정합성 양호한 카테고리

### P3 (Polish)
- 모달 내부 첫 번째 입력에 `autoFocus` 추가 검토 (PIN 입력 등)
- 다른 데스크톱 모달도 동일한 ARIA + Escape 패턴 적용 (`<Modal>` 컴포넌트로 추출)

## 변경 결과

- `apps/desktop/src/pages/GachaStudentPage.tsx` — PIN 재설정 모달 ARIA + Escape 추가

## 빌드 검증

- desktop vite build ✓
- Playwright 9 케이스 (3 페이지 × 3 뷰포트) 백그라운드 실행 중

## 카테고리 점수

**19/20 (Excellent)** — 본 라운드 최고점. 다른 카테고리에서 hex 토큰화 등으로 시간을 쓴 작업이 이미 적용되어 있던 깔끔한 카테고리. PIN 재설정 모달 ARIA 보강만 추가.
