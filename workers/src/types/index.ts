// 환경 변수 타입
export interface Env {
  DB: any;
  KV: any;
  BUCKET: any;
  ENVIRONMENT: string;
  API_URL: string;
  FRONTEND_URL: string;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  GEMINI_API_KEY?: string;
  JWT_EXPIRES_IN: string;
  REFRESH_TOKEN_EXPIRES_IN: string;
  LOG_LEVEL: string;
}

// 인증 페이로드
export interface AuthPayload {
  userId: string;
  email: string;
  role: 'admin' | 'instructor' | 'student';
  academyId: string;
  iat: number;
  exp: number;
}

// 사용자 정보
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instructor' | 'student';
  academyId: string;
  createdAt: string;
  updatedAt: string;
}

// 학급 정보
export interface Class {
  id: string;
  academyId: string;
  name: string;
  grade?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  instructorId?: string;
  capacity?: number;
  createdAt: string;
  updatedAt: string;
}

// 학생 정보
export interface Student {
  id: string;
  academyId: string;
  name: string;
  classId?: string;
  contact?: string;
  guardianContact?: string;
  enrollmentDate?: string;
  status: 'active' | 'inactive' | 'graduated';
  createdAt: string;
  updatedAt: string;
}

// 출석 기록
export interface Attendance {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'makeup';
  notes?: string;
  createdAt: string;
}

// 시험 정보
export interface Exam {
  id: string;
  academyId: string;
  classId: string;
  name: string;
  date: string;
  totalScore?: number;
  createdAt: string;
}

// 성적 정보
export interface Grade {
  id: string;
  studentId: string;
  examId: string;
  score?: number;
  comments?: string;
  gradedAt?: string;
  gradedBy?: string;
  createdAt: string;
}

// 수업별 학생 배정
export interface ClassStudent {
  id: string;
  classId: string;
  studentId: string;
  createdAt: string;
}

// 결석 기록
export interface Absence {
  id: string;
  studentId: string;
  classId: string;
  absenceDate: string;
  reason: string;
  notifiedBy: string;
  notifiedAt?: string;
  status: 'absent' | 'makeup_scheduled' | 'makeup_done';
  recordedBy?: string;
  createdAt: string;
  // JOIN fields
  studentName?: string;
  className?: string;
}

// 보강 추적
export interface Makeup {
  id: string;
  absenceId: string;
  scheduledDate?: string;
  completedDate?: string;
  status: 'pending' | 'scheduled' | 'completed';
  notes: string;
  createdAt: string;
  updatedAt: string;
  // JOIN fields
  studentName?: string;
  className?: string;
  absenceDate?: string;
  reason?: string;
}

// API 응답 형식
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// 요청 컨텍스트
export interface RequestContext {
  request: Request;
  env: Env;
  auth?: AuthPayload;
  params: Record<string, string>;
}
