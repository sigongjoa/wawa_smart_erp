const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('play_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
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
};

export function getImageUrl(key: string): string {
  return `${API_BASE}/api/proof/image/${key}`;
}

export function getCardImageUrl(key: string): string {
  return `${API_BASE}/api/gacha/image/${key}`;
}
