/**
 * 학생 (play) 토큰 인증 — KV `play:<token>` UUID 기반.
 *
 * gacha/baseball/exam/exam-attempt/medterm 핸들러에서 중복 정의되던 패턴.
 * 후속 cleanup PR에서 기존 5개 핸들러도 이 모듈로 교체 예정.
 */
import type { RequestContext, AuthPayload } from '@/types';
import { unauthorizedResponse } from '@/utils/response';
import { tenantMiddleware } from './tenant';

export interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

export async function getPlayAuth(context: RequestContext): Promise<PlayAuth | null> {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const data = await context.env.KV.get(`play:${token}`, 'json') as PlayAuth | null;
  return data;
}

export function requirePlayAuth(auth: PlayAuth | null): auth is PlayAuth {
  return auth !== null;
}

/**
 * 학생 라우트 1줄 가드 — PlayAuth + tenant (학원 활성/만료) 한꺼번에 검증.
 *
 * 성공 시 context 에 다음 주입:
 *   - context.auth = { userId: studentId, academyId, role: 'student' } (기존 핸들러 shim)
 *   - context.tenantId, context.academy (tenantMiddleware 결과)
 *
 * 실패 시 401/403 Response 반환 — 호출자는 그대로 return.
 */
export async function playGuard(
  context: RequestContext,
): Promise<Response | { auth: PlayAuth }> {
  const playAuth = await getPlayAuth(context);
  if (!requirePlayAuth(playAuth)) return unauthorizedResponse();

  // 기존 핸들러가 auth.userId 사용 — shim
  const shim: AuthPayload = {
    userId: playAuth.studentId,
    academyId: playAuth.academyId,
    role: 'student',
  };
  context.auth = shim;

  // tenant 활성/만료 체크
  const tenantResult = await tenantMiddleware(context);
  if (tenantResult instanceof Response) return tenantResult;

  return { auth: playAuth };
}

/**
 * KV 기반 burst rate-limit. 윈도우(초) 동안 최대 max 회.
 * 일일 quota 와 별개 — 1분 5회 같은 burst 차단용.
 *
 * 반환 { allowed, retryAfterSec }. 차단 시 핸들러는 429 + Retry-After 응답 권장.
 */
export async function checkBurstLimit(
  context: RequestContext,
  bucket: string,
  max: number,
  windowSec: number,
): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  const key = `rate:${bucket}`;
  const raw = await context.env.KV.get(key);
  const now = Math.floor(Date.now() / 1000);
  let count = 0;
  let windowStart = now;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { count: number; windowStart: number };
      if (now - parsed.windowStart < windowSec) {
        count = parsed.count;
        windowStart = parsed.windowStart;
      }
    } catch { /* corrupt — reset */ }
  }
  if (count >= max) {
    return { allowed: false, retryAfterSec: windowSec - (now - windowStart) };
  }
  await context.env.KV.put(
    key,
    JSON.stringify({ count: count + 1, windowStart }),
    { expirationTtl: windowSec * 2 },
  );
  return { allowed: true };
}
