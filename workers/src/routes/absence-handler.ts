/**
 * 결석/보강 관리 라우트 핸들러
 * Issue #27
 */

import { RequestContext, Absence, Makeup } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';

export async function handleAbsence(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // ── 결석 관련 ──

    // POST /api/absence — 결석 기록
    if (method === 'POST' && pathname === '/api/absence') {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const { studentId, classId, absenceDate, reason, notifiedBy, notifiedAt } = await request.json() as any;

      if (!studentId || !classId || !absenceDate) {
        return errorResponse('studentId, classId, absenceDate 필수', 400);
      }

      const absenceId = crypto.randomUUID();
      const makeupId = crypto.randomUUID();

      // 결석 기록 + 보강 레코드 자동 생성
      const result = await executeInsert(
        context.env.DB,
        `INSERT INTO absences (id, student_id, class_id, absence_date, reason, notified_by, notified_at, status, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'absent', ?)
         ON CONFLICT(student_id, class_id, absence_date) DO UPDATE SET
           reason = excluded.reason,
           notified_by = excluded.notified_by,
           notified_at = excluded.notified_at`,
        [absenceId, studentId, classId, absenceDate, reason || '', notifiedBy || '', notifiedAt || null, context.auth?.userId || null]
      );

      if (!result.success) {
        return errorResponse('결석 기록 실패', 500);
      }

      // 실제 삽입된 결석 ID 조회 (UPSERT이므로)
      const inserted = await executeFirst<any>(
        context.env.DB,
        'SELECT id FROM absences WHERE student_id = ? AND class_id = ? AND absence_date = ?',
        [studentId, classId, absenceDate]
      );

      // 보강 레코드 자동 생성 (없으면)
      if (inserted) {
        await executeInsert(
          context.env.DB,
          `INSERT INTO makeups (id, absence_id, status) VALUES (?, ?, 'pending')
           ON CONFLICT(absence_id) DO NOTHING`,
          [makeupId, inserted.id]
        );
      }

      return successResponse({ id: inserted?.id || absenceId }, 201);
    }

    // POST /api/absence/batch — 수업 마침 시 일괄 결석 기록
    if (method === 'POST' && pathname === '/api/absence/batch') {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const { absences } = await request.json() as { absences: Array<{ studentId: string; classId: string; absenceDate: string; reason: string; notifiedBy: string }> };

      if (!absences || !Array.isArray(absences) || absences.length === 0) {
        return errorResponse('absences 배열 필수', 400);
      }

      const results = [];
      for (const a of absences) {
        const absenceId = crypto.randomUUID();
        const makeupId = crypto.randomUUID();

        await executeInsert(
          context.env.DB,
          `INSERT INTO absences (id, student_id, class_id, absence_date, reason, notified_by, status, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, 'absent', ?)
           ON CONFLICT(student_id, class_id, absence_date) DO UPDATE SET
             reason = excluded.reason, notified_by = excluded.notified_by`,
          [absenceId, a.studentId, a.classId, a.absenceDate, a.reason || '', a.notifiedBy || '', context.auth?.userId || null]
        );

        const inserted = await executeFirst<any>(
          context.env.DB,
          'SELECT id FROM absences WHERE student_id = ? AND class_id = ? AND absence_date = ?',
          [a.studentId, a.classId, a.absenceDate]
        );

        if (inserted) {
          await executeInsert(
            context.env.DB,
            `INSERT INTO makeups (id, absence_id, status) VALUES (?, ?, 'pending')
             ON CONFLICT(absence_id) DO NOTHING`,
            [makeupId, inserted.id]
          );
        }

        results.push({ studentId: a.studentId, absenceId: inserted?.id || absenceId });
      }

      return successResponse({ recorded: results.length, results }, 201);
    }

    // GET /api/absence?date=YYYY-MM-DD — 날짜별 결석 조회
    if (method === 'GET' && pathname === '/api/absence') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const url = new URL(request.url);
      const date = url.searchParams.get('date');

      if (!date) {
        return errorResponse('date 파라미터 필수', 400);
      }

      const absences = await executeQuery<any>(
        context.env.DB,
        `SELECT a.*, s.name as student_name, c.name as class_name
         FROM absences a
         JOIN students s ON a.student_id = s.id
         JOIN classes c ON a.class_id = c.id
         WHERE a.absence_date = ?
         ORDER BY c.start_time, s.name`,
        [date]
      );

      return successResponse(absences);
    }

    // GET /api/absence/unchecked?classId=xx&date=xx — 수업 마침 시 미출석자 조회
    if (method === 'GET' && pathname === '/api/absence/unchecked') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const url = new URL(request.url);
      const classId = url.searchParams.get('classId');
      const date = url.searchParams.get('date');

      if (!classId || !date) {
        return errorResponse('classId, date 파라미터 필수', 400);
      }

      // 해당 수업에 배정된 학생 중, 출석 기록이 없는 학생 조회
      const unchecked = await executeQuery<any>(
        context.env.DB,
        `SELECT s.id, s.name,
                a.id as absence_id, a.reason, a.notified_by, a.notified_at
         FROM class_students cs
         JOIN students s ON cs.student_id = s.id
         LEFT JOIN attendance att ON att.student_id = s.id AND att.class_id = cs.class_id AND att.date = ?
         LEFT JOIN absences a ON a.student_id = s.id AND a.class_id = cs.class_id AND a.absence_date = ?
         WHERE cs.class_id = ? AND att.id IS NULL AND s.status = 'active'
         ORDER BY s.name`,
        [date, date, classId]
      );

      return successResponse(unchecked);
    }

    // GET /api/absence/daily-summary?date=YYYY-MM-DD — 퇴근 요약
    if (method === 'GET' && pathname === '/api/absence/daily-summary') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const url = new URL(request.url);
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

      // 오늘 결석
      const todayAbsences = await executeQuery<any>(
        context.env.DB,
        `SELECT a.*, s.name as student_name, c.name as class_name, c.start_time
         FROM absences a
         JOIN students s ON a.student_id = s.id
         JOIN classes c ON a.class_id = c.id
         WHERE a.absence_date = ?
         ORDER BY c.start_time, s.name`,
        [date]
      );

      // 미보강 누적
      const pendingMakeups = await executeQuery<any>(
        context.env.DB,
        `SELECT m.*, a.absence_date, a.reason, a.student_id,
                s.name as student_name, c.name as class_name
         FROM makeups m
         JOIN absences a ON m.absence_id = a.id
         JOIN students s ON a.student_id = s.id
         JOIN classes c ON a.class_id = c.id
         WHERE m.status = 'pending'
         ORDER BY a.absence_date`,
        []
      );

      // 요일 계산
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dateObj = new Date(date + 'T00:00:00');
      const dayName = dayNames[dateObj.getDay()];
      const monthDay = `${dateObj.getMonth() + 1}/${dateObj.getDate()}(${dayName})`;

      // 클립보드 텍스트 생성
      let clipboardText = `[와와학습코칭센터] ${monthDay} 결석 보고\n`;

      if (todayAbsences.length === 0) {
        clipboardText += '- 결석 없음\n';
      } else {
        for (const a of todayAbsences) {
          clipboardText += `- ${a.student_name}: ${a.class_name} 결석 (${a.reason || '미통보'}) → 보강 필요\n`;
        }
      }

      if (pendingMakeups.length > 0) {
        clipboardText += `\n미보강 누적: ${pendingMakeups.length}건\n`;
        for (const m of pendingMakeups) {
          clipboardText += `- ${m.student_name}: ${m.absence_date} ${m.class_name} 결석\n`;
        }
      }

      clipboardText += `담당: ${context.auth?.email || ''}`;

      return successResponse({
        date,
        todayAbsences,
        pendingMakeups,
        clipboardText,
      });
    }

    // PATCH /api/absence/:id — 결석 정보 수정
    if (method === 'PATCH' && pathname.match(/^\/api\/absence\/[^/]+$/) && !pathname.includes('daily-summary') && !pathname.includes('unchecked') && !pathname.includes('batch')) {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const id = pathname.split('/').pop()!;
      const updates = await request.json() as any;

      const existing = await executeFirst<any>(
        context.env.DB,
        'SELECT * FROM absences WHERE id = ?',
        [id]
      );

      if (!existing) return notFoundResponse();

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.reason !== undefined) { fields.push('reason = ?'); values.push(updates.reason); }
      if (updates.notifiedBy !== undefined) { fields.push('notified_by = ?'); values.push(updates.notifiedBy); }
      if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }

      if (fields.length === 0) return errorResponse('수정할 필드 없음', 400);

      values.push(id);
      await executeUpdate(
        context.env.DB,
        `UPDATE absences SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      return successResponse({ id });
    }

    // ── 보강 관련 ──

    // GET /api/makeup?status=pending|scheduled|completed — 보강 목록
    if (method === 'GET' && pathname === '/api/makeup') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const url = new URL(request.url);
      const status = url.searchParams.get('status');

      let query = `
        SELECT m.*, a.absence_date, a.reason, a.student_id, a.class_id,
               s.name as student_name, c.name as class_name
        FROM makeups m
        JOIN absences a ON m.absence_id = a.id
        JOIN students s ON a.student_id = s.id
        JOIN classes c ON a.class_id = c.id
      `;
      const params: any[] = [];

      if (status) {
        query += ' WHERE m.status = ?';
        params.push(status);
      }

      query += ' ORDER BY CASE m.status WHEN \'pending\' THEN 0 WHEN \'scheduled\' THEN 1 ELSE 2 END, a.absence_date DESC';

      const makeups = await executeQuery<any>(context.env.DB, query, params);
      return successResponse(makeups);
    }

    // POST /api/makeup — 보강일 지정 (absence_id로)
    if (method === 'POST' && pathname === '/api/makeup') {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const { absenceId, scheduledDate, notes } = await request.json() as any;

      if (!absenceId || !scheduledDate) {
        return errorResponse('absenceId, scheduledDate 필수', 400);
      }

      // 보강 레코드 업데이트
      await executeUpdate(
        context.env.DB,
        `UPDATE makeups SET scheduled_date = ?, status = 'scheduled', notes = ?, updated_at = datetime('now')
         WHERE absence_id = ?`,
        [scheduledDate, notes || '', absenceId]
      );

      // 결석 상태도 업데이트
      await executeUpdate(
        context.env.DB,
        `UPDATE absences SET status = 'makeup_scheduled' WHERE id = ?`,
        [absenceId]
      );

      return successResponse({ absenceId, scheduledDate });
    }

    // PATCH /api/makeup/:id/complete — 보강 완료
    if (method === 'PATCH' && pathname.match(/^\/api\/makeup\/[^/]+\/complete$/)) {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const parts = pathname.split('/');
      const makeupId = parts[3];

      const makeup = await executeFirst<any>(
        context.env.DB,
        'SELECT * FROM makeups WHERE id = ?',
        [makeupId]
      );

      if (!makeup) return notFoundResponse();

      const today = new Date().toISOString().split('T')[0];

      await executeUpdate(
        context.env.DB,
        `UPDATE makeups SET status = 'completed', completed_date = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [today, makeupId]
      );

      await executeUpdate(
        context.env.DB,
        `UPDATE absences SET status = 'makeup_done' WHERE id = ?`,
        [makeup.absence_id]
      );

      return successResponse({ makeupId, completedDate: today });
    }

    // ── 수업별 학생 배정 관리 ──

    // GET /api/absence/class-students?classId=xx — 수업별 배정 학생 조회
    if (method === 'GET' && pathname === '/api/absence/class-students') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const url = new URL(request.url);
      const classId = url.searchParams.get('classId');

      if (!classId) {
        return errorResponse('classId 파라미터 필수', 400);
      }

      const students = await executeQuery<any>(
        context.env.DB,
        `SELECT cs.id as assignment_id, s.id, s.name, s.status
         FROM class_students cs
         JOIN students s ON cs.student_id = s.id
         WHERE cs.class_id = ? AND s.status = 'active'
         ORDER BY s.name`,
        [classId]
      );

      return successResponse(students);
    }

    // POST /api/absence/class-students — 학생 배정
    if (method === 'POST' && pathname === '/api/absence/class-students') {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const { classId, studentId } = await request.json() as any;

      if (!classId || !studentId) {
        return errorResponse('classId, studentId 필수', 400);
      }

      const id = crypto.randomUUID();
      await executeInsert(
        context.env.DB,
        `INSERT INTO class_students (id, class_id, student_id) VALUES (?, ?, ?)
         ON CONFLICT(class_id, student_id) DO NOTHING`,
        [id, classId, studentId]
      );

      return successResponse({ id }, 201);
    }

    // DELETE /api/absence/class-students/:id — 학생 배정 해제
    if (method === 'DELETE' && pathname.match(/^\/api\/absence\/class-students\/[^/]+$/)) {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const id = pathname.split('/').pop()!;
      await executeUpdate(
        context.env.DB,
        'DELETE FROM class_students WHERE id = ?',
        [id]
      );

      return successResponse({ deleted: true });
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('결석/보강 처리 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('요청 처리 실패', 500);
  }
}
