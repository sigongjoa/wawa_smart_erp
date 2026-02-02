// 학생 정보
export interface Student {
  id: string;
  name: string;
  grade: string;        // 학년
  phone?: string;
  parentPhone?: string;
  createdAt: string;
}

// 시간표 일정
export interface Schedule {
  id: string;
  studentId: string;
  dayOfWeek: number;    // 0-6 (일-토)
  startTime: string;    // "HH:mm"
  endTime: string;
  subject: string;
  teacher?: string;
  room?: string;
}

// 성적 정보
export interface Grade {
  id: string;
  studentId: string;
  subject: string;
  score: number;
  maxScore: number;
  date: string;
  examType: 'quiz' | 'midterm' | 'final' | 'homework';
  details?: GradeDetail[];
}

export interface GradeDetail {
  questionNumber: number;
  correct: boolean;
  studentAnswer?: string;
  correctAnswer?: string;
}

// 월간 보고서
export interface MonthlyReport {
  id: string;
  studentId: string;
  month: string;        // "YYYY-MM"
  attendance: AttendanceSummary;
  grades: GradeSummary;
  comments: string;
  createdAt: string;
}

export interface AttendanceSummary {
  totalClasses: number;
  attended: number;
  absent: number;
  late: number;
}

export interface GradeSummary {
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  subjects: SubjectSummary[];
}

export interface SubjectSummary {
  subject: string;
  averageScore: number;
  trend: 'up' | 'down' | 'stable';
}

// 모듈 간 통신 메시지
export interface ModuleMessage {
  type: ModuleMessageType;
  payload: any;
  source: 'timer' | 'grader' | 'report' | 'dashboard';
  timestamp: number;
}

export type ModuleMessageType =
  | 'STUDENT_SELECTED'
  | 'GRADE_SAVED'
  | 'SCHEDULE_UPDATED'
  | 'REPORT_GENERATED'
  | 'SYNC_REQUEST'
  | 'SYNC_COMPLETE';
