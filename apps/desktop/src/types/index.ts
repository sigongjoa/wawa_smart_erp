// 모듈 타입
export type ModuleType = 'timer' | 'report' | 'grader' | 'schedule';

// 학년 타입
export type GradeType = '중1' | '중2' | '중3' | '고1' | '고2' | '고3' | '검정고시';

// 요일 타입
export type DayType = '화' | '목' | '토';

// 학생 스케줄 데이터
export interface Student {
  id: string;
  name: string;
  grade: GradeType;
  day: DayType;
  startTime: string;
  endTime: string;
  subject: string;
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
