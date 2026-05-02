---
name: desktop-learning-content audit
description: 강사 앱 학습 콘텐츠 카테고리 audit (vocab/exam/lessons/curriculum)
---

# Audit — desktop-learning-content

- **이슈**: [#115](https://github.com/sigongjoa/wawa_smart_erp/issues/115)
- **부모 epic**: #108
- **날짜**: 2026-05-02
- **대상 페이지**:
  - `apps/desktop/src/pages/vocab/VocabGradeTab.tsx` (415)
  - `apps/desktop/src/pages/vocab/VocabPolicyTab.tsx` (418)
  - `apps/desktop/src/pages/vocab/VocabWordsTab.tsx` (352)
  - `apps/desktop/src/pages/vocab/VocabWrongTab.tsx` (184)
  - `apps/desktop/src/pages/vocab/VocabWordModal.tsx`
  - `apps/desktop/src/pages/ExamManagementPage.tsx` (1014) — 가장 큰 페이지
  - `apps/desktop/src/pages/ExamPapersPage.tsx` (559)
  - `apps/desktop/src/pages/ExamQuestionEditorPage.tsx` (292)
  - `apps/desktop/src/pages/ExamResultPage.tsx` (195)
  - `apps/desktop/src/pages/ExamTimerPage.tsx` (559)
  - `apps/desktop/src/pages/StudentLessonsPage.tsx` (1418, CSS 588) — 단일 페이지 1위
  - `apps/desktop/src/pages/CurriculumPage.tsx` (484, CSS 261)
  - `apps/desktop/src/pages/ParentLessonsPage.tsx` (CSS 224)

## Audit Health Score

| # | Dimension | 점수 | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3/4 | useConfirm() 6곳 적용 — 키보드/Escape 가능 |
| 2 | Performance | 2/4 | StudentLessonsPage 1418·ExamManagement 1014줄 — 분할 가치 |
| 3 | Theming | 4/4 | inline hex 19→0, CSS hex 잔존 0 |
| 4 | Responsive | 3/4 | index.css 전역 미디어, 페이지 자체 반응형 부족 |
| 5 | Anti-Patterns | 4/4 | native confirm 6곳 → useConfirm, 이모지·div onClick 0 |
| **Total** | | **16/20 (Good)** | 가장 큰 코드 베이스 카테고리, 토큰·confirm 정합성 회복 |

## Before / After 정량

| 지표 | Before | After |
|---|---|---|
| 인라인 hex 컬러 | 19 | **0** |
| native `confirm()` | 6 | **0** (useConfirm 도입) |
| `<div onClick>` | 1 | 1 (modal-content stopPropagation — 정상 패턴) |
| CSS 페이지 hex | 0 | 0 (이미 정리됨) |
| 이모지 아이콘 | 0 | 0 (P1 라운드에서 정리) |

## 검사 결과

### Anti-Patterns — native `confirm()` 6곳 → `useConfirm()`

`apps/desktop/src/components/Toast.tsx`의 `useConfirm()` 훅이 이미 존재하지만 vocab 페이지들에서는 아직 native `confirm()`를 사용 중이었음.

**대상**:
- VocabGradeTab — 시험지 무효 / 시험지 삭제 (2곳)
- VocabPolicyTab — 학생 정책 오버라이드 삭제 (1곳)
- VocabWordsTab — 단어 거절 / 단어 삭제 (2곳)
- VocabWrongTab — 오답 기록 초기화 (1곳)

**처리 패턴**:
```tsx
// Before
import { toast } from '../../components/Toast';
// ...
if (!confirm('정말 삭제할까요?')) return;

// After
import { toast, useConfirm } from '../../components/Toast';
// ...
const { confirm, ConfirmDialog } = useConfirm();
// ...
if (!(await confirm('정말 삭제할까요?'))) return;
// ...
return (<>...{ConfirmDialog}</>);
```

**효과**:
- DESKTOP.md "운영 도구 톤" 보존 (native dialog는 OS·브라우저 다름, 일관성 깨짐)
- Escape 키로 취소, autoFocus로 확인 (이미 useConfirm 구현에 포함)
- `role="dialog" aria-modal="true" aria-label="확인"` (a11y 자동)
- 라운드 누적 alert/confirm 제거: **17건** (HomePage 3 + Proof 4 + AssignmentDetail 4 + vocab 6)

### Theming — inline hex 19곳 → 토큰

**Tailwind slate 매핑**:
- `#4a5568` (slate-600) → `var(--text-secondary)` — 가장 빈번
- `#1a202c`/`#1a1e2e` (gray-900) → `var(--text-primary)`
- `#cbd5e0` (slate-300) → `var(--border-primary)`
- `#cbd5e1` → `var(--text-tertiary)`
- `#94a3b8` (slate-400) → `var(--text-tertiary)`
- `#475569` / `#64748b` → `var(--text-secondary)`
- `#666` → `var(--text-secondary)`
- `#2d3a8c` → `var(--primary)` (의도된 학생 앱 primary 일관 매핑)

**ExamQuestionEditorPage 핫스팟**:
```tsx
// Before
<input style={{ border: '1px solid #cbd5e0' }} />
<strong style={{ color: '#2d3a8c' }}>Q{q.questionNo}</strong>

// After
<input style={{ border: '1px solid var(--border-primary)' }} />
<strong style={{ color: 'var(--primary)' }}>Q{q.questionNo}</strong>
```

**ExamManagement / VocabGrade 핫스팟**:
- 로딩/메타 텍스트 컬러 6곳, 보더·배경 4곳

### Performance

- **StudentLessonsPage 1418줄** — 단일 페이지 1위. 진도/자료/커버리지 통합 도메인이라 페이지 분할 어려움. 컴포넌트 추출 가능 (헤더/필터/리스트/상세).
- **ExamManagementPage 1014줄** — 시험지 관리 통합. 분할 검토 가능.
- 다른 페이지들은 적정 사이즈.

### Accessibility

**개선**:
- useConfirm 6곳 적용으로 모든 확인 dialog가 ARIA + 키보드 접근 가능
- 자동 `autoFocus`로 키보드 사용자 즉시 확인 가능

**기존 부족** (P2 다음 라운드):
- 큰 페이지의 테이블/리스트 ARIA 강화 검토
- 정책 폼·문제 편집기 라벨 일관성

### Responsive

- index.css 전역 `@media` 16곳이 글로벌 동작 보장
- 페이지 자체 `@media` 없음 — 데스크톱 운영 도구 특성상 우선순위 낮음
- Playwright 1024·768·375 캡처는 백그라운드 실행 중

## 발견 P0/P1/P2/P3

### P0
- **없음**

### P1 (수정 완료)
- **[P1] inline hex 19곳** → 토큰 ✓
- **[P1] native confirm() 6곳** → useConfirm ✓

### P2 (다음 라운드)
- StudentLessonsPage 1418줄 컴포넌트 추출 — 가독성·테스트 용이성
- ExamManagementPage 1014줄 분할 검토
- 큰 페이지의 테이블 ARIA 강화

### P3 (Polish)
- vocab 4개 탭에서 동일한 useConfirm 패턴 — outlet context로 한 번만 선언 검토

## 변경 결과

- `apps/desktop/src/pages/Exam*.tsx` — inline color 토큰화 (ExamManagement, ExamQuestionEditor, ExamTimer 등)
- `apps/desktop/src/pages/vocab/Vocab*.tsx` — inline color 토큰화 + useConfirm 6곳 적용
- `apps/desktop/e2e/learning-content-audit-live.spec.ts` — Playwright 4페이지 × 3 뷰포트 spec

## 빌드 검증

- desktop vite build ✓
- Playwright 12 케이스 (백그라운드 실행 중)

## 카테고리 점수

**16/20 (Good)** — 가장 큰 코드 베이스(약 4,500줄)지만 토큰·confirm 정합성을 일괄 회복. 큰 페이지 분할은 P2로 다음 라운드.
