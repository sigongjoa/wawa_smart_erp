// Vite dev/preview에서는 proxy가 /api → localhost:8787으로 중계
// 배포 시에는 VITE_API_URL 환경변수 사용
const API_BASE = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || res.statusText);
  }
  // API wraps responses as { success, data, ... } — unwrap
  return json?.data ?? json;
}

export interface Student {
  id: string;
  name: string;
  class_id: string;
  subjects: string[];
  status: string;
}

export interface Exam {
  id: string;
  name: string;
  exam_month: string;
  date: string;
  total_score: number;
  is_active: number;
}

export interface ScoreEntry {
  examId: string;
  subject: string;
  score: number;
  comment: string;
}

export interface ReportEntry {
  studentId: string;
  studentName: string;
  yearMonth: string;
  scores: ScoreEntry[];
  totalComment: string;
}

export const api = {
  // Auth
  login: (name: string, pin: string) =>
    request<{ accessToken: string; refreshToken: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name, pin }),
    }),

  // Settings — returns { activeExamMonth, ... }
  getActiveMonth: () =>
    request<{ activeExamMonth: string | null }>('/api/settings/active-exam-month'),
  setActiveMonth: (yearMonth: string) =>
    request('/api/settings/active-exam-month', {
      method: 'POST',
      body: JSON.stringify({ activeExamMonth: yearMonth }),
    }),

  // Students — returns Student[] directly
  getStudents: () =>
    request<Student[]>('/api/student'),

  // Exams — returns Exam[] directly
  getExams: (yearMonth?: string) =>
    request<Exam[]>(yearMonth ? `/api/grader/exams?yearMonth=${yearMonth}` : '/api/grader/exams'),

  // Grades
  saveGrade: (data: { student_id: string; exam_id: string; score: number; comments?: string }) =>
    request('/api/grader/grades', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Report — returns ReportEntry[] directly
  getReport: (yearMonth: string) =>
    request<ReportEntry[]>(`/api/report?yearMonth=${yearMonth}`),
};
