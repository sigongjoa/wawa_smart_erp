---
name: desktop-medterm audit
description: 강사 앱 의학용어 카테고리 audit (MedTermAdminPage)
---

# Audit — desktop-medterm

- **이슈**: [#119](https://github.com/sigongjoa/wawa_smart_erp/issues/119)
- **부모 epic**: #108
- **날짜**: 2026-05-02
- **대상 페이지**:
  - `apps/desktop/src/pages/MedTermAdminPage.tsx` (383)
  - `apps/desktop/src/pages/MedTermAdminPage.css` (153)

## Audit Health Score

| # | Dimension | 점수 | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 2/4 | aria-label 0건 — 신설 도메인이라 미적용 |
| 2 | Performance | 4/4 | 적정 사이즈 (383+153) |
| 3 | Theming | 4/4 | CSS hex 15→0, --medterm-signature 토큰 추가 |
| 4 | Responsive | 3/4 | 글로벌 미디어 의존 |
| 5 | Anti-Patterns | 4/4 | alert/confirm 0, 이모지 0 (P1 라운드에서 정리됨) |
| **Total** | | **17/20 (Good)** | 신설 도메인 정합성 회복 |

## Before / After 정량

| 지표 | Before | After |
|---|---|---|
| CSS hex 컬러 | 15 | **0** |
| 인라인 hex | 0 | 0 (이미 정합성) |
| `alert()` / `confirm()` | 0 | 0 |
| `<div onClick>` | 0 | 0 |
| 이모지 (정리됨) | 0 | 0 |

## 검사 결과

### Theming — 의학용어 도메인 시그니처 보존

**Before** (Material design 색 박혀 있음):
- `#8B0000` — 의학용어 시그니처 빨강 (보건고 톤)
- `#1565C0` — 정보 강조
- `#104a92` — hover
- `#FFEBEE`/`#B71C1C` — 위험 surface/text
- `#E8F5E9`/`#1B5E20`/`#2E7D32` — 성공 variants
- `#C62828` — 경계 보더
- `#e0e0e0`/`#f0f0f0`/`#ccc` — 보더 다층
- `#333`/`#555`/`#666`/`#888` — 텍스트 사다리
- `#f5f5f5`/`#fff` — 배경

**토큰 매핑**:
- `--medterm-signature: #8B0000` 신규 (도메인 시그니처 보존)
- `--medterm-signature-hover: #6a0000` 신규
- `#1565C0` → `var(--type-water)` (학생 앱과 통일)
- `#104a92` → `var(--primary-hover)`
- 텍스트 사다리 #333~#888 → `--text-primary/--text-secondary/--text-tertiary`
- 위험·성공 → `--danger-surface/--danger`, `--success-surface/--success`
- 보더 → `--border-primary/--border-secondary`
- 배경 → `--bg-secondary/--bg-tertiary`

**효과**:
- 데스크톱 + 학생 앱 양쪽에 `--medterm-signature` 도메인 토큰 존재 (이전 라운드에서 학생 토큰 추가)
- 신설 도메인 색이 토큰 시스템 안으로 통합됨

### Anti-Patterns

- ✓ `alert()`/`confirm()` 0건
- ✓ 이모지 0건 (P1 라운드에서 ✅⚠️ → lucide-react Check/AlertTriangle 치환됨)
- ✓ `<div onClick>` 0건

### Accessibility — 부족 (P2)

- aria-label 0건 — 신설 도메인이라 신경 못 쓴 흔적
- 학생 추가 입력·이미지 업로드 등 폼이 많은 페이지인데 라벨 매칭 검토 필요
- P2로 다음 라운드에 보강

### Performance

- TSX 383줄 / CSS 153줄 — 적정
- 이미지 업로드 + 챕터 관리 + 학생 진도 통합 — 단일 페이지에 합리적

### Responsive

- CSS `@media` 0건 — 글로벌 미디어에 의존
- Playwright 1024·768·375 캡처 백그라운드 실행 중

## 발견 P0/P1/P2/P3

### P0
- **없음**

### P1 (수정 완료)
- **[P1] CSS hex 15곳** → 토큰 (`--medterm-signature` 도메인 토큰 신규) ✓

### P2 (다음 라운드)
- aria-label 0건 → 폼·테이블에 보강
- 이미지 업로드 영역 키보드 접근성 검토

### P3 (Polish)
- `--medterm-signature` 다크 모드 매핑 (현재 light only)

## 변경 결과

- `apps/desktop/src/styles/tokens.css` — `--medterm-signature` / `--medterm-signature-hover` 추가
- `apps/desktop/src/pages/MedTermAdminPage.css` — 15 hex → 0

## 빌드 검증

- desktop vite build ✓
- Playwright 3 케이스 (1 페이지 × 3 뷰포트) 백그라운드 실행 중

## 카테고리 점수

**17/20 (Good)** — 신설 의학용어 도메인의 시그니처 컬러를 토큰화하면서도 도메인 정체성(짙은 적색) 보존. 라운드의 마지막 카테고리.
