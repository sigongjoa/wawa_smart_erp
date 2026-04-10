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

  // Report Send Status — 월별 전송 상태 조회
  getSendStatus: (yearMonth: string) =>
    request<Record<string, { shareUrl: string; sentBy: string; sentAt: string }>>(
      `/api/report/send-status?yearMonth=${yearMonth}`
    ),

  // Report Image — upload PNG to R2, get public share URL
  uploadReportImage: (data: { imageBase64: string; studentId: string; studentName: string; yearMonth: string }) =>
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

  // ── 시간표/수업 ──

  // 수업 목록
  getClasses: () =>
    request<any[]>('/api/timer/classes'),

  // 출석 기록
  recordAttendance: (data: { studentId: string; classId: string; date: string; status: string; notes?: string }) =>
    request('/api/timer/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 수업별 출석 조회
  getAttendance: (classId: string, date: string) =>
    request<any[]>(`/api/timer/attendance/${classId}/${date}`),

  // ── 결석/보강 관리 ──

  // 결석 기록
  recordAbsence: (data: { studentId: string; classId: string; absenceDate: string; reason: string; notifiedBy: string; notifiedAt?: string }) =>
    request('/api/absence', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 수업 마침 시 일괄 결석 기록
  recordAbsenceBatch: (absences: Array<{ studentId: string; classId: string; absenceDate: string; reason: string; notifiedBy: string }>) =>
    request('/api/absence/batch', {
      method: 'POST',
      body: JSON.stringify({ absences }),
    }),

  // 날짜별 결석 조회
  getAbsences: (date: string) =>
    request<any[]>(`/api/absence?date=${date}`),

  // 수업 마침 시 미출석자 조회
  getUncheckedStudents: (classId: string, date: string) =>
    request<any[]>(`/api/absence/unchecked?classId=${classId}&date=${date}`),

  // 퇴근 요약
  getDailySummary: (date: string) =>
    request<{ date: string; todayAbsences: any[]; pendingMakeups: any[]; clipboardText: string }>(
      `/api/absence/daily-summary?date=${date}`
    ),

  // 보강 목록 (상태 필터)
  getMakeups: (status?: string) =>
    request<any[]>(status ? `/api/makeup?status=${status}` : '/api/makeup'),

  // 보강일 지정
  scheduleMakeup: (data: { absenceId: string; scheduledDate: string; notes?: string }) =>
    request('/api/makeup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 보강 완료 처리
  completeMakeup: (makeupId: string) =>
    request(`/api/makeup/${makeupId}/complete`, { method: 'PATCH' }),

  // 수업별 배정 학생 조회
  getClassStudents: (classId: string) =>
    request<any[]>(`/api/absence/class-students?classId=${classId}`),

  // 학생 수업 배정
  assignStudent: (data: { classId: string; studentId: string }) =>
    request('/api/absence/class-students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 학생 배정 해제
  unassignStudent: (assignmentId: string) =>
    request(`/api/absence/class-students/${assignmentId}`, { method: 'DELETE' }),

  // ── 공지/액션 보드 ──

  // 공지 목록
  getNotices: (category?: string) =>
    request<any[]>(category ? `/api/board/notices?category=${category}` : '/api/board/notices'),

  // 공지 작성 (액션 아이템 함께 생성 가능)
  createNotice: (data: { title: string; content?: string; category?: string; isPinned?: boolean; dueDate?: string; actionItems?: Array<{ title: string; assignedTo: string; dueDate?: string; description?: string }> }) =>
    request('/api/board/notices', { method: 'POST', body: JSON.stringify(data) }),

  // 공지 수정
  updateNotice: (id: string, data: { title?: string; content?: string; category?: string; isPinned?: boolean; dueDate?: string }) =>
    request(`/api/board/notices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // 공지 삭제
  deleteNotice: (id: string) =>
    request(`/api/board/notices/${id}`, { method: 'DELETE' }),

  // 공지 읽음 처리
  markNoticeRead: (id: string) =>
    request(`/api/board/notices/${id}/read`, { method: 'POST' }),

  // 전체 액션 목록
  getActions: (status?: string) =>
    request<any[]>(status ? `/api/board/actions?status=${status}` : '/api/board/actions'),

  // 내 할일
  getMyActions: () =>
    request<any[]>('/api/board/my-actions'),

  // 액션 생성
  createAction: (data: { title: string; assignedTo: string; dueDate?: string; description?: string; noticeId?: string }) =>
    request('/api/board/actions', { method: 'POST', body: JSON.stringify(data) }),

  // 액션 상태 변경
  updateAction: (id: string, data: { status?: string; title?: string; description?: string; dueDate?: string }) =>
    request(`/api/board/actions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // 타임라인
  getTimeline: () =>
    request<any[]>('/api/board/timeline'),

  // 보드용 선생님 목록
  getBoardTeachers: () =>
    request<any[]>('/api/board/teachers'),
};
