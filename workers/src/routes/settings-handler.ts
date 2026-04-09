/**
 * 설정 라우트 핸들러
 * 시험 월 설정 등 학원 전체 설정 관리
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// ==================== 스키마 ====================
const SetActiveExamMonthSchema = z.object({
  activeExamMonth: z.string().regex(/^\d{4}-\d{2}$/, '시험 월은 YYYY-MM 형식이어야 합니다'),
});

type SetActiveExamMonthInput = z.infer<typeof SetActiveExamMonthSchema>;

// ==================== 헬퍼 함수 ====================

function generateId(prefix: string): string {
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid.split('-')[0]}`;
}

async function parseSetActiveExamMonthInput(request: Request): Promise<SetActiveExamMonthInput> {
  try {
    const body = await request.json() as any;
    return SetActiveExamMonthSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      throw new Error(`입력 검증 오류: ${message}`);
    }
    throw new Error('요청 처리 오류: 유효한 JSON이 필요합니다');
  }
}

// ==================== Exam Settings 핸들러 ====================

/**
 * GET /api/settings/active-exam-month - 활성 시험 월 조회
 */
async function handleGetActiveExamMonth(context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const setting = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM exam_settings WHERE academy_id = ?',
      [context.auth?.academyId || 'acad-1']
    );

    if (!setting) {
      return errorResponse('아직 시험 월이 설정되지 않았습니다', 404);
    }

    return successResponse({
      academyId: setting.academy_id,
      activeExamMonth: setting.active_exam_month,
      updatedBy: setting.updated_by,
      updatedAt: setting.updated_at,
    });
  } catch (error) {
    logger.error('시험 월 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('시험 월 조회에 실패했습니다', 500);
  }
}

/**
 * POST /api/settings/active-exam-month - 활성 시험 월 설정
 */
async function handleSetActiveExamMonth(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // 관리자 권한 확인
    if (!requireAuth(context) || !requireRole(context, 'admin')) {
      return unauthorizedResponse();
    }

    const input = await parseSetActiveExamMonthInput(request);

    logger.logRequest('POST', '/api/settings/active-exam-month', undefined, ipAddress);

    const now = new Date().toISOString();
    const academyId = context.auth?.academyId || 'acad-1';

    // 기존 설정 확인
    const existing = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM exam_settings WHERE academy_id = ?',
      [academyId]
    );

    if (existing) {
      // 기존 설정 업데이트
      const result = await executeUpdate(
        context.env.DB,
        `UPDATE exam_settings
         SET active_exam_month = ?, updated_by = ?, updated_at = ?
         WHERE academy_id = ?`,
        [
          input.activeExamMonth,
          context.auth?.userId || 'unknown',
          now,
          academyId,
        ]
      );

      if (!result) {
        throw new Error('시험 월 업데이트 실패');
      }

      return successResponse(
        {
          academyId,
          activeExamMonth: input.activeExamMonth,
          updatedBy: context.auth?.userId || 'unknown',
          updatedAt: now,
        },
        200
      );
    } else {
      // 신규 설정 생성
      const settingId = generateId('setting');

      const result = await executeInsert(
        context.env.DB,
        `INSERT INTO exam_settings (id, academy_id, active_exam_month, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          settingId,
          academyId,
          input.activeExamMonth,
          context.auth?.userId || 'unknown',
          now,
          now,
        ]
      );

      if (!result.success) {
        throw new Error('시험 월 저장 실패');
      }

      return successResponse(
        {
          academyId,
          activeExamMonth: input.activeExamMonth,
          updatedBy: context.auth?.userId || 'unknown',
          updatedAt: now,
        },
        201
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증') || errorMessage.includes('요청 처리')) {
      logger.warn('시험 월 설정 검증 오류', { error: errorMessage, ipAddress });
      return errorResponse(errorMessage, 400);
    }

    logger.error('시험 월 설정 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('시험 월 설정에 실패했습니다', 500);
  }
}

// ==================== 메인 핸들러 ====================

export async function handleSettings(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/settings/active-exam-month
    if (pathname === '/api/settings/active-exam-month') {
      if (method === 'GET') return await handleGetActiveExamMonth(context);
      if (method === 'POST') return await handleSetActiveExamMonth(request, context);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Settings handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('Internal server error', 500);
  }
}
