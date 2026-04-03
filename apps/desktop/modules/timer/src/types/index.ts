// 학년 타입
export type GradeType = '중1' | '중2' | '중3' | '고1' | '고2' | '고3' | '검정고시';

// 요일 타입
export type DayType = '화' | '목' | '토';

// 뷰 모드 타입
export type ViewMode = 'day' | 'realtime' | 'student' | 'grade' | 'timeslot' | 'attendance';

// 세션 상태 타입
export type SessionStatus = 'waiting' | 'active' | 'paused' | 'completed' | 'overtime';

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

// 일시정지 기록
export interface PauseRecord {
  pausedAt: string;    // ISO datetime
  resumedAt?: string;  // ISO datetime (일시정지 중이면 undefined)
  reason?: string;     // 사유: '외출', '휴식', '화장실' 등
}

// 실시간 수업 상태
export interface RealtimeSession {
  id: string;
  studentId: string;
  student: Student;
  checkInTime: string;
  checkOutTime?: string;
  status: SessionStatus;
  elapsedMinutes: number;
  scheduledMinutes: number;
  pauseHistory: PauseRecord[];
  date: string;        // YYYY-MM-DD
  note?: string;
}

// 출석 기록 (영구 저장)
export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  grade: GradeType;
  subject: string;
  date: string;                  // YYYY-MM-DD
  checkInTime: string;           // ISO datetime
  checkOutTime: string;          // ISO datetime
  scheduledStartTime: string;    // HH:mm
  scheduledEndTime: string;      // HH:mm
  scheduledMinutes: number;
  netMinutes: number;            // 순수 수업시간 (일시정지 제외)
  totalPausedMinutes: number;
  pauseCount: number;
  pauseHistory: PauseRecord[];
  wasLate: boolean;
  wasOvertime: boolean;
  note?: string;
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
  paused: number;
  completed: number;
}
