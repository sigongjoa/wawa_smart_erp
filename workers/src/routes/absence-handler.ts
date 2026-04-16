/**
 * 결석/보강 관리 라우트 핸들러
 * Issue #27
 */

import { RequestContext, Absence, Makeup } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId } from '@/utils/context';
import { logger } from '@/utils/logger';
import { handleMakeupSession } from '@/routes/makeup-session-handler';

export async function handleAbsence(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // 분할 보강 세션 라우트 우선 처리
    if (/^\/api\/makeup\/[^/]+\/sessions(\/|$)/.test(pathname)) {
      return await handleMakeupSession(method, pathname, request, context);
    }

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

      if (absences.length > 100) {
        return errorResponse('한 번에 최대 100건까지 처리 가능', 400);
      }

      // 1) 일괄 INSERT absences
      for (const a of absences) {
        const absenceId = crypto.randomUUID();
        await executeInsert(
          context.env.DB,
          `INSERT INTO absences (id, student_id, class_id, absence_date, reason, notified_by, status, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, 'absent', ?)
           ON CONFLICT(student_id, class_id, absence_date) DO UPDATE SET
             reason = excluded.reason, notified_by = excluded.notified_by`,
          [absenceId, a.studentId, a.classId, a.absenceDate, a.reason || '', a.notifiedBy || '', context.auth?.userId || null]
        );
      }

      // 2) 한 번의 쿼리로 모든 결석 ID 조회 (N+1 제거)
      const conditions = absences.map(() => '(student_id = ? AND class_id = ? AND absence_date = ?)').join(' OR ');
      const conditionParams = absences.flatMap(a => [a.studentId, a.classId, a.absenceDate]);
      const insertedRows = await executeQuery<{ id: string; student_id: string }>(
        context.env.DB,
        `SELECT id, student_id FROM absences WHERE ${conditions}`,
        conditionParams
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

      const idMap = new Map(insertedRows.map(r => [r.student_id, r.id]));
      const results = absences.map(a => ({
        studentId: a.studentId,
        absenceId: idMap.get(a.studentId) || '',
      }));

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

      const academyId = getAcademyId(context);
      const userId = context.auth!.userId;
      const isAdmin = context.auth!.role === 'admin';

      let absenceQuery = `
        SELECT a.*, s.name as student_name, c.name as class_name
        FROM absences a
        JOIN students s ON a.student_id = s.id
        JOIN classes c ON a.class_id = c.id
        WHERE a.absence_date = ? AND s.academy_id = ?`;
      const absenceParams: any[] = [date, academyId];

      if (!isAdmin) {
        absenceQuery += ' AND (c.instructor_id = ? OR c.instructor_id IS NULL)';
        absenceParams.push(userId);
      }

      absenceQuery += ' ORDER BY c.start_time, s.name';
      const absences = await executeQuery<any>(context.env.DB, absenceQuery, absenceParams);

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

      const academyId2 = getAcademyId(context);

      // 오늘 결석
      const todayAbsences = await executeQuery<any>(
        context.env.DB,
        `SELECT a.*, s.name as student_name, c.name as class_name, c.start_time
         FROM absences a
         JOIN students s ON a.student_id = s.id
         JOIN classes c ON a.class_id = c.id
         WHERE a.absence_date = ? AND s.academy_id = ?
         ORDER BY c.start_time, s.name`,
        [date, academyId2]
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
         WHERE m.status = 'pending' AND s.academy_id = ?
         ORDER BY a.absence_date`,
        [academyId2]
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

    // ── 보강 관련 ──

    // GET /api/makeup?status=pending|scheduled|completed&scope=all|mine — 보강 목록
    if (method === 'GET' && pathname === '/api/makeup') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const scope = url.searchParams.get('scope');
      const userId = context.auth!.userId;
      const isAdmin = context.auth!.role === 'admin';
      const showAll = isAdmin && scope === 'all';

      const academyId3 = getAcademyId(context);
      let query = `
        SELECT m.*, a.absence_date, a.reason, a.student_id, a.class_id,
               s.name as student_name, c.name as class_name
        FROM makeups m
        JOIN absences a ON m.absence_id = a.id
        JOIN students s ON a.student_id = s.id
        JOIN classes c ON a.class_id = c.id
        WHERE s.academy_id = ?
      `;
      const params: any[] = [academyId3];

      if (!showAll) {
        query += ' AND (c.instructor_id = ? OR EXISTS (SELECT 1 FROM student_teachers st WHERE st.student_id = s.id AND st.teacher_id = ? AND c.instructor_id IS NULL))';
        params.push(userId, userId);
      }

      if (status) {
        query += ' AND m.status = ?';
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

      const { absenceId, scheduledDate, scheduledStartTime, scheduledEndTime, notes } = await request.json() as any;

      if (!absenceId || !scheduledDate) {
        return errorResponse('absenceId, scheduledDate 필수', 400);
      }

      // 보강 레코드 업데이트
      await executeUpdate(
        context.env.DB,
        `UPDATE makeups SET scheduled_date = ?, scheduled_start_time = ?, scheduled_end_time = ?, status = 'scheduled', notes = ?, updated_at = datetime('now')
         WHERE absence_id = ?`,
        [scheduledDate, scheduledStartTime || null, scheduledEndTime || null, notes || '', absenceId]
      );

      // 결석 상태도 업데이트
      await executeUpdate(
        context.env.DB,
        `UPDATE absences SET status = 'makeup_scheduled' WHERE id = ?`,
        [absenceId]
      );

      return successResponse({ absenceId, scheduledDate });
    }

    // PATCH /api/absence/:id — 결석 정보 수정
    const absenceIdReserved = ['batch', 'unchecked', 'daily-summary', 'class-students'];
    const absencePatchMatch = pathname.match(/^\/api\/absence\/([^/]+)$/);
    if (method === 'PATCH' && absencePatchMatch && !absenceIdReserved.includes(absencePatchMatch[1])) {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }
      const id = absencePatchMatch[1];

      // 테넌트 격리: students JOIN으로 academy_id 검증
      const owned = await executeFirst<{ id: string }>(
        context.env.DB,
        `SELECT a.id FROM absences a
         JOIN students s ON a.student_id = s.id
         WHERE a.id = ? AND s.academy_id = ?`,
        [id, getAcademyId(context)]
      );
      if (!owned) return errorResponse('결석 기록을 찾을 수 없습니다', 404);

      const body = await request.json() as any;
      const sets: string[] = [];
      const params: any[] = [];
      if (body.absence_date !== undefined) { sets.push('absence_date = ?'); params.push(body.absence_date); }
      if (body.reason !== undefined) { sets.push('reason = ?'); params.push(body.reason || null); }
      if (body.class_id !== undefined) { sets.push('class_id = ?'); params.push(body.class_id); }
      if (body.notifiedBy !== undefined) { sets.push('notified_by = ?'); params.push(body.notifiedBy || ''); }
      if (body.status !== undefined) { sets.push('status = ?'); params.push(body.status); }
      if (sets.length === 0) return errorResponse('수정할 필드가 없습니다', 400);
      params.push(id);
      await executeUpdate(
        context.env.DB,
        `UPDATE absences SET ${sets.join(', ')} WHERE id = ?`,
        params
      );
      return successResponse({ id, updated: true });
    }

    // DELETE /api/absence/:id — 결석+보강 삭제
    if (method === 'DELETE' && absencePatchMatch && !absenceIdReserved.includes(absencePatchMatch[1])) {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }
      const id = absencePatchMatch[1];

      // 테넌트 격리: students JOIN으로 academy_id 검증
      const owned = await executeFirst<{ id: string }>(
        context.env.DB,
        `SELECT a.id FROM absences a
         JOIN students s ON a.student_id = s.id
         WHERE a.id = ? AND s.academy_id = ?`,
        [id, getAcademyId(context)]
      );
      if (!owned) return errorResponse('결석 기록을 찾을 수 없습니다', 404);

      await executeUpdate(context.env.DB, 'DELETE FROM makeups WHERE absence_id = ?', [id]);
      await executeUpdate(context.env.DB, 'DELETE FROM absences WHERE id = ?', [id]);
      return successResponse({ id, deleted: true });
    }

    // PATCH /api/makeup/:id — 보강 정보 수정 (reschedule, notes, status)
    const makeupPatchMatch = pathname.match(/^\/api\/makeup\/([^/]+)$/);
    if (method === 'PATCH' && makeupPatchMatch) {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }
      const id = makeupPatchMatch[1];
      const body = await request.json() as any;

      // 테넌트 격리: absences → students JOIN으로 academy_id 검증
      const makeup = await executeFirst<any>(
        context.env.DB,
        `SELECT m.* FROM makeups m
         JOIN absences a ON m.absence_id = a.id
         JOIN students s ON a.student_id = s.id
         WHERE m.id = ? AND s.academy_id = ?`,
        [id, getAcademyId(context)]
      );
      if (!makeup) return notFoundResponse();

      const sets: string[] = [];
      const params: any[] = [];
      if (body.scheduled_date !== undefined) {
        sets.push('scheduled_date = ?');
        params.push(body.scheduled_date || null);
        // 자동 상태 전이: 날짜 세팅 시 scheduled로, null로 지우면 pending
        if (body.status === undefined) {
          sets.push('status = ?');
          params.push(body.scheduled_date ? 'scheduled' : 'pending');
        }
      }
      if (body.scheduled_start_time !== undefined) {
        sets.push('scheduled_start_time = ?');
        params.push(body.scheduled_start_time || null);
      }
      if (body.scheduled_end_time !== undefined) {
        sets.push('scheduled_end_time = ?');
        params.push(body.scheduled_end_time || null);
      }
      if (body.notes !== undefined) { sets.push('notes = ?'); params.push(body.notes || ''); }
      if (body.status !== undefined) {
        if (!['pending', 'scheduled', 'completed'].includes(body.status)) {
          return errorResponse('유효하지 않은 상태입니다', 400);
        }
        sets.push('status = ?');
        params.push(body.status);
        if (body.status === 'completed') {
          sets.push('completed_date = ?');
          params.push(body.completed_date || new Date().toISOString().split('T')[0]);
        } else if (body.status !== 'completed') {
          sets.push('completed_date = ?');
          params.push(null);
        }
      }
      if (sets.length === 0) return errorResponse('수정할 필드가 없습니다', 400);
      sets.push(`updated_at = datetime('now')`);
      params.push(id);

      await executeUpdate(
        context.env.DB,
        `UPDATE makeups SET ${sets.join(', ')} WHERE id = ?`,
        params
      );

      // 결석 상태 동기화
      const newStatus = body.status || (body.scheduled_date ? 'scheduled' : makeup.status);
      const absenceStatus = newStatus === 'completed' ? 'makeup_done'
        : newStatus === 'scheduled' ? 'makeup_scheduled'
        : 'absent';
      await executeUpdate(
        context.env.DB,
        'UPDATE absences SET status = ? WHERE id = ?',
        [absenceStatus, makeup.absence_id]
      );

      return successResponse({ id, updated: true });
    }

    // DELETE /api/makeup/:id — 보강만 삭제 (결석 유지)
    if (method === 'DELETE' && makeupPatchMatch) {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }
      const id = makeupPatchMatch[1];

      // 테넌트 격리: absences → students JOIN으로 academy_id 검증
      const makeup = await executeFirst<any>(
        context.env.DB,
        `SELECT m.absence_id FROM makeups m
         JOIN absences a ON m.absence_id = a.id
         JOIN students s ON a.student_id = s.id
         WHERE m.id = ? AND s.academy_id = ?`,
        [id, getAcademyId(context)]
      );
      if (!makeup) return notFoundResponse();

      await executeUpdate(context.env.DB, 'DELETE FROM makeups WHERE id = ?', [id]);
      await executeUpdate(
        context.env.DB,
        `UPDATE absences SET status = 'absent' WHERE id = ?`,
        [makeup.absence_id]
      );
      return successResponse({ id, deleted: true });
    }

    // PATCH /api/makeup/:id/complete — 보강 완료
    if (method === 'PATCH' && pathname.match(/^\/api\/makeup\/[^/]+\/complete$/)) {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }

      const parts = pathname.split('/');
      const makeupId = parts[3];

      // 테넌트 격리: absences → students JOIN으로 academy_id 검증
      const makeup = await executeFirst<any>(
        context.env.DB,
        `SELECT m.* FROM makeups m
         JOIN absences a ON m.absence_id = a.id
         JOIN students s ON a.student_id = s.id
         WHERE m.id = ? AND s.academy_id = ?`,
        [makeupId, getAcademyId(context)]
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
