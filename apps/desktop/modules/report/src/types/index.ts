// 시험 난이도 등급
export type DifficultyGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// 시험지
export interface Exam {
  id: string;
  subject: string;
  yearMonth: string;
  difficulty: DifficultyGrade;
  examFileUrl?: string;
  scope?: string;           // 범위
  uploadedBy: string;
  uploadedAt: string;
}

// 선생님
export interface Teacher {
  id: string;
  name: string;
  subjects: string[]; // 담당 과목들 (여러 과목 가능)
  pin: string; // 4자리 PIN
  isAdmin: boolean;
}

// 학생
export interface Student {
  id: string;
  name: string;
  grade: string; // 학년
  subjects: string[]; // 수강 과목들
  parentName?: string; // 학부모 이름 (카카오톡 전송용)
  parentPhone?: string; // 학부모 전화번호 (알림톡용)
  examDate?: string; // 시험 예정일 (YYYY-MM-DD)
  status?: 'active' | 'inactive'; // 학생 상태
  absenceReason?: string; // 결시 사유
}

// 성적 (성적 DB의 한 행)
export interface Score {
  id: string;
  studentId: string; // relation
  studentName?: string; // 조회 편의용
  yearMonth: string; // "2026-02"
  subject: string;
  score: number;
  teacherId: string; // relation
  teacherName?: string; // 조회 편의용
  comment?: string; // 선생님 한줄 코멘트
  difficulty?: DifficultyGrade;
}

// 과목별 점수
export interface SubjectScore {
  subject: string;
  score: number;
  teacherId: string;
  teacherName: string;
  comment?: string;
  updatedAt: string;
  difficulty?: DifficultyGrade;  // 시험 난이도
}

// 월별 리포트
export interface MonthlyReport {
  id: string;
  studentId: string;
  studentName: string;
  yearMonth: string; // "2026-01"
  scores: SubjectScore[];
  totalComment?: string; // 종합 코멘트
  status: 'draft' | 'complete' | 'sent';
  createdAt: string;
  updatedAt: string;
  pdfUrl?: string; // Cloudinary PDF URL
  pdfUploadedAt?: string; // PDF 업로드 시간
}

// 전송 이력
export interface SendHistory {
  id?: string;
  studentId: string;
  studentName: string;
  reportId: string;
  recipientName: string;
  recipientPhone?: string;           // 학부모 전화번호 (알림톡용)
  recipientType: 'parent' | 'self' | 'alimtalk';
  sentAt: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  pdfUrl?: string;                   // Cloudinary PDF URL
}

// 카카오 친구 (비즈앱용)
export interface KakaoFriend {
  uuid: string;
  profile_nickname: string;
  profile_thumbnail_image?: string;
}

// 앱 설정
export interface AppSettings {
  // Notion 연동 설정
  notionApiKey?: string;
  notionTeachersDb?: string;
  notionStudentsDb?: string;
  notionScoresDb?: string;
  notionExamsDb?: string;
  // 레거시 (호환성)
  notionDbId?: string;
  // 카카오 설정
  kakaoJsKey?: string;
  // 학원 정보
  academyName?: string;
  academyLogo?: string;              // Base64 이미지
  // 카카오 비즈
  kakaoBizChannelId?: string;
  kakaoBizSenderKey?: string;
  kakaoBizTemplateId?: string;
  // Cloudinary 설정 (Signed Upload)
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  // 결시 이력 DB
  notionAbsenceHistoryDb?: string;
  // 시험 일정 DB (월별 관리)
  notionExamScheduleDb?: string;
}

// Cloudinary 업로드 결과
export interface CloudinaryUploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

// 알림톡 전송 요청
export interface AlimtalkRequest {
  recipientPhone: string;            // 수신자 전화번호 (01012345678)
  studentName: string;
  yearMonth: string;
  pdfUrl: string;                    // Cloudinary PDF URL
  academyName?: string;
}

// 알림톡 전송 결과
export interface AlimtalkResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// 현재 로그인한 선생님
export interface CurrentUser {
  teacher: Teacher;
  loginAt: string;
}

// 결시 이력
export interface AbsenceHistory {
  id: string;
  studentId: string;        // relation to Student
  studentName?: string;     // 조회 편의용
  originalDate: string;     // 원래 시험일 (YYYY-MM-DD)
  absenceReason: string;    // 결시 사유
  retestDate?: string;      // 재시험일 (YYYY-MM-DD)
  retestCompleted: boolean; // 재시험 완료 여부
  yearMonth: string;        // 시험 년월 (2026-02)
  createdAt: string;
}

// 시험 상태 (화면 표시용)
export type ExamStatus =
  | 'completed'      // 시험 완료 (점수 입력됨)
  | 'today'          // 오늘 시험 예정
  | 'absent'         // 결시 (재시험 미지정)
  | 'retest_pending' // 재시험 대기 중
  | 'upcoming'       // 시험 예정
  | 'unscheduled';   // 미지정

// 월별 시험 일정 (ExamSchedule DB)
export interface ExamSchedule {
  id: string;
  studentId: string;        // relation to Student
  studentName?: string;     // 조회 편의용
  yearMonth: string;        // "2026-02"
  examDate: string;         // 시험일 (YYYY-MM-DD)
  createdAt?: string;
  updatedAt?: string;
}
