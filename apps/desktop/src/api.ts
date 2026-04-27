// Vite dev/preview에서는 proxy가 /api → localhost:8787으로 중계
// 배포 시에는 VITE_API_URL 환경변수 사용
// 인증: 1차는 httpOnly 쿠키(access_token/refresh_token) — 브라우저가 자동 전송.
// 모바일 Safari ITP / 3rd-party cookie 차단으로 쿠키가 드롭되는 환경을 위해
// 로그인/리프레시 응답 body의 토큰을 localStorage에 보관하고 Authorization
// 헤더로 폴백 전송. 서버는 쿠키 우선, Bearer 헤더 폴백을 모두 받는다.
const API_BASE = import.meta.env.VITE_API_URL || '';

const ACCESS_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';

export function setAuthTokens(tokens: { accessToken?: string; refreshToken?: string }) {
  if (tokens.accessToken) localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function authHeader(): Record<string, string> {
  const t = getAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// refresh 동시성 제어 — 동시 401 여러 개가 와도 refresh는 1번만
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const stored = getRefreshToken();
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // 쿠키가 막혀 있을 때 body로 refresh 토큰 전달 (서버 측 레거시 폴백 활용)
        body: stored ? JSON.stringify({ refreshToken: stored }) : undefined,
      });
      if (!res.ok) return false;
      const json = await res.json().catch(() => null);
      const data = json?.data ?? json;
      if (data?.accessToken || data?.refreshToken) {
        setAuthTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function forceLogout() {
  // user 프로필은 localStorage에 남지만 토큰 쿠키는 서버가 clear
  localStorage.removeItem('user');
  // 과거 버전 호환 — 잔존 토큰 제거
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  clearAuthTokens();
  window.location.href = '/';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...options?.headers,
    },
  });

  // 로그인 응답에 토큰이 있으면 저장 (모바일 쿠키 차단 폴백)
  const isLoginEndpoint = path.startsWith('/api/auth/login');

  // 401 → refresh로 재시도 (로그인/리프레시 자체는 제외)
  const isAuthEndpoint = isLoginEndpoint || path.startsWith('/api/auth/refresh');
  if (res.status === 401 && !isAuthEndpoint) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retry = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
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
    forceLogout();
    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || res.statusText);
  }
  const payload = json?.data ?? json;
  if (isLoginEndpoint && res.ok && payload && (payload.accessToken || payload.refreshToken)) {
    setAuthTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
  }
  return payload;
}

/** 파일 업로드용 fetch — Content-Type 자동(boundary), 쿠키 자동 전송, 401 시 refresh 재시도 */
async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...authHeader() },
      body: formData,
    });
  let res = await doFetch();
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (!refreshed) {
      forceLogout();
      throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
    }
    res = await doFetch();
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return (json?.data ?? json) as T;
}

/**
 * 페이징 응답의 정식 스키마. 서버 utils/pagination.ts의 PagedResult와 동기화 유지.
 * 페이징 엔드포인트는 항상 이 모양을 반환하며, list 헬퍼로 .items만 풀어서 사용.
 */
export interface PagedResult<T> {
  items: T[];
  pagination: {
    total?: number;
    limit: number;
    offset: number;
    nextOffset: number | null;
  };
}

/** 페이징 응답을 호출하고 .items만 추출 — 페이징 메타가 필요한 곳만 list() 직접 사용 */
async function listRequest<T>(path: string, options?: RequestInit): Promise<T[]> {
  const r = await request<PagedResult<T> | T[]>(path, options);
  // 점진적 마이그레이션 안전장치: 이미 array로 오는 엔드포인트와 PagedResult 둘 다 지원
  if (Array.isArray(r)) return r;
  return Array.isArray(r?.items) ? r.items : [];
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
  email?: string;
  status?: 'active' | 'disabled';
  subjects?: string[];
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherCreateInput {
  name: string;
  pin: string;
  subjects: string[];
  isAdmin?: boolean;
}

export interface TeacherUpdateInput {
  name?: string;
  role?: 'instructor' | 'admin';
  subjects?: string[];
  status?: 'active' | 'disabled';
}

export interface StudentProfile extends Student {
  teachers: { id: string; name: string; is_homeroom?: number }[];
  homeroom_teacher?: { id: string; name: string } | null;
}

export interface Consultation {
  id: string;
  student_id: string;
  author_id: string;
  author_name?: string;
  channel: 'phone' | 'sms' | 'kakao' | 'in_person' | 'other';
  category: 'monthly' | 'pre_exam' | 'post_exam' | 'ad_hoc';
  consulted_at: string;
  subjects?: string[];
  summary: string;
  parent_sentiment?: 'positive' | 'neutral' | 'concerned' | null;
  follow_up?: string | null;
  follow_up_due?: string | null;
  created_at: string;
}

export interface TeacherNote {
  id: string;
  academy_id: string;
  student_id: string;
  author_id: string;
  author_name: string | null;
  subject: string;
  category: 'attitude' | 'understanding' | 'homework' | 'exam' | 'etc';
  sentiment: 'positive' | 'neutral' | 'concern';
  tags: string[];
  content: string;
  source: 'manual' | 'post_class' | 'post_exam' | 'post_assignment' | 'live_session';
  source_ref_id: string | null;
  visibility: 'staff' | 'homeroom_only' | 'parent_share';
  period_tag: string;
  created_at: string;
  updated_at: string;
}

export interface TeacherNoteInput {
  subject: string;
  category: TeacherNote['category'];
  sentiment: TeacherNote['sentiment'];
  tags?: string[];
  content: string;
  source?: TeacherNote['source'];
  source_ref_id?: string | null;
  visibility?: TeacherNote['visibility'];
}

export interface LiveSessionRow {
  id: string;
  academy_id: string;
  teacher_id: string;
  student_id: string;
  subject: string;
  status: 'active' | 'ended' | 'abandoned';
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  problem_text: string | null;
  problem_r2_key: string | null;
  teacher_solution_text: string | null;
  teacher_solution_r2_key: string | null;
  student_answer_text: string | null;
  student_answer_r2_key: string | null;
  note_id: string | null;
}

export interface LiveSessionState {
  problem: { text?: string; image_data_url?: string; updated_at: number };
  teacher: { text?: string; strokes?: Stroke[]; updated_at: number };
  student: {
    text?: string;
    strokes?: Stroke[];
    photo_data_urls?: string[];
    updated_at: number;
  };
  pulse: number;
  status?: 'active' | 'ended';
}

export interface Stroke {
  color: string;
  width: number;
  points: [number, number][];
}

export interface ExternalSchedule {
  id: string;
  student_id: string;
  author_id: string;
  author_name?: string;
  kind: 'other_subject' | 'other_academy' | 'exam' | 'event';
  title: string;
  starts_at?: string | null;
  ends_at?: string | null;
  recurrence?: string | null;
  location?: string | null;
  note?: string | null;
  created_at: string;
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

export const api = {
  // Auth — 1차는 httpOnly 쿠키, 폴백으로 body의 accessToken/refreshToken을
  // localStorage에 저장하고 Authorization 헤더로 전송 (모바일 쿠키 차단 대응)
  login: (slug: string, name: string, pin: string) =>
    request<{ user: any; accessToken?: string; refreshToken?: string }>('/api/auth/login', {
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
  getInvites: () => listRequest<any>('/api/academy/invites'),
  cancelInvite: (id: string) =>
    request(`/api/academy/invites/${id}`, { method: 'DELETE' }),

  // 선생님 CRUD (admin only)
  createTeacher: (data: TeacherCreateInput) =>
    request<{ id: string; pin: string; name: string }>('/api/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTeacher: (id: string, data: TeacherUpdateInput) =>
    request<TeacherOption>(`/api/teachers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTeacher: (id: string) =>
    request(`/api/teachers/${id}`, { method: 'DELETE' }),
  resetTeacherPin: (id: string) =>
    request<{ tempPin: string }>(`/api/teachers/${id}/reset-pin`, { method: 'POST' }),

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

  // ── 담임 / 상담 / 외부 일정 (합의서 4-5, 4-1, 4-2) ──

  setHomeroom: (studentId: string, teacherId: string | null) =>
    request<{ student_id: string; homeroom_teacher_id: string | null }>(
      `/api/student/${studentId}/homeroom`,
      { method: 'PUT', body: JSON.stringify({ teacher_id: teacherId }) }
    ),

  listConsultations: (studentId: string, limit = 50) =>
    request<Consultation[]>(
      `/api/student/${studentId}/consultations?${new URLSearchParams({ limit: String(limit) })}`
    ),

  createConsultation: (
    studentId: string,
    data: Omit<Consultation, 'id' | 'student_id' | 'author_id' | 'author_name' | 'created_at'>
  ) =>
    request<{ id: string }>(`/api/student/${studentId}/consultations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteConsultation: (studentId: string, consultationId: string) =>
    request<{ id: string; deleted: boolean }>(
      `/api/student/${studentId}/consultations/${consultationId}`,
      { method: 'DELETE' }
    ),

  listSchedules: (studentId: string) =>
    request<ExternalSchedule[]>(`/api/student/${studentId}/schedules`),

  createSchedule: (
    studentId: string,
    data: Omit<ExternalSchedule, 'id' | 'student_id' | 'author_id' | 'author_name' | 'created_at'>
  ) =>
    request<{ id: string }>(`/api/student/${studentId}/schedules`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteSchedule: (studentId: string, scheduleId: string) =>
    request<{ id: string; deleted: boolean }>(
      `/api/student/${studentId}/schedules/${scheduleId}`,
      { method: 'DELETE' }
    ),

  importExamPeriodToSchedule: (studentId: string, periodId: string) =>
    request<{ id: string; imported: boolean }>(
      `/api/student/${studentId}/schedules/from-exam-period/${periodId}`,
      { method: 'POST' }
    ),

  getHomeroomSummary: () =>
    request<{
      homeroom_count: number;
      this_month_consulted: { id: string; name: string; grade: string }[];
      this_month_pending: { id: string; name: string; grade: string }[];
      follow_ups_due: {
        id: string;
        student_id: string;
        student_name: string;
        follow_up: string;
        follow_up_due: string;
      }[];
      upcoming_exams: {
        id: string;
        student_id: string;
        student_name: string;
        title: string;
        starts_at: string;
      }[];
    }>('/api/homeroom/summary'),

  getHomeroomCalendar: (month?: string) =>
    request<{
      month: string;
      students: { id: string; name: string; grade: string }[];
      consultations: {
        id: string;
        student_id: string;
        category: Consultation['category'];
        channel: Consultation['channel'];
        consulted_at: string;
        summary: string;
      }[];
    }>(`/api/homeroom/calendar${month ? `?month=${month}` : ''}`),

  // ── 학부모 월간 리포트 공유 링크 ──
  createParentReportLink: (
    studentId: string,
    data: { month: string; days?: number }
  ) =>
    request<{ url: string; path: string; token: string; month: string; expires_at: string }>(
      `/api/parent-report/${studentId}/share`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  // ── 교과 선생님 메모 (student_teacher_notes) ──
  listTeacherNotes: (
    studentId: string,
    opts?: { subject?: string; period?: string; limit?: number }
  ) => {
    const qs = new URLSearchParams();
    if (opts?.subject) qs.set('subject', opts.subject);
    if (opts?.period) qs.set('period', opts.period);
    if (opts?.limit) qs.set('limit', String(opts.limit));
    const q = qs.toString();
    return request<TeacherNote[]>(
      `/api/student/${studentId}/notes${q ? `?${q}` : ''}`
    );
  },
  createTeacherNote: (
    studentId: string,
    data: TeacherNoteInput
  ) =>
    request<{ id: string }>(`/api/student/${studentId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTeacherNote: (
    studentId: string,
    noteId: string,
    data: Partial<TeacherNoteInput>
  ) =>
    request<{ id: string; updated: boolean }>(
      `/api/student/${studentId}/notes/${noteId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  deleteTeacherNote: (studentId: string, noteId: string) =>
    request<{ id: string; deleted: boolean }>(
      `/api/student/${studentId}/notes/${noteId}`,
      { method: 'DELETE' }
    ),
  getHomeroomNotesOverview: (period?: string) =>
    request<{
      period: string;
      students: {
        id: string;
        name: string;
        grade: string;
        by_subject: {
          subject: string;
          count: number;
          sentiment_counts: { positive: number; neutral: number; concern: number };
        }[];
        concern_count: number;
        total_notes: number;
      }[];
    }>(`/api/homeroom/notes-overview${period ? `?period=${period}` : ''}`),

  // ── 라이브 문제 세션 ──
  startLiveSession: (data: { student_id: string; subject: string; problem_text?: string }) =>
    request<{ id: string; started_at: string }>('/api/live/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLiveSession: (id: string) =>
    request<LiveSessionRow>(`/api/live/sessions/${id}`),
  getLiveState: (id: string) =>
    request<LiveSessionState>(`/api/live/sessions/${id}/state`),
  patchLiveState: (
    id: string,
    data: {
      side: 'teacher' | 'problem';
      text?: string;
      strokes?: any[];
      image_data_url?: string;
    }
  ) =>
    request<{ pulse: number }>(`/api/live/sessions/${id}/state`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  endLiveSession: (
    id: string,
    data: {
      teacher_solution_image?: string;
      student_answer_image?: string;
      create_note?: {
        sentiment: 'positive' | 'neutral' | 'concern';
        summary: string;
        category?: 'attitude' | 'understanding' | 'homework' | 'exam' | 'etc';
      };
    }
  ) =>
    request<{ id: string; note_id: string | null }>(
      `/api/live/sessions/${id}/end`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  // 정기고사 (달력 연계용)
  getExamPeriodsByMonth: (month: string) =>
    request<{ periods: { id: string; title: string; period_month: string }[] }>(
      `/api/exam-mgmt/by-month?${new URLSearchParams({ month })}`
    ),

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
    request<{ id: string; pinReset: boolean }>(`/api/gacha/students/${id}/reset-pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),
  /** 서버가 4자리 랜덤 PIN 생성 후 응답에 한 번만 평문 포함 (강사가 학생에게 전달용) */
  generateGachaStudentPin: (id: string) =>
    request<{ id: string; pinReset: boolean; pin: string }>(`/api/gacha/students/${id}/reset-pin`, {
      method: 'POST',
      body: JSON.stringify({ generate: true }),
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
    const fd = new FormData();
    fd.append('file', file);
    return uploadRequest<{ key: string; url: string }>('/api/gacha/cards/upload-image', fd);
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
    const fd = new FormData();
    fd.append('file', file);
    return uploadRequest<{ key: string; url: string }>('/api/proof/upload-image', fd);
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

  // 영어 시험 응시 MVP — 시험지 메타 + 문제 입력
  patchExamPaperMeta: (paperId: string, data: { subject?: string; durationMinutes?: number; title?: string }) =>
    request(`/api/exam-mgmt/papers/${paperId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getExamPaperQuestions: (paperId: string) =>
    request<ExamQuestionDto[]>(`/api/exam-mgmt/papers/${paperId}/questions`),
  putExamPaperQuestions: (paperId: string, questions: ExamQuestionDto[]) =>
    request<{ saved: number }>(`/api/exam-mgmt/papers/${paperId}/questions`, {
      method: 'PUT',
      body: JSON.stringify({ questions }),
    }),

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
    return uploadRequest<{ key: string; fileName: string; fileSize: number; contentType: string }>(
      '/api/exam-papers/upload', fd,
    );
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

  // ── Vocab Gacha (영단어 학습) ──

  getVocabWords: (params?: { student_id?: string; status?: string }): Promise<VocabWord[]> => {
    const qp = new URLSearchParams();
    if (params?.student_id) qp.set('student_id', params.student_id);
    if (params?.status) qp.set('status', params.status);
    const qs = qp.toString();
    return listRequest<VocabWord>(`/api/vocab/words${qs ? '?' + qs : ''}`);
  },
  createVocabWord: (data: { student_id: string; english: string; korean: string; blank_type?: string; category?: string | null }) =>
    request<{ id: string }>('/api/vocab/words', { method: 'POST', body: JSON.stringify(data) }),
  updateVocabWord: (id: string, data: Partial<{ english: string; korean: string; blank_type: string; status: string; box: number; category: string | null }>) =>
    request(`/api/vocab/words/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVocabWord: (id: string) =>
    request(`/api/vocab/words/${id}`, { method: 'DELETE' }),

  getVocabGrammar: (status?: string) =>
    listRequest<VocabGrammarQA>(`/api/vocab/grammar${status ? '?status=' + status : ''}`),
  createVocabGrammar: (data: { question: string; answer?: string; student_id?: string }) =>
    request<{ id: string }>('/api/vocab/grammar', { method: 'POST', body: JSON.stringify(data) }),
  updateVocabGrammar: (id: string, data: { question?: string; answer?: string; include_in_print?: boolean }) =>
    request(`/api/vocab/grammar/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVocabGrammar: (id: string) =>
    request(`/api/vocab/grammar/${id}`, { method: 'DELETE' }),
  generateVocabGrammarAnswer: (id: string) =>
    request<{ id: string; answer: string }>(`/api/vocab/grammar/${id}/ai-answer`, { method: 'POST' }),

  getVocabTextbooks: () =>
    request<VocabTextbook[]>('/api/vocab/textbooks'),
  createVocabTextbook: (data: { title: string; school?: string; grade?: string; semester?: string }) =>
    request<{ id: string }>('/api/vocab/textbooks', { method: 'POST', body: JSON.stringify(data) }),
  deleteVocabTextbook: (id: string) =>
    request(`/api/vocab/textbooks/${id}`, { method: 'DELETE' }),
  getVocabTextbookWords: (textbookId: string) =>
    request<VocabTextbookWord[]>(`/api/vocab/textbooks/${textbookId}/words`),
  addVocabTextbookWords: (textbookId: string, words: { english: string; korean: string; unit?: string; sentence?: string }[]) =>
    request<{ created: number }>(`/api/vocab/textbooks/${textbookId}/words`, {
      method: 'POST',
      body: JSON.stringify({ words }),
    }),

  // pickVocabPrint, assignVocabPrint, gradeVocabPrint: 셀프-서브 모델로 대체되어 제거 (045)
  listVocabPrintJobs: (params?: { status?: string; days?: number }) => {
    const qp = new URLSearchParams();
    if (params?.status) qp.set('status', params.status);
    if (params?.days) qp.set('days', String(params.days));
    const q = qp.toString();
    return request<VocabPrintJobSummary[]>(`/api/vocab/print/jobs${q ? '?' + q : ''}`);
  },
  getVocabPrintJobAnswers: (jobId: string) =>
    request<VocabPrintJobDetail>(`/api/vocab/print/jobs/${jobId}/answers`),
  voidVocabPrintJob: (jobId: string) =>
    request(`/api/vocab/print/jobs/${jobId}/void`, { method: 'POST', body: JSON.stringify({}) }),
  deleteVocabPrintJob: (jobId: string) =>
    request(`/api/vocab/print/jobs/${jobId}`, { method: 'DELETE' }),

  // ── Vocab Exam Policy ──
  listVocabPolicies: () =>
    request<VocabExamPolicy[]>('/api/vocab/policy'),
  getVocabEffectivePolicy: (params: { student?: string; teacher?: string }) => {
    const qp = new URLSearchParams();
    if (params.student) qp.set('student', params.student);
    if (params.teacher) qp.set('teacher', params.teacher);
    return request<VocabExamPolicy>(`/api/vocab/policy/effective?${qp.toString()}`);
  },
  upsertVocabPolicy: (
    scope: 'academy' | 'teacher' | 'student',
    scopeId: string,
    data: Partial<VocabExamPolicyInput>
  ) =>
    request<{ id: string; created?: boolean; updated?: boolean }>(
      `/api/vocab/policy/${scope}/${encodeURIComponent(scopeId)}`,
      { method: 'PUT', body: JSON.stringify(data) }
    ),
  deleteVocabPolicy: (scope: 'teacher' | 'student', scopeId: string) =>
    request(`/api/vocab/policy/${scope}/${encodeURIComponent(scopeId)}`, { method: 'DELETE' }),

  // ── 시험 결시 개별 타이머 (exam_attempts) ──

  getExamAttemptsToday: () =>
    request<{
      attempts: ExamAttempt[];
      pendingAssignments: ExamAttemptPendingAssignment[];
    }>('/api/exam-attempts/today'),

  startExamAttempt: (data: { examAssignmentId: string; durationMinutes: number; realtimeSessionId?: string }) =>
    request<ExamAttempt>('/api/exam-attempts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  pauseExamAttempt: (id: string, reason: string) =>
    request<ExamAttempt>(`/api/exam-attempts/${id}/pause`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  resumeExamAttempt: (id: string) =>
    request<ExamAttempt>(`/api/exam-attempts/${id}/resume`, { method: 'POST' }),

  submitExamAttempt: (id: string, note?: string) =>
    request<ExamAttempt>(`/api/exam-attempts/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(note ? { note } : {}),
    }),

  voidExamAttempt: (id: string) =>
    request<ExamAttempt>(`/api/exam-attempts/${id}/void`, { method: 'POST' }),

  // 기간 내 모든 attempt (점수 + student) — ExamManagementPage에서 자동 채점 표시용
  getExamAttemptsByPeriod: (periodId: string) =>
    request<ExamAttemptByPeriod[]>(`/api/exam-attempts/by-period/${periodId}`),

  // 문항별 응시 상세 — ExamResultPage
  getExamAttemptDetail: (attemptId: string) =>
    request<ExamAttemptDetail>(`/api/exam-attempts/${attemptId}/detail`),

  // ── Assignments (과제 회수·첨삭) ──
  getAssignments: (params?: { status?: string; kind?: string; mine?: boolean }) => {
    const qp = new URLSearchParams();
    if (params?.status) qp.set('status', params.status);
    if (params?.kind) qp.set('kind', params.kind);
    if (params?.mine) qp.set('mine', '1');
    const q = qp.toString();
    return listRequest<any>(`/api/assignments${q ? `?${q}` : ''}`);
  },
  getAssignmentInbox: () => listRequest<any>('/api/assignments/inbox'),
  getAssignmentStats: () => request<any>('/api/assignments/stats'),
  getAssignment: (id: string) => request<any>(`/api/assignments/${id}`),
  createAssignment: (data: {
    title: string;
    instructions?: string;
    kind: 'perf_eval' | 'exam_paper' | 'general';
    due_at?: string | null;
    attached_file_key?: string | null;
    attached_file_name?: string | null;
    student_ids: string[];
  }) => request<{ id: string; target_count: number }>('/api/assignments', { method: 'POST', body: JSON.stringify(data) }),
  updateAssignment: (id: string, data: { title?: string; instructions?: string; due_at?: string | null; status?: 'published' | 'closed' }) =>
    request<any>(`/api/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  closeAssignment: (id: string) => request(`/api/assignments/${id}`, { method: 'DELETE' }),
  hardDeleteAssignment: (id: string) =>
    request<{ message: string }>(`/api/assignments/${id}?hard=1`, { method: 'DELETE' }),
  deleteAssignmentTarget: (targetId: string) =>
    request<{ message: string }>(`/api/assignments/targets/${targetId}`, { method: 'DELETE' }),
  getAssignmentTarget: (targetId: string) =>
    request<{ target: any; submissions: any[]; responses: any[] }>(`/api/assignments/targets/${targetId}`),
  respondToTarget: (targetId: string, data: {
    submission_id?: string | null;
    comment?: string | null;
    file_key?: string | null;
    file_name?: string | null;
    action: 'accept' | 'needs_resubmit';
  }) => request<{ id: string; target_status: string }>(`/api/assignments/targets/${targetId}/respond`, {
    method: 'POST', body: JSON.stringify(data),
  }),
  setTargetStatus: (targetId: string, status: string) =>
    request(`/api/assignments/targets/${targetId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  uploadAssignmentFile: async (file: File, purpose: 'attachment' | 'response') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', purpose);
    return uploadRequest<{ key: string; fileName: string; fileSize: number; contentType: string }>(
      '/api/assignments/upload', fd,
    );
  },
  assignmentFileUrl: (key: string) => `${API_BASE}/api/assignments/file/${encodeURIComponent(key)}`,

  // ── 숙제 학부모 공유 링크 ──
  createHomeworkParentShare: (targetId: string, days?: number) =>
    request<{ url: string; path: string; token: string; expires_at: string }>(
      `/api/assignments/targets/${targetId}/parent-share`,
      { method: 'POST', body: JSON.stringify({ days }) }
    ),

  // ── Student Lesson Items ──
  listLessonItems: (params?: {
    studentId?: string;
    textbook?: string;
    kind?: LessonItemKind;
    source?: LessonItemSource;
    q?: string;
    includeArchived?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.studentId) qs.set('student_id', params.studentId);
    if (params?.textbook) qs.set('textbook', params.textbook);
    if (params?.kind) qs.set('kind', params.kind);
    if (params?.source) qs.set('source', params.source);
    if (params?.q) qs.set('q', params.q);
    if (params?.includeArchived) qs.set('include_archived', '1');
    const q = qs.toString();
    return listRequest<LessonItem>(`/api/lesson-items${q ? '?' + q : ''}`);
  },
  applyCurriculum: (data: { student_id: string; curriculum_id: string; item_ids?: string[] }) =>
    request<{ created: number; total: number }>('/api/lesson-items/apply-curriculum', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  // ── Curriculum ──
  listCurricula: (params?: { term?: string; grade?: string; subject?: string; includeArchived?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.term) qs.set('term', params.term);
    if (params?.grade) qs.set('grade', params.grade);
    if (params?.subject) qs.set('subject', params.subject);
    if (params?.includeArchived) qs.set('include_archived', '1');
    const q = qs.toString();
    return listRequest<Curriculum>(`/api/curricula${q ? '?' + q : ''}`);
  },
  getCurriculum: (id: string) => request<CurriculumDetail>(`/api/curricula/${id}`),
  createCurriculum: (data: CurriculumCreateInput) =>
    request<Curriculum>('/api/curricula', { method: 'POST', body: JSON.stringify(data) }),
  updateCurriculum: (id: string, patch: Partial<CurriculumCreateInput>) =>
    request<{ ok: boolean }>(`/api/curricula/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  archiveCurriculum: (id: string) =>
    request<{ ok: boolean }>(`/api/curricula/${id}`, { method: 'DELETE' }),
  addCurriculumItem: (curriculumId: string, data: CurriculumItemInput) =>
    request<CurriculumItem>(`/api/curricula/${curriculumId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCurriculumItem: (curriculumId: string, itemId: string, data: Partial<CurriculumItemInput>) =>
    request<{ ok: boolean }>(`/api/curricula/${curriculumId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCurriculumItem: (curriculumId: string, itemId: string) =>
    request<{ ok: boolean }>(`/api/curricula/${curriculumId}/items/${itemId}`, { method: 'DELETE' }),
  reorderCurriculumItems: (curriculumId: string, items: Array<{ id: string; order_idx: number }>) =>
    request<{ ok: boolean }>(`/api/curricula/${curriculumId}/items/reorder`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  getLessonItem: (id: string) => request<LessonItem>(`/api/lesson-items/${id}`),
  createLessonItem: (data: LessonItemCreateInput) =>
    request<LessonItem>('/api/lesson-items', { method: 'POST', body: JSON.stringify(data) }),
  updateLessonItem: (id: string, patch: LessonItemPatch) =>
    request<LessonItem>(`/api/lesson-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  archiveLessonItem: (id: string) =>
    request<{ ok: boolean }>(`/api/lesson-items/${id}`, { method: 'DELETE' }),
  reorderLessonItems: (items: Array<{ id: string; order_idx: number }>) =>
    request<{ ok: boolean }>('/api/lesson-items/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  uploadLessonItemFile: (itemId: string, file: File, role: LessonFileRole = 'main') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('role', role);
    return uploadRequest<LessonItemFile>(`/api/lesson-items/${itemId}/files`, fd);
  },
  deleteLessonItemFile: (itemId: string, fileId: string) =>
    request<{ ok: boolean }>(`/api/lesson-items/${itemId}/files/${fileId}`, { method: 'DELETE' }),
  createLessonItemParentShare: (itemId: string) =>
    request<{ student_id: string; path: string; token: string; expires_at: string }>(
      `/api/lesson-items/${itemId}/share`,
      { method: 'POST' }
    ),
  createLessonFromCoverage: (data: {
    student_id: string;
    category: string;
    title?: string;
    purpose?: string;
  }) =>
    request<LessonItem>('/api/lesson-items/from-coverage', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  lessonItemFileDownloadUrl: (fileId: string) =>
    `${API_BASE}/api/lesson-items/download/${encodeURIComponent(fileId)}`,
};

// ── Curriculum (학원 단위 카탈로그) ──

export interface Curriculum {
  id: string;
  academy_id: string;
  term: string;
  grade: string;
  subject: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  item_count?: number;
  student_count?: number;
}

export interface CurriculumItem {
  id: string;
  curriculum_id: string;
  textbook: string | null;
  unit_name: string;
  kind: 'unit' | 'type';
  order_idx: number;
  description: string | null;
  default_purpose: string | null;
  created_at: string;
}

export interface CurriculumDetail extends Curriculum {
  items: CurriculumItem[];
}

export interface CurriculumCreateInput {
  term: string;
  grade: string;
  subject: string;
  title: string;
  description?: string | null;
}

export interface CurriculumItemInput {
  textbook?: string | null;
  unit_name: string;
  kind?: 'unit' | 'type';
  order_idx?: number;
  description?: string | null;
  default_purpose?: string | null;
}

// ── Student Lesson Items (진도+자료+학부모노출 통합 도메인) ──

export type LessonItemKind = 'unit' | 'type' | 'free';
export type LessonItemStatus = 'todo' | 'in_progress' | 'done';
export type LessonItemSource = 'manual' | 'curriculum' | 'exam_prep' | 'coverage_prescription';
export type LessonFileRole = 'main' | 'answer' | 'solution' | 'extra';

export interface LessonItemFile {
  id: string;
  file_name: string;
  file_role: LessonFileRole;
  mime_type: string | null;
  size_bytes: number;
  version: number;
  uploaded_at: string;
}

export interface LessonItem {
  id: string;
  academy_id: string;
  student_id: string;
  textbook: string | null;
  unit_name: string | null;
  kind: LessonItemKind;
  order_idx: number;
  understanding: number | null;
  status: LessonItemStatus;
  note: string | null;
  title: string | null;
  purpose: string | null;
  topic: string | null;
  description: string | null;
  tags: string[];
  coverage_category: string | null;
  visible_to_parent: boolean;
  parent_can_download: boolean;
  curriculum_item_id: string | null;
  source: LessonItemSource;
  created_by: string;
  created_at: string;
  updated_at: string;
  files: LessonItemFile[];
}

export interface LessonItemCreateInput {
  student_id: string;
  textbook?: string | null;
  unit_name?: string | null;
  kind?: LessonItemKind;
  order_idx?: number;
  understanding?: number | null;
  status?: LessonItemStatus;
  note?: string | null;
  title?: string | null;
  purpose?: string | null;
  topic?: string | null;
  description?: string | null;
  tags?: string[];
  coverage_category?: string | null;
  visible_to_parent?: boolean;
  parent_can_download?: boolean;
  source?: 'manual' | 'exam_prep';
}

export type LessonItemPatch = Partial<Omit<LessonItemCreateInput, 'student_id' | 'source'>>;

// ── Vocab Gacha 타입 ──

export interface VocabWord {
  id: string;
  academy_id: string;
  student_id: string;
  english: string;
  korean: string;
  box: number;
  blank_type: 'korean' | 'english' | 'both';
  status: 'pending' | 'approved';
  added_by: 'teacher' | 'student';
  review_count: number;
  wrong_count: number;
  created_at: string;
  // 선택적: 학생이 직접 추가 시 포함될 수 있음
  example?: string | null;
  pos?: 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'conj' | null;
  category?: string | null;
}

export interface VocabGrammarQA {
  id: string;
  academy_id: string;
  student_id: string | null;
  student_name?: string | null;
  question: string;
  answer: string | null;
  status: 'pending' | 'answered';
  answered_by: 'teacher' | 'ai' | null;
  include_in_print: number;
  created_at: string;
  answered_at: string | null;
}

export interface VocabTextbook {
  id: string;
  academy_id: string;
  school: string | null;
  grade: string | null;
  semester: string | null;
  title: string;
}

export interface VocabTextbookWord {
  id: string;
  textbook_id: string;
  unit: string | null;
  english: string;
  korean: string;
  sentence: string | null;
}

export interface VocabExamPolicyInput {
  vocab_count: number;
  context_count: number;
  grammar_count: number;
  writing_enabled: boolean;
  writing_type: string | null;
  box_filter: string;
  source: 'student_pool' | 'textbook' | 'mixed';
  textbook_id: string | null;
  time_limit_sec: number;
  cooldown_min: number;
  daily_limit: number;
  active_from: string | null;
  active_to: string | null;
  word_cooldown_min: number;
  ai_grading: boolean;
  enabled: boolean;
}

export interface VocabExamPolicy extends VocabExamPolicyInput {
  id: string;
  academy_id: string;
  scope: 'academy' | 'teacher' | 'student';
  scope_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface VocabPrintJobSummary {
  job_id: string;
  student_id: string;
  student_name: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'voided';
  auto_correct: number | null;
  auto_total: number | null;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
  word_count: number;
}

export interface VocabPrintJobAnswerRow {
  word_id: string;
  english: string;
  korean: string;
  pos: string | null;
  selected_index: number | null;
  correct_index: number;
  choices: string[];
  correct: boolean;
  saved_at: string | null;
}

export interface VocabPrintJobDetail {
  job: {
    id: string;
    status: string;
    student_id: string;
    student_name: string;
    auto_correct: number | null;
    auto_total: number | null;
    started_at: string | null;
    submitted_at: string | null;
    created_at: string;
  };
  answers: VocabPrintJobAnswerRow[];
}

// ── 가차/증명 타입 ──

export interface GachaStudent {
  id: string;
  academy_id: string;
  teacher_id: string;
  name: string;
  grade: string;
  status: string;
  /** 서버에서 항상 빈 문자열 또는 hex hash. 평문 PIN은 한 번도 노출되지 않음. */
  pin_hash?: string;
  pin_salt?: string;
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
  subject?: string | null;
  duration_minutes?: number | null;
}

export interface ExamQuestionDto {
  id?: string;
  questionNo: number;
  prompt: string;
  choices: string[];        // 5개
  correctChoice: number;    // 1..5
  points?: number;
  category?: string | null; // 문제 유형 — 커버리지 집계의 분류 축
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

export interface ExamAttemptPauseEvent {
  pausedAt: string;
  resumedAt?: string;
  reason?: string;
  byUserId?: string;
}

export interface ExamAttemptByPeriod {
  id: string;
  exam_assignment_id: string;
  student_id: string;
  status: string;
  auto_score: number | null;
  auto_correct: number | null;
  auto_total: number | null;
  started_at: string | null;
  ended_at: string | null;
  submit_note: string | null;
  student_name: string;
}

export interface ExamAttemptDetailBreakdown {
  questionNo: number;
  prompt: string;
  choices: string[];
  correctChoice: number;
  points: number;
  selectedChoice: number | null;
  savedAt: string | null;
  correct: boolean;
}

export interface ExamAttemptDetail {
  id: string;
  studentName: string;
  paperTitle: string | null;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  score: number | null;
  correct: number | null;
  total: number | null;
  submitNote: string | null;
  breakdown: ExamAttemptDetailBreakdown[];
}

export interface ExamAttempt {
  id: string;
  examAssignmentId: string;
  studentId: string;
  durationMinutes: number;
  status: 'ready' | 'running' | 'paused' | 'submitted' | 'expired' | 'voided';
  startedAt: string | null;
  endedAt: string | null;
  deadlineAt: string | null;
  pausedSeconds: number;
  isPaused: boolean;
  remainingSeconds: number;
  pauseHistory: ExamAttemptPauseEvent[];
  proctorUserId: string | null;
  submitNote: string | null;
  studentName?: string;
  periodTitle?: string | null;
  paperTitle?: string | null;
}

export interface ExamAttemptPendingAssignment {
  assignment_id: string;
  student_id: string;
  exam_status: 'absent' | 'rescheduled';
  absence_reason: string | null;
  rescheduled_date: string | null;
  exam_period_id: string;
  exam_paper_id: string;
  student_name: string;
  student_grade: string;
  period_title: string | null;
  paper_title: string | null;
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
