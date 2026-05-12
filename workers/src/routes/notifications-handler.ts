/**
 * 알림 라우트 — 교사용 MVP.
 *  - GET  /api/notifications              목록 (academy 격리, 본인+broadcast 통합)
 *  - GET  /api/notifications/unread-count 헤더 배지용 (KV 60s 캐시)
 *  - POST /api/notifications/:id/read     단건 읽음
 *  - POST /api/notifications/read-all     전체 읽음
 *
 * 다형 type/payload 구조. 자세한 설계: docs/NOTIFICATION_SYSTEM_DESIGN.md
 */
import { RequestContext } from '@/types';
import { executeQuery, executeFirst } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { isValidId } from '@/utils/sanitize';
import { logger } from '@/utils/logger';

interface NotificationRow {
  id: string;
  academy_id: string;
  recipient_user_id: string | null;
  recipient_role: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  payload: string | null;
  is_read: number;
  read_at: string | null;
  created_at: string;
}

interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

function rowToDto(r: NotificationRow): NotificationDto {
  let payload: Record<string, unknown> | null = null;
  if (r.payload) {
    try { payload = JSON.parse(r.payload); } catch { payload = null; }
  }
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link,
    payload,
    is_read: r.is_read === 1,
    read_at: r.read_at,
    created_at: r.created_at,
  };
}

function unreadCountCacheKey(academyId: string): string {
  return `notif:unread:${academyId}`;
}

export async function handleNotifications(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext,
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  const role = context.auth!.role; // 'admin' | 'instructor'

  try {
    // GET /api/notifications/unread-count
    if (method === 'GET' && pathname === '/api/notifications/unread-count') {
      // academy 단위 캐시 — broadcast 알림이 대부분이라 학원 단위 unread 수가 거의 사용자별과 동일.
      // 사용자별 정확도가 필요하면 캐시 키에 userId 추가.
      const cacheKey = unreadCountCacheKey(academyId);
      const cached = await context.env.KV.get(cacheKey);
      if (cached !== null) {
        const n = parseInt(cached, 10);
        if (Number.isFinite(n)) return successResponse({ count: n });
      }

      const row = await executeFirst<{ cnt: number }>(
        context.env.DB,
        `SELECT COUNT(*) AS cnt FROM notifications
         WHERE academy_id = ? AND is_read = 0
           AND (
             recipient_user_id = ?
             OR (recipient_user_id IS NULL AND recipient_role IN ('all_teachers', ?))
           )`,
        [academyId, userId, role],
      );
      const count = row?.cnt ?? 0;
      try { await context.env.KV.put(cacheKey, String(count), { expirationTtl: 60 }); } catch { /* ignore */ }
      return successResponse({ count });
    }

    // GET /api/notifications
    if (method === 'GET' && pathname === '/api/notifications') {
      const url = new URL(request.url);
      const status = url.searchParams.get('status') ?? 'unread';
      const limitParam = Number(url.searchParams.get('limit') ?? '20');
      const limit = Math.min(Math.max(limitParam || 20, 1), 50);
      const cursor = url.searchParams.get('cursor'); // ISO timestamp

      if (!['unread', 'read', 'all'].includes(status)) {
        return errorResponse('status 는 unread | read | all', 400);
      }

      const params: (string | number)[] = [academyId, userId, role];
      let sql = `SELECT id, academy_id, recipient_user_id, recipient_role, type, title, body, link,
                        payload, is_read, read_at, created_at
                 FROM notifications
                 WHERE academy_id = ?
                   AND (
                     recipient_user_id = ?
                     OR (recipient_user_id IS NULL AND recipient_role IN ('all_teachers', ?))
                   )`;
      if (status === 'unread') sql += ' AND is_read = 0';
      else if (status === 'read') sql += ' AND is_read = 1';
      if (cursor) {
        sql += ' AND created_at < ?';
        params.push(cursor);
      }
      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const rows = await executeQuery<NotificationRow>(context.env.DB, sql, params);
      const items = rows.map(rowToDto);
      const next_cursor = items.length === limit ? items[items.length - 1].created_at : null;
      return successResponse({ items, next_cursor });
    }

    // POST /api/notifications/:id/read
    const readMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (method === 'POST' && readMatch) {
      const id = readMatch[1];
      if (!isValidId(id, 64)) return errorResponse('잘못된 알림 id', 400);

      // 멱등 가드 + academy 격리 + 본인 수신 가능 여부 검증
      const result = await context.env.DB
        .prepare(
          `UPDATE notifications
           SET is_read = 1, read_at = datetime('now')
           WHERE id = ? AND academy_id = ? AND is_read = 0
             AND (
               recipient_user_id = ?
               OR (recipient_user_id IS NULL AND recipient_role IN ('all_teachers', ?))
             )`,
        )
        .bind(id, academyId, userId, role)
        .run();

      const changed = result.meta.changes ?? 0;
      if (changed === 0) {
        // 이미 read 거나 권한 없음 — 양쪽 모두 멱등하게 OK 처리
        return successResponse({ id, is_read: true, changed: 0 });
      }
      try { await context.env.KV.delete(unreadCountCacheKey(academyId)); } catch { /* ignore */ }
      return successResponse({ id, is_read: true, changed });
    }

    // POST /api/notifications/read-all
    if (method === 'POST' && pathname === '/api/notifications/read-all') {
      const result = await context.env.DB
        .prepare(
          `UPDATE notifications
           SET is_read = 1, read_at = datetime('now')
           WHERE academy_id = ? AND is_read = 0
             AND (
               recipient_user_id = ?
               OR (recipient_user_id IS NULL AND recipient_role IN ('all_teachers', ?))
             )`,
        )
        .bind(academyId, userId, role)
        .run();
      const marked = result.meta.changes ?? 0;
      try { await context.env.KV.delete(unreadCountCacheKey(academyId)); } catch { /* ignore */ }
      return successResponse({ marked });
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('알림 처리 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('요청 처리 실패', 500);
  }
}
