// 모듈 타입
export type ModuleType = 'timer' | 'report' | 'grader' | 'schedule';

// 학년 타입
export type GradeType = '중1' | '중2' | '중3' | '고1' | '고2' | '고3' | '검정고시';

// 요일 타입
export type DayType = '화' | '목' | '토';

// 학생 타입 (통합)
export interface Student {
  id: string;
  name: string;
  grade: string;        // 학년 (GradeType과 호환 가능하도록 string으로 확장)
  day?: DayType;         // 타이머용 요일
  startTime?: string;    // 타이머용 시작 시간
  endTime?: string;      // 타이머용 종료 시간
  subject?: string;      // 타이머용 주력 과목
  subjects: string[];    // 수강 과목들 (리포트용)
  parentName?: string;   // 학부모 이름
  parentPhone?: string;  // 학부모 전화번호
  examDate?: string;     // 시험 예정일 (YYYY-MM-DD)
  status?: 'active' | 'inactive';
  absenceReason?: string;
  note?: string;
  localFolder?: string;
  driveLinks?: string[];
  createdAt: string;
  updatedAt: string;
}

// 실시간 세션
export interface RealtimeSession {
  studentId: string;
  student: Student;
  checkInTime: string;
  checkOutTime?: string;
  status: 'waiting' | 'active' | 'completed' | 'overtime';
  elapsedMinutes: number;
  scheduledMinutes: number;
}

// 필터 상태
export interface FilterState {
  day: DayType | 'all';
  grade: GradeType | 'all';
  search: string;
}

// 사이드바 메뉴 아이템
export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

// 모듈 설정
export interface ModuleConfig {
  id: ModuleType;
  label: string;
  icon: string;
  basePath: string;
  sidebarItems: SidebarItem[];
}
// 시험 난이도 등급
export type DifficultyGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// 시험지
export interface Exam {
  id: string;
  subject: string;
  yearMonth: string;
  difficulty: DifficultyGrade;
  examFileUrl?: string;
  scope?: string;
  uploadedBy: string;
  uploadedAt: string;
}

// 선생님
export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  pin: string;
  isAdmin: boolean;
}

// 성적 (성적 DB의 한 행)
export interface Score {
  id: string;
  studentId: string;
  studentName?: string;
  yearMonth: string;
  subject: string;
  score: number;
  teacherId: string;
  teacherName?: string;
  comment?: string;
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
  difficulty?: DifficultyGrade;
}

// 월별 리포트
export interface MonthlyReport {
  id: string;
  studentId: string;
  studentName: string;
  yearMonth: string;
  scores: SubjectScore[];
  totalComment?: string;
  status: 'draft' | 'complete' | 'sent';
  createdAt: string;
  updatedAt: string;
  pdfUrl?: string;
  pdfUploadedAt?: string;
}

// 전송 이력
export interface SendHistory {
  id?: string;
  studentId: string;
  studentName: string;
  reportId: string;
  recipientName: string;
  recipientPhone?: string;
  recipientType: 'parent' | 'self' | 'alimtalk';
  sentAt: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  pdfUrl?: string;
}

// 알림톡 전송 요청
export interface AlimtalkRequest {
  recipientPhone: string;
  studentName: string;
  yearMonth: string;
  pdfUrl: string;
  academyName?: string;
}

// 알림톡 전송 결과
export interface AlimtalkResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// 앱 설정
export interface AppSettings {
  notionApiKey?: string;
  notionTeachersDb?: string;
  notionStudentsDb?: string;
  notionScoresDb?: string;
  notionExamsDb?: string;
  notionDbId?: string; // Legacy
  kakaoJsKey?: string;
  academyName?: string;
  academyLogo?: string;
  kakaoBizChannelId?: string;
  kakaoBizSenderKey?: string;
  kakaoBizTemplateId?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  notionAbsenceHistoryDb?: string;
  notionExamScheduleDb?: string;
}

// 현재 로그인한 선생님
export interface CurrentUser {
  teacher: Teacher;
  loginAt: string;
}

// 결시 이력
export interface AbsenceHistory {
  id: string;
  studentId: string;
  studentName?: string;
  originalDate: string;
  absenceReason: string;
  retestDate?: string;
  retestCompleted: boolean;
  yearMonth: string;
  createdAt: string;
}

// 월별 시험 일정
export interface ExamSchedule {
  id: string;
  studentId: string;
  studentName?: string;
  yearMonth: string;
  examDate: string;
  createdAt?: string;
  updatedAt?: string;
}
