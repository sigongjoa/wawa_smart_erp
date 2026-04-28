# WAWA Smart ERP — 시스템 유즈케이스

> **범위**: `apps/desktop`, `apps/student`, `workers/src/routes` 기반 현행 시스템 전체
> **관련 문서**: `docs/VOCAB_EXAM_USECASES.md`, `docs/MULTI_TENANT_DESIGN.md`, `docs/EXAM_MAKEUP_TIMER_DESIGN.md`, `docs/SPLIT_MAKEUP_DESIGN.md`, `docs/STUDENT_EXAM_TAKE_DESIGN.md`, `docs/VOCAB_EXAM_INTEGRATION_DESIGN.md`
> **최종 갱신**: 2026-04-29

---

## 액터

| 액터 | 접근 앱 | 역할 |
|---|---|---|
| 원장(Admin) | desktop | 학원·정책·시드 관리 |
| 강사(Teacher) | desktop | 수업·시험·학생 관리 |
| 담임(Homeroom) | desktop | 담임 학생 추적·상담 |
| 학생(Student) | student | 학습·시험·가챠 |
| 학부모(Parent) | desktop(parent route) | 리포트·숙제 확인 |
| 시스템(System) | workers | 채점·배치·크론 |

---

## 1. 학원 운영 (Academy / Settings)

| ID | 유즈케이스 | 액터 | 주요 경로 |
|---|---|---|---|
| UC-A1 | 학원 등록 및 다중 테넌트 설정 | Admin | `AcademyPage`, `academy-handler`, `MULTI_TENANT_DESIGN.md` |
| UC-A2 | 강사·담임 계정 발급 및 권한 부여 | Admin | `teachers-handler` |
| UC-A3 | 시스템 설정 변경 (PIN, 알림, 로고 등) | Admin | `SettingsPage`, `settings-handler` |
| UC-A4 | 강사가 PIN으로 빠르게 전환 로그인 | Teacher | `LoginPage`, `auth-handler` |

## 2. 학생 관리

| ID | 유즈케이스 | 액터 | 주요 경로 |
|---|---|---|---|
| UC-S1 | 학생 등록·프로필 수정 | Teacher | `StudentListPage`, `StudentProfilePage`, `student-handler` |
| UC-S2 | 학생/학부모 계정 자동 온보딩 | System | `onboard-handler` |
| UC-S3 | 결석·지각 기록 및 사유 관리 | Teacher | `AbsencePage`, `absence-handler` |
| UC-S4 | 게시판으로 공지·자료 배포 | Teacher | `BoardPage`, `board-handler` |

## 3. 수업·일정 (Lesson)

| ID | 유즈케이스 | 액터 | 주요 경로 |
|---|---|---|---|
| UC-L1 | 커리큘럼/진도표 작성 | Teacher | `CurriculumPage`, `curriculum-handler` |
| UC-L2 | 라이브 세션 시작·학생 입장 | Teacher/Student | `LiveSessionPage` (양쪽), `live-handler` |
| UC-L3 | 강사 미팅·상담 노트 | Teacher | `MeetingPage`, `meeting-handler` |
| UC-L4 | 학생이 본인 수업 일정 확인 | Student | `StudentLessonsPage`, `lesson-items-handler` |

## 4. 시험 (Exam)

| ID | 유즈케이스 | 액터 | 주요 경로 |
|---|---|---|---|
| UC-E1 | 시험지·문항 편집 | Teacher | `ExamPapersPage`, `ExamQuestionEditorPage`, `exam-paper-handler` |
| UC-E2 | 시험 배정·관리 | Teacher | `ExamManagementPage`, `exam-mgmt-handler` |
| UC-E3 | 시험 응시 | Student | `student/ExamPage`, `exam-play-handler`, `exam-attempt-handler` |
| UC-E4 | 타이머 기반 시간제한 응시 | Student | `ExamTimerPage` (양쪽), `EXAM_MAKEUP_TIMER_DESIGN.md` |
| UC-E5 | 자동 채점 + 결과 조회 | System/Teacher | `ExamResultPage`, `grader-handler` |
| UC-E6 | 결시생 보충 시험 분할 진행 | Teacher/Student | `SPLIT_MAKEUP_DESIGN.md`, `makeup-session-handler` |
| UC-E7 | 담임 본인반 응시 현황 추적 | Homeroom | `HomeroomExamsPage` |

## 5. 어휘 시험 (Vocab)

> 상세는 `docs/VOCAB_EXAM_USECASES.md` 참조.

| ID | 유즈케이스 | 액터 | 주요 경로 |
|---|---|---|---|
| UC-V1 | 어휘 시드 업로드 | Admin | `VocabAdminPage`, `vocab-handler` |
| UC-V2 | 학생 지망학과/티어/태그 정책 설정 | Teacher | `VocabPolicyTab`, `vocab-policy-handler` |
| UC-V3 | 단어 추가·수정 | Teacher | `VocabWordModal`, `VocabWordsTab` |
| UC-V4 | 일일 암기 큐 자동 생성 | System | `vocab-play-handler` |
| UC-V5 | 어휘 시험 응시 + 결과 조회 | Student | `VocabExamPage`, `VocabExamResultPage` |
| UC-V6 | 오답노트 누적·리뷰 | Student/Teacher | `VocabWrongTab` |
| UC-V7 | 채점 결과 가시화 | Teacher | `VocabGradeTab` |

## 6. 과제·증명 (Assignments / Proof)

| ID | 유즈케이스 | 액터 | 주요 경로 |
|---|---|---|---|
| UC-AS1 | 과제 출제·배포 | Teacher | `AssignmentsPage`, `assignments-handler` |
| UC-AS2 | 과제 풀이·제출 | Student | `student/AssignmentsPage`, `AssignmentDetailPage`, `play-assignments-handler` |
| UC-AS3 | 증명 문제 에디터(빈칸/순서) | Teacher | `ProofEditorPage`, `proof-handler` |
| UC-AS4 | 증명 풀이 (빈칸 / 순서 배열) | Student | `ProofFillBlankPage`, `ProofOrderingPage` |

## 7. 가챠 (보상 시스템)

| ID | 유즈케이스 | 액터 | 주요 경로 |
|---|---|---|---|
| UC-G1 | 카드 풀·확률 관리 | Admin/Teacher | `GachaDashboardPage`, `GachaCardPage`, `gacha-card-handler` |
| UC-G2 | 학생별 보상 조건 관리 | Teacher | `GachaStudentPage`, `gacha-student-handler` |
| UC-G3 | 학생 가챠 뽑기·도감 수집 | Student | `student/GachaPage`, `DexPage`, `gacha-play-handler` |
| UC-G4 | 마이 아카이브에서 획득 카드 열람 | Student | `MyArchivePage` |

## 8. 담임 (Homeroom)

| ID | 유즈케이스 | 액터 | 주요 경로 |
|---|---|---|---|
| UC-H1 | 담임 대시보드 | Homeroom | `HomeroomPage` |
| UC-H2 | 상담 기록 작성 | Homeroom | `HomeroomConsultationsPage` |
| UC-H3 | 후속조치(Follow-up) 관리 | Homeroom | `HomeroomFollowUpsPage` |

## 9. 리포트·학부모

| ID | 유즈케이스 | 액터 | 주요 경로 |
|---|---|---|---|
| UC-R1 | 강사 리포트 작성 | Teacher | `ReportPage`, `report-handler`, `report-image-handler` |
| UC-R2 | 학부모 리포트 열람 | Parent | `ParentReportPage`, `parent-report-handler` |
| UC-R3 | 학부모가 자녀 숙제 확인 | Parent | `ParentHomeworkPage`, `parent-homework-handler` |
| UC-R4 | 학부모가 자녀 수업 일정 확인 | Parent | `ParentLessonsPage` |

## 10. 부가 기능

| ID | 유즈케이스 | 액터 | 주요 경로 |
|---|---|---|---|
| UC-X1 | 타이머/공부시간 트래킹 | Student/Teacher | `TimerPage`, `timer-handler`, `timer-session-handler` |
| UC-X2 | AI 보조 (채점·해설) | System | `ai-handler` |
| UC-X3 | 메시지/알림 발송 | System/Teacher | `message-handler` |
| UC-X4 | 파일 업로드/저장 | All | `file-handler` |
| UC-X5 | D1 DB 백업 → Google Drive | Admin | `erp-backup` skill |
| UC-X6 | DB 마이그레이션 실행 | Admin/System | `migrate-handler` |

---

## 갱신 가이드

- 새 페이지/핸들러가 추가되면 해당 도메인 섹션의 표에 한 줄 추가.
- 도메인 단위로 상세 시나리오가 필요하면 `docs/VOCAB_EXAM_USECASES.md` 형식(액터/선결조건/성공 시나리오/대체흐름/예외)으로 별도 파일을 만들고 본 문서에서 링크.
- ID 체계: `UC-<도메인>n` (A=Academy, S=Student, L=Lesson, E=Exam, V=Vocab, AS=Assignment, G=Gacha, H=Homeroom, R=Report, X=etc).
