import { RequestContext, AuthPayload } from '@/types';
import { verifyAccessToken } from '@/utils/jwt';
import { unauthorizedResponse } from '@/utils/response';
import { parseCookies, ACCESS_COOKIE } from '@/utils/cookies';

/** 액세스 토큰 추출: httpOnly 쿠키 우선, 레거시 Authorization 헤더 폴백 */
export function extractAccessToken(request: Request): string | null {
  const cookies = parseCookies(request.headers.get('cookie'));
  if (cookies[ACCESS_COOKIE]) return cookies[ACCESS_COOKIE];
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

export async function authMiddleware(
  context: RequestContext
): Promise<RequestContext | Response> {
  const token = extractAccessToken(context.request);
  if (!token) return unauthorizedResponse();

  const payload = await verifyAccessToken(token, context.env);
  if (!payload) return unauthorizedResponse();

  context.auth = payload;
  return context;
}

export function requireAuth(context: RequestContext): boolean {
  return !!context.auth;
}

export function requireRole(context: RequestContext, ...roles: string[]): boolean {
  return context.auth ? roles.includes(context.auth.role) : false;
}

export function requireAcademy(context: RequestContext, academyId: string): boolean {
  return context.auth?.academyId === academyId;
}
