/**
 * 교재/프린트물 관리 핸들러
 * CRUD: GET /api/materials, POST, PATCH /:id, DELETE /:id
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';

interface MaterialRow {
  id: string;
  student_id: string;
  student_name: string;
  title: string;
  memo: string;
  status: string;
  file_url: string;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

function generateId(): string {
  return 'mat-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function handleMaterials(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const db = context.env.DB;
  const userId = context.auth!.userId;

  // GET /api/materials?status=todo&studentId=xxx
  if (method === 'GET' && pathname === '/api/materials') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const studentId = url.searchParams.get('studentId');

    let sql = `
      SELECT m.*, s.name as student_name
      FROM print_materials m
      JOIN students s ON s.id = m.student_id
      WHERE m.created_by = ?
    `;
    const params: any[] = [userId];

    if (status) {
      sql += ' AND m.status = ?';
      params.push(status);
    }
    if (studentId) {
      sql += ' AND m.student_id = ?';
      params.push(studentId);
    }

    sql += ' ORDER BY CASE m.status WHEN \'todo\' THEN 0 ELSE 1 END, m.created_at DESC';

    const rows = await executeQuery<MaterialRow>(db, sql, params);
    return successResponse(rows);
  }

  // POST /api/materials — 새 교재 등록
  if (method === 'POST' && pathname === '/api/materials') {
    const body = await request.json() as any;
    const { studentId, title, memo } = body;

    if (!studentId || !title?.trim()) {
      return errorResponse('studentId와 title은 필수입니다', 400);
    }

    const id = generateId();
    await executeInsert(db,
      `INSERT INTO print_materials (id, student_id, title, memo, status, created_by)
       VALUES (?, ?, ?, ?, 'todo', ?)`,
      [id, studentId, title.trim(), memo?.trim() || '', userId]
    );

    return successResponse({ id, status: 'todo' }, 201);
  }

  // PATCH /api/materials/:id — 상태/파일URL/메모 업데이트
  const patchMatch = pathname.match(/^\/api\/materials\/([^/]+)$/);
  if (method === 'PATCH' && patchMatch) {
    const id = patchMatch[1];
    const body = await request.json() as any;

    const existing = await executeFirst<{ id: string; created_by: string }>(
      db, 'SELECT id, created_by FROM print_materials WHERE id = ?', [id]
    );
    if (!existing) return errorResponse('교재를 찾을 수 없습니다', 404);
    if (existing.created_by !== userId) return unauthorizedResponse();

    const updates: string[] = [];
    const params: any[] = [];

    if (body.status !== undefined) {
      updates.push('status = ?');
      params.push(body.status);
      if (body.status === 'done') {
        updates.push('completed_at = datetime(\'now\')');
      } else {
        updates.push('completed_at = NULL');
      }
    }
    if (body.fileUrl !== undefined) {
      updates.push('file_url = ?');
      params.push(body.fileUrl);
    }
    if (body.title !== undefined) {
      updates.push('title = ?');
      params.push(body.title.trim());
    }
    if (body.memo !== undefined) {
      updates.push('memo = ?');
      params.push(body.memo.trim());
    }

    if (updates.length === 0) return errorResponse('변경할 필드가 없습니다', 400);

    params.push(id);
    await executeUpdate(db,
      `UPDATE print_materials SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return successResponse({ success: true });
  }

  // DELETE /api/materials/:id
  const deleteMatch = pathname.match(/^\/api\/materials\/([^/]+)$/);
  if (method === 'DELETE' && deleteMatch) {
    const id = deleteMatch[1];

    const existing = await executeFirst<{ id: string; created_by: string }>(
      db, 'SELECT id, created_by FROM print_materials WHERE id = ?', [id]
    );
    if (!existing) return errorResponse('교재를 찾을 수 없습니다', 404);
    if (existing.created_by !== userId) return unauthorizedResponse();

    await executeUpdate(db, 'DELETE FROM print_materials WHERE id = ?', [id]);
    return successResponse({ success: true });
  }

  return errorResponse('Not found', 404);
}
