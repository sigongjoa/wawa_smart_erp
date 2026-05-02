---
name: audit categories
description: WAWA Smart ERP의 audit 카테고리 정의 — 앱×도메인 단위로 묶어 일관성 평가가 가능하도록 분할
---

# Audit Categories

`/audit`은 카테고리 단위로 실행합니다. 페이지 단위로 너무 잘게 쪼개면 디자인 시스템 일관성 평가가 안 되고, 앱 전체로 묶으면 너무 커서 개선 지점이 흐려집니다. 아래 9개 묶음이 표준입니다.

## 카테고리 정의

### Student 앱 (`apps/student/`)

| 카테고리 | ID | 대표 페이지 | 비고 |
|---|---|---|---|
| 인증·홈 | `student-auth-home` | LoginPage, HomePage, QrPage | 첫인상·진입 흐름 |
| 학습 응시 | `student-learning` | VocabPlay, ExamTake, GachaPlay | 핵심 사용 흐름 |
| 과제·제출 | `student-assignments` | AssignmentsPage, MakeupPage, SubmitFlow | 매일 사용 |

### Desktop 앱 (`apps/desktop/`)

| 카테고리 | ID | 대표 페이지 | 비고 |
|---|---|---|---|
| 학생 관리 | `desktop-student-mgmt` | StudentsPage, HomeroomPage, AttendancePage | 강사 일상 사용 1위 |
| 학습 콘텐츠 | `desktop-learning-content` | VocabPage, ExamPage, LessonItemsPage, CurriculumPage | 콘텐츠 제작 |
| 학원 운영 | `desktop-academy-ops` | SettingsPage, TeachersPage, ClassesPage | 관리자 |
| 교재·배포 | `desktop-content-distribution` | ArchivesPage, ParentReportPage, DeckExportPage | 외부 노출 |
| 게이미피케이션 | `desktop-gamification` | WordGachaPage, GachaCardsPage | 시각 임팩트 |
| 의학용어 (medterm) | `desktop-medterm` | MedtermPage 외 | 별도 도메인 — 독립 audit |

## 우선순위

학생 앱이 사용자 노출도 더 높고 디자인 임팩트가 큽니다. 권장 순서:

1. `student-auth-home` (첫인상)
2. `student-learning` (핵심 사용 흐름)
3. `student-assignments`
4. `desktop-student-mgmt` (강사 일상 빈도 1위)
5. `desktop-learning-content`
6. `desktop-academy-ops`
7. `desktop-content-distribution`
8. `desktop-gamification`
9. `desktop-medterm`

## 카테고리 추가/변경 규칙

- 새 페이지 추가 시 위 카테고리 중 하나에 편입 (또는 새 카테고리 정의)
- 카테고리 ID는 변경하지 않습니다 (라운드 간 비교용)
- 카테고리 변경 시 이 문서를 업데이트하고 PR에서 명시
