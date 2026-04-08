/**
 * 인증 라우트 핸들러
 * 직접 라우팅용으로 단일 핸들러 함수
 */

import { RequestContext } from '@/types';
import { generateTokens, verifyRefreshToken } from '@/utils/jwt';
import { executeFirst, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { createTokenExpiry } from '@/utils/jwt';
import { LoginSchema, RefreshTokenSchema, parseAndValidate } from '@/schemas/validation';
import { logger } from '@/utils/logger';

export async function handleAuth(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // POST /login
    if (method === 'POST' && pathname === '/api/auth/login') {
      const { email, password } = await parseAndValidate(request, LoginSchema);

      logger.logRequest('POST', '/api/auth/login', undefined, ipAddress);

      const user = await executeFirst<any>(
        context.env.DB,
        'SELECT id, email, name, role, academy_id FROM users WHERE email = ? LIMIT 1',
        [email]
      );

      if (!user) {
        return unauthorizedResponse();
      }

      const { accessToken, refreshToken, refreshTokenId } = await generateTokens(
        user.id,
        user.email,
        user.role,
        user.academy_id,
        context.env
      );

      const expiresAt = createTokenExpiry(parseInt(context.env.REFRESH_TOKEN_EXPIRES_IN) || 2592000);
      await executeUpdate(
        context.env.DB,
        `INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [refreshTokenId, user.id, refreshToken, expiresAt.toISOString()]
      );

      return successResponse(
        {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
        200
      );
    }

    // POST /refresh
    if (method === 'POST' && pathname === '/api/auth/refresh') {
      const { refreshToken } = await parseAndValidate(request, RefreshTokenSchema);

      logger.logRequest('POST', '/api/auth/refresh', undefined, ipAddress);

      const payload = await verifyRefreshToken(refreshToken, context.env);
      if (!payload) {
        return unauthorizedResponse();
      }

      const session = await executeFirst<any>(
        context.env.DB,
        'SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime("now")',
        [payload.tokenId]
      );

      if (!session) {
        return unauthorizedResponse();
      }

      const user = await executeFirst<any>(
        context.env.DB,
        'SELECT id, email, name, role, academy_id FROM users WHERE id = ?',
        [(session as any).user_id]
      );

      if (!user) {
        return unauthorizedResponse();
      }

      const { accessToken, refreshToken: newRefreshToken, refreshTokenId } = await generateTokens(
        user.id,
        user.email,
        user.role,
        user.academy_id,
        context.env
      );

      const expiresAt = createTokenExpiry(parseInt(context.env.REFRESH_TOKEN_EXPIRES_IN) || 2592000);
      await executeUpdate(
        context.env.DB,
        `INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [refreshTokenId, user.id, newRefreshToken, expiresAt.toISOString()]
      );

      return successResponse({ accessToken, refreshToken: newRefreshToken });
    }

    // POST /logout
    if (method === 'POST' && pathname === '/api/auth/logout') {
      if (!context.auth) {
        return unauthorizedResponse();
      }

      const { refreshToken } = (await request.json()) as any;

      if (refreshToken) {
        const payload = await verifyRefreshToken(refreshToken, context.env);
        if (payload) {
          await executeUpdate(
            context.env.DB,
            'DELETE FROM sessions WHERE id = ?',
            [payload.tokenId]
          );
        }
      }

      return successResponse({ message: 'Logged out successfully' });
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증') || errorMessage.includes('요청 처리')) {
      logger.warn('인증 검증 오류', { error: errorMessage, ipAddress });
      return errorResponse(errorMessage, 400);
    }

    logger.error('인증 처리 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('요청 처리 실패', 500);
  }
}
