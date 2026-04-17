// Vite dev/preview에서는 proxy가 /api → localhost:8787으로 중계
// 배포 시에는 VITE_API_URL 환경변수 사용
const API_BASE = import.meta.env.VITE_API_URL || '';

// 토큰 갱신 중복 방지 — 동시 401 여러 개가 와도 refresh는 1번만
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
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
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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

  // 401 → refresh token으로 재시도 (로그인/리프레시 자체는 제외 — 에러를 호출자에 그대로 전달)
  const isAuthEndpoint = path.startsWith('/api/auth/login') || path.startsWith('/api/auth/refresh');
  if (res.status === 401 && !isAuthEndpoint) {
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
  school?: string | null;
  contact?: string | null;
  guardian_contact?: string | null;
  enrollment_date?: string;
}

export interface StudentCreateInput {
  name: string;
  grade: string;
  school?: string | null;
  contact?: string | null;
  guardian_contact?: string | null;
  class_id?: string | null;
  subjects?: string[];
  status?: 'active' | 'inactive';
}

export type StudentUpdateInput = Partial<StudentCreateInput>;

export interface TeacherOption {
  id: string;
  name: string;
  role: 'admin' | 'instructor';
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
  login: (slug: string, name: string, pin: string) =>
    request<{ accessToken: string; refreshToken: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ slug, name, pin }),
    }),

  // 학원 공개 정보 (로그인 페이지용)
  getTeacherNames: (slug: string) =>
    request<{ teachers: string[]; academy: { name: string; logo: string | null } | null }>(
      `/api/teachers/names?${new URLSearchParams({ slug })}`
    ),

  // 온보딩
  registerAcademy: (data: { academyName: string; slug: string; ownerName: string; pin: string; phone?: string }) =>
    request<{ academyId: string; slug: string }>('/api/onboard/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  verifySlug: (slug: string) =>
    request<{ available: boolean; reason?: string }>('/api/onboard/verify-slug', {
      method: 'POST',
      body: JSON.stringify({ slug }),
    }),
  getAcademyInfo: (slug: string) =>
    request<{ name: string; logo: string | null }>(`/api/onboard/academy-info?${new URLSearchParams({ slug })}`),
  getAcademyList: () =>
    request<{ slug: string; name: string; logo: string | null }[]>('/api/onboard/academies'),

  // 초대 수락
  acceptInvite: (data: { code: string; name: string; pin: string }) =>
    request<{ userId: string; academyName: string; academySlug: string }>('/api/invite/accept', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 학원 관리
  getAcademy: () => request<any>('/api/academy'),
  updateAcademy: (data: { name?: string; phone?: string; address?: string; logo_url?: string | null }) =>
    request('/api/academy', { method: 'PUT', body: JSON.stringify(data) }),
  getAcademyUsage: () =>
    request<{ students: { current: number; max: number }; teachers: { current: number; max: number }; plan: string }>('/api/academy/usage'),
  createInvite: (data: { role?: string; expiresInDays?: number }) =>
    request<{ code: string; expiresAt: string }>('/api/academy/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getInvites: () => request<any[]>('/api/academy/invites'),

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

  // Students — CRUD
  getStudents: (scope?: 'all' | 'mine') =>
    request<Student[]>(scope === 'all' ? '/api/student?scope=all' : '/api/student'),
  createStudent: (data: StudentCreateInput) =>
    request<Student>('/api/student', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (id: string, data: StudentUpdateInput) =>
    request<Student>(`/api/student/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStudent: (id: string) =>
    request(`/api/student/${id}`, { method: 'DELETE' }),
  setStudentTeachers: (id: string, teacher_ids: string[]) =>
    request(`/api/student/${id}/teachers`, { method: 'PUT', body: JSON.stringify({ teacher_ids }) }),
  getTeachers: () =>
    request<TeacherOption[]>('/api/teachers'),

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
        makeups?: Array<{ id: string; absenceId: string; originalDate: string; classId: string; className: string; notes: string; status: string; scheduledStartTime: string | null; scheduledEndTime: string | null }>;
        adhocs?: Array<{ id: string; date: string; startTime: string; endTime: string; subject?: string | null; reason?: string | null }>;
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

  // 임시 수업 CRUD
  listAdhocSessions: (date: string) =>
    request<AdhocSession[]>(`/api/timer/adhoc?${new URLSearchParams({ date })}`),
  createAdhocSession: (data: { studentId: string; date: string; startTime: string; endTime: string; subject?: string; reason?: string }) =>
    request<AdhocSession>('/api/timer/adhoc', { method: 'POST', body: JSON.stringify(data) }),
  deleteAdhocSession: (id: string) =>
    request(`/api/timer/adhoc/${id}`, { method: 'DELETE' }),

  // 세션 체크인/정지/재개/체크아웃
  sessionCheckIn: (data: { studentId: string; enrollmentId?: string; makeupId?: string; adhocId?: string; scheduledStartTime?: string; scheduledEndTime?: string; subject?: string }) =>
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

  // 보강 목록 (상태 필터 + admin scope)
  getMakeups: (status?: string, scope?: 'all' | 'mine') => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (scope === 'all') p.set('scope', 'all');
    const qs = p.toString();
    return request<any[]>(qs ? `/api/makeup?${qs}` : '/api/makeup');
  },

  // 보강일 지정
  scheduleMakeup: (data: { absenceId: string; scheduledDate: string; scheduledStartTime?: string; scheduledEndTime?: string; notes?: string }) =>
    request('/api/makeup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 보강 완료 처리
  completeMakeup: (makeupId: string) =>
    request(`/api/makeup/${makeupId}/complete`, { method: 'PATCH' }),

  // ── 분할 보강 세션 ──
  listMakeupSessions: (makeupId: string) =>
    request(`/api/makeup/${makeupId}/sessions`),

  addMakeupSession: (makeupId: string, data: {
    scheduled_date: string;
    scheduled_start_time: string;
    scheduled_end_time: string;
    notes?: string;
  }) => request(`/api/makeup/${makeupId}/sessions`, {
    method: 'POST', body: JSON.stringify(data),
  }),

  updateMakeupSession: (makeupId: string, sessionId: string, data: {
    scheduled_date?: string;
    scheduled_start_time?: string;
    scheduled_end_time?: string;
    notes?: string;
  }) => request(`/api/makeup/${makeupId}/sessions/${sessionId}`, {
    method: 'PATCH', body: JSON.stringify(data),
  }),

  completeMakeupSession: (makeupId: string, sessionId: string) =>
    request(`/api/makeup/${makeupId}/sessions/${sessionId}/complete`, { method: 'POST' }),

  cancelMakeupSession: (makeupId: string, sessionId: string) =>
    request(`/api/makeup/${makeupId}/sessions/${sessionId}`, { method: 'DELETE' }),

  // 결석 수정
  updateAbsence: (id: string, data: { absence_date?: string; reason?: string | null; class_id?: string; status?: string }) =>
    request(`/api/absence/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // 결석 삭제 (보강 포함)
  deleteAbsence: (id: string) =>
    request(`/api/absence/${id}`, { method: 'DELETE' }),

  // 보강 수정 (reschedule, notes, status)
  updateMakeup: (id: string, data: { scheduled_date?: string | null; scheduled_start_time?: string | null; scheduled_end_time?: string | null; notes?: string; status?: 'pending' | 'scheduled' | 'completed'; completed_date?: string }) =>
    request(`/api/makeup/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // 보강 삭제 (결석 유지)
  deleteMakeup: (id: string) =>
    request(`/api/makeup/${id}`, { method: 'DELETE' }),

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
  updateAction: (id: string, data: { status?: string; title?: string; description?: string; dueDate?: string; assignedTo?: string }) =>
    request(`/api/board/actions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // 액션 삭제
  deleteAction: (id: string) =>
    request(`/api/board/actions/${id}`, { method: 'DELETE' }),

  // 타임라인
  getTimeline: () =>
    request<any[]>('/api/board/timeline'),

  // 보드용 선생님 목록
  getBoardTeachers: () =>
    request<any[]>('/api/board/teachers'),

  // ── 회의 녹음/요약 ──

  getMeetings: () =>
    request<any[]>('/api/meeting'),

  getMeeting: (id: string) =>
    request<any>(`/api/meeting/${id}`),

  createMeeting: (data: { title: string; participants?: string[] }) =>
    request<{ id: string; title: string; status: string }>('/api/meeting', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  uploadMeetingAudio: (id: string, data: { audioBase64: string; mimeType?: string }) =>
    request<any>(`/api/meeting/${id}/upload`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  transcribeMeetingText: (id: string, transcript: string) =>
    request<any>(`/api/meeting/${id}/transcribe`, {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),

  updateMeetingAction: (actionId: string, status: 'pending' | 'done') =>
    request(`/api/meeting/actions/${actionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  publishMeeting: (id: string) =>
    request<{ noticeId: string }>(`/api/meeting/${id}/publish`, { method: 'POST' }),

  deleteMeeting: (id: string) =>
    request(`/api/meeting/${id}`, { method: 'DELETE' }),

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

  // ── 가차 학생 관리 ──

  getGachaStudents: (scope?: 'all' | 'mine') =>
    request<GachaStudent[]>(scope === 'all' ? '/api/gacha/students?scope=all' : '/api/gacha/students'),

  createGachaStudent: (data: { name: string; pin: string; grade?: string }) =>
    request<{ id: string; name: string; grade: string }>('/api/gacha/students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateGachaStudent: (id: string, data: { name?: string; grade?: string; status?: string; school?: string | null }) =>
    request(`/api/gacha/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteGachaStudent: (id: string) =>
    request(`/api/gacha/students/${id}`, { method: 'DELETE' }),

  resetGachaStudentPin: (id: string, pin: string) =>
    request(`/api/gacha/students/${id}/reset-pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),

  // ── 가차 카드 관리 ──

  getGachaCards: (params?: { student_id?: string; topic?: string; grade?: string }) => {
    const qs = new URLSearchParams();
    if (params?.student_id) qs.set('student_id', params.student_id);
    if (params?.topic) qs.set('topic', params.topic);
    if (params?.grade) qs.set('grade', params.grade);
    const q = qs.toString();
    return request<GachaCard[]>(`/api/gacha/cards${q ? '?' + q : ''}`);
  },

  createGachaCard: (data: { student_id?: string; type: string; question?: string; question_image?: string; answer: string; topic?: string; chapter?: string; grade?: string }) =>
    request<{ id: string }>('/api/gacha/cards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createGachaCardsBulk: (cards: Array<{ student_id?: string; type: string; question?: string; answer: string; topic?: string; grade?: string }>) =>
    request<{ created: string[]; count: number }>('/api/gacha/cards/bulk', {
      method: 'POST',
      body: JSON.stringify({ cards }),
    }),

  updateGachaCard: (id: string, data: Partial<GachaCard>) =>
    request(`/api/gacha/cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteGachaCard: (id: string) =>
    request(`/api/gacha/cards/${id}`, { method: 'DELETE' }),

  uploadGachaCardImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/api/gacha/cards/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || res.statusText);
    return (json?.data ?? json) as { key: string; url: string };
  },

  // ── 증명 관리 ──

  getProofs: (params?: { grade?: string; difficulty?: string }) => {
    const qs = new URLSearchParams();
    if (params?.grade) qs.set('grade', params.grade);
    if (params?.difficulty) qs.set('difficulty', params.difficulty);
    const q = qs.toString();
    return request<Proof[]>(`/api/proof${q ? '?' + q : ''}`);
  },

  getProof: (id: string) =>
    request<ProofDetail>(`/api/proof/${id}`),

  createProof: (data: { title: string; grade: string; chapter?: string; difficulty?: number; description?: string; description_image?: string; steps?: ProofStepInput[] }) =>
    request<{ id: string; title: string }>('/api/proof', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProof: (id: string, data: { title?: string; grade?: string; chapter?: string; difficulty?: number; description?: string; description_image?: string }) =>
    request(`/api/proof/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteProof: (id: string) =>
    request(`/api/proof/${id}`, { method: 'DELETE' }),

  updateProofSteps: (proofId: string, steps: ProofStepInput[]) =>
    request(`/api/proof/${proofId}/steps`, {
      method: 'PUT',
      body: JSON.stringify({ steps }),
    }),

  uploadProofImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/api/proof/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || res.statusText);
    return (json?.data ?? json) as { key: string; url: string };
  },

  // 공유 마켓
  getSharedProofs: (params?: { grade?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.grade) qs.set('grade', params.grade);
    if (params?.q) qs.set('q', params.q);
    const q = qs.toString();
    return request<Proof[]>(`/api/proof/shared${q ? '?' + q : ''}`);
  },

  shareProof: (id: string) =>
    request(`/api/proof/${id}/share`, { method: 'POST' }),

  unshareProof: (id: string) =>
    request(`/api/proof/${id}/share`, { method: 'DELETE' }),

  copyProof: (id: string) =>
    request<{ id: string; copiedFrom: string; title: string }>(`/api/proof/${id}/copy`, { method: 'POST' }),

  // 학생 배정
  assignProof: (proofId: string, studentIds: string[]) =>
    request(`/api/proof/${proofId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ student_ids: studentIds }),
    }),

  unassignProof: (proofId: string, studentId: string) =>
    request(`/api/proof/${proofId}/assign/${studentId}`, { method: 'DELETE' }),

  // 대시보드 통계
  getGachaStats: () =>
    request<GachaStats>('/api/proof/stats'),

  // ── 정기고사 관리 ──

  getExamPeriods: () =>
    request<ExamPeriod[]>('/api/exam-mgmt'),

  createExamPeriod: (data: { title: string; period_month: string }) =>
    request<{ id: string; title: string; period_month: string }>('/api/exam-mgmt', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateExamPeriod: (id: string, data: { title?: string; status?: string }) =>
    request(`/api/exam-mgmt/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteExamPeriod: (id: string) =>
    request(`/api/exam-mgmt/${id}`, { method: 'DELETE' }),

  getExamPapers: (periodId: string) =>
    request<ExamPaper[]>(`/api/exam-mgmt/${periodId}/papers`),

  createExamPaper: (periodId: string, data: { title: string; grade_filter?: string; is_custom?: boolean }) =>
    request<{ id: string }>(`/api/exam-mgmt/${periodId}/papers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteExamPaper: (periodId: string, paperId: string) =>
    request(`/api/exam-mgmt/${periodId}/papers/${paperId}`, { method: 'DELETE' }),

  getExamAssignments: (periodId: string) =>
    request<ExamAssignment[]>(`/api/exam-mgmt/${periodId}/assignments`),

  autoAssignExam: (periodId: string) =>
    request<{ created: number; total: number }>(`/api/exam-mgmt/${periodId}/auto-assign`, {
      method: 'POST',
    }),

  manualAssignExam: (periodId: string, data: { student_id: string; exam_paper_id: string }) =>
    request<{ id: string }>(`/api/exam-mgmt/${periodId}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateExamAssignment: (periodId: string, assignId: string, data: Partial<ExamAssignmentUpdate>) =>
    request(`/api/exam-mgmt/${periodId}/assignments/${assignId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  bulkCheckExam: (periodId: string, field: 'created_check' | 'printed' | 'reviewed', value: boolean) =>
    request(`/api/exam-mgmt/${periodId}/bulk-check`, {
      method: 'POST',
      body: JSON.stringify({ field, value }),
    }),

  deleteExamAssignment: (periodId: string, assignId: string) =>
    request(`/api/exam-mgmt/${periodId}/assignments/${assignId}`, { method: 'DELETE' }),

  // ── 월 기반 간편 배정 ──

  updateExamStudentSchool: (student_id: string, school: string) =>
    request(`/api/exam-mgmt/student-school`, {
      method: 'PATCH',
      body: JSON.stringify({ student_id, school }),
    }),

  getExamByMonth: (month: string, scope?: 'all' | 'mine') =>
    request<{
      period: ExamPeriod;
      students: Array<{
        student_id: string;
        student_name: string;
        student_grade: string;
        student_school: string | null;
        assignment_id: string | null;
        assigned: boolean;
        created_check: number;
        printed: number;
        reviewed: number;
        drive_link: string | null;
        score: number | null;
        memo: string | null;
        exam_date: string | null;
        exam_status: string;
        absence_reason: string | null;
        rescheduled_date: string | null;
        rescheduled_memo: string | null;
      }>;
    }>(`/api/exam-mgmt/by-month?month=${encodeURIComponent(month)}${scope === 'all' ? '&scope=all' : ''}`),

  toggleExamByMonth: (month: string, student_id: string) =>
    request<{ assigned: boolean; assignment_id?: string }>(`/api/exam-mgmt/by-month/toggle`, {
      method: 'POST',
      body: JSON.stringify({ month, student_id }),
    }),

  getExamAbsentees: (month: string, scope?: 'all' | 'mine') =>
    request<{ period: ExamPeriod | null; absentees: ExamAbsentee[] }>(
      `/api/exam-mgmt/absentees?month=${encodeURIComponent(month)}${scope === 'all' ? '&scope=all' : ''}`
    ),

  // ── 시험지(유인물) 관리 ──
  listExamPapers: (filters?: { examType?: string; school?: string; grade?: string; year?: string; semester?: string }) => {
    const qs = new URLSearchParams();
    if (filters?.examType) qs.set('examType', filters.examType);
    if (filters?.school) qs.set('school', filters.school);
    if (filters?.grade) qs.set('grade', filters.grade);
    if (filters?.year) qs.set('year', filters.year);
    if (filters?.semester) qs.set('semester', filters.semester);
    const q = qs.toString();
    return request<ExamPaperItem[]>(`/api/exam-papers${q ? '?' + q : ''}`);
  },

  getExamPaper: (id: string) =>
    request<ExamPaperItem & { distributions: ExamPaperDistribution[] }>(`/api/exam-papers/${id}`),

  previewExamPaperStudents: (school: string, grade: string) =>
    request<Array<{ id: string; name: string; grade: string; school: string }>>(
      `/api/exam-papers/preview-students?school=${encodeURIComponent(school)}&grade=${encodeURIComponent(grade)}`
    ),

  uploadExamPaperFile: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/api/exam-papers/upload`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: fd,
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || '파일 업로드 실패');
    return json.data as { key: string; fileName: string; fileSize: number; contentType: string };
  },

  createExamPaperDoc: (data: {
    title: string;
    examType: 'midterm' | 'final' | 'performance';
    subject?: string;
    school?: string;
    grade?: string;
    examYear?: number;
    semester?: number;
    fileKey?: string;
    fileName?: string;
    fileSize?: number;
    contentType?: string;
    memo?: string;
    autoDistribute?: boolean;
    excludeStudentIds?: string[];
  }) =>
    request<{ id: string; distributed: number }>(`/api/exam-papers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateExamPaper: (id: string, data: Partial<{
    title: string;
    examType: 'midterm' | 'final' | 'performance';
    subject: string;
    school: string;
    grade: string;
    examYear: number;
    semester: number;
    memo: string;
  }>) =>
    request(`/api/exam-papers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteExamPaperDoc: (id: string) =>
    request(`/api/exam-papers/${id}`, { method: 'DELETE' }),

  redistributeExamPaper: (id: string, excludeStudentIds: string[] = []) =>
    request<{ distributed: number }>(`/api/exam-papers/${id}/distribute`, {
      method: 'POST',
      body: JSON.stringify({ excludeStudentIds }),
    }),

  removeExamPaperDistribution: (paperId: string, studentId: string) =>
    request(`/api/exam-papers/${paperId}/distributions/${studentId}`, { method: 'DELETE' }),

  examPaperFileUrl: (key: string) => `${API_BASE}/api/exam-papers/file/${key}`,
};

// ── 가차/증명 타입 ──

export interface GachaStudent {
  id: string;
  academy_id: string;
  teacher_id: string;
  name: string;
  grade: string;
  status: string;
  card_count?: number;
  proof_count?: number;
  session_count?: number;
  created_at: string;
}

export interface GachaCard {
  id: string;
  student_id: string | null;
  type: 'text' | 'image';
  question: string | null;
  question_image: string | null;
  answer: string;
  topic: string | null;
  chapter: string | null;
  grade: string | null;
  box: number;
  success_count: number;
  fail_count: number;
  last_review: string | null;
  created_at: string;
}

export interface Proof {
  id: string;
  academy_id: string;
  created_by: string;
  title: string;
  grade: string;
  chapter: string | null;
  difficulty: number;
  description: string | null;
  description_image: string | null;
  is_shared: number;
  share_count: number;
  step_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ProofStep {
  id: string;
  proof_id: string;
  step_order: number;
  content: string;
  content_image: string | null;
  blanks_json: string | null;
  hint: string | null;
}

export interface ProofDetail extends Proof {
  steps: ProofStep[];
}

export interface ProofStepInput {
  id?: string;
  content: string;
  content_image?: string;
  blanks_json?: string;
  hint?: string;
}

// ── 정기고사 타입 ──

export interface ExamPeriod {
  id: string;
  academy_id: string;
  title: string;
  period_month: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExamPaper {
  id: string;
  exam_period_id: string;
  academy_id: string;
  title: string;
  grade_filter: string | null;
  is_custom: number;
  created_at: string;
}

export interface ExamAssignment {
  id: string;
  exam_period_id: string;
  exam_paper_id: string;
  student_id: string;
  academy_id: string;
  created_check: number;
  printed: number;
  reviewed: number;
  drive_link: string | null;
  score: number | null;
  memo: string | null;
  created_at: string;
  student_name: string;
  student_grade: string;
  paper_title: string;
}

export interface ExamAssignmentUpdate {
  created_check: boolean;
  printed: boolean;
  reviewed: boolean;
  drive_link: string;
  score: number;
  memo: string;
  exam_date: string | null;
  exam_status: 'scheduled' | 'absent' | 'rescheduled' | 'completed' | 'exempted';
  absence_reason: string | null;
  rescheduled_date: string | null;
  rescheduled_memo: string | null;
  rescheduled_start: string;  // 'HH:mm' — 재시험 일정 자동 등록 트리거
  rescheduled_end: string;    // 'HH:mm'
  rescheduled_subject: string;
}

export interface ExamAbsentee {
  assignment_id: string;
  student_id: string;
  student_name: string;
  student_grade: string;
  student_school: string | null;
  exam_status: 'absent' | 'rescheduled';
  absence_reason: string | null;
  rescheduled_date: string | null;
  rescheduled_memo: string | null;
  rescheduled_start: string | null;
  rescheduled_end: string | null;
  adhoc_session_id: string | null;
  adhoc_status: 'scheduled' | 'completed' | 'cancelled' | null;
  score: number | null;
}

export interface AdhocSession {
  id: string;
  studentId: string;
  studentName?: string;
  studentGrade?: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string | null;
  reason: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface ExamPaperItem {
  id: string;
  academy_id: string;
  title: string;
  exam_type: 'midterm' | 'final' | 'performance';
  subject: string | null;
  school: string | null;
  grade: string | null;
  exam_year: number | null;
  semester: number | null;
  file_key: string | null;
  file_name: string | null;
  file_size: number | null;
  content_type: string | null;
  memo: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  distribution_count?: number;
}

export interface ExamPaperDistribution {
  id: string;
  paper_id: string;
  student_id: string;
  academy_id: string;
  source: 'auto' | 'manual';
  distributed_at: string;
  viewed_at: string | null;
  student_name: string;
  student_school: string | null;
  student_grade: string | null;
}

export interface GachaStats {
  summary: {
    students: number;
    cards: number;
    proofs: number;
    activeToday: number;
  };
  studentProgress: Array<{
    id: string;
    name: string;
    grade: string;
    card_count: number;
    assigned_proofs: number;
    completed_proofs: number;
    avg_proof_score: number | null;
    last_activity: string | null;
  }>;
  hardProofs: Array<{
    id: string;
    title: string;
    grade: string;
    difficulty: number;
    avg_score: number;
    attempt_count: number;
  }>;
}
