// Vite dev/preview에서는 proxy가 /api → localhost:8787으로 중계
// 배포 시에는 VITE_API_URL 환경변수 사용
const API_BASE = import.meta.env.VITE_API_URL || '';

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data ?? json;
    if (data?.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

function forceLogout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.hash = '#/login';
  window.location.reload();
}

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

  // 401 → refresh token으로 재시도
  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      const retry = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options?.headers,
        },
      });
      const retryJson = await retry.json().catch(() => null);
      if (!retry.ok) {
        forceLogout();
        throw new Error(retryJson?.error || retry.statusText);
      }
      return retryJson?.data ?? retryJson;
    }
    // refresh도 실패 → 로그인 페이지로
    forceLogout();
    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
  }

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

  // Score history — returns { months: string[], subjects: Record<string, (number|null)[]> }
  getScoreHistory: (studentId: string, months?: number) =>
    request<{ months: string[]; subjects: Record<string, (number | null)[]> }>(
      `/api/report/history?studentId=${studentId}&months=${months || 6}`
    ),

  // Report Image — upload PNG to R2, get public share URL
  uploadReportImage: (data: { imageBase64: string; studentName: string; yearMonth: string }) =>
    request<{ shareUrl: string; imageUrl: string }>('/api/report/upload-image', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // AI — generate comment via Gemini
  generateComment: (data: { studentName: string; subject: string; score: number; yearMonth: string; existingComment?: string }) =>
    request<{ comment: string }>('/api/ai/generate-comment', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // AI — generate total summary
  generateSummary: (data: { studentName: string; yearMonth: string; scores: { subject: string; score: number; comment?: string }[] }) =>
    request<{ summary: string }>('/api/ai/generate-summary', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
