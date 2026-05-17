/**
 * UC-02 — 학생 일일 한도 (질문 30회 / 사진 10장 / Asia/Seoul)
 *
 * 순수 함수 — KV/DB 의존성 없음. 호출자가 state load/persist 책임.
 * 매일 자정 (한국시) reset — date 필드와 today 비교로 판단.
 */

import type { QuotaState } from '@/schemas/ask-ai';

export const QUESTIONS_DAILY_LIMIT = 30;
export const PHOTOS_DAILY_LIMIT = 10;

export type QuotaKind = 'question' | 'photo';

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
}

export function freshQuotaState(student_id: string, date: string): QuotaState {
  return {
    student_id,
    date,
    questions_used: 0,
    questions_limit: QUESTIONS_DAILY_LIMIT,
    photos_used: 0,
    photos_limit: PHOTOS_DAILY_LIMIT,
  };
}

export function checkQuota(state: QuotaState, kind: QuotaKind): QuotaCheckResult {
  const used = kind === 'question' ? state.questions_used : state.photos_used;
  const limit = kind === 'question' ? state.questions_limit : state.photos_limit;

  if (used >= limit) {
    return {
      allowed: false,
      reason: `오늘 한도 도달 (${used}/${limit}) — 내일 다시 시도해주세요`,
      remaining: 0,
    };
  }

  return { allowed: true, remaining: limit - used };
}

export function incrementQuota(state: QuotaState, kind: QuotaKind): QuotaState {
  // 이중 안전장치 — 호출자가 checkQuota를 빼먹어도 절대 한도 초과 X
  const check = checkQuota(state, kind);
  if (!check.allowed) {
    throw new Error(`quota exceeded for ${kind}: ${check.reason}`);
  }

  return {
    ...state,
    questions_used: kind === 'question' ? state.questions_used + 1 : state.questions_used,
    photos_used: kind === 'photo' ? state.photos_used + 1 : state.photos_used,
  };
}

/** state.date가 today와 다르면 stale → 새로 freshQuotaState 호출해야 함 */
export function isStaleForToday(state: QuotaState, today: string): boolean {
  return state.date !== today;
}
