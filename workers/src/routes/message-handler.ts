/**
 * 메시지 라우트 핸들러
 * 직접 라우팅용으로 단일 핸들러 함수
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { SendMessageSchema, parseAndValidate } from '@/schemas/validation';
import { logger } from '@/utils/logger';
import { parsePagination } from '@/utils/pagination';
import { paginatedList } from '@/utils/paginatedList';

// SEC-MSG-M1: 텍스트 위생화 — C0/C1 제거 + trim + 길이 캡
const MAX_CONTENT_LEN = 5000;
function sanitizeContent(v: any): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, MAX_CONTENT_LEN);
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export async function handleMessage(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // POST /api/message/
    if (method === 'POST' && pathname === '/api/message/') {
      const { recipientId, content } = await parseAndValidate(request, SendMessageSchema);

      if (!requireAuth(context)) return unauthorizedResponse();

      const userId = context.auth!.userId;
      const ipAddress = request.headers.get('CF-Connecting-IP') || 'unknown';

      // 같은 학원 소속인지 확인 (다른 학원에 메시지 보내기 방지)
      const recipient = await executeFirst(
        context.env.DB,
        'SELECT id FROM users WHERE id = ? AND academy_id = ?',
        [recipientId, context.auth!.academyId]
      );

      if (!recipient) return notFoundResponse();

      if (userId === recipientId) {
        return errorResponse('자신에게 메시지를 보낼 수 없습니다', 400);
      }

      // SEC-MSG-M1: content 위생화 + 길이 캡
      const cleanContent = sanitizeContent(content);
      if (!cleanContent) return errorResponse('content는 비울 수 없습니다', 400);

      const id = crypto.randomUUID();
      const result = await executeInsert(
        context.env.DB,
        `INSERT INTO messages (id, sender_id, recipient_id, content, is_read, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [id, userId, recipientId, cleanContent, false]
      );

      if (!result.success) {
        return errorResponse('메시지 전송 실패', 500);
      }

      logger.logAudit('MESSAGE_SEND', 'Message', id, userId, { recipientId }, ipAddress);

      const message = await executeFirst<Message>(context.env.DB, 'SELECT * FROM messages WHERE id = ?', [id]);

      return successResponse(message, 201);
    }

    // GET /api/message/inbox
    if (method === 'GET' && pathname === '/api/message/inbox') {
      if (!requireAuth(context)) return unauthorizedResponse();
      const pg = parsePagination(new URL(request.url), { defaultLimit: 50, maxLimit: 200 });
      const result = await paginatedList<Message>({
        db: context.env.DB,
        table: 'messages',
        baseFilters: [{ sql: 'recipient_id = ?', param: context.auth!.userId }],
        countsBy: { column: 'is_read', values: ['0', '1'] },
        orderBy: 'created_at DESC',
        pagination: pg,
      });
      return successResponse(result);
    }

    // GET /api/message/sent
    if (method === 'GET' && pathname === '/api/message/sent') {
      if (!requireAuth(context)) return unauthorizedResponse();
      const pg = parsePagination(new URL(request.url), { defaultLimit: 50, maxLimit: 200 });
      const result = await paginatedList<Message>({
        db: context.env.DB,
        table: 'messages',
        baseFilters: [{ sql: 'sender_id = ?', param: context.auth!.userId }],
        orderBy: 'created_at DESC',
        pagination: pg,
      });
      return successResponse(result);
    }

    // GET /api/message/conversation/:userId
    if (method === 'GET' && pathname.startsWith('/api/message/conversation/')) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const conversationUserId = pathname.split('/')[4];
      const currentUserId = context.auth!.userId;
      const pg = parsePagination(new URL(request.url), { defaultLimit: 100, maxLimit: 500 });

      // SEC-MSG-H1: 상대방이 같은 학원 소속인지 사전 검증 (cross-tenant 대화 차단)
      const peer = await executeFirst<{ id: string }>(
        context.env.DB,
        'SELECT id FROM users WHERE id = ? AND academy_id = ?',
        [conversationUserId, context.auth!.academyId]
      );
      if (!peer) return notFoundResponse();

      // PERF-MSG-M1: COUNT + 조회를 병렬로
      const [totalRow, items] = await Promise.all([
        executeFirst<{ n: number }>(
          context.env.DB,
          `SELECT COUNT(*) AS n FROM messages
           WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)`,
          [currentUserId, conversationUserId, conversationUserId, currentUserId]
        ),
        executeQuery<Message>(
          context.env.DB,
          `SELECT * FROM messages
           WHERE (sender_id = ? AND recipient_id = ?)
              OR (sender_id = ? AND recipient_id = ?)
           ORDER BY created_at ASC
           LIMIT ? OFFSET ?`,
          [currentUserId, conversationUserId, conversationUserId, currentUserId, pg.limit, pg.offset]
        ),
      ]);
      return successResponse({
        items,
        pagination: { total: Number(totalRow?.n ?? 0), limit: pg.limit, offset: pg.offset,
                      nextOffset: items.length < pg.limit ? null : pg.offset + pg.limit },
      });
    }

    // PATCH /api/message/:id/read
    if (method === 'PATCH' && pathname.includes('/read')) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const id = pathname.split('/')[4];
      const userId = context.auth!.userId;

      const message = await executeFirst<any>(context.env.DB, 'SELECT * FROM messages WHERE id = ?', [id]);

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

      const updated = await executeFirst<Message>(context.env.DB, 'SELECT * FROM messages WHERE id = ?', [id]);

      return successResponse(updated);
    }

    // DELETE /api/message/:id
    if (method === 'DELETE' && pathname.startsWith('/api/message/') && !pathname.includes('/read')) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const id = pathname.split('/')[4];
      const userId = context.auth!.userId;

      const message = await executeFirst<any>(context.env.DB, 'SELECT * FROM messages WHERE id = ?', [id]);

      if (!message) return notFoundResponse();
      if (message.sender_id !== userId) {
        return errorResponse('권한이 없습니다', 403);
      }

      const result = await executeUpdate(context.env.DB, 'DELETE FROM messages WHERE id = ?', [id]);

      if (!result) {
        return errorResponse('메시지 삭제 실패', 500);
      }

      logger.logAudit('MESSAGE_DELETE', 'Message', id, userId);

      return successResponse({ message: '메시지가 삭제되었습니다' });
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증') || errorMessage.includes('요청 처리')) {
      logger.warn('메시지 검증 오류', { error: errorMessage });
      return errorResponse(errorMessage, 400);
    }

    logger.error('메시지 처리 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('메시지 처리 실패', 500);
  }
}
