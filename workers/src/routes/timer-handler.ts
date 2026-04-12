/**
 * 타이머/학급 라우트 핸들러
 * 직접 라우팅용으로 단일 핸들러 함수
 */

import { RequestContext, Class, Attendance } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';
import { CreateClassSchema, RecordAttendanceSchema, parseAndValidate } from '@/schemas/validation';
import { logger } from '@/utils/logger';
import { handleRouteError } from '@/utils/error-handler';
import { handleTimerSession } from './timer-session-handler';

/**
 * URL에서 파라미터 추출
 */
function extractParams(pathname: string, pattern: string): Record<string, string> {
  const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '([^/]+)').replace(/\//g, '\\/')}$`);
  const matches = pathname.match(regex);

  const paramNames = (pattern.match(/:[^/]+/g) || []).map(p => p.slice(1));
  const params: Record<string, string> = {};

  if (matches) {
    paramNames.forEach((name, i) => {
      params[name] = matches[i + 1];
    });
  }

  return params;
}

export async function handleTimer(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // ═══ v1.9.0 복원: enrollment + realtime session 라우트 ═══
    const sessionResult = await handleTimerSession(method, pathname, request, context);
    if (sessionResult !== null) return sessionResult;

    // GET /api/timer/classes
    if (method === 'GET' && pathname === '/api/timer/classes') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const classes = await executeQuery<Class>(
        context.env.DB,
        'SELECT * FROM classes WHERE academy_id = ? ORDER BY name',
        [context.auth!.academyId]
      );

      return successResponse(classes);
    }

    // GET /api/timer/classes/:id
    if (method === 'GET' && pathname.startsWith('/api/timer/classes/') && pathname.split('/').length === 5) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const id = pathname.split('/')[4];
      const classData = await executeFirst<Class>(
        context.env.DB,
        'SELECT * FROM classes WHERE id = ? AND academy_id = ?',
        [id, context.auth!.academyId]
      );

      if (!classData) return notFoundResponse();
      return successResponse(classData);
    }

    // POST /api/timer/classes
    if (method === 'POST' && pathname === '/api/timer/classes') {
      const { name, grade, dayOfWeek, startTime, endTime, capacity } = await parseAndValidate(
        request,
        CreateClassSchema
      );

      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      logger.logRequest('POST', '/api/timer/classes', context.auth?.userId, request.headers.get('CF-Connecting-IP') || undefined);

      const id = crypto.randomUUID();
      const result = await executeInsert(
        context.env.DB,
        `INSERT INTO classes (id, academy_id, name, grade, day_of_week, start_time, end_time, capacity, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [id, context.auth!.academyId, name, grade, dayOfWeek, startTime, endTime, capacity]
      );

      if (!result.success) {
        return errorResponse('Failed to create class', 500);
      }

      const newClass = await executeFirst<Class>(
        context.env.DB,
        'SELECT * FROM classes WHERE id = ?',
        [id]
      );

      return successResponse(newClass, 201);
    }

    // PATCH /api/timer/classes/:id
    if (method === 'PATCH' && pathname.startsWith('/api/timer/classes/') && pathname.split('/').length === 5) {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const id = pathname.split('/')[4];
      const { name, grade, dayOfWeek, startTime, endTime, capacity } = await request.json() as any;

      const classData = await executeFirst(
        context.env.DB,
        'SELECT * FROM classes WHERE id = ? AND academy_id = ?',
        [id, context.auth!.academyId]
      );

      if (!classData) return notFoundResponse();

      const updates = [];
      const values = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (grade !== undefined) {
        updates.push('grade = ?');
        values.push(grade);
      }
      if (dayOfWeek !== undefined) {
        updates.push('day_of_week = ?');
        values.push(dayOfWeek);
      }
      if (startTime !== undefined) {
        updates.push('start_time = ?');
        values.push(startTime);
      }
      if (endTime !== undefined) {
        updates.push('end_time = ?');
        values.push(endTime);
      }
      if (capacity !== undefined) {
        updates.push('capacity = ?');
        values.push(capacity);
      }

      if (updates.length === 0) {
        return errorResponse('No fields to update', 400);
      }

      updates.push('updated_at = datetime("now")');
      values.push(id);

      const result = await executeUpdate(
        context.env.DB,
        `UPDATE classes SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      if (!result) {
        return errorResponse('Failed to update class', 500);
      }

      const updated = await executeFirst<Class>(
        context.env.DB,
        'SELECT * FROM classes WHERE id = ?',
        [id]
      );

      return successResponse(updated);
    }

    // POST /api/timer/attendance — UPSERT (선생님이 버튼 재클릭 시 상태 변경 허용)
    if (method === 'POST' && pathname === '/api/timer/attendance') {
      const { studentId, classId, date, status, notes } = await parseAndValidate(
        request,
        RecordAttendanceSchema
      );

      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      logger.logRequest('POST', '/api/timer/attendance', context.auth?.userId, request.headers.get('CF-Connecting-IP') || undefined);

      const id = crypto.randomUUID();
      const result = await executeInsert(
        context.env.DB,
        `INSERT INTO attendance (id, student_id, class_id, date, status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(student_id, class_id, date) DO UPDATE SET
           status = excluded.status, notes = excluded.notes`,
        [id, studentId, classId, date, status || 'present', notes]
      );

      if (!result.success) {
        return errorResponse('Failed to record attendance', 500);
      }

      const record = await executeFirst<Attendance>(
        context.env.DB,
        'SELECT * FROM attendance WHERE student_id = ? AND class_id = ? AND date = ?',
        [studentId, classId, date]
      );

      return successResponse(record, 201);
    }

    // ────────────────────────────────────────────────────────────
    // GET /api/timer/today-students?date=YYYY-MM-DD
    // 로그인한 선생님의 담당 학생 + 오늘 출석/결석 상태를 반환
    // admin 역할도 본인 담당 학생만 반환한다 (학원 전체 보기는 별도 페이지에서).
    // ────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/timer/today-students') {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const url = new URL(request.url);
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

      const academyId = context.auth!.academyId;
      const userId = context.auth!.userId;

      // 해당 academy의 default_class_id 조회
      const academyRow = await executeFirst<{ default_class_id: string | null }>(
        context.env.DB,
        'SELECT default_class_id FROM academies WHERE id = ?',
        [academyId]
      );
      const defaultClassId = academyRow?.default_class_id || `class-default-${academyId}`;

      // 학생 목록 + 오늘 출석 상태 LEFT JOIN
      //   - student_teachers: 로그인 사용자(userId)가 담당한 학생만
      //   - attendance: default_class_id + date로 매칭
      //   - absences:    default_class_id + absence_date로 매칭
      // 우선순위: attendance.status > absence (absent) > pending
      const sql = `SELECT s.id, s.name, s.grade, s.subjects,
                  att.id AS attendance_id, att.status AS att_status, att.notes AS att_notes,
                  abs.id AS absence_id, abs.reason AS abs_reason
           FROM students s
           INNER JOIN student_teachers st ON s.id = st.student_id AND st.teacher_id = ?
           LEFT JOIN attendance att
             ON att.student_id = s.id AND att.class_id = ? AND att.date = ?
           LEFT JOIN absences abs
             ON abs.student_id = s.id AND abs.class_id = ? AND abs.absence_date = ?
           WHERE s.academy_id = ? AND s.status = 'active'
           ORDER BY s.grade DESC, s.name`;

      const params = [userId, defaultClassId, date, defaultClassId, date, academyId];

      const rows = await executeQuery<any>(context.env.DB, sql, params);

      const students = rows.map((r) => {
        let attendance_status: 'pending' | 'present' | 'late' | 'absent' = 'pending';
        if (r.att_status) {
          attendance_status = r.att_status as any;
        } else if (r.absence_id) {
          attendance_status = 'absent';
        }

        let subjects: string[] = [];
        try {
          subjects = r.subjects ? JSON.parse(r.subjects) : [];
        } catch {
          subjects = [];
        }

        return {
          id: r.id,
          name: r.name,
          grade: r.grade,
          subjects,
          attendance_status,
          attendance_id: r.attendance_id || null,
          notes: r.att_notes || r.abs_reason || null,
        };
      });

      return successResponse({
        date,
        defaultClassId,
        students,
      });
    }

    // ────────────────────────────────────────────────────────────
    // POST /api/timer/finish-day { date }
    // 수업 마침 — 담당 학생 중 오늘 attendance/absence 모두 없는 학생을
    // 일괄 결석 처리 (absences 테이블에 reason='수업마침 일괄')
    // ────────────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/timer/finish-day') {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const body = await request.json() as { date?: string };
      const date = body?.date || new Date().toISOString().split('T')[0];

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return errorResponse('date는 YYYY-MM-DD 형식이어야 합니다', 400);
      }

      const academyId = context.auth!.academyId;
      const userId = context.auth!.userId;

      const academyRow = await executeFirst<{ default_class_id: string | null }>(
        context.env.DB,
        'SELECT default_class_id FROM academies WHERE id = ?',
        [academyId]
      );
      const defaultClassId = academyRow?.default_class_id || `class-default-${academyId}`;

      // pending 학생 찾기 — 담당 학생 중 attendance/absence 모두 없는 경우
      // admin 역할도 본인 담당 학생만 처리한다.
      const pendingSql = `SELECT s.id FROM students s
           INNER JOIN student_teachers st ON s.id = st.student_id AND st.teacher_id = ?
           LEFT JOIN attendance att
             ON att.student_id = s.id AND att.class_id = ? AND att.date = ?
           LEFT JOIN absences abs
             ON abs.student_id = s.id AND abs.class_id = ? AND abs.absence_date = ?
           WHERE s.academy_id = ? AND s.status = 'active'
             AND att.id IS NULL AND abs.id IS NULL`;

      const pendingParams = [userId, defaultClassId, date, defaultClassId, date, academyId];

      const pending = await executeQuery<{ id: string }>(context.env.DB, pendingSql, pendingParams);

      // 1) 일괄 INSERT absences
      for (const p of pending) {
        const absenceId = crypto.randomUUID();
        await executeInsert(
          context.env.DB,
          `INSERT INTO absences (id, student_id, class_id, absence_date, reason, notified_by, status, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, 'absent', ?)
           ON CONFLICT(student_id, class_id, absence_date) DO NOTHING`,
          [absenceId, p.id, defaultClassId, date, '수업마침 일괄 결석', '', userId]
        );
      }

      // 2) 한 번의 쿼리로 모든 결석 ID 조회 (N+1 제거)
      const placeholders = pending.map(() => '?').join(',');
      const studentIds = pending.map(p => p.id);
      const insertedRows = await executeQuery<{ id: string; student_id: string }>(
        context.env.DB,
        `SELECT id, student_id FROM absences WHERE student_id IN (${placeholders}) AND class_id = ? AND absence_date = ?`,
        [...studentIds, defaultClassId, date]
      );

      // 3) 일괄 INSERT makeups (N+1 제거)
      for (const row of insertedRows) {
        const makeupId = crypto.randomUUID();
        await executeInsert(
          context.env.DB,
          `INSERT INTO makeups (id, absence_id, status) VALUES (?, ?, 'pending')
           ON CONFLICT(absence_id) DO NOTHING`,
          [makeupId, row.id]
        );
      }

      const recorded = insertedRows.length;

      logger.logRequest('POST', '/api/timer/finish-day', userId, request.headers.get('CF-Connecting-IP') || undefined);

      return successResponse({ date, recorded, total: pending.length }, 201);
    }

    // GET /api/timer/attendance/:classId/:date
    if (method === 'GET' && pathname.startsWith('/api/timer/attendance/') && pathname.split('/').length === 6) {
      if (!requireAuth(context)) return unauthorizedResponse();

      const parts = pathname.split('/');
      const classId = parts[4];
      const date = parts[5];

      const attendance = await executeQuery<Attendance>(
        context.env.DB,
        'SELECT * FROM attendance WHERE class_id = ? AND date = ?',
        [classId, date]
      );

      return successResponse(attendance);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, '타이머 처리');
  }
}
