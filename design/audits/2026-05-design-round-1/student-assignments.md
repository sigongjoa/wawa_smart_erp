---
name: student-assignments audit
description: 학생 앱 과제·제출 카테고리 audit (AssignmentsPage, AssignmentDetailPage)
---

# Audit — student-assignments

- **이슈**: [#113](https://github.com/sigongjoa/wawa_smart_erp/issues/113)
- **부모 epic**: #108
- **날짜**: 2026-05-02
- **대상 페이지**:
  - `apps/student/src/pages/AssignmentsPage.tsx` (113→97줄, CSS 신규 113줄)
  - `apps/student/src/pages/AssignmentDetailPage.tsx` (304→307줄)
  - `apps/student/src/pages/AssignmentDetailPage.css` (423줄, +24)

## Audit Health Score

| # | Dimension | 점수 | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3/4 | aria-label 신규(0→4), role=alert/status |
| 2 | Performance | 3/4 | inline → CSS 클래스 추출 |
| 3 | Theming | 4/4 | hex 22→0, STATUS_COLOR 객체 → data-status 속성 |
| 4 | Responsive | 3/4 | 320·375·480 가로 0 (3/3) |
| 5 | Anti-Patterns | 4/4 | alert 4곳 → 인라인 배너, STATUS_COLOR 하드코딩 제거 |
| **Total** | | **17/20 (Good)** | 가장 큰 폭의 구조 개선 |

## Before / After 정량

| 지표 | Before | After |
|---|---|---|
| AssignmentsPage.tsx hex | 14 | **0** |
| AssignmentsPage 인라인 style | 14곳 | **0** (CSS 클래스로 추출) |
| AssignmentDetailPage.tsx hex | 5 | **0** |
| AssignmentDetailPage.css hex | 3 | **0** |
| `alert()` 호출 | 4 | **0** |
| `aria-label`/`role` | 0 | **4+** |

## 검사 결과

### Theming — STATUS_COLOR 객체를 CSS data-attribute로

**기존**:
```tsx
const STATUS_COLOR = {
  assigned: '#f59e0b',
  submitted: '#2563eb',
  reviewed: '#7c3aed',
  needs_resubmit: '#dc2626',
  completed: '#16a34a',
};
// 사용
<span style={{ background: STATUS_COLOR[r.status], color: '#fff' }}>
```

**개선**:
```css
.asgn-status[data-status="assigned"]       { background: var(--type-electric); color: var(--ink); }
.asgn-status[data-status="submitted"]      { background: var(--type-water); }
.asgn-status[data-status="reviewed"]       { background: var(--type-dragon); }
.asgn-status[data-status="needs_resubmit"] { background: var(--danger); }
.asgn-status[data-status="completed"]      { background: var(--type-grass); }
```

```tsx
<span className="asgn-status" data-status={r.status}>
```

**효과**:
- 색이 토큰 시스템 안으로 통합 → 다크 모드 자동 적용 (학생 앱은 의도적 미지원이지만 매핑은 가능)
- IMPECCABLE 도크트린 "타입(=색)으로 의미 전달" 강화 — Pokemon 타입 컬러로 의미 구분
- AssignmentDetailPage의 STATUS_COLOR 객체는 사용처 0이라 **삭제**

### Anti-Patterns — alert 4곳

**AssignmentDetailPage**:
- `alert(err.message || '업로드 실패')` — 파일 업로드 실패
- `alert('제출할 파일을 1개 이상 첨부해주세요')` — 제출 검증
- `alert('제출되었어요!')` — 제출 성공
- `alert(err.message || '제출 실패')` — 제출 실패

**개선**: `feedback: { kind: 'ok' | 'err'; text: string }` 상태 + `.ad-feedback--ok / --err` 인라인 배너
- 성공: `--success-surface` + `--success` (`role="status"`)
- 실패: `--danger-surface` + `--danger` (`role="alert"`)
- 클릭으로 dismiss
- 라운드 누적 alert 제거: 11곳 (HomePage 3 + Proof 4 + AssignmentDetail 4)

### Performance — inline → 클래스

AssignmentsPage 전체가 inline-styled였음 (14곳). `AssignmentsPage.css` 113줄 신설로 추출:
- 정적 스타일 100% 클래스화
- 인라인 0건
- CSS 변수만 사용 → 토큰 시스템 일관

### Accessibility

**기존 0건** — 두 페이지 모두 aria-label/role 없음.

**개선**:
- AssignmentsPage 행 버튼: `aria-label="${title} — ${status}${overdue ? ', 기한 지남' : ''}"` (`"수능 단어 D-30 — 검토 중, 기한 지남"` 같은 형태)
- 홈 버튼: `aria-label="홈으로"`
- 에러 배너: `role="alert"`
- AssignmentDetailPage feedback: `role="alert"` (err) / `role="status"` (ok)

### Responsive

- AssignmentsPage CSS 113줄·`@media` 0건 — 컨테이너 락이 보장
- AssignmentDetailPage CSS `@media` 0건 — 320 통과 ✓
- 캡처: `screenshots/student-assignments/list-{320,375,480}.png` (3/3 ✓)

## 발견 P0/P1/P2/P3

### P0
- **없음**

### P1 (수정 완료)
- **[P1] AssignmentsPage 전체 inline-styled** — CSS 파일 신설 + 클래스 추출 ✓
- **[P1] STATUS_COLOR 하드코딩 hex 5색** — `data-status` + 타입 컬러 토큰 ✓
- **[P1] alert() 4곳** — `feedback` 상태 + 인라인 배너 ✓
- **[P1] aria-label 0건** — 행 버튼·헤더에 의미 라벨 추가 ✓

### P2 (다음 라운드)
- AssignmentDetailPage 파일 첨부 영역 키보드 접근성 검토
- 파일 미리보기·다운로드 흐름 개선

### P3 (Polish)
- 상태별 하단 액션 버튼 (PRIMARY/secondary 분기) 디자인 일관성

## 변경 결과

- `apps/student/src/pages/AssignmentsPage.tsx` — 113→97줄, 14 hex 제거, aria 추가
- `apps/student/src/pages/AssignmentsPage.css` — **신규 113줄** (data-status 매핑 포함)
- `apps/student/src/pages/AssignmentDetailPage.tsx` — STATUS_COLOR 객체 삭제, feedback 상태 추가, alert 4곳 제거
- `apps/student/src/pages/AssignmentDetailPage.css` — feedback 배너 스타일 +24줄, hex 5→0

## 빌드 검증

- vite build ✓
- Playwright 320·375·480 list 페이지 3/3 ✓

## 카테고리 점수

**17/20 (Good)** — 본 라운드에서 가장 큰 구조 개선이 적용된 카테고리. inline-styled 페이지 → CSS 클래스 + data-attribute 패턴, STATUS_COLOR 객체 → 타입 컬러 토큰 매핑.
