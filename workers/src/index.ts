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
import { handleSettings } from '@/routes/settings-handler';
import { handleAI } from '@/routes/ai-handler';
import { handleAbsence } from '@/routes/absence-handler';
import { handleBoard } from '@/routes/board-handler';
import { handleMaterials } from '@/routes/materials-handler';
import { handleOnboard } from '@/routes/onboard-handler';
import { handleAcademy } from '@/routes/academy-handler';
import { handleMeeting } from '@/routes/meeting-handler';
import { handleGachaStudent } from '@/routes/gacha-student-handler';
import { handleGachaCard } from '@/routes/gacha-card-handler';
import { handleProof } from '@/routes/proof-handler';
import { handleGachaPlay } from '@/routes/gacha-play-handler';
import { handleExamMgmt } from '@/routes/exam-mgmt-handler';
import { handleExamPaper } from '@/routes/exam-paper-handler';
import { handleParentReport } from '@/routes/parent-report-handler';
import { tenantMiddleware } from '@/middleware/tenant';

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
    // JWT 시크릿 필수 검증 (시작 시)
    if (!env.JWT_SECRET || !env.JWT_REFRESH_SECRET) {
      return internalErrorResponse(new Error('JWT secrets not configured'));
    }
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

    // Health Check + 만료 세션 정리 (lazy cleanup)
    if (pathname === '/health') {
      try {
        await env.DB.prepare(
          "DELETE FROM sessions WHERE expires_at < datetime('now')"
        ).run();
      } catch { /* non-critical */ }
      return addCorsHeaders(
        successResponse({ status: 'ok', timestamp: new Date().toISOString() }),
        env,
        origin
      );
    }

    // 요청 본문 크기 제한 (10MB)
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > 10 * 1024 * 1024) {
      return addCorsHeaders(errorResponse('요청 크기가 10MB를 초과합니다', 413), env, origin);
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
      // 인증이 필요 없는 라우트
      if ((pathname === '/api/auth/login' || pathname === '/api/auth/refresh') && method === 'POST') {
        return addCorsHeaders(await handleAuth(method, pathname, request, context), env, origin);
      }

      // 온보딩 라우트 (공개)
      if (pathname.startsWith('/api/onboard/')) {
        return addCorsHeaders(await handleOnboard(method, pathname, request, context), env, origin);
      }

      // 초대 수락 (공개)
      if (pathname === '/api/invite/accept' && method === 'POST') {
        return addCorsHeaders(await handleAcademy(method, pathname, request, context), env, origin);
      }

      // 학생 앱 (PIN 토큰 인증 — JWT 미들웨어 스킵)
      if (pathname.startsWith('/api/play/')) {
        return addCorsHeaders(await handleGachaPlay(method, pathname, request, context), env, origin);
      }

      // 학부모 리포트 조회 (HMAC 토큰 기반 공개 - GET만)
      if (method === 'GET' && pathname.match(/^\/api\/parent-report\/[^/]+$/)) {
        return addCorsHeaders(await handleParentReport(method, pathname, request, context), env, origin);
      }

      // 인증 체크 (logout, 다른 protected routes)
      // 이미지 조회는 공개 (인증 필요 없음)
      // 선생님 이름 목록은 공개 (로그인 페이지에서 필요) — 이름만 반환
      const isPublicImage = pathname.match(/^\/api\/report\/image\//) || pathname.match(/^\/api\/gacha\/image\//) || pathname.match(/^\/api\/proof\/image\//) || pathname.startsWith('/api/exam-papers/file/') || pathname === '/api/report/list';
      const isPublicTeacherNames = pathname === '/api/teachers/names' && method === 'GET';
      if (!pathname.includes('/auth/login') && !pathname.includes('/auth/refresh') && !isPublicImage && !isPublicTeacherNames) {
        const authResult = await authMiddleware(context);
        if (authResult instanceof Response) {
          return addCorsHeaders(authResult, env, origin);
        }
        Object.assign(context, authResult);

        // 테넌트 미들웨어 — 인증된 요청에 학원 정보 로드 + 활성 상태 확인
        const tenantResult = await tenantMiddleware(context);
        if (tenantResult instanceof Response) {
          return addCorsHeaders(tenantResult, env, origin);
        }
        Object.assign(context, tenantResult);
      }

      // 라우트 핸들러 매칭
      if (pathname.startsWith('/api/auth/')) {
        return addCorsHeaders(await handleAuth(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/academy') || pathname.startsWith('/api/invite/')) {
        return addCorsHeaders(await handleAcademy(method, pathname, request, context), env, origin);
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

      if (pathname.startsWith('/api/report')) {
        // 이미지 관련 라우트는 별도로 처리
        if (pathname === '/api/report/upload-image' || pathname === '/api/report/list' || pathname.match(/^\/api\/report\/image\//)) {
          return addCorsHeaders(await handleReportImage(method, pathname, request, context), env, origin);
        }
        return addCorsHeaders(await handleReport(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/student')) {
        return addCorsHeaders(await handleStudent(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/teachers') || pathname.startsWith('/api/migrate/')) {
        return addCorsHeaders(await handleTeachers(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/settings')) {
        return addCorsHeaders(await handleSettings(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/ai/')) {
        return addCorsHeaders(await handleAI(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/absence') || pathname.startsWith('/api/makeup')) {
        return addCorsHeaders(await handleAbsence(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/board/')) {
        return addCorsHeaders(await handleBoard(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/meeting')) {
        return addCorsHeaders(await handleMeeting(method, pathname, request, context), env, origin);
      }

      if (pathname.startsWith('/api/materials')) {
        return addCorsHeaders(await handleMaterials(method, pathname, request, context), env, origin);
      }

      // 가차 학생/카드 관리 (JWT 인증)
      if (pathname.startsWith('/api/gacha/')) {
        if (pathname.startsWith('/api/gacha/students')) {
          return addCorsHeaders(await handleGachaStudent(method, pathname, request, context), env, origin);
        }
        // 카드 CRUD + 이미지 업로드/서빙
        return addCorsHeaders(await handleGachaCard(method, pathname, request, context), env, origin);
      }

      // 증명 관리 (JWT 인증)
      if (pathname.startsWith('/api/proof')) {
        return addCorsHeaders(await handleProof(method, pathname, request, context), env, origin);
      }

      // 정기고사 관리 (JWT 인증)
      if (pathname.startsWith('/api/exam-mgmt')) {
        return addCorsHeaders(await handleExamMgmt(method, pathname, request, context), env, origin);
      }

      // 시험지 관리 (중간/기말/수행평가 유인물)
      if (pathname.startsWith('/api/exam-papers')) {
        return addCorsHeaders(await handleExamPaper(method, pathname, request, context), env, origin);
      }

      // 학부모 리포트 링크 발급 (교사 JWT)
      if (pathname.startsWith('/api/parent-report/')) {
        return addCorsHeaders(await handleParentReport(method, pathname, request, context), env, origin);
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
