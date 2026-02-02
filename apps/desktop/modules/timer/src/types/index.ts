// 학년 타입
export type GradeType = '중1' | '중2' | '중3' | '고1' | '고2' | '고3' | '검정고시';

// 요일 타입
export type DayType = '화' | '목' | '토';

// 뷰 모드 타입
export type ViewMode = 'day' | 'realtime' | 'student' | 'grade' | 'timeslot';

// 학생 스케줄 데이터
export interface Student {
  id: string;
  name: string;
  grade: GradeType;
  day: DayType;
  startTime: string;  // HH:mm 형식
  endTime: string;    // HH:mm 형식
  subject: string;
  note?: string;
  localFolder?: string;
  driveLinks?: string[];
  pdfFiles?: PdfFile[];
  createdAt: string;
  updatedAt: string;
}

// PDF 파일 정보
export interface PdfFile {
  id: string;
  name: string;
  path: string;
  uploadedAt: string;
}

// 실시간 수업 상태
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

// Notion 설정
export interface NotionSettings {
  apiKey: string;
  studentsDbId: string;
  attendanceDbId?: string;
  pdfsDbId?: string;
  isConnected: boolean;
}

// 앱 설정
export interface AppSettings {
  notion: NotionSettings;
  aiProvider: 'anthropic' | 'openai' | 'gemini';
  aiApiKey: string;
}

// 통계 데이터
export interface DayStats {
  total: number;
  waiting: number;
  active: number;
  completed: number;
}
