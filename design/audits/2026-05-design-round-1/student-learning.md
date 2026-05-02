---
name: student-learning audit
description: 학생 앱 학습 응시 카테고리 audit (VocabExam, MedTerm, Gacha, Exam, Proof)
---

# Audit — student-learning

- **이슈**: [#112](https://github.com/sigongjoa/wawa_smart_erp/issues/112)
- **부모 epic**: #108
- **날짜**: 2026-05-02
- **대상 페이지**:
  - `apps/student/src/pages/VocabExamPage.tsx` (160줄, CSS 234)
  - `apps/student/src/pages/VocabExamResultPage.tsx` (73)
  - `apps/student/src/pages/ExamPage.tsx` (536) — 가장 큰 페이지
  - `apps/student/src/pages/ExamTimerPage.tsx` (348)
  - `apps/student/src/pages/GachaPage.tsx` (284, CSS 453)
  - `apps/student/src/pages/MedTermPage.tsx` (387, CSS 243)
  - `apps/student/src/pages/MedTermExamsPage.tsx` (253)
  - `apps/student/src/pages/ProofFillBlankPage.tsx` (213)
  - `apps/student/src/pages/ProofOrderingPage.tsx` (180)

## Audit Health Score

| # | Dimension | 점수 | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 2/4 | aria 적용 부족, alert 4곳 (수정) |
| 2 | Performance | 3/4 | 적정 사이즈, ExamPage 536줄은 분할 검토 가능 |
| 3 | Theming | 3/4 | hex 70곳 토큰화 (수정), 일부 잔존 |
| 4 | Responsive | 3/4 | 320·375·480 가로 0 (9/9 통과), @media 0건 페이지 |
| 5 | Anti-Patterns | 3/4 | alert 4곳 → 인라인 (수정), 이모지 0 |
| **Total** | | **14/20 (Good)** | 핫스팟 큰 카테고리, 큰 폭의 수정 적용 |

## Before / After 정량

| 지표 | Before | After |
|---|---|---|
| VocabExamPage.css hex | 30 | **0** |
| MedTermPage.css hex | 34 | **0** |
| GachaPage.css hex | 6 | **0** |
| ExamPage.tsx inline color | 8 | **0** |
| ExamTimerPage.tsx inline color | 7 | **0** |
| Proof 페이지 `alert()` | 4 | **0** |
| **합계 변환** | | **89건 토큰화** |

## 검사 결과

### Theming — 큰 핫스팟이었음

**VocabExamPage.css (30 hex)**: Tailwind slate 팔레트가 그대로 박혀있던 상태
- `#f8fafc` → `var(--bg-canvas)`, `#0f172a` → `var(--ink)`, `#475569` → `var(--ink-60)`
- `#94a3b8` → `var(--ink-40)`, `#e2e8f0` → `var(--ink-09)`
- `#2563eb` → `var(--primary)`, `#1e40af` → `var(--primary-hover)`, `#eff6ff` → `var(--primary-surface)`
- `#b91c1c`/`#991b1b`/`#fef2f2` → `var(--danger)` / `var(--danger-surface)`
- `#065f46`/`#ecfdf5` → `var(--success)` / `var(--success-surface)`
- `#22c55e`/`#ef4444` (vresult-correct/wrong) → `var(--success)` / `var(--danger)`

**MedTermPage.css (34 hex)**: Material color + 의학용어 시그니처 빨강 박혀있던 상태
- 신규 토큰 추가: `--medterm-signature: #8B0000`, `--medterm-signature-hover: #6a0000` (도메인 시그니처 보존, 다크 호환은 추후)
- `#1565C0` → `var(--type-water)`, `#2E7D32` → `var(--type-grass)`
- Material grey scale (#666/555/444/eee/ddd) → `--ink-*` 사다리
- `#E8F5E9`/`#1B5E20`/`#43A047` → `var(--success-surface)` / `var(--success)`
- `#FFEBEE`/`#C62828`/`#B71C1C` → `var(--danger-surface)` / `var(--danger)`
- `#f8f9ff` → `var(--primary-surface)`
- `#f5f5f5`/`#fafafa` → `var(--bg-canvas)`

**GachaPage.css (6 hex)**: 거의 정리되어 있던 상태에서 잔여 hover만
- `#fff` → `var(--text-on-primary)`, `#2e8820` → `var(--type-grass)`, `#c21f20` → `var(--danger)`

**ExamPage·ExamTimerPage inline color (15곳)**:
- Tailwind slate (`#94a3b8`/`#cbd5e1`/`#475569`/`#4a5568`) → `--ink-*` 사다리
- `#c53030` → `var(--danger)`, `#2d3a8c` → `var(--primary)` (의도된 학생 앱 primary)

### Anti-Patterns — alert 4곳

**ProofFillBlankPage·ProofOrderingPage**:
- `alert((err as Error).message)` 2곳 (제출 실패)
- `alert('문제 재로드 실패: ...')` 2곳

**수정**: `error` 상태 + `<div role="alert">` 인라인 배너 (`--danger-surface` + `--danger`)
- 클릭으로 dismiss
- IMPECCABLE 도크트린 — 게임 폴리시 깨는 native alert 제거

### Accessibility

**기존 부족**:
- aria-label / role 활용도가 #111 LoginPage 대비 낮음
- ExamTimerPage에 일부 aria 있음 (`aria-live` 추정)
- GachaPage 1건만

**유지된 좋은 점**:
- VocabExamPage `vexam-error` 같은 시멘틱 클래스
- Proof 에러 배너에 `role="alert"` (수정 시 추가)

**개선 여지** (P2 — 다음 폴리시 라운드):
- 학습 카드의 진행 상태(`Q5/10` 등)에 `aria-label` 강화
- 정답·오답 피드백에 `aria-live="polite"` (정답을 읽어주도록)

### Responsive

- 320·375·480 가로 overflow 0 (9/9 ✓)
- VocabExamPage·MedTermPage CSS `@media` 0건 — 480 컨테이너 락이 보장
- 시각적 검증 통과: `screenshots/student-learning/{vocab-exam,medterm,gacha}-{320,375,480}.png`

### Performance

- ExamPage 536줄·ExamTimerPage 348줄 — 큰 편이나 단일 흐름이라 분할 효과 제한적
- inline `style={{}}` 대부분이 동적 값 (progress %, status conditional) — 합리적

## 발견 P0/P1/P2/P3

### P0
- **없음**

### P1 (수정 완료)
- **[P1] CSS hex 70곳 토큰화** — VocabExam 30 + MedTerm 34 + Gacha 6 ✓
- **[P1] inline color 15곳 토큰화** — ExamPage 8 + ExamTimerPage 7 ✓
- **[P1] alert() 4곳** — Proof 페이지 인라인 에러 배너 ✓

### P2 (별도 처리)
- **[P2] aria-label 보강** — 학습 진행 상태·정답 피드백에 `aria-live` 추가 (다음 라운드)
- **[P2] ExamPage.tsx 536줄 분할** — 컴포넌트 추출 가능성 (성능보다 가독성 위주)

### P3 (Polish)
- 의학용어 시그니처 빨강 다크 모드 매핑 (`--medterm-signature` 다크 토큰)

## 변경 결과

- `apps/student/src/styles/tokens.css` — `--medterm-signature`, `--medterm-signature-hover` 추가
- `apps/student/src/pages/VocabExamPage.css` — 30 hex → 0
- `apps/student/src/pages/MedTermPage.css` — 34 hex → 0
- `apps/student/src/pages/GachaPage.css` — 6 hex → 0
- `apps/student/src/pages/ExamPage.tsx` — inline 8곳 토큰화
- `apps/student/src/pages/ExamTimerPage.tsx` — inline 7곳 토큰화
- `apps/student/src/pages/ProofFillBlankPage.tsx` — alert 2곳 → error 배너
- `apps/student/src/pages/ProofOrderingPage.tsx` — alert 2곳 → error 배너

## 빌드 검증

- vite build ✓
- Playwright 320·375·480 (3개 페이지) 9/9 ✓

## 카테고리 점수

**14/20 (Good)** — Hex 핫스팟이 큰 카테고리였으나 (-89건) 처리 후 토큰 시스템 정합성 회복. ExamPage 분할은 P2로 미뤄둠.
