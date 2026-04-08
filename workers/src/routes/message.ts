import { Router } from 'itty-router';
import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { SendMessageSchema, parseAndValidate } from '@/schemas/validation';
import { logger } from '@/utils/logger';

export const messageRouter = Router<any>();

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

// 메시지 전송
messageRouter.post('/', async (request: Request, env: any) => { const context = env as RequestContext;
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    // 입력 검증
    const { recipientId, content } = await parseAndValidate(
      context.request,
      SendMessageSchema
    );

    const userId = context.auth!.userId;
    const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

    // 수신자 존재 여부 확인
    const recipient = await executeFirst(
      context.env.DB,
      'SELECT id FROM users WHERE id = ?',
      [recipientId]
    );

    if (!recipient) return notFoundResponse();

    // 자신에게 메시지를 보낼 수 없음
    if (userId === recipientId) {
      return errorResponse('자신에게 메시지를 보낼 수 없습니다', 400);
    }

    const id = crypto.randomUUID();
    const result = await executeInsert(
      context.env.DB,
      `INSERT INTO messages (id, sender_id, recipient_id, content, is_read, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, userId, recipientId, content, false]
    );

    if (!result.success) {
      return errorResponse('메시지 전송 실패', 500);
    }

    logger.logAudit('MESSAGE_SEND', 'Message', id, userId, { recipientId }, ipAddress);

    const message = await executeFirst<Message>(
      context.env.DB,
      'SELECT * FROM messages WHERE id = ?',
      [id]
    );

    return successResponse(message, 201);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // 검증 오류인 경우 400 반환
    if (errorMessage.includes('입력 검증') || errorMessage.includes('요청 처리')) {
      logger.warn('메시지 전송 검증 오류', { error: errorMessage });
      return errorResponse(errorMessage, 400);
    }

    logger.error('메시지 전송 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('메시지 전송 중 오류가 발생했습니다', 500);
  }
});

// 받은 메시지 조회
messageRouter.get('/inbox', async (request: Request, env: any) => { const context = env as RequestContext;
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const userId = context.auth!.userId;

    const messages = await executeQuery<Message>(
      context.env.DB,
      `SELECT * FROM messages
       WHERE recipient_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    return successResponse(messages);
  } catch (error) {
    logger.error('메시지 조회 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('메시지 조회 실패', 500);
  }
});

// 보낸 메시지 조회
messageRouter.get('/sent', async (request: Request, env: any) => { const context = env as RequestContext;
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const userId = context.auth!.userId;

    const messages = await executeQuery<Message>(
      context.env.DB,
      `SELECT * FROM messages
       WHERE sender_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    return successResponse(messages);
  } catch (error) {
    logger.error('메시지 조회 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('메시지 조회 실패', 500);
  }
});

// 대화 조회 (특정 사용자와의 양방향 메시지)
messageRouter.get('/conversation/:userId', async (request: Request, env: any) => { const context = env as RequestContext;
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const currentUserId = context.auth!.userId;
    const { userId } = context.params as any;

    const messages = await executeQuery<Message>(
      context.env.DB,
      `SELECT * FROM messages
       WHERE (sender_id = ? AND recipient_id = ?)
          OR (sender_id = ? AND recipient_id = ?)
       ORDER BY created_at ASC
       LIMIT 200`,
      [currentUserId, userId, userId, currentUserId]
    );

    return successResponse(messages);
  } catch (error) {
    logger.error('대화 조회 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('대화 조회 실패', 500);
  }
});

// 메시지 읽음 표시
messageRouter.patch('/:id/read', async (request: Request, env: any) => { const context = env as RequestContext;
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const { id } = context.params as any;
    const userId = context.auth!.userId;

    // 수신자 확인
    const message = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM messages WHERE id = ?',
      [id]
    );

    if (!message) return notFoundResponse();
    if (message.recipient_id !== userId) {
      return errorResponse('권한이 없습니다', 403);
    }

    const result = await executeUpdate(
      context.env.DB,
      'UPDATE messages SET is_read = TRUE, updated_at = datetime("now") WHERE id = ?',
      [id]
    );

    if (!result) {
      return errorResponse('메시지 업데이트 실패', 500);
    }

    const updated = await executeFirst<Message>(
      context.env.DB,
      'SELECT * FROM messages WHERE id = ?',
      [id]
    );

    return successResponse(updated);
  } catch (error) {
    logger.error('메시지 읽음 표시 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('메시지 업데이트 실패', 500);
  }
});

// 메시지 삭제
messageRouter.delete('/:id', async (request: Request, env: any) => { const context = env as RequestContext;
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const { id } = context.params as any;
    const userId = context.auth!.userId;

    // 발신자 확인
    const message = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM messages WHERE id = ?',
      [id]
    );

    if (!message) return notFoundResponse();
    if (message.sender_id !== userId) {
      return errorResponse('권한이 없습니다', 403);
    }

    const result = await executeUpdate(
      context.env.DB,
      'DELETE FROM messages WHERE id = ?',
      [id]
    );

    if (!result) {
      return errorResponse('메시지 삭제 실패', 500);
    }

    logger.logAudit('MESSAGE_DELETE', 'Message', id, userId);

    return successResponse({ message: '메시지가 삭제되었습니다' });
  } catch (error) {
    logger.error('메시지 삭제 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('메시지 삭제 실패', 500);
  }
});
