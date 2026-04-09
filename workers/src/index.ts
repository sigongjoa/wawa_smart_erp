/**
 * Cloudflare Workers 메인 엔트리 포인트
 * 직접 라우팅 구현
 */

import { RequestContext, Env } from '@/types';
import { authMiddleware } from '@/middleware/auth';
import { handleCors, addCorsHeaders } from '@/middleware/cors';
import { rateLimitMiddleware, setRateLimitHeaders } from '@/middleware/rateLimit';
import { internalErrorResponse, errorResponse, successResponse } from '@/utils/response';
import { logger } from '@/utils/logger';

// 핸들러들 import
import { handleAuth } from '@/routes/auth-handler';
import { handleTimer } from '@/routes/timer-handler';
import { handleMessage } from '@/routes/message-handler';
import { handleFile } from '@/routes/file-handler';
import { handleGrader } from '@/routes/grader-handler';
import { handleReport } from '@/routes/report-handler';
import { handleReportImage } from '@/routes/report-image-handler';
import { handleStudent } from '@/routes/student-handler';
import { handleTeachers } from '@/routes/teachers-handler';

/**
 * 메인 요청 처리 함수
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  const context: RequestContext = {
    request,
    env,
    params: {},
  };

  try {
    // 요청 origin 추출
    const origin = request.headers.get('origin') || undefined;

    // CORS preflight
    if (method === 'OPTIONS') {
      return handleCors(request, env) || new Response(null, { status: 200 });
    }

    // Rate Limiting
    const rateLimitResult = await rateLimitMiddleware(context);
    if (rateLimitResult instanceof Response) {
      return addCorsHeaders(rateLimitResult, env, origin);
    }

    // Health Check
    if (pathname === '/health') {
      return addCorsHeaders(
        successResponse({ status: 'ok', timestamp: new Date().toISOString() }),
        env,
        origin
      );
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
      // 인증이 필요 없는 라우트
      if ((pathname === '/api/auth/login' || pathname === '/api/auth/refresh') && method === 'POST') {
        return addCorsHeaders(await handleAuth(method, pathname, request, context), env, origin);
      }

      // 인증 체크 (logout, 다른 protected routes)
      // 이미지 조회는 공개 (인증 필요 없음)
      const isPublicImage = pathname.match(/^\/api\/report\/image\//);
      if (!pathname.includes('/auth/login') && !pathname.includes('/auth/refresh') && !isPublicImage) {
        const authResult = await authMiddleware(context);
        if (authResult instanceof Response) {
          return addCorsHeaders(authResult, env, origin);
        }
        Object.assign(context, authResult);
      }

      // 라우트 핸들러 매칭
      if (pathname.startsWith('/api/auth/')) {
        return addCorsHeaders(await handleAuth(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/timer/')) {
        return addCorsHeaders(await handleTimer(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/message/')) {
        return addCorsHeaders(await handleMessage(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/file/')) {
        return addCorsHeaders(await handleFile(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/grader/')) {
        return addCorsHeaders(await handleGrader(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/report/')) {
        // 이미지 관련 라우트는 별도로 처리
        if (pathname === '/api/report/upload-image' || pathname.match(/^\/api\/report\/image\//)) {
          return addCorsHeaders(await handleReportImage(method, pathname, request, context), env, origin);
        }
        return addCorsHeaders(await handleReport(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/student/')) {
        return addCorsHeaders(await handleStudent(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/teachers') || pathname.startsWith('/api/migrate/')) {
        return addCorsHeaders(await handleTeachers(method, pathname, request, context), env, origin);
      }
    }

    // 404
    return addCorsHeaders(errorResponse('Not found', 404), env, origin);
  } catch (error) {
    logger.error('Request error', error instanceof Error ? error : new Error(String(error)));
    return addCorsHeaders(internalErrorResponse(error), env);
  }
}

/**
 * Cloudflare Worker fetch handler
 */
export default {
  fetch: async (request: Request, env: Env): Promise<Response> => {
    const response = await handleRequest(request, env);

    // Rate Limit Headers
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    return await setRateLimitHeaders(response, ip, env.KV);
  },
};
