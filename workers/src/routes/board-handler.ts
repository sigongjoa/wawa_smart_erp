/**
 * 학원 공지/액션 보드 라우트 핸들러
 * Issue #28
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';

// SEC-BOARD-M3: status / category 화이트리스트
const ACTION_STATUS_VALUES = new Set(['pending', 'in_progress', 'completed']);
const NOTICE_CATEGORY_VALUES = new Set(['general', 'urgent', 'event', 'curriculum', 'admin']);

// SEC-BOARD-M4: 텍스트 길이 캡
const MAX_TITLE_LEN = 200;
const MAX_CONTENT_LEN = 10_000;
const MAX_DESCRIPTION_LEN = 2_000;

// 제어문자 제거 + 길이 캡 — utils/sanitize.ts로 통일 (라운드 24)
import { sanitizeText } from '@/utils/sanitize';

/**
 * SEC-BOARD-H1/H2/M2: 주어진 user_ids가 모두 caller academy 소속인지 검증.
 * 한 명이라도 외부면 false. (빈 배열은 true.)
 */
async function allUsersInAcademy(db: any, userIds: string[], academyId: string): Promise<boolean> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return true;
  const ph = ids.map(() => '?').join(',');
  const rows = await executeQuery<{ id: string }>(
    db,
    `SELECT id FROM users WHERE id IN (${ph}) AND academy_id = ?`,
    [...ids, academyId],
  );
  return rows.length === ids.length;
}

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

      // total_users는 단일 쿼리로 계산 후 JS에서 주입 (N+1 방지)
      const totalUsersRow = await executeFirst<{ cnt: number }>(
        context.env.DB,
        `SELECT COUNT(*) as cnt FROM users WHERE academy_id = ?`,
        [context.auth!.academyId]
      );
      const totalUsers = totalUsersRow?.cnt ?? 0;

      let query = `
        SELECT n.*,
               u.name as author_name,
               COUNT(DISTINCT nr.user_id) as read_count,
               MAX(CASE WHEN nr.user_id = ? THEN 1 ELSE 0 END) as is_read
        FROM notices n
        JOIN users u ON n.author_id = u.id
        LEFT JOIN notice_reads nr ON nr.notice_id = n.id
        WHERE n.academy_id = ?
      `;
      const params: any[] = [context.auth!.userId, context.auth!.academyId];

      if (category) {
        query += ' AND n.category = ?';
        params.push(category);
      }

      query += ' GROUP BY n.id, u.name ORDER BY n.is_pinned DESC, n.created_at DESC LIMIT 50';

      const notices = await executeQuery<any>(context.env.DB, query, params);
      const withTotal = notices.map((n) => ({ ...n, total_users: totalUsers }));
      return successResponse(withTotal);
    }

    // POST /api/board/notices — 공지 작성
    if (method === 'POST' && pathname === '/api/board/notices') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const { title, content, category, isPinned, dueDate, actionItems } = await request.json() as any;

      if (!title) return errorResponse('title 필수', 400);

      // SEC-BOARD-M4: 텍스트 위생화 + 길이 캡
      const safeTitle = sanitizeText(title, MAX_TITLE_LEN);
      const safeContent = sanitizeText(content, MAX_CONTENT_LEN);
      if (!safeTitle) return errorResponse('title 필수', 400);

      // SEC-BOARD-M3: category 화이트리스트
      const safeCategory = category && NOTICE_CATEGORY_VALUES.has(category) ? category : 'general';

      // 마감일 과거 검증
      const today = new Date().toISOString().slice(0, 10);
      if (dueDate && dueDate < today) {
        return errorResponse('마감일은 오늘 이후여야 합니다', 400);
      }

      // 핀 고정은 admin만 허용
      const canPin = context.auth!.role === 'admin';
      const pinValue = (isPinned && canPin) ? 1 : 0;

      // SEC-BOARD-H1: actionItems의 assignedTo가 모두 caller 학원 소속인지 사전 검증
      const itemsArray: any[] = Array.isArray(actionItems) ? actionItems.slice(0, 20) : [];
      const candidateAssignees = itemsArray.map((it) => it?.assignedTo).filter(Boolean);
      if (candidateAssignees.length > 0) {
        const ok = await allUsersInAcademy(context.env.DB, candidateAssignees, context.auth!.academyId);
        if (!ok) return errorResponse('할당 대상 중 학원 소속이 아닌 사용자가 있습니다', 403);
      }

      const noticeId = crypto.randomUUID();
      const stmts: any[] = [
        context.env.DB
          .prepare(
            `INSERT INTO notices (id, academy_id, author_id, title, content, category, is_pinned, due_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(noticeId, context.auth!.academyId, context.auth!.userId, safeTitle, safeContent, safeCategory, pinValue, dueDate || null),
      ];

      // 액션 아이템 — 중복 제거 후 batch에 합침
      if (itemsArray.length > 0) {
        const seen = new Set<string>();
        for (const item of itemsArray) {
          if (!item?.title || !item?.assignedTo) continue;
          if (item.dueDate && item.dueDate < today) continue;
          // SEC-BOARD-L2: JSON.stringify로 안전한 dedup 키
          const dedupKey = JSON.stringify([item.title, item.assignedTo, item.dueDate || '']);
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);
          const actionId = crypto.randomUUID();
          stmts.push(
            context.env.DB
              .prepare(
                `INSERT INTO action_items (id, academy_id, notice_id, title, description, assigned_to, assigned_by, due_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                actionId,
                context.auth!.academyId,
                noticeId,
                sanitizeText(item.title, MAX_TITLE_LEN),
                sanitizeText(item.description, MAX_DESCRIPTION_LEN),
                item.assignedTo,
                context.auth!.userId,
                item.dueDate || null,
              ),
          );
        }
      }

      // 공지 + 액션 아이템을 D1 batch로 원자 실행
      await context.env.DB.batch(stmts);

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

      // 권한: 본인 작성 또는 admin
      const isAuthor = existing.author_id === context.auth!.userId;
      const isAdmin = context.auth!.role === 'admin';
      if (!isAuthor && !isAdmin) return errorResponse('공지 수정 권한 없음', 403);

      // 핀 고정 변경은 admin 전용
      if (updates.isPinned !== undefined && !isAdmin) {
        return errorResponse('공지 고정/해제는 관리자만 가능합니다', 403);
      }

      // 마감일 과거 검증
      const today = new Date().toISOString().slice(0, 10);
      if (updates.dueDate && updates.dueDate < today) {
        return errorResponse('마감일은 오늘 이후여야 합니다', 400);
      }

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.title !== undefined) {
        const safe = sanitizeText(updates.title, MAX_TITLE_LEN);
        if (!safe) return errorResponse('title 비어 있음', 400);
        fields.push('title = ?'); values.push(safe);
      }
      if (updates.content !== undefined) {
        fields.push('content = ?'); values.push(sanitizeText(updates.content, MAX_CONTENT_LEN));
      }
      if (updates.category !== undefined) {
        if (!NOTICE_CATEGORY_VALUES.has(updates.category)) {
          return errorResponse('유효하지 않은 카테고리입니다', 400);
        }
        fields.push('category = ?'); values.push(updates.category);
      }
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

      const existing = await executeFirst<any>(context.env.DB, 'SELECT author_id FROM notices WHERE id = ? AND academy_id = ?', [id, context.auth!.academyId]);
      if (!existing) return notFoundResponse();

      const isAuthor = existing.author_id === context.auth!.userId;
      const isAdmin = context.auth!.role === 'admin';
      if (!isAuthor && !isAdmin) return errorResponse('공지 삭제 권한 없음', 403);

      await executeUpdate(context.env.DB, 'DELETE FROM notices WHERE id = ? AND academy_id = ?', [id, context.auth!.academyId]);
      return successResponse({ deleted: true });
    }

    // POST /api/board/notices/:id/read — 읽음 처리
    if (method === 'POST' && pathname.match(/^\/api\/board\/notices\/[^/]+\/read$/)) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const parts = pathname.split('/');
      const noticeId = parts[4];

      // SEC-BOARD-M1: noticeId가 caller 학원 소속인지 검증
      const owned = await executeFirst<{ id: string }>(
        context.env.DB,
        'SELECT id FROM notices WHERE id = ? AND academy_id = ?',
        [noticeId, context.auth!.academyId]
      );
      if (!owned) return notFoundResponse();

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

      // SEC-BOARD-M4: 위생화 + 길이 캡
      const safeTitle = sanitizeText(title, MAX_TITLE_LEN);
      const safeDescription = sanitizeText(description, MAX_DESCRIPTION_LEN);
      if (!safeTitle) return errorResponse('title 비어 있음', 400);

      const today = new Date().toISOString().slice(0, 10);
      if (dueDate && dueDate < today) {
        return errorResponse('마감일은 오늘 이후여야 합니다', 400);
      }

      // SEC-BOARD-H2: assignedTo academy 격리 검증
      const ok = await allUsersInAcademy(context.env.DB, [assignedTo], context.auth!.academyId);
      if (!ok) return errorResponse('할당 대상이 학원 소속이 아닙니다', 403);

      // noticeId가 있으면 해당 공지도 같은 학원인지 검증
      if (noticeId) {
        const n = await executeFirst<{ id: string }>(
          context.env.DB,
          'SELECT id FROM notices WHERE id = ? AND academy_id = ?',
          [noticeId, context.auth!.academyId]
        );
        if (!n) return errorResponse('연관 공지가 학원 소속이 아닙니다', 403);
      }

      const id = crypto.randomUUID();
      await executeInsert(
        context.env.DB,
        `INSERT INTO action_items (id, academy_id, notice_id, title, description, assigned_to, assigned_by, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, context.auth!.academyId, noticeId || null, safeTitle, safeDescription, assignedTo, context.auth!.userId, dueDate || null]
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

      // 권한: 본인 할당/생성자/admin
      const isOwner = existing.assigned_to === context.auth!.userId || existing.assigned_by === context.auth!.userId;
      const isAdmin = context.auth!.role === 'admin';
      if (!isOwner && !isAdmin) return errorResponse('할일 수정 권한 없음', 403);

      // 마감일 과거 검증
      const today = new Date().toISOString().slice(0, 10);
      if (updates.dueDate && updates.dueDate < today) {
        return errorResponse('마감일은 오늘 이후여야 합니다', 400);
      }

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.title !== undefined) {
        const safe = sanitizeText(updates.title, MAX_TITLE_LEN);
        if (!safe) return errorResponse('title 비어 있음', 400);
        fields.push('title = ?'); values.push(safe);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?'); values.push(sanitizeText(updates.description, MAX_DESCRIPTION_LEN));
      }
      if (updates.assignedTo !== undefined) {
        // SEC-BOARD-M2: 새 assignedTo가 caller 학원 소속인지 검증
        const ok = await allUsersInAcademy(context.env.DB, [updates.assignedTo], context.auth!.academyId);
        if (!ok) return errorResponse('할당 대상이 학원 소속이 아닙니다', 403);
        fields.push('assigned_to = ?'); values.push(updates.assignedTo);
      }
      if (updates.status !== undefined) {
        // SEC-BOARD-M3: status 화이트리스트
        if (!ACTION_STATUS_VALUES.has(updates.status)) {
          return errorResponse('유효하지 않은 상태입니다', 400);
        }
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

    // DELETE /api/board/actions/:id
    if (method === 'DELETE' && pathname.match(/^\/api\/board\/actions\/[^/]+$/)) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const id = pathname.split('/').pop() || '';
      if (!id) return errorResponse('유효하지 않은 ID', 400);

      const existing = await executeFirst<any>(context.env.DB, 'SELECT assigned_to, assigned_by FROM action_items WHERE id = ? AND academy_id = ?', [id, context.auth!.academyId]);
      if (!existing) return notFoundResponse();

      // SEC-BOARD-L1: 삭제는 작성자(assigned_by) 또는 admin만 가능 —
      // 할당받은 사람(assigned_to)은 작업 회피 채널이 되므로 제외 (status 변경으로 종료)
      const isCreator = existing.assigned_by === context.auth!.userId;
      const isAdmin = context.auth!.role === 'admin';
      if (!isCreator && !isAdmin) return errorResponse('할일 삭제는 작성자 또는 관리자만 가능합니다', 403);

      await executeUpdate(context.env.DB, 'DELETE FROM action_items WHERE id = ? AND academy_id = ?', [id, context.auth!.academyId]);
      return successResponse({ deleted: true });
    }

    // ── 타임라인 ──

    // GET /api/board/timeline — 공지 + 완료 액션 통합 타임라인
    if (method === 'GET' && pathname === '/api/board/timeline') {
      if (!requireAuth(context)) return unauthorizedResponse();

      // PERF-BOARD-M2: notices + completed actions를 병렬 실행
      const [notices, completedActions] = await Promise.all([
        executeQuery<any>(
          context.env.DB,
          `SELECT n.id, 'notice' as type, n.title, n.content, n.category, n.is_pinned, n.due_date,
                  n.created_at, u.name as author_name,
                  (SELECT COUNT(*) FROM notice_reads nr WHERE nr.notice_id = n.id) as read_count
           FROM notices n
           JOIN users u ON n.author_id = u.id
           WHERE n.academy_id = ?
           ORDER BY n.created_at DESC LIMIT 30`,
          [context.auth!.academyId]
        ),
        executeQuery<any>(
          context.env.DB,
          `SELECT ai.id, 'action_completed' as type, ai.title, ai.description, ai.status,
                  ai.completed_at as created_at, u.name as assigned_to_name
           FROM action_items ai
           JOIN users u ON ai.assigned_to = u.id
           WHERE ai.academy_id = ? AND ai.status = 'completed'
           ORDER BY ai.completed_at DESC LIMIT 20`,
          [context.auth!.academyId]
        ),
      ]);

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
