/**
 * AI 호출 비용 보호 — KV 기반 사용자/학원별 일일 한도.
 *
 * 기존 rateLimit.ts(in-memory, IP 기반)는 분당 burst 보호용.
 * 이 모듈은 일일 비용 cap — Gemini API 호출당 토큰비 누적 차단.
 *
 * 사용:
 *   const blocked = await checkAiDailyLimit(env.KV, userId, 'vocab-grammar');
 *   if (blocked) return blocked;
 */

import { errorResponse } from './response';

interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const DAILY_LIMITS: Record<string, number> = {
  'vocab-grammar': 50,
  'meeting-summary': 30,
  'meeting-action': 30,
  'ai-comment': 100,
  'ai-summary': 30,
  'ai-generate': 100,
  default: 50,
};

const DAY_SECONDS = 24 * 60 * 60;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * userId 단위 일일 카운터. 한도 초과 시 429 Response, 통과 시 null.
 * 호출 자체는 카운트도 함께 증가시킴 (check-and-increment).
 */
export async function checkAiDailyLimit(
  kv: KVLike,
  userId: string,
  kind: string,
): Promise<Response | null> {
  const max = DAILY_LIMITS[kind] ?? DAILY_LIMITS.default;
  const key = `ai-daily:${kind}:${userId}:${todayUtc()}`;

  const raw = await kv.get(key);
  const current = raw ? parseInt(raw, 10) : 0;

  if (current >= max) {
    return errorResponse(
      `AI 호출 일일 한도(${max}회)에 도달했습니다. 내일 다시 시도하거나 관리자에게 문의하세요.`,
      429,
    );
  }

  await kv.put(key, String(current + 1), { expirationTtl: DAY_SECONDS + 60 });
  return null;
}
