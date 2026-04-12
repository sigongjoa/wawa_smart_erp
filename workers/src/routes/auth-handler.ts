/**
 * 인증 라우트 핸들러
 * 직접 라우팅용으로 단일 핸들러 함수
 */

import { RequestContext } from '@/types';
import { generateTokens, verifyRefreshToken } from '@/utils/jwt';
import { executeFirst, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { createTokenExpiry } from '@/utils/jwt';
import { RefreshTokenSchema, parseAndValidate } from '@/schemas/validation';
import { logger } from '@/utils/logger';
import { loginRateLimit } from '@/middleware/rateLimit';
import { z } from 'zod';

// 로그인 스키마 (이름/PIN 기반)
const TeacherLoginSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다'),
  pin: z.string().min(4, 'PIN은 최소 4자 이상이어야 합니다'),
});

// ---------- PIN hashing: PBKDF2 (new) + SHA256 (legacy compat) ----------

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** New PBKDF2 hash — returns `pbkdf2$100000$<salt_b64>$<hash_b64>` */
async function hashPinPbkdf2(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key, HASH_BYTES * 8,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToB64(salt.buffer)}$${bufToB64(bits)}`;
}

/** Verify against a PBKDF2 hash string */
async function verifyPinPbkdf2(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = b64ToBuf(parts[2]);
  const expectedHash = b64ToBuf(parts[3]);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveBits'],
  );
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, HASH_BYTES * 8,
  ));
  // constant-time compare
  if (bits.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expectedHash[i];
  return diff === 0;
}

/** Legacy SHA256 (no salt) — used for migration compat only */
async function hashPinSha256(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Verify PIN: supports both pbkdf2$... and legacy hex SHA256 */
async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('pbkdf2$')) {
    return verifyPinPbkdf2(pin, storedHash);
  }
  // Legacy SHA256 hex comparison
  const pinHash = await hashPinSha256(pin);
  return pinHash === storedHash;
}

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
      // Rate limit: 5 login attempts per minute per IP
      const blocked = await loginRateLimit(context.env.KV, request);
      if (blocked) return blocked;

      const body = await request.json() as any;
      const { name, pin } = TeacherLoginSchema.parse(body);

      logger.logRequest('POST', '/api/auth/login', undefined, ipAddress);

      // 사용자 조회 (이름으로 검색)
      const user = await executeFirst<any>(
        context.env.DB,
        'SELECT id, email, name, role, academy_id, password_hash FROM users WHERE name = ? LIMIT 1',
        [name]
      );

      if (!user) {
        return unauthorizedResponse();
      }

      // PIN 검증 (PBKDF2 or legacy SHA256)
      const pinValid = await verifyPin(pin, user.password_hash);
      if (!pinValid) {
        logger.warn('PIN 불일치', { name });
        return unauthorizedResponse();
      }

      // Auto-upgrade legacy SHA256 hash → PBKDF2
      if (!user.password_hash.startsWith('pbkdf2$')) {
        const upgradedHash = await hashPinPbkdf2(pin);
        await executeUpdate(
          context.env.DB,
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [upgradedHash, user.id],
        );
      }

      const { accessToken, refreshToken, refreshTokenId } = await generateTokens(
        user.id,
        user.name,
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

      // academy default_class_id — TimerPage 출석 기록에 사용
      const academyRow = await executeFirst<{ default_class_id: string | null }>(
        context.env.DB,
        'SELECT default_class_id FROM academies WHERE id = ?',
        [user.academy_id]
      );
      const defaultClassId = academyRow?.default_class_id || `class-default-${user.academy_id}`;

      return successResponse(
        {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
            academyId: user.academy_id,
            defaultClassId,
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
