---
name: 2026-05 Design Audit Round 1
description: 첫 디자인 audit 라운드 — 학생 앱 + 강사 앱 9개 카테고리
---

# 2026-05 Design Audit — Round 1

- **시작**: 2026-05-02
- **종료**: 2026-05-02
- **상태**: ✅ **완료** (9개 카테고리 모두 audit 완료)
- **Epic 이슈**: [#108](https://github.com/sigongjoa/wawa_smart_erp/issues/108)
- **카테고리 정의**: [`design/CATEGORIES.md`](../../CATEGORIES.md)

## 인프라 완료 트래킹

- [#109](https://github.com/sigongjoa/wawa_smart_erp/issues/109) 가이드라인 정합성 P0
- [#110](https://github.com/sigongjoa/wawa_smart_erp/issues/110) 다크 모드 + 모바일 1차 + 잔여 P1/P2

## 카테고리별 진행 현황

학생 앱 (우선)

| 카테고리 | 이슈 | 리포트 | 점수 | 상태 |
|---|---|---|---|---|
| student-auth-home | [#111](https://github.com/sigongjoa/wawa_smart_erp/issues/111) | [link](./student-auth-home.md) | **16/20** | ✅ 완료 |
| student-learning | [#112](https://github.com/sigongjoa/wawa_smart_erp/issues/112) | [link](./student-learning.md) | **14/20** | ✅ 완료 |
| student-assignments | [#113](https://github.com/sigongjoa/wawa_smart_erp/issues/113) | [link](./student-assignments.md) | **17/20** | ✅ 완료 |

강사 앱

| 카테고리 | 이슈 | 리포트 | 점수 | 상태 |
|---|---|---|---|---|
| desktop-student-mgmt | [#114](https://github.com/sigongjoa/wawa_smart_erp/issues/114) | [link](./desktop-student-mgmt.md) | **17/20** | ✅ 완료 |
| desktop-learning-content | [#115](https://github.com/sigongjoa/wawa_smart_erp/issues/115) | [link](./desktop-learning-content.md) | **16/20** | ✅ 완료 |
| desktop-academy-ops | [#116](https://github.com/sigongjoa/wawa_smart_erp/issues/116) | [link](./desktop-academy-ops.md) | **18/20** | ✅ 완료 |
| desktop-content-distribution | [#117](https://github.com/sigongjoa/wawa_smart_erp/issues/117) | [link](./desktop-content-distribution.md) | **18/20** | ✅ 완료 |
| desktop-gamification | [#118](https://github.com/sigongjoa/wawa_smart_erp/issues/118) | [link](./desktop-gamification.md) | **19/20** | ✅ 완료 |
| desktop-medterm | [#119](https://github.com/sigongjoa/wawa_smart_erp/issues/119) | [link](./desktop-medterm.md) | **17/20** | ✅ 완료 |

## 라운드 종합

### 점수 평균
- **9개 카테고리 평균: 16.9/20 (Good)**
- 최고점: desktop-gamification (19/20 — Excellent)
- 최저점: student-learning (14/20 — 가장 큰 핫스팟이 있던 카테고리)

### 정량 누적 효과

| 항목 | 처리 건수 |
|---|---|
| 하드코딩 hex → 토큰 (CSS) | ~250 |
| 하드코딩 hex → 토큰 (TSX inline) | ~200 |
| `alert()` / native `confirm()` 제거 | **23건** (HomePage 3 + Proof 4 + AssignmentDetail 4 + vocab 6 + academy 3 + ExamQuestionEditor 메시지화 + MedTerm 등) |
| 이모지 아이콘 → lucide-react | 11 |
| `<div onClick>` 안티패턴 → button | 1 (modal 패턴 17곳은 정상으로 재분류) |
| Modal ARIA 보강 (role/aria-modal/Escape) | 1 (GachaStudentPage), useConfirm 9곳 자동 적용 |
| 글로벌 터치 가드 (button 44px) | 양쪽 앱 적용 |
| Playwright 캡처 케이스 | **70+ (학생 18 + desktop 50+)** |

### 신규 토큰 추가
- 학생: `--medterm-signature`, `--medterm-signature-hover`, `--radius-full`
- 데스크톱: `--success-text`, `--warning-text`, `--danger-text` (light + dark variants), `--medterm-signature`, `--medterm-signature-hover`

### 시스템에 반영된 공통 패턴
- **타입 컬러 시스템**(학생): 학년/카테고리 → `--type-*` 매핑 (auth-home, assignments에 적용)
- **시멘틱 텍스트 토큰**(데스크톱): `--success-text`/`--warning-text`/`--danger-text` 도입으로 surface 위 텍스트 자동 다크 매핑
- **`useConfirm()` 훅 강제 사용**: native confirm은 모두 useConfirm으로 대체, ARIA + Escape 자동
- **이모지 → lucide-react**: 두 앱 공통 라이브러리 결정

### 라운드 종료 후 후속 작업 (commits 8112909, 389d1ce)

라운드 본 작업 완료 후 누락분 정렬 및 컴포넌트 추출:

1. **`/normalize` — TSX inline color 잔존 85건 → 0** (commit 8112909)
   - TargetDetailModal(24), AssignmentsPage(21), MyArchive(12), RegisterPage(8), LiveSession(5+1), TimerPage(3), LoginPage(3), ChangePinPage(3), MedTermExams(2)
   - 후속 처리 후 두 앱 TSX inline hex **0건** (SimpleCanvas 색 팔레트는 의도된 데이터로 보존)

2. **`/harden` — MedTermAdminPage ARIA 0→충분** (commit 8112909)
   - section `aria-labelledby`, `<label htmlFor>` 명시, `<fieldset>` `<legend>`
   - 에러 `role="alert"` + `aria-live="assertive"`, 성공 `role="status"`
   - 버튼 `disabled` + `aria-busy` + 동적 라벨 ("할당 중…", "업로드 중…")
   - 파일 업로드: 10MB 검증, 선택 파일명 표시, 성공 후 reset
   - examLimit blur 시 1~100 클램프, 빈 상태 메시지
   - 테이블 `<caption>` (`visually-hidden`) + `scope="col"`
   - 텍스트 overflow: `medterm-admin-cell-truncate` (모바일 max-width 140px)

3. **`/extract` — `<DialogShell>` 공통 컴포넌트** (commit 389d1ce)
   - `apps/desktop/src/components/DialogShell.tsx` 신설
   - 얇은 래퍼: role="dialog" + aria-modal + aria-label + Escape 키 + 오버레이 클릭 닫기
   - 마이그레이션 4 모달: MakeupSessionsModal, ProofEditorPage 2곳, GachaStudentPage
   - DESKTOP.md "3.0 Modal / Dialog" 섹션 추가 (`<Modal>` vs `<DialogShell>` vs `useConfirm()` 가이드)

### 최종 정량 (라운드 + 후속)

| 항목 | 라운드 본 | 후속 | 총합 |
|---|---|---|---|
| TSX inline hex 토큰화 | ~200 | 85 | **~285** |
| CSS hex 토큰화 | ~250 | - | ~250 |
| ARIA 보강 (MedTermAdmin) | 0건 | 30+ | 30+ |
| Modal 공통 컴포넌트 마이그레이션 | - | 4 | 4 |

### 잔존 (다음 라운드 #110 트래킹)

- **alert() 14건 잔존**: ConsultationPanel·ExternalSchedulePanel·TeacherNotesPanel·LiveSessionPage·MeetingPage 5개 파일 → 다음 라운드에서 useToast/error 배너로 정리
- **`<div onClick>` 14건**: 대부분 modal-overlay/click-out 정상 패턴, BoardPage·TimerPage·ExamTimerPage는 이미 ARIA 직접 적용 완료 — DialogShell 마이그레이션은 코드 정리 차원
- **CSS index.css 잔존 hex 112건**: 학년 배지·과목 색·차트 데이터 색 (의도된 패턴, 다크 오버라이드 매칭됨)

### 다음 라운드 권장사항
1. **#110 잔여 작업**: BoardPage·TimerPage·ExamTimerPage modal-overlay 인라인 → `<DialogShell>` 마이그레이션 (코드 정리)
2. **큰 페이지 분할**: StudentLessonsPage 1418줄 / ExamManagementPage 1014줄 / ParentReportPage 665줄
3. **다크 모드 시각 검증**: Playwright `colorScheme: 'dark'` 캡처 추가
4. **잔존 alert() 14건** → useToast() / inline 배너
5. **`design/system/` 토큰 시각 카탈로그** 페이지 (Storybook 또는 단일 HTML)
6. **STUDENT.md Modal 섹션 추가** — 학생 앱은 자체 모달 패턴 부재, ProofPlay·VocabExam의 인라인 에러 배너 패턴 정리

### 결과물
- 9개 카테고리 리포트: `design/audits/2026-05-design-round-1/*.md`
- Playwright spec: `apps/{desktop,student}/e2e/*-audit*.spec.ts`
- 스크린샷 70+ 장: `design/audits/2026-05-design-round-1/screenshots/<category>/`
- 새 컴포넌트: `apps/desktop/src/components/DialogShell.tsx`

### GitHub
- Epic [#108](https://github.com/sigongjoa/wawa_smart_erp/issues/108) ✅ closed
- 자식 이슈 11개 (#109·#111~#119) 모두 ✅ closed (#110만 다음 라운드 트래킹용 유지)
- 라벨 20개 영구화 (`.github/labels.yml`)
- 이슈 템플릿 2종 (`.github/ISSUE_TEMPLATE/audit-{epic,category}.md`) — 다음 라운드(보안/성능/i18n)도 동일 인프라 재사용

### 빌드 검증 (최종)
- `apps/desktop` vite build ✓
- `apps/student` vite build ✓
- TSX inline hex grep: **0건**
- 이모지 아이콘 grep: **0건**
- Playwright 70+ 케이스 모두 통과
