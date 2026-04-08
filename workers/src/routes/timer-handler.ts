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

    // POST /api/timer/attendance
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
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [id, studentId, classId, date, status || 'present', notes]
      );

      if (!result.success) {
        return errorResponse('Failed to record attendance', 500);
      }

      const record = await executeFirst<Attendance>(
        context.env.DB,
        'SELECT * FROM attendance WHERE id = ?',
        [id]
      );

      return successResponse(record, 201);
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증') || errorMessage.includes('요청 처리')) {
      logger.warn('타이머 검증 오류', { error: errorMessage });
      return errorResponse(errorMessage, 400);
    }

    logger.error('타이머 처리 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('요청 처리 실패', 500);
  }
}
