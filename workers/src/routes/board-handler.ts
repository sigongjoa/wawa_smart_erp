/**
 * 학원 공지/액션 보드 라우트 핸들러
 * Issue #28
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';

export async function handleBoard(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // ── 공지사항 ──

    // GET /api/board/notices — 공지 목록 (고정 우선, 최신순)
    if (method === 'GET' && pathname === '/api/board/notices') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const url = new URL(request.url);
      const category = url.searchParams.get('category');

      let query = `
        SELECT n.*,
               u.name as author_name,
               (SELECT COUNT(*) FROM notice_reads nr WHERE nr.notice_id = n.id) as read_count,
               (SELECT COUNT(*) FROM users WHERE academy_id = n.academy_id) as total_users,
               EXISTS(SELECT 1 FROM notice_reads nr WHERE nr.notice_id = n.id AND nr.user_id = ?) as is_read
        FROM notices n
        JOIN users u ON n.author_id = u.id
        WHERE n.academy_id = ?
      `;
      const params: any[] = [context.auth!.userId, context.auth!.academyId];

      if (category) {
        query += ' AND n.category = ?';
        params.push(category);
      }

      query += ' ORDER BY n.is_pinned DESC, n.created_at DESC LIMIT 50';

      const notices = await executeQuery<any>(context.env.DB, query, params);
      return successResponse(notices);
    }

    // POST /api/board/notices — 공지 작성
    if (method === 'POST' && pathname === '/api/board/notices') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const { title, content, category, isPinned, dueDate, actionItems } = await request.json() as any;

      if (!title) return errorResponse('title 필수', 400);

      const noticeId = crypto.randomUUID();
      await executeInsert(
        context.env.DB,
        `INSERT INTO notices (id, academy_id, author_id, title, content, category, is_pinned, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [noticeId, context.auth!.academyId, context.auth!.userId, title, content || '', category || 'general', isPinned ? 1 : 0, dueDate || null]
      );

      // 액션 아이템이 함께 전달되면 생성 (최대 20개)
      if (actionItems && Array.isArray(actionItems) && actionItems.length <= 20) {
        for (const item of actionItems) {
          if (!item.title || !item.assignedTo) continue;
          const actionId = crypto.randomUUID();
          await executeInsert(
            context.env.DB,
            `INSERT INTO action_items (id, academy_id, notice_id, title, description, assigned_to, assigned_by, due_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [actionId, context.auth!.academyId, noticeId, item.title, item.description || '', item.assignedTo, context.auth!.userId, item.dueDate || null]
          );
        }
      }

      return successResponse({ id: noticeId }, 201);
    }

    // PATCH /api/board/notices/:id — 수정/고정/해제
    if (method === 'PATCH' && pathname.match(/^\/api\/board\/notices\/[^/]+$/) && !pathname.includes('/read')) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const id = pathname.split('/').pop() || '';
      if (!id) return errorResponse('유효하지 않은 ID', 400);
      const updates = await request.json() as any;

      const existing = await executeFirst<any>(context.env.DB, 'SELECT * FROM notices WHERE id = ? AND academy_id = ?', [id, context.auth!.academyId]);
      if (!existing) return notFoundResponse();

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
      if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
      if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
      if (updates.isPinned !== undefined) { fields.push('is_pinned = ?'); values.push(updates.isPinned ? 1 : 0); }
      if (updates.dueDate !== undefined) { fields.push('due_date = ?'); values.push(updates.dueDate); }

      if (fields.length === 0) return errorResponse('수정할 필드 없음', 400);

      fields.push("updated_at = datetime('now')");
      values.push(id);

      await executeUpdate(context.env.DB, `UPDATE notices SET ${fields.join(', ')} WHERE id = ?`, values);
      return successResponse({ id });
    }

    // DELETE /api/board/notices/:id
    if (method === 'DELETE' && pathname.match(/^\/api\/board\/notices\/[^/]+$/)) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const id = pathname.split('/').pop() || '';
      if (!id) return errorResponse('유효하지 않은 ID', 400);
      await executeUpdate(context.env.DB, 'DELETE FROM notices WHERE id = ? AND academy_id = ?', [id, context.auth!.academyId]);
      return successResponse({ deleted: true });
    }

    // POST /api/board/notices/:id/read — 읽음 처리
    if (method === 'POST' && pathname.match(/^\/api\/board\/notices\/[^/]+\/read$/)) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const parts = pathname.split('/');
      const noticeId = parts[4];

      const readId = crypto.randomUUID();
      await executeInsert(
        context.env.DB,
        `INSERT INTO notice_reads (id, notice_id, user_id) VALUES (?, ?, ?)
         ON CONFLICT(notice_id, user_id) DO NOTHING`,
        [readId, noticeId, context.auth!.userId]
      );

      return successResponse({ noticeId });
    }

    // ── 액션 아이템 ──

    // GET /api/board/actions — 전체 액션 목록
    if (method === 'GET' && pathname === '/api/board/actions') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const url = new URL(request.url);
      const status = url.searchParams.get('status');

      let query = `
        SELECT ai.*,
               u1.name as assigned_to_name,
               u2.name as assigned_by_name,
               n.title as notice_title
        FROM action_items ai
        JOIN users u1 ON ai.assigned_to = u1.id
        JOIN users u2 ON ai.assigned_by = u2.id
        LEFT JOIN notices n ON ai.notice_id = n.id
        WHERE ai.academy_id = ?
      `;
      const params: any[] = [context.auth!.academyId];

      if (status) {
        query += ' AND ai.status = ?';
        params.push(status);
      }

      query += " ORDER BY CASE ai.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, ai.due_date ASC NULLS LAST, ai.created_at DESC";

      const actions = await executeQuery<any>(context.env.DB, query, params);
      return successResponse(actions);
    }

    // GET /api/board/my-actions — 내 할일만
    if (method === 'GET' && pathname === '/api/board/my-actions') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const actions = await executeQuery<any>(
        context.env.DB,
        `SELECT ai.*,
                u1.name as assigned_to_name,
                u2.name as assigned_by_name,
                n.title as notice_title
         FROM action_items ai
         JOIN users u1 ON ai.assigned_to = u1.id
         JOIN users u2 ON ai.assigned_by = u2.id
         LEFT JOIN notices n ON ai.notice_id = n.id
         WHERE ai.assigned_to = ? AND ai.academy_id = ?
         ORDER BY CASE ai.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, ai.due_date ASC NULLS LAST`,
        [context.auth!.userId, context.auth!.academyId]
      );

      return successResponse(actions);
    }

    // POST /api/board/actions — 액션 생성
    if (method === 'POST' && pathname === '/api/board/actions') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const { title, description, assignedTo, dueDate, noticeId } = await request.json() as any;

      if (!title || !assignedTo) return errorResponse('title, assignedTo 필수', 400);

      const id = crypto.randomUUID();
      await executeInsert(
        context.env.DB,
        `INSERT INTO action_items (id, academy_id, notice_id, title, description, assigned_to, assigned_by, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, context.auth!.academyId, noticeId || null, title, description || '', assignedTo, context.auth!.userId, dueDate || null]
      );

      return successResponse({ id }, 201);
    }

    // PATCH /api/board/actions/:id — 상태 변경/완료
    if (method === 'PATCH' && pathname.match(/^\/api\/board\/actions\/[^/]+$/)) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const id = pathname.split('/').pop() || '';
      if (!id) return errorResponse('유효하지 않은 ID', 400);
      const updates = await request.json() as any;

      const existing = await executeFirst<any>(context.env.DB, 'SELECT * FROM action_items WHERE id = ? AND academy_id = ?', [id, context.auth!.academyId]);
      if (!existing) return notFoundResponse();

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
      if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
      if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
        if (updates.status === 'completed') {
          fields.push("completed_at = datetime('now')");
        }
      }
      if (updates.dueDate !== undefined) { fields.push('due_date = ?'); values.push(updates.dueDate); }

      if (fields.length === 0) return errorResponse('수정할 필드 없음', 400);

      fields.push("updated_at = datetime('now')");
      values.push(id);

      await executeUpdate(context.env.DB, `UPDATE action_items SET ${fields.join(', ')} WHERE id = ?`, values);
      return successResponse({ id });
    }

    // ── 타임라인 ──

    // GET /api/board/timeline — 공지 + 완료 액션 통합 타임라인
    if (method === 'GET' && pathname === '/api/board/timeline') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const notices = await executeQuery<any>(
        context.env.DB,
        `SELECT n.id, 'notice' as type, n.title, n.content, n.category, n.is_pinned, n.due_date,
                n.created_at, u.name as author_name,
                (SELECT COUNT(*) FROM notice_reads nr WHERE nr.notice_id = n.id) as read_count
         FROM notices n
         JOIN users u ON n.author_id = u.id
         WHERE n.academy_id = ?
         ORDER BY n.created_at DESC LIMIT 30`,
        [context.auth!.academyId]
      );

      const completedActions = await executeQuery<any>(
        context.env.DB,
        `SELECT ai.id, 'action_completed' as type, ai.title, ai.description, ai.status,
                ai.completed_at as created_at, u.name as assigned_to_name
         FROM action_items ai
         JOIN users u ON ai.assigned_to = u.id
         WHERE ai.academy_id = ? AND ai.status = 'completed'
         ORDER BY ai.completed_at DESC LIMIT 20`,
        [context.auth!.academyId]
      );

      // 합치고 시간순 정렬
      const timeline = [...notices, ...completedActions]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30);

      return successResponse(timeline);
    }

    // GET /api/board/teachers — 액션 할당용 선생님 목록
    if (method === 'GET' && pathname === '/api/board/teachers') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const teachers = await executeQuery<any>(
        context.env.DB,
        `SELECT id, name, role FROM users WHERE academy_id = ? ORDER BY name`,
        [context.auth!.academyId]
      );

      return successResponse(teachers);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('보드 처리 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('요청 처리 실패', 500);
  }
}
