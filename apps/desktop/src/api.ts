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
  window.location.href = '/';
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
  grade?: string;
  guardian_contact?: string;
  enrollment_date?: string;
}

export interface StudentProfile extends Student {
  teachers: { id: string; name: string }[];
}

export interface CommentHistoryEntry {
  yearMonth: string;
  scores: { subject: string; score: number; comment: string }[];
  totalComment: string;
}

export interface AttendanceSummary {
  totalClasses: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
  recentAbsences: { date: string; className: string; reason: string }[];
  makeups: { completed: number; pending: number };
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

export type ReportType = 'monthly' | 'midterm' | 'final';

export interface ReportEntry {
  studentId: string;
  studentName: string;
  reportType?: ReportType;
  yearMonth?: string | null;
  term?: string | null;
  scores: ScoreEntry[];
  totalComment: string;
}

export interface ExamContext {
  reportType: 'midterm' | 'final';
  term: string;
}

// ── v1.9.0 timer 복원 타입 ──
export interface PauseRecord {
  pausedAt: string;
  resumedAt?: string;
  reason?: string;
}

export interface RealtimeSession {
  id: string;
  studentId?: string;
  status: 'active' | 'paused' | 'completed' | 'overtime';
  checkInTime: string;
  checkOutTime?: string | null;
  scheduledMinutes: number;
  addedMinutes: number;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  pauseHistory: PauseRecord[];
  subject?: string | null;
}

export interface MaterialItem {
  id: string;
  student_id: string;
  student_name: string;
  title: string;
  memo: string;
  status: 'todo' | 'done';
  file_url: string;
  created_at: string;
  completed_at: string | null;
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

  // Settings — active exam review (정기고사: 중간/기말)
  getActiveExamReview: () =>
    request<{ activeTerm: string; activeExamType: 'midterm' | 'final' }>('/api/settings/active-exam-review'),
  setActiveExamReview: (activeTerm: string, activeExamType: 'midterm' | 'final') =>
    request('/api/settings/active-exam-review', {
      method: 'POST',
      body: JSON.stringify({ activeTerm, activeExamType }),
    }),

  // Students — returns Student[] directly
  getStudents: () =>
    request<Student[]>('/api/student'),

  // Exams — returns Exam[] directly
  getExams: (yearMonth?: string) =>
    request<Exam[]>(yearMonth ? `/api/grader/exams?${new URLSearchParams({ yearMonth })}` : '/api/grader/exams'),

  // Grades
  saveGrade: (data: { student_id: string; exam_id: string; score: number; comments?: string }) =>
    request('/api/grader/grades', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Report — returns ReportEntry[]
  //   월말: getReport({ reportType: 'monthly', yearMonth })
  //   정기고사: getReport({ reportType: 'midterm'|'final', term: 'YYYY-N' })
  getReport: (params: { reportType?: ReportType; yearMonth?: string; term?: string }) => {
    const qp = new URLSearchParams();
    qp.set('reportType', params.reportType || 'monthly');
    if (params.yearMonth) qp.set('yearMonth', params.yearMonth);
    if (params.term) qp.set('term', params.term);
    return request<ReportEntry[]>(`/api/report?${qp.toString()}`);
  },

  // Score history — 월말평가 전용 (과목별 월간 점수 추이)
  getScoreHistory: (studentId: string, months?: number) =>
    request<{ months: string[]; subjects: Record<string, (number | null)[]> }>(
      `/api/report/history?${new URLSearchParams({ studentId, months: String(months || 6) })}`
    ),

  // Report Send Status
  //   월말: getSendStatus({ reportType: 'monthly', yearMonth })
  //   정기고사: getSendStatus({ reportType: 'midterm'|'final', term })
  getSendStatus: (params: { reportType?: ReportType; yearMonth?: string; term?: string }) => {
    const qp = new URLSearchParams();
    qp.set('reportType', params.reportType || 'monthly');
    if (params.yearMonth) qp.set('yearMonth', params.yearMonth);
    if (params.term) qp.set('term', params.term);
    return request<Record<string, { shareUrl: string; sentBy: string; sentAt: string }>>(
      `/api/report/send-status?${qp.toString()}`
    );
  },

  // Report Image — upload PNG to R2, get public share URL
  uploadReportImage: (data: {
    imageBase64: string;
    studentId: string;
    studentName: string;
    yearMonth?: string;
    reportType?: ReportType;
    term?: string;
  }) =>
    request<{ shareUrl: string; imageUrl: string }>('/api/report/upload-image', {
      method: 'POST',
      body: JSON.stringify({ reportType: 'monthly', ...data }),
    }),

  // AI — generate comment via Gemini
  generateComment: (data: {
    studentName: string;
    subject: string;
    score: number;
    yearMonth: string;
    existingComment?: string;
    examContext?: ExamContext;
  }) =>
    request<{ comment: string }>('/api/ai/generate-comment', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // AI — generate total summary
  generateSummary: (data: {
    studentName: string;
    yearMonth: string;
    scores: { subject: string; score: number; comment?: string }[];
    examContext?: ExamContext;
  }) =>
    request<{ summary: string }>('/api/ai/generate-summary', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── 학생 성장 대시보드 ──

  getStudentProfile: (id: string) =>
    request<StudentProfile>(`/api/student/${id}/profile`),

  getStudentComments: (id: string, months?: number) =>
    request<CommentHistoryEntry[]>(`/api/student/${id}/comments?${new URLSearchParams({ months: String(months || 12) })}`),

  getStudentAttendance: (id: string, months?: number) =>
    request<AttendanceSummary>(`/api/student/${id}/attendance?${new URLSearchParams({ months: String(months || 6) })}`),

  // ── 시간표/수업 ──

  // 수업 목록 (관리자 도구용 — TimerPage는 사용 안 함)
  getClasses: () =>
    request<any[]>('/api/timer/classes'),

  // 출석 기록 (UPSERT)
  recordAttendance: (data: { studentId: string; classId: string; date: string; status: string; notes?: string }) =>
    request('/api/timer/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 수업별 출석 조회
  getAttendance: (classId: string, date: string) =>
    request<any[]>(`/api/timer/attendance/${classId}/${date}`),

  // 오늘의 담당 학생 목록 (선생님 기준, attendance+absence 조합 상태 포함)
  getTodayStudents: (date: string) =>
    request<{
      date: string;
      defaultClassId: string;
      students: Array<{
        id: string;
        name: string;
        grade?: string;
        subjects: string[];
        attendance_status: 'pending' | 'present' | 'late' | 'absent';
        attendance_id: string | null;
        notes: string | null;
      }>;
    }>(`/api/timer/today-students?${new URLSearchParams({ date })}`),

  // 수업 마침 — 오늘 담당 학생 중 pending 전원 일괄 결석 처리
  finishDay: (data: { date: string }) =>
    request<{ date: string; recorded: number; total: number }>('/api/timer/finish-day', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── v1.9.0 복원: realtime session ──

  // 담당 학생 + 오늘 요일 enrollment + active/completed session 조합
  getRealtimeToday: (day?: string, date?: string) => {
    const qp = new URLSearchParams();
    if (day) qp.set('day', day);
    if (date) qp.set('date', date);
    const qs = qp.toString();
    return request<{
      date: string;
      day: string | null;
      students: Array<{
        id: string;
        name: string;
        grade?: string;
        subjects: string[];
        enrollments: Array<{ id: string; day: string; startTime: string; endTime: string; subject?: string | null }>;
        activeSession: RealtimeSession | null;
        completedSession: RealtimeSession | null;
      }>;
    }>(`/api/timer/realtime-today${qs ? '?' + qs : ''}`);
  },

  // 수강일정 CRUD
  listEnrollments: (studentId: string) =>
    request<Array<{ id: string; studentId: string; day: string; startTime: string; endTime: string; subject?: string | null }>>(
      `/api/timer/enrollments?${new URLSearchParams({ studentId })}`
    ),
  createEnrollment: (data: { studentId: string; day: string; startTime: string; endTime: string; subject?: string }) =>
    request('/api/timer/enrollments', { method: 'POST', body: JSON.stringify(data) }),
  deleteEnrollment: (id: string) =>
    request(`/api/timer/enrollments/${id}`, { method: 'DELETE' }),

  // 세션 체크인/정지/재개/체크아웃
  sessionCheckIn: (data: { studentId: string; enrollmentId?: string; scheduledStartTime?: string; scheduledEndTime?: string; subject?: string }) =>
    request<RealtimeSession>('/api/timer/sessions/check-in', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sessionPause: (sessionId: string, reason?: string) =>
    request<{ id: string; status: string; pauseHistory: PauseRecord[] }>(
      `/api/timer/sessions/${sessionId}/pause`,
      { method: 'POST', body: JSON.stringify({ reason }) }
    ),
  sessionResume: (sessionId: string) =>
    request<{ id: string; status: string; pauseHistory: PauseRecord[] }>(
      `/api/timer/sessions/${sessionId}/resume`,
      { method: 'POST' }
    ),
  sessionCheckOut: (sessionId: string, note?: string) =>
    request<{ id: string; recordId: string; status: string; checkOutTime: string; netMinutes: number; wasOvertime: boolean }>(
      `/api/timer/sessions/${sessionId}/check-out`,
      { method: 'POST', body: JSON.stringify({ note }) }
    ),

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
    request<any[]>(`/api/absence?${new URLSearchParams({ date })}`),

  // 수업 마침 시 미출석자 조회
  getUncheckedStudents: (classId: string, date: string) =>
    request<any[]>(`/api/absence/unchecked?${new URLSearchParams({ classId, date })}`),

  // 퇴근 요약
  getDailySummary: (date: string) =>
    request<{ date: string; todayAbsences: any[]; pendingMakeups: any[]; clipboardText: string }>(
      `/api/absence/daily-summary?${new URLSearchParams({ date })}`
    ),

  // 보강 목록 (상태 필터)
  getMakeups: (status?: string) =>
    request<any[]>(status ? `/api/makeup?${new URLSearchParams({ status })}` : '/api/makeup'),

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
    request<any[]>(`/api/absence/class-students?${new URLSearchParams({ classId })}`),

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
    request<any[]>(category ? `/api/board/notices?${new URLSearchParams({ category })}` : '/api/board/notices'),

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
    request<any[]>(status ? `/api/board/actions?${new URLSearchParams({ status })}` : '/api/board/actions'),

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

  // ── 교재 관리 ──
  getMaterials: (params?: { status?: string; studentId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.studentId) qs.set('studentId', params.studentId);
    const q = qs.toString();
    return request<MaterialItem[]>(`/api/materials${q ? '?' + q : ''}`);
  },

  createMaterial: (data: { studentId: string; title: string; memo?: string }) =>
    request<{ id: string }>('/api/materials', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMaterial: (id: string, data: { status?: string; fileUrl?: string; title?: string; memo?: string }) =>
    request('/api/materials/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteMaterial: (id: string) =>
    request('/api/materials/' + id, { method: 'DELETE' }),
};
