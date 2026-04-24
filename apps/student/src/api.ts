const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('play_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  const json = await res.json().catch(() => null);

  if (res.status === 401) {
    localStorage.removeItem('play_token');
    localStorage.removeItem('play_student');
    window.location.hash = '#/login';
    throw new Error('세션이 만료되었습니다');
  }

  if (!res.ok) {
    throw new Error(json?.error || res.statusText);
  }

  return json?.data ?? json;
}

// ── 타입 ──

export interface Session {
  id: string;
  student_id: string;
  session_date: string;
  cards_drawn: number;
  cards_target: number;
  proofs_done: number;
  proofs_target: number;
}

export interface Card {
  id: string;
  type: 'text' | 'image';
  question: string | null;
  question_image: string | null;
  answer: string;
  topic: string | null;
  box: number;
  success_count: number;
  fail_count: number;
}

export interface ProofListItem {
  id: string;
  title: string;
  grade: string;
  chapter: string | null;
  difficulty: number;
  description: string | null;
  description_image: string | null;
  step_count: number;
  best_score: number | null;
  current_box: number | null;
}

export interface OrderingProblem {
  proof: { id: string; title: string; grade: string; difficulty: number; description: string | null; description_image: string | null };
  steps: Array<{ id: string; content: string; content_image: string | null }>;
  total_steps: number;
}

export interface FillBlankProblem {
  proof: { id: string; title: string; grade: string; difficulty: number; description: string | null; description_image: string | null };
  steps: Array<{
    id: string;
    step_order: number;
    content: string;
    content_image: string | null;
    has_blank: boolean;
    blanks: Array<{ position: number; length: number }>;
  }>;
  total_blanks: number;
  current_box: number;
}

export interface SubmitResult {
  score: number;
  box_before: number;
  box_after: number;
  detail: any;
  time_spent: number;
}

export interface StudentProfile {
  student: { id: string; name: string; grade: string };
  sessions: Session[];
  boxDistribution: Array<{ box: number; count: number }>;
  recentProofScores: Array<{ proof_id: string; title: string; mode: string; score: number; box: number; attempted_at: string }>;
}

// ── API ──

export interface Academy {
  slug: string;
  name: string;
  logo: string | null;
}

export const api = {
  getAcademies: async (): Promise<Academy[]> => {
    const res = await fetch(`${API_BASE}/api/onboard/academies`);
    const json = await res.json();
    return json?.data ?? [];
  },

  login: (academy_slug: string, name: string, pin: string) =>
    request<{ token: string; student: { id: string; name: string; grade: string } }>('/api/play/login', {
      method: 'POST',
      body: JSON.stringify({ academy_slug, name, pin }),
    }),

  getSession: () =>
    request<Session>('/api/play/session'),

  getProfile: () =>
    request<StudentProfile>('/api/play/profile'),

  getRandomCard: () =>
    request<Card>('/api/play/random-card'),

  submitCardFeedback: (cardId: string, result: 'success' | 'fail') =>
    request<{ card_id: string; result: string; box_before: number; box_after: number }>(`/api/play/card/${cardId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ result }),
    }),

  getProofs: () =>
    request<ProofListItem[]>('/api/play/proofs'),

  getOrdering: (proofId: string) =>
    request<OrderingProblem>(`/api/play/proof/${proofId}/ordering`),

  getFillBlank: (proofId: string) =>
    request<FillBlankProblem>(`/api/play/proof/${proofId}/fillblank`),

  submitProof: (proofId: string, data: { mode: string; answers: any; start_time?: string }) =>
    request<SubmitResult>(`/api/play/proof/${proofId}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Vocab (영단어 학습) ──

  getVocabWords: () =>
    request<VocabWord[]>('/api/play/vocab/words'),
  addVocabWord: (data: { english: string; korean: string }) =>
    request<{ id: string }>('/api/play/vocab/words', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getVocabGrammar: () =>
    request<VocabGrammarItem[]>('/api/play/vocab/grammar'),
  addVocabGrammar: (question: string) =>
    request<{ id: string }>('/api/play/vocab/grammar', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
  getVocabTextbooks: () =>
    request<VocabTextbookItem[]>('/api/play/vocab/textbooks'),
  getVocabTextbookWords: (id: string) =>
    request<VocabTextbookWordItem[]>(`/api/play/vocab/textbooks/${id}/words`),

  // ── 시험 응시 타이머 (PIN 인증) ──

  getActiveExamAttempt: () =>
    request<{ active: ExamAttemptDto | null }>('/api/play/exam-attempts/active')
      .then((r) => r?.active ?? null),

  getExamAttempt: (id: string) =>
    request<ExamAttemptDto>(`/api/play/exam-attempts/${id}`),

  submitExamAttempt: (id: string, note?: string) =>
    request<{ id: string; status: string; endedAt: string | null; remainingSeconds: number }>(
      `/api/play/exam-attempts/${id}/submit`,
      {
        method: 'POST',
        body: JSON.stringify(note ? { note } : {}),
      }
    ),

  // ── 영어 시험 응시 (PIN 인증) ──
  listExams: () => request<ExamListItem[]>('/api/play/exams'),
  startExam: (assignmentId: string) =>
    request<{ id: string; status: string; durationMinutes: number; startedAt: string }>(
      `/api/play/exams/${assignmentId}/start`,
      { method: 'POST' }
    ),
  getExamAttemptFull: (id: string) => request<ExamAttemptFull>(`/api/play/attempts/${id}`),
  saveExamAnswer: (attemptId: string, questionNo: number, choice: number | null) =>
    request<{ savedAt: string }>(`/api/play/attempts/${attemptId}/answer`, {
      method: 'PUT',
      body: JSON.stringify({ questionNo, choice }),
    }),
  submitExam: (attemptId: string) =>
    request<{ id: string; status: string; endedAt: string; score: number; correct: number; total: number }>(
      `/api/play/attempts/${attemptId}/submit`,
      { method: 'POST' }
    ),

  // ── 과제 (PIN 인증) ──
  getAssignments: () => request<AssignmentListItem[]>('/api/play/assignments'),
  getAssignmentDetail: (targetId: string) =>
    request<AssignmentDetail>(`/api/play/assignments/${targetId}`),
  submitAssignment: (targetId: string, data: { note?: string | null; files: Array<{ key: string; name: string; size: number; mime?: string | null }> }) =>
    request<{ id: string; status: string }>(`/api/play/assignments/${targetId}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  uploadAssignmentFile: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/play/assignments/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || '업로드 실패');
    return (json?.data ?? json) as { key: string; fileName: string; fileSize: number; contentType: string };
  },
  assignmentFileUrl: (key: string) => `${API_BASE}/api/play/assignments/file/${encodeURIComponent(key)}`,

  // ── 라이브 문제 세션 ──
  getActiveLiveSession: () =>
    request<{ session: { id: string; subject: string; teacher_name: string | null; started_at: string } | null }>(
      '/api/play/live/active'
    ),
  getLiveState: (id: string) =>
    request<LiveSessionState>(`/api/play/live/sessions/${id}/state`),
  patchLiveStudent: (
    id: string,
    data: { text?: string; strokes?: any[]; append_photo_data_url?: string }
  ) =>
    request<{ pulse: number }>(`/api/play/live/sessions/${id}/state`, {
      method: 'PATCH',
      body: JSON.stringify({ side: 'student', ...data }),
    }),

  // ── 학습자료 아카이브 ──
  listArchives: () => request<StudentArchiveItem[]>('/api/play/archives'),
  archiveDownloadUrl: (archiveId: string, fileId: string) =>
    `${API_BASE}/api/play/archives/${encodeURIComponent(archiveId)}/download/${encodeURIComponent(fileId)}`,
};

export interface StudentArchiveItem {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  purpose: string;
  description: string | null;
  tags: string[];
  can_download: boolean;
  distributed_at: string;
  created_at: string;
  files: Array<{
    id: string;
    file_name: string;
    file_role: 'main' | 'answer' | 'solution' | 'extra';
    size_bytes: number;
    version: number;
  }>;
}

export interface LiveStroke {
  color: string;
  width: number;
  points: [number, number][];
}
export interface LiveSessionState {
  problem: { text?: string; image_data_url?: string; updated_at: number };
  teacher: { text?: string; strokes?: LiveStroke[]; updated_at: number };
  student: {
    text?: string;
    strokes?: LiveStroke[];
    photo_data_urls?: string[];
    updated_at: number;
  };
  pulse: number;
  status?: 'active' | 'ended';
}

export interface AssignmentListItem {
  target_id: string;
  assignment_id: string;
  status: 'assigned' | 'submitted' | 'reviewed' | 'needs_resubmit' | 'completed';
  assigned_at: string;
  last_submitted_at: string | null;
  last_reviewed_at: string | null;
  title: string;
  kind: 'perf_eval' | 'exam_paper' | 'general';
  due_at: string | null;
  instructions: string | null;
  attached_file_key: string | null;
  attached_file_name: string | null;
  assignment_status: string;
  response_count: number;
  latest_response_at: string | null;
}

export interface AssignmentDetail {
  target: AssignmentListItem & { [k: string]: any };
  submissions: Array<{
    id: string;
    note: string | null;
    files: Array<{ key: string; name: string; size: number; mime?: string }>;
    submitted_at: string;
  }>;
  responses: Array<{
    id: string;
    comment: string | null;
    file_key: string | null;
    file_name: string | null;
    action: 'accept' | 'needs_resubmit';
    created_at: string;
    teacher_name: string | null;
  }>;
}

export interface ExamListItem {
  assignmentId: string;
  paperId: string;
  title: string;
  durationMinutes: number;
  examDate: string | null;
  examStatus: string;
  questionCount: number;
  attemptId: string | null;
  attemptStatus: string | null;
}

export interface ExamQuestionDto {
  questionNo: number;
  prompt: string;
  choices: string[];
  points: number;
}

export interface ExamAnswerDto {
  questionNo: number;
  selectedChoice: number | null;
}

export interface ExamBreakdownItem {
  questionNo: number;
  correct: boolean;
  selected: number | null;
  correctChoice: number;
}

export interface ExamAttemptFull {
  id: string;
  status: 'ready' | 'running' | 'paused' | 'submitted' | 'expired' | 'voided';
  title: string;
  durationMinutes: number;
  startedAt: string | null;
  endedAt?: string | null;
  remainingSeconds: number;
  questions: ExamQuestionDto[] | null;
  answers: ExamAnswerDto[] | null;
  // 종료 후
  score?: number;
  correct?: number;
  total?: number;
  breakdown?: ExamBreakdownItem[];
}

export interface ExamAttemptDto {
  id: string;
  status: 'ready' | 'running' | 'paused' | 'submitted' | 'expired' | 'voided';
  durationMinutes: number;
  remainingSeconds: number;
  isPaused: boolean;
  startedAt: string | null;
  endedAt?: string | null;
  deadlineAt: string | null;
  studentName?: string;
  examTitle?: string;
  paperTitle?: string;
  periodTitle?: string;
  pauseReason?: string;
}

export interface VocabWord {
  id: string;
  english: string;
  korean: string;
  box: number;
  blank_type: 'korean' | 'english' | 'both';
  status: 'pending' | 'approved';
  review_count: number;
  wrong_count: number;
  created_at: string;
}

export interface VocabGrammarItem {
  id: string;
  question: string;
  answer: string | null;
  status: 'pending' | 'answered';
  answered_by: 'teacher' | 'ai' | null;
  student_id: string | null;
  created_at: string;
  answered_at: string | null;
}

export interface VocabTextbookItem {
  id: string;
  school: string | null;
  grade: string | null;
  semester: string | null;
  title: string;
}

export interface VocabTextbookWordItem {
  id: string;
  unit: string | null;
  english: string;
  korean: string;
  sentence: string | null;
}

export function getImageUrl(key: string): string {
  return `${API_BASE}/api/proof/image/${key}`;
}

export function getCardImageUrl(key: string): string {
  return `${API_BASE}/api/gacha/image/${key}`;
}
