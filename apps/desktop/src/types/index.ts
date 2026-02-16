// 모듈 타입
export type ModuleType = 'timer' | 'report' | 'grader' | 'student' | 'makeup';

// 학년 타입
export type GradeType = '초1' | '초2' | '초3' | '초4' | '초5' | '초6' | '중1' | '중2' | '중3' | '고1' | '고2' | '고3' | '검정고시';

// 요일 타입
export type DayType = '월' | '화' | '수' | '목' | '금' | '토' | '일';

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
  teacherIds?: string[]; // 담당 선생님 ID 목록 (relation)
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

// 필터 상태 (다중 선택 지원)
export interface FilterState {
  days: DayType[];    // 다중 선택된 요일들
  grades: GradeType[]; // 다중 선택된 학년들
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

// 시험 상태
export type ExamStatus =
  | 'completed'       // 시험 완료 (completedAt 있음)
  | 'today'           // 오늘 시험
  | 'absent'          // 결시 (시험일 지났는데 미완료)
  | 'upcoming'        // 예정
  | 'unscheduled';    // 미지정

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

  // 시험일정 관련 필드
  examDate?: string;              // 시험일 (YYYY-MM-DD)
  studentId?: string;             // 학생별 시험 (개별 시험일 지정용)
  studentName?: string;           // 학생 이름 (비정규화)

  // 시험 완료 추적
  completedAt?: string;           // 시험 완료 시각
  completedBy?: string;           // 완료 처리한 선생님 ID

  // 메타데이터
  createdAt?: string;
  updatedAt?: string;
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
  notionEnrollmentDb?: string;
  notionMakeupDb?: string;
  notionDmMessagesDb?: string;
  notionExamScheduleDb?: string;  // 추가 (Lint 에러 수정)
  notionNotificationsDb?: string; // 추가 (Lint 에러 수정)
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
  yearMonth: string;
  createdAt: string;
  // 재시험 관련 필드 제거 (retestDate, retestCompleted)
}

// 수강 일정 타입
export interface Enrollment {
  id: string;
  studentId: string;
  studentName?: string;
  day: DayType;
  startTime: string;
  endTime: string;
  subject: string;
  tuition?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ========== 보강관리 관련 타입 ==========

// 보강 상태
export type MakeupStatus = '시작 전' | '진행 중' | '완료';

// 보강 기록
export interface MakeupRecord {
  id: string;
  studentId: string;
  studentName?: string;
  subject: string;
  teacherId?: string;
  teacherName?: string;
  absentDate: string;         // 결석일
  absentReason: string;       // 결석사유
  makeupDate?: string;        // 보강예정일
  makeupTime?: string;        // 보강시간 (예: "14:00~15:00")
  status: MakeupStatus;
  memo?: string;
  createdAt?: string;
}

// ========== DM (쪽지) 관련 타입 ==========

// DM 메시지
export interface DirectMessage {
  id: string;
  senderId: string;
  senderName?: string;
  receiverId: string;
  receiverName?: string;
  content: string;
  createdAt: string;
  readAt?: string;             // 읽은 시각 (추가)
}

// DM 대화 상대
export interface DMContact {
  teacherId: string;
  teacherName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

// ========== 시스템 알림 관련 타입 ==========

export type NotificationType = '보강' | '성적' | '시험' | '시스템';
export type NotificationStatus = 'unread' | 'read' | 'dismissed';

export interface AppNotification {
  id: string;
  title: string;
  content: string;
  type: NotificationType;
  status: NotificationStatus;
  targetTeacherId: string;
  priority: 'high' | 'normal';
  path?: string;             // 클릭 시 이동할 경로
  createdAt: string;
  readAt?: string;
}

// ========== AI 종합평가 관련 타입 ==========

// AI 프로바이더
export type AIProvider = 'gemini' | 'openai' | 'claude';

// AI 모델 정보
export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  inputPricePerMToken: number;   // USD per 1M input tokens
  outputPricePerMToken: number;  // USD per 1M output tokens
}

// AI 설정
export interface AISettings {
  geminiApiKey?: string;
  openaiApiKey?: string;
  claudeApiKey?: string;
  defaultProvider: AIProvider;
  defaultModel: string;
  promptTemplate: string;
  generationCount: number;  // 생성할 버전 수 (2~3)
  maxTokens: number;
}

// AI 사용량 기록
export interface AIUsageRecord {
  month: string;          // "2026-02"
  provider: AIProvider;
  model: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;  // USD
}

// AI 생성 요청
export interface AIGenerationRequest {
  studentName: string;
  grade: string;
  yearMonth: string;
  subjects: string[];
  scores: Array<{ subject: string; score: number; comment?: string }>;
  historicalData?: Array<{
    yearMonth: string;
    scores: Array<{ subject: string; score: number }>;
  }>;
  provider: AIProvider;
  model: string;
  promptTemplate: string;
  generationCount: number;
  maxTokens: number;
}

// AI 생성 결과
export interface AIGenerationResult {
  success: boolean;
  versions: string[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    model: string;
    provider: AIProvider;
  };
  error?: string;
}
