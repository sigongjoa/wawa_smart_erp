/**
 * AskAI API client — workers/api/ask-ai/* 호출 wrapper.
 */

import type { AskAIResult, QuotaSummary, Rating } from './types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

function authHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('play_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized() {
  // api.ts 와 동일 — 토큰 만료/거부 시 자격증명 비우고 로그인 페이지로
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('play_token');
    localStorage.removeItem('play_token_created_at');
    localStorage.removeItem('play_student');
    localStorage.removeItem('play_slug');
  }
  if (typeof window !== 'undefined') {
    window.location.hash = '#/login';
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/ask-ai${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('세션이 만료되었습니다');
  }
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json.data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/ask-ai${path}`, {
    credentials: 'include',
    headers: { ...authHeaders() },
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('세션이 만료되었습니다');
  }
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json.data as T;
}

export interface AskOpts {
  message: string;
  unit_id?: string;
  attached_photos?: string[];
}

export const askAI = {
  ask: (opts: AskOpts) => apiPost<AskAIResult>('/ask', opts),
  quota: () => apiGet<QuotaSummary>('/quota'),
  conversation: (id: string) => apiGet<any>(`/conversations/${id}`),
  drillToday: () => apiGet<{ cards: any[]; today: string }>('/drill/today'),
  drillRate: (card_id: string, rating: Rating) =>
    apiPost('/drill/rate', { card_id, rating }),
};
