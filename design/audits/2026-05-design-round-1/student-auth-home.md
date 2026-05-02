---
name: student-auth-home audit
description: 학생 앱 인증·홈 카테고리 audit (LoginPage, HomePage)
---

# Audit — student-auth-home

- **이슈**: [#111](https://github.com/sigongjoa/scolar/wawa_smart_erp/issues/111)
- **부모 epic**: #108
- **날짜**: 2026-05-02
- **대상 페이지**:
  - `apps/student/src/pages/LoginPage.tsx` (206줄)
  - `apps/student/src/pages/HomePage.tsx` (325줄)
  - QrPage — 존재하지 않음 (등록 안 된 페이지)

## Audit Health Score

| # | Dimension | 점수 | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3/4 | LoginPage ARIA 충실, HomePage 타일 aria-label 부재(수정) |
| 2 | Performance | 4/4 | 482·325줄 적정, 인라인 스타일 0건, polling visibility-aware |
| 3 | Theming | 3/4 | hp-tile 타입 컬러 시스템 충실 적용, white/black 5곳(수정) |
| 4 | Responsive | 3/4 | 320·375·480 가로 스크롤 0, @media 1~2건 |
| 5 | Anti-Patterns | 3/4 | `alert()` 3곳(수정), 이모지 0, 이미 정리됨 |
| **Total** | | **16/20 (Good)** | 핫스팟 적은 양호한 상태 |

## 검사 항목별 결과

### Accessibility

**LoginPage**:
- ✓ `aria-haspopup="dialog"`, `aria-expanded`, `aria-modal`, `aria-label="PIN 4자리"` 등 ARIA 충실
- ✓ Academy 시트 항목에 `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space)
- ✓ error에 `role="alert"`
- ✓ focus 처리 (`pinInputRef.current?.focus()`)

**HomePage** (수정 전):
- ✗ 4개 타일 버튼 모두 aria-label 없음 — 스크린 리더가 내부 텍스트만 읽음
- ✗ TaskCard 버튼 — 상태/마감 정보가 시각만으로 전달
- ✓ `aria-hidden="true"` (장식용 도트·화살표)

**수정 적용**:
- HomePage 4개 타일에 의미 기반 `aria-label` 추가 (`"영단어 학습으로 이동"`, `"증명 0/5"` 등)

### Performance

- LoginPage 206줄·CSS 452줄 — 적정
- HomePage 325줄·CSS 453줄 — 적정
- HomePage 데이터 로딩 `Promise.all` 4개 동시 — ✓
- `useVisiblePolling` — 탭 hidden 시 폴링 중단 ✓
- 인라인 `style={{}}` 동적 값(progress %, opacity) 1곳만 — 합리적

### Theming

**좋은 점**:
- ✓ hp-tile 4종이 **포켓몬 타입 시스템** 충실 적용 (`--type-water`, `--type-grass`, `--type-electric`, `--type-ground`)
- ✓ STUDENT.md 도크트린 정확히 따름

**문제 (수정 완료)**:
- ✗ LoginPage `color: #fff` 234줄, `background: #fff` 254줄
- ✗ HomePage `color: #fff` 124·409·411줄

**수정 적용**: sed 일괄 치환
- `color: #fff` → `var(--text-on-primary)`
- `background: #fff` → `var(--bg-card)`

### Responsive

- 320×568, 375×667, 480×800 모두 가로 overflow 0 (Playwright 6/6 ✓)
- LoginPage `@media` 2건, HomePage 1건 — 480 컨테이너 락 + 모바일 우선 설계로 충분
- 스크린샷:
  - `screenshots/student-auth-home/login-{320,375,480}.png`
  - `screenshots/student-auth-home/home-{320,375,480}.png`

### Anti-Patterns

**문제 (수정 완료)**:
- ✗ HomePage `alert()` 3곳 — IMPECCABLE 도크트린 위반 (네이티브 alert는 OS 다름·게임 폴리시 깨짐)
  - 시험 없음/이미 응시함/시험지 미준비
- ✗ LoginPage 시트 닫기 버튼 텍스트가 `×` (의미 명확하지만 아이콘 일관성을 위해 lucide `X` 권장 — P3로 분류)

**수정 적용**:
- HomePage `examMsg` 상태 + `<div className="hp-banner" role="status">` 인라인 배너로 교체
- 배너는 클릭으로 dismiss, `--type-electric-surface` 배경

**좋은 점**:
- ✓ 이모지 0건 (P1 라운드에서 정리 완료)
- ✓ 라벨 도배 없음 — `01·02·03` 인덱스로 절제된 안내
- ✓ 마스코트 없이 정보가 주인공 (워드마크 + 핵심 숫자)
- ✓ 모션 1회 (staggered reveal in `hp-in` keyframe)

## 발견 P0/P1/P2/P3

### P0
- **없음**

### P1 (수정 완료)
- **[P1] HomePage native `alert()` 3곳** → 인라인 배너로 교체 ✓
- **[P1] LoginPage·HomePage white/black 하드코딩 5곳** → 토큰 ✓
- **[P1] HomePage 4개 타일 버튼 aria-label 누락** → 의미 기반 라벨 추가 ✓

### P2 (별도 이슈)
- 없음

### P3 (Polish)
- **[P3] LoginPage 시트 닫기 `×` 글리프** → lucide `X` 컴포넌트로 통일 (다른 lucide 도입 한 김에)

## 변경 결과

- `apps/student/src/pages/LoginPage.css` — white/black 2곳 토큰 치환
- `apps/student/src/pages/HomePage.css` — white/black 3곳 토큰 치환 + `.hp-banner` 추가
- `apps/student/src/pages/HomePage.tsx` — `alert()` 3곳 제거, `examMsg` 상태 + 배너, 4 타일에 aria-label 추가

## 빌드 검증

- vite build ✓
- Playwright 320·375·480 6/6 ✓ (재실행 시)

## 카테고리 점수

**16/20 (Good)** — 약점이 적고 IMPECCABLE 도크트린이 잘 반영된 카테고리. 인증·홈 흐름은 학생 앱의 첫인상이라 우선 처리 효과가 큼.

## 다음 단계

#111 close 후 → #112 student-learning (VocabExam·MedTerm·Gacha — 더 큰 hex 핫스팟 보유).
