import { RequestContext, AuthPayload } from '@/types';
import { verifyAccessToken } from '@/utils/jwt';
import { unauthorizedResponse } from '@/utils/response';

export async function authMiddleware(
  context: RequestContext
): Promise<RequestContext | Response> {
  const authHeader = context.request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorizedResponse();
  }

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token, context.env);

  if (!payload) {
    return unauthorizedResponse();
  }

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
