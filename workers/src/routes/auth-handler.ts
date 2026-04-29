/**
 * 인증 라우트 핸들러
 * 직접 라우팅용으로 단일 핸들러 함수
 */

import { RequestContext } from '@/types';
import { generateTokens, verifyRefreshToken, createTokenExpiry } from '@/utils/jwt';
import { executeFirst, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { RefreshTokenSchema, parseAndValidate } from '@/schemas/validation';
import { logger } from '@/utils/logger';
import { loginRateLimit, accountLoginCheck, accountLoginRecordFail, accountLoginRecordSuccess } from '@/middleware/rateLimit';
import { hashPin, verifyPin, isLegacyHash } from '@/utils/crypto';

/**
 * 사용자 미존재 시 PBKDF2 비용을 동일하게 발생시켜 타이밍 사이드채널 차단 (SEC-AUTH-H2).
 * 결과는 항상 false. 실제 verifyPin과 동일 iteration·hash로 비교한다.
 */
const DUMMY_PIN_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
async function dummyPinVerify(pin: string): Promise<void> {
  try { await verifyPin(pin, DUMMY_PIN_HASH); } catch { /* ignore */ }
}
import {
  ACCESS_COOKIE, REFRESH_COOKIE, serializeCookie, clearCookie,
  parseCookies, appendSetCookie,
} from '@/utils/cookies';
import { z } from 'zod';

const TeacherLoginSchema = z.object({
  slug: z.string().min(1, '학원코드는 필수입니다'),
  name: z.string().min(1, '이름은 필수입니다'),
  pin: z.string().min(4, 'PIN은 최소 4자 이상이어야 합니다'),
});

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
      const { slug, name, pin } = TeacherLoginSchema.parse(body);

      logger.logRequest('POST', '/api/auth/login', undefined, ipAddress);

      // 계정 잠금 확인 (분산 무차별 대입 방어 — SEC-AUTH-H1)
      const locked = await accountLoginCheck(context.env.KV, slug, name);
      if (locked) return locked;

      // 사용자 조회 (학원 slug + 이름으로 검색 — 다른 학원 이름 충돌 방지)
      const user = await executeFirst<any>(
        context.env.DB,
        `SELECT u.id, u.email, u.name, u.role, u.academy_id, u.password_hash,
                u.password_must_change, u.password_reset_at
         FROM users u
         JOIN academies a ON u.academy_id = a.id
         WHERE u.name = ? AND a.slug = ? AND a.is_active = 1
         LIMIT 1`,
        [name, slug]
      );

      if (!user) {
        // 더미 PBKDF2 — 응답 시간 동등화 (SEC-AUTH-H2)
        await dummyPinVerify(pin);
        await accountLoginRecordFail(context.env.KV, slug, name);
        return unauthorizedResponse();
      }

      // PIN 검증 (PBKDF2 or legacy SHA256)
      const pinValid = await verifyPin(pin, user.password_hash);
      if (!pinValid) {
        await accountLoginRecordFail(context.env.KV, slug, name);
        logger.warn('PIN 불일치', { slug });
        return unauthorizedResponse();
      }

      // SEC-AUTH-PWMC: 임시 PIN 24h 만료 enforcement (TEACH-SEC-H3)
      // password_must_change=1 + password_reset_at + 24h 초과 → 로그인 거부
      if (user.password_must_change === 1 && user.password_reset_at) {
        const resetMs = new Date(user.password_reset_at + 'Z').getTime();
        if (!isNaN(resetMs)) {
          const ageHours = (Date.now() - resetMs) / (3600 * 1000);
          if (ageHours > 24) {
            logger.logSecurity('TEMP_PIN_EXPIRED_LOGIN_REJECTED', 'medium', {
              userId: user.id, ageHours: Math.round(ageHours),
            });
            return errorResponse(
              '임시 PIN이 만료되었습니다 (24시간 초과). 관리자에게 재발급을 요청하세요.',
              401
            );
          }
        }
      }

      // 성공 — 계정 잠금 카운터 리셋
      await accountLoginRecordSuccess(context.env.KV, slug, name);

      // Auto-upgrade legacy SHA256 hash → PBKDF2
      if (isLegacyHash(user.password_hash)) {
        const upgradedHash = await hashPin(pin);
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

      // academy 정보 — TimerPage 출석 기록에 사용
      const academyRow = await executeFirst<{ default_class_id: string | null; name: string; slug: string; logo_url: string | null }>(
        context.env.DB,
        'SELECT default_class_id, name, slug, logo_url FROM academies WHERE id = ?',
        [user.academy_id]
      );
      const defaultClassId = academyRow?.default_class_id || `class-default-${user.academy_id}`;

      const accessMaxAge = parseInt(context.env.JWT_EXPIRES_IN) || 3600;
      const refreshMaxAge = parseInt(context.env.REFRESH_TOKEN_EXPIRES_IN) || 2592000;
      const baseResponse = successResponse(
        {
          // 기본 전송 경로는 httpOnly 쿠키.
          // 모바일 브라우저(iOS Safari ITP / 3rd-party cookie block)에서 쿠키가
          // 드롭되는 경우를 위해 body에도 토큰을 포함. 클라이언트가 Authorization
          // 헤더로 폴백 전송. 서버는 쿠키 우선, 헤더 폴백으로 양쪽 지원.
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
            academyId: user.academy_id,
            defaultClassId,
            academyName: academyRow?.name,
            academySlug: academyRow?.slug,
            academyLogo: academyRow?.logo_url,
            // SEC-AUTH-PWMC: 클라이언트는 이 플래그가 true면 변경 화면 강제
            passwordMustChange: user.password_must_change === 1,
          },
        },
        200
      );
      return appendSetCookie(baseResponse, [
        serializeCookie(ACCESS_COOKIE, accessToken, { maxAge: accessMaxAge }),
        serializeCookie(REFRESH_COOKIE, refreshToken, { maxAge: refreshMaxAge }),
      ]);
    }

    // POST /refresh — 쿠키에서 우선 읽고, body 호환 지원
    if (method === 'POST' && pathname === '/api/auth/refresh') {
      const cookieRefresh = parseCookies(request.headers.get('cookie'))[REFRESH_COOKIE];
      let refreshToken = cookieRefresh;
      if (!refreshToken) {
        // 레거시: body로 전달된 refreshToken 허용
        try {
          const parsed = await parseAndValidate(request, RefreshTokenSchema);
          refreshToken = parsed.refreshToken;
        } catch {
          return unauthorizedResponse();
        }
      }

      logger.logRequest('POST', '/api/auth/refresh', undefined, ipAddress);

      const payload = await verifyRefreshToken(refreshToken, context.env);
      if (!payload) {
        return unauthorizedResponse();
      }

      // SEC-AUTH-H3: 회전 + 재사용 탐지.
      // 이 토큰의 session row를 조회. 존재하지 않으면 (이미 회전됨) → 재사용 시도 → user 전체 폐기.
      const session = await executeFirst<{ user_id: string }>(
        context.env.DB,
        'SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime("now")',
        [payload.tokenId]
      );

      if (!session) {
        // 토큰은 verify 통과했지만 session 없음 — 이미 회전됐거나 logout된 토큰 재사용.
        // payload.userId의 모든 활성 세션을 즉시 폐기 (도난 가능성 방어).
        // refresh JWT 자체는 30일 유효이므로 회전 후에도 verify는 통과하지만, DB row 삭제로
        // 무효화 — DB row 부재가 재사용 신호.
        await executeUpdate(
          context.env.DB,
          'DELETE FROM sessions WHERE user_id = ?',
          [payload.userId]
        );
        logger.logSecurity('REFRESH_TOKEN_REUSE_DETECTED', 'high', {
          userId: payload.userId, tokenId: payload.tokenId,
        });
        return unauthorizedResponse();
      }

      const user = await executeFirst<any>(
        context.env.DB,
        'SELECT id, email, name, role, academy_id FROM users WHERE id = ?',
        [session.user_id]
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

      // SEC-AUTH-H3: 회전 — 이전 row 삭제 + 새 row 삽입을 batch로 원자화
      await context.env.DB.batch([
        context.env.DB
          .prepare('DELETE FROM sessions WHERE id = ?')
          .bind(payload.tokenId),
        context.env.DB
          .prepare(
            `INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at)
             VALUES (?, ?, ?, ?, datetime('now'))`
          )
          .bind(refreshTokenId, user.id, newRefreshToken, expiresAt.toISOString()),
      ]);

      const accessMaxAge = parseInt(context.env.JWT_EXPIRES_IN) || 3600;
      const refreshMaxAge = parseInt(context.env.REFRESH_TOKEN_EXPIRES_IN) || 2592000;
      // 쿠키와 함께 body에도 토큰 반환 — 모바일 쿠키 차단 폴백
      const refreshBase = successResponse({
        refreshed: true,
        accessToken,
        refreshToken: newRefreshToken,
      });
      return appendSetCookie(refreshBase, [
        serializeCookie(ACCESS_COOKIE, accessToken, { maxAge: accessMaxAge }),
        serializeCookie(REFRESH_COOKIE, newRefreshToken, { maxAge: refreshMaxAge }),
      ]);
    }

    // POST /api/auth/change-pin — 본인 PIN 변경 (password_must_change 해제용)
    if (method === 'POST' && pathname === '/api/auth/change-pin') {
      if (!context.auth) return unauthorizedResponse();

      const body = (await request.json().catch(() => ({}))) as any;
      const currentPin = typeof body.currentPin === 'string' ? body.currentPin : '';
      const newPin = typeof body.newPin === 'string' ? body.newPin : '';

      if (newPin.length < 4 || newPin.length > 20) {
        return errorResponse('새 PIN은 4~20자', 400);
      }
      if (currentPin === newPin) {
        return errorResponse('새 PIN은 기존과 달라야 합니다', 400);
      }

      const me = await executeFirst<{ id: string; password_hash: string }>(
        context.env.DB,
        'SELECT id, password_hash FROM users WHERE id = ?',
        [context.auth.userId]
      );
      if (!me) return unauthorizedResponse();

      const ok = await verifyPin(currentPin, me.password_hash);
      if (!ok) {
        logger.logSecurity('CHANGE_PIN_CURRENT_INVALID', 'medium', { userId: me.id, ip: ipAddress });
        return errorResponse('현재 PIN이 올바르지 않습니다', 401);
      }

      const newHash = await hashPin(newPin);
      // 변경 시 password_must_change=0, reset_at=NULL + 모든 다른 세션 폐기 (현재 세션만 남김)
      await context.env.DB.batch([
        context.env.DB.prepare(
          `UPDATE users
              SET password_hash = ?,
                  password_must_change = 0,
                  password_reset_at = NULL,
                  updated_at = datetime('now')
            WHERE id = ?`
        ).bind(newHash, me.id),
        // 다른 디바이스 세션 폐기. 현재 요청은 access JWT 사용이라 영향 없음.
        // 단 클라이언트는 새 refresh를 발급받기 위해 재로그인 권장.
        context.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(me.id),
      ]);

      logger.info(`PIN 변경 완료: ${me.id}`);
      const resp = successResponse({ changed: true, message: 'PIN이 변경되었습니다. 다시 로그인하세요.' });
      // 쿠키 정리 — 클라이언트는 재로그인 강제
      return appendSetCookie(resp, [clearCookie(ACCESS_COOKIE), clearCookie(REFRESH_COOKIE)]);
    }

    // POST /logout — 쿠키의 refresh 토큰으로 세션 DB 삭제 + 쿠키 clear
    if (method === 'POST' && pathname === '/api/auth/logout') {
      if (!context.auth) {
        return unauthorizedResponse();
      }

      const cookieRefresh = parseCookies(request.headers.get('cookie'))[REFRESH_COOKIE];
      let refreshToken: string | undefined = cookieRefresh;
      if (!refreshToken) {
        try {
          const body = (await request.json()) as any;
          refreshToken = body?.refreshToken;
        } catch { /* body 없음 허용 */ }
      }

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

      const logoutBase = successResponse({ message: 'Logged out successfully' });
      return appendSetCookie(logoutBase, [clearCookie(ACCESS_COOKIE), clearCookie(REFRESH_COOKIE)]);
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
