/**
 * 학생 진도/이해도 관리
 * GET    /api/progress/textbooks                             교재 목록(distinct)
 * DELETE /api/progress/textbooks?name=                       교재(와 단원/진도) 삭제
 * GET    /api/progress/units?textbook=&kind=                 단원 목록
 * POST   /api/progress/units                                 단원 추가 (admin)
 * PATCH  /api/progress/units/:id                             단원 수정 (admin)
 * DELETE /api/progress/units/:id                             단원 삭제 (admin)
 * POST   /api/progress/units/reorder                         순서 일괄 변경 (admin)
 * GET    /api/progress/students/:studentId?textbook=&kind=   학생 진도 (left join)
 * PATCH  /api/progress/students/:studentId/units/:unitId     이해도/상태 upsert
 */

import { RequestContext } from '@/types';
import { executeFirst, executeQuery, executeInsert, executeUpdate, executeDelete } from '@/utils/db';
import { errorResponse, successResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { generateId } from '@/utils/id';

async function teacherOwnsStudent(db: D1Database, teacherId: string, studentId: string): Promise<boolean> {
  const row = await executeFirst<{ n: number }>(
    db,
    'SELECT 1 AS n FROM student_teachers WHERE teacher_id = ? AND student_id = ? LIMIT 1',
    [teacherId, studentId]
  );
  return !!row;
}

export async function handleProgress(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const db = context.env.DB;
  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  const role = context.auth!.role;
  const isAdmin = role === 'admin';

  // ─────── Textbooks ───────
  if (method === 'GET' && pathname === '/api/progress/textbooks') {
    const rows = await executeQuery<{ textbook: string; unit_count: number }>(
      db,
      `SELECT textbook, COUNT(*) AS unit_count
       FROM study_units
       WHERE academy_id = ?
       GROUP BY textbook
       ORDER BY textbook`,
      [academyId]
    );
    return successResponse(rows);
  }

  if (method === 'DELETE' && pathname === '/api/progress/textbooks') {
    if (!isAdmin) return errorResponse('권한이 없습니다', 403);
    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    if (!name) return errorResponse('교재명이 필요합니다', 400);
    await executeDelete(
      db,
      'DELETE FROM study_units WHERE academy_id = ? AND textbook = ?',
      [academyId, name]
    );
    return successResponse({ ok: true });
  }

  // ─────── Units ───────
  if (method === 'GET' && pathname === '/api/progress/units') {
    const url = new URL(request.url);
    const textbook = url.searchParams.get('textbook');
    const kind = url.searchParams.get('kind') || 'unit';
    if (!textbook) return errorResponse('교재를 지정하세요', 400);
    const rows = await executeQuery(
      db,
      `SELECT id, textbook, name, kind, order_idx, created_at
       FROM study_units
       WHERE academy_id = ? AND textbook = ? AND kind = ?
       ORDER BY order_idx, created_at`,
      [academyId, textbook, kind]
    );
    return successResponse(rows);
  }

  if (method === 'POST' && pathname === '/api/progress/units') {
    if (!isAdmin) return errorResponse('권한이 없습니다', 403);
    const body = await request.json() as {
      textbook?: string; name?: string; kind?: string; order_idx?: number;
    };
    const textbook = body.textbook?.trim();
    const name = body.name?.trim();
    const kind = body.kind === 'type' ? 'type' : 'unit';
    if (!textbook) return errorResponse('교재명이 필요합니다', 400);
    if (!name) return errorResponse('단원/유형명이 필요합니다', 400);

    let orderIdx = body.order_idx;
    if (orderIdx === undefined || orderIdx === null) {
      const last = await executeFirst<{ max_idx: number | null }>(
        db,
        `SELECT MAX(order_idx) AS max_idx FROM study_units
         WHERE academy_id = ? AND textbook = ? AND kind = ?`,
        [academyId, textbook, kind]
      );
      orderIdx = (last?.max_idx ?? -1) + 1;
    }

    const id = generateId();
    await executeInsert(
      db,
      `INSERT INTO study_units (id, academy_id, textbook, name, kind, order_idx, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, academyId, textbook, name, kind, orderIdx, userId]
    );
    return successResponse({ id, textbook, name, kind, order_idx: orderIdx });
  }

  const unitMatch = pathname.match(/^\/api\/progress\/units\/([^/]+)$/);
  if (unitMatch) {
    const unitId = unitMatch[1];
    const existing = await executeFirst<{ academy_id: string }>(
      db,
      'SELECT academy_id FROM study_units WHERE id = ?',
      [unitId]
    );
    if (!existing || existing.academy_id !== academyId) return notFoundResponse();

    if (method === 'PATCH') {
      if (!isAdmin) return errorResponse('권한이 없습니다', 403);
      const body = await request.json() as { name?: string; order_idx?: number };
      const sets: string[] = [];
      const params: any[] = [];
      if (body.name !== undefined) { sets.push('name = ?'); params.push(body.name.trim()); }
      if (body.order_idx !== undefined) { sets.push('order_idx = ?'); params.push(body.order_idx); }
      if (sets.length === 0) return successResponse({ ok: true });
      params.push(unitId);
      await executeUpdate(db, `UPDATE study_units SET ${sets.join(', ')} WHERE id = ?`, params);
      return successResponse({ ok: true });
    }

    if (method === 'DELETE') {
      if (!isAdmin) return errorResponse('권한이 없습니다', 403);
      await executeDelete(db, 'DELETE FROM study_units WHERE id = ?', [unitId]);
      return successResponse({ ok: true });
    }
  }

  if (method === 'POST' && pathname === '/api/progress/units/reorder') {
    if (!isAdmin) return errorResponse('권한이 없습니다', 403);
    const body = await request.json() as { ids?: string[] };
    const ids = body.ids || [];
    for (let i = 0; i < ids.length; i++) {
      await executeUpdate(
        db,
        'UPDATE study_units SET order_idx = ? WHERE id = ? AND academy_id = ?',
        [i, ids[i], academyId]
      );
    }
    return successResponse({ ok: true });
  }

  // ─────── Student Progress ───────
  const getMatch = pathname.match(/^\/api\/progress\/students\/([^/]+)$/);
  if (method === 'GET' && getMatch) {
    const studentId = getMatch[1];

    const student = await executeFirst<{ academy_id: string }>(
      db,
      'SELECT academy_id FROM students WHERE id = ?',
      [studentId]
    );
    if (!student || student.academy_id !== academyId) return notFoundResponse();
    if (!(await teacherOwnsStudent(db, userId, studentId))) {
      return errorResponse('담당 학생이 아닙니다', 403);
    }

    const url = new URL(request.url);
    const textbook = url.searchParams.get('textbook');
    const kind = url.searchParams.get('kind') || 'unit';
    if (!textbook) return errorResponse('교재를 지정하세요', 400);

    const rows = await executeQuery(
      db,
      `SELECT u.id AS unit_id, u.name, u.order_idx, u.kind,
              p.understanding, p.status, p.note, p.updated_at
       FROM study_units u
       LEFT JOIN student_study_progress p
         ON p.unit_id = u.id AND p.student_id = ?
       WHERE u.academy_id = ? AND u.textbook = ? AND u.kind = ?
       ORDER BY u.order_idx, u.created_at`,
      [studentId, academyId, textbook, kind]
    );
    return successResponse(rows);
  }

  const patchMatch = pathname.match(/^\/api\/progress\/students\/([^/]+)\/units\/([^/]+)$/);
  if (method === 'PATCH' && patchMatch) {
    const [, studentId, unitId] = patchMatch;

    const student = await executeFirst<{ academy_id: string }>(
      db,
      'SELECT academy_id FROM students WHERE id = ?',
      [studentId]
    );
    if (!student || student.academy_id !== academyId) return notFoundResponse();
    if (!(await teacherOwnsStudent(db, userId, studentId))) {
      return errorResponse('담당 학생이 아닙니다', 403);
    }
    const unit = await executeFirst<{ academy_id: string }>(
      db,
      'SELECT academy_id FROM study_units WHERE id = ?',
      [unitId]
    );
    if (!unit || unit.academy_id !== academyId) return notFoundResponse();

    const body = await request.json() as {
      understanding?: number | null;
      status?: string;
      note?: string | null;
    };
    const understanding = body.understanding === undefined
      ? undefined
      : body.understanding === null
        ? null
        : Math.max(0, Math.min(100, Math.round(body.understanding)));
    const status = body.status && ['not_started', 'in_progress', 'done'].includes(body.status)
      ? body.status
      : undefined;

    const existing = await executeFirst<{ id: string }>(
      db,
      'SELECT id FROM student_study_progress WHERE student_id = ? AND unit_id = ?',
      [studentId, unitId]
    );

    if (existing) {
      const sets: string[] = ['updated_by = ?', "updated_at = datetime('now')"];
      const params: any[] = [userId];
      if (understanding !== undefined) { sets.push('understanding = ?'); params.push(understanding); }
      if (status !== undefined) { sets.push('status = ?'); params.push(status); }
      if (body.note !== undefined) { sets.push('note = ?'); params.push(body.note); }
      params.push(existing.id);
      await executeUpdate(
        db,
        `UPDATE student_study_progress SET ${sets.join(', ')} WHERE id = ?`,
        params
      );
    } else {
      await executeInsert(
        db,
        `INSERT INTO student_study_progress
         (id, academy_id, student_id, unit_id, understanding, status, note, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(), academyId, studentId, unitId,
          understanding ?? null,
          status ?? (understanding != null ? (understanding >= 80 ? 'done' : 'in_progress') : 'not_started'),
          body.note ?? null,
          userId,
        ]
      );
    }

    return successResponse({ ok: true });
  }

  return errorResponse('Not found', 404);
}
