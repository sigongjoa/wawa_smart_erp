/**
 * 보고서 라우트 핸들러
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// ==================== 스키마 ====================
const SendConfigSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '시작일은 YYYY-MM-DD 형식이어야 합니다'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '종료일은 YYYY-MM-DD 형식이어야 합니다'),
});

type SendConfigInput = z.infer<typeof SendConfigSchema>;

// ==================== 헬퍼 함수 ====================

function generateId(prefix: string): string {
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid.split('-')[0]}`;
}

async function parseSendConfigInput(request: Request): Promise<SendConfigInput> {
  try {
    const body = await request.json() as any;
    return SendConfigSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      throw new Error(`입력 검증 오류: ${message}`);
    }
    throw new Error('요청 처리 오류: 유효한 JSON이 필요합니다');
  }
}

// ==================== ReportConfig 핸들러 ====================

/**
 * POST /api/report/send-config - 전송주간 설정 저장
 */
async function handleSetSendConfig(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // 관리자 권한 확인
    if (!requireAuth(context) || !requireRole(context, 'admin')) {
      return unauthorizedResponse();
    }

    const input = await parseSendConfigInput(request);

    logger.logRequest('POST', '/api/report/send-config', undefined, ipAddress);

    // 기존 설정 확인
    const existing = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM report_send_configs WHERE academy_id = ?',
      [context.auth?.academyId || 'acad-1']
    );

    const now = new Date().toISOString();

    if (existing) {
      // 기존 설정 업데이트
      const result = await executeUpdate(
        context.env.DB,
        `UPDATE report_send_configs
         SET start_date = ?, end_date = ?, updated_at = ?
         WHERE id = ?`,
        [input.start_date, input.end_date, now, existing.id]
      );

      if (!result) {
        throw new Error('설정 업데이트 실패');
      }

      return successResponse({
        id: existing.id,
        start_date: input.start_date,
        end_date: input.end_date,
        updated_at: now,
      });
    } else {
      // 신규 설정 생성
      const configId = generateId('config');

      const result = await executeInsert(
        context.env.DB,
        `INSERT INTO report_send_configs (id, academy_id, start_date, end_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          configId,
          context.auth?.academyId || 'acad-1',
          input.start_date,
          input.end_date,
          now,
          now,
        ]
      );

      if (!result.success) {
        throw new Error('데이터베이스 삽입 실패');
      }

      return successResponse(
        {
          id: configId,
          start_date: input.start_date,
          end_date: input.end_date,
        },
        201
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증')) {
      logger.warn('전송주간 설정 검증 오류', { error: errorMessage, ipAddress });
      return errorResponse(errorMessage, 400);
    }

    logger.error('전송주간 설정 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('전송주간 설정에 실패했습니다', 500);
  }
}

/**
 * GET /api/report/send-config - 전송주간 설정 조회
 */
async function handleGetSendConfig(context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const config = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM report_send_configs WHERE academy_id = ?',
      [context.auth?.academyId || 'acad-1']
    );

    if (!config) {
      return errorResponse('설정된 전송주간이 없습니다', 404);
    }

    return successResponse(config);
  } catch (error) {
    logger.error('전송주간 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('전송주간 조회에 실패했습니다', 500);
  }
}

// ==================== 메인 핸들러 ====================

export async function handleReport(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/report/send-config
    if (pathname === '/api/report/send-config') {
      if (method === 'POST') return await handleSetSendConfig(request, context);
      if (method === 'GET') return await handleGetSendConfig(context);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Report handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('Internal server error', 500);
  }
}
