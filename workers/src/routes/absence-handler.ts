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

// SEC-ABS-M5: status 입력 화이트리스트
const ABSENCE_STATUS_VALUES = new Set(['absent', 'makeup_scheduled', 'makeup_done']);

// SEC-ABS-M6: 결석 사유 길이 한도
const MAX_REASON_LEN = 500;
const MAX_NOTIFIED_BY_LEN = 100;

/** 제어문자 제거 + 길이 캡 (결석 사유 등) */
function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  // \x00-\x1F (제어문자) 제거, \t와 \n은 유지
  // eslint-disable-next-line no-control-regex
  const cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned.slice(0, maxLen);
}

/**
 * SEC-ABS-H1/H2/H3 + M1: studentId·classId가 caller academy 소속이고
 * (instructor면) 본인 담당 수업인지 검증.
 * 위반 시 errorResponse를 throw 대신 반환 — 호출 측이 그대로 반환.
 */
async function assertStudentClassInAcademy(
  db: any,
  studentId: string | undefined,
  classId: string | undefined,
  academyId: string,
  opts: { instructorId?: string } = {}
): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (!studentId || !classId) {
    return { ok: false, response: errorResponse('studentId, classId 필수', 400) };
  }
  let q = `SELECT s.id, c.instructor_id FROM students s, classes c
           WHERE s.id = ? AND c.id = ?
             AND s.academy_id = ? AND c.academy_id = ?`;
  const row = await executeFirst<{ id: string; instructor_id: string | null }>(
    db, q, [studentId, classId, academyId, academyId]
  );
  if (!row) {
    return { ok: false, response: errorResponse('학생 또는 수업이 학원 소속이 아닙니다', 403) };
  }
  // SEC-ABS-L1: instructor는 본인 담당 수업만 (instructor_id NULL은 admin만 다루는 일반 수업으로 가정 — 허용)
  if (opts.instructorId && row.instructor_id && row.instructor_id !== opts.instructorId) {
    return { ok: false, response: errorResponse('담당 수업만 결석 처리할 수 있습니다', 403) };
  }
  return { ok: true };
}

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

      if (!absenceDate) {
        return errorResponse('absenceDate 필수', 400);
      }

      // SEC-ABS-H1 + L1: tenant + (instructor면) 본인 수업 검증
      const academyId = getAcademyId(context);
      const isAdmin = context.auth!.role === 'admin';
      const guard = await assertStudentClassInAcademy(
        context.env.DB, studentId, classId, academyId,
        isAdmin ? {} : { instructorId: context.auth!.userId }
      );
      if (!guard.ok) return guard.response;

      // SEC-ABS-M6: 입력 위생화
      const safeReason = sanitizeText(reason, MAX_REASON_LEN);
      const safeNotifiedBy = sanitizeText(notifiedBy, MAX_NOTIFIED_BY_LEN);

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
        [absenceId, studentId, classId, absenceDate, safeReason, safeNotifiedBy, notifiedAt || null, context.auth?.userId || null]
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

      // SEC-ABS-H2 + L1: 입력의 모든 (studentId, classId)가 학원 소속이고
      // (instructor면) 본인 담당 수업인지 단일 쿼리로 검증.
      const academyIdB = getAcademyId(context);
      const isAdminB = context.auth!.role === 'admin';
      const userIdB = context.auth!.userId;

      const studentIds = [...new Set(absences.map(a => a.studentId).filter(Boolean))];
      const classIds = [...new Set(absences.map(a => a.classId).filter(Boolean))];
      if (studentIds.length === 0 || classIds.length === 0) {
        return errorResponse('absences의 studentId/classId가 비어 있습니다', 400);
      }
      const sPh = studentIds.map(() => '?').join(',');
      const cPh = classIds.map(() => '?').join(',');
      const validStudents = await executeQuery<{ id: string }>(
        context.env.DB,
        `SELECT id FROM students WHERE id IN (${sPh}) AND academy_id = ?`,
        [...studentIds, academyIdB]
      );
      const validClasses = await executeQuery<{ id: string; instructor_id: string | null }>(
        context.env.DB,
        `SELECT id, instructor_id FROM classes WHERE id IN (${cPh}) AND academy_id = ?`,
        [...classIds, academyIdB]
      );
      const validStudentSet = new Set(validStudents.map(r => r.id));
      const validClassMap = new Map(validClasses.map(r => [r.id, r.instructor_id]));

      const filtered = absences.filter(a => {
        if (!a.studentId || !a.classId || !a.absenceDate) return false;
        if (!validStudentSet.has(a.studentId)) return false;
        if (!validClassMap.has(a.classId)) return false;
        if (!isAdminB) {
          const ownerId = validClassMap.get(a.classId);
          if (ownerId && ownerId !== userIdB) return false;
        }
        return true;
      });
      const skipped = absences.length - filtered.length;

      if (filtered.length === 0) {
        return errorResponse('처리 가능한 결석 항목이 없습니다 (학원 소속/담당 수업 검증 실패)', 403);
      }

      // PERF-ABS-M1: D1 batch — INSERT absences + INSERT makeups를 단일 트랜잭션
      const recordedBy = context.auth?.userId || null;
      const absenceStmts = filtered.map((a) =>
        context.env.DB.prepare(
          `INSERT INTO absences (id, student_id, class_id, absence_date, reason, notified_by, status, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, 'absent', ?)
           ON CONFLICT(student_id, class_id, absence_date) DO UPDATE SET
             reason = excluded.reason, notified_by = excluded.notified_by`
        ).bind(
          crypto.randomUUID(),
          a.studentId,
          a.classId,
          a.absenceDate,
          sanitizeText(a.reason, MAX_REASON_LEN),
          sanitizeText(a.notifiedBy, MAX_NOTIFIED_BY_LEN),
          recordedBy,
        )
      );
      await context.env.DB.batch(absenceStmts);

      // 한 번의 쿼리로 모든 결석 ID 조회
      const conditions = filtered.map(() => '(student_id = ? AND class_id = ? AND absence_date = ?)').join(' OR ');
      const conditionParams = filtered.flatMap(a => [a.studentId, a.classId, a.absenceDate]);
      const insertedRows = await executeQuery<{ id: string; student_id: string }>(
        context.env.DB,
        `SELECT id, student_id FROM absences WHERE ${conditions}`,
        conditionParams
      );

      // makeups도 D1 batch 한 트랜잭션
      if (insertedRows.length > 0) {
        const makeupStmts = insertedRows.map((row) =>
          context.env.DB.prepare(
            `INSERT INTO makeups (id, absence_id, status) VALUES (?, ?, 'pending')
             ON CONFLICT(absence_id) DO NOTHING`
          ).bind(crypto.randomUUID(), row.id)
        );
        await context.env.DB.batch(makeupStmts);
      }

      const idMap = new Map(insertedRows.map(r => [r.student_id, r.id]));
      const results = filtered.map(a => ({
        studentId: a.studentId,
        absenceId: idMap.get(a.studentId) || '',
      }));

      return successResponse({ recorded: results.length, skipped, results }, 201);
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

      const academyId = getAcademyId(context);

      // 테넌트 격리: 해당 수업이 현재 학원 소유인지 + (instructor면) 본인 담당인지 검증
      const cls = await executeFirst<{ id: string; instructor_id: string | null }>(
        context.env.DB,
        'SELECT id, instructor_id FROM classes WHERE id = ? AND academy_id = ?',
        [classId, academyId]
      );
      if (!cls) return errorResponse('수업을 찾을 수 없습니다', 404);
      // SEC-ABS-M4: instructor scope drift 차단
      if (context.auth!.role !== 'admin' && cls.instructor_id && cls.instructor_id !== context.auth!.userId) {
        return errorResponse('담당 수업만 조회할 수 있습니다', 403);
      }

      const unchecked = await executeQuery<any>(
        context.env.DB,
        `SELECT s.id, s.name,
                a.id as absence_id, a.reason, a.notified_by, a.notified_at
         FROM class_students cs
         JOIN students s ON cs.student_id = s.id
         LEFT JOIN attendance att ON att.student_id = s.id AND att.class_id = cs.class_id AND att.date = ?
         LEFT JOIN absences a ON a.student_id = s.id AND a.class_id = cs.class_id AND a.absence_date = ?
         WHERE cs.class_id = ? AND s.academy_id = ? AND att.id IS NULL AND s.status = 'active'
         ORDER BY s.name`,
        [date, date, classId, academyId]
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

      // SEC-ABS-H3: 해당 absence가 caller 학원 소속인지 검증
      const ownedAbs = await executeFirst<{ id: string }>(
        context.env.DB,
        `SELECT a.id FROM absences a
         JOIN students s ON a.student_id = s.id
         WHERE a.id = ? AND s.academy_id = ?`,
        [absenceId, getAcademyId(context)]
      );
      if (!ownedAbs) return errorResponse('결석 기록을 찾을 수 없습니다', 404);

      // PERF-ABS-M2: makeups + absences를 D1 batch로 1 RTT
      await context.env.DB.batch([
        context.env.DB
          .prepare(
            `UPDATE makeups SET scheduled_date = ?, scheduled_start_time = ?, scheduled_end_time = ?,
                                status = 'scheduled', notes = ?, updated_at = datetime('now')
              WHERE absence_id = ?`
          )
          .bind(scheduledDate, scheduledStartTime || null, scheduledEndTime || null,
                sanitizeText(notes, MAX_REASON_LEN), absenceId),
        context.env.DB
          .prepare(`UPDATE absences SET status = 'makeup_scheduled' WHERE id = ?`)
          .bind(absenceId),
      ]);

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
      if (body.reason !== undefined) {
        // SEC-ABS-M6: 결석 사유 위생화 + 길이 캡
        sets.push('reason = ?');
        params.push(body.reason ? sanitizeText(body.reason, MAX_REASON_LEN) : null);
      }
      if (body.class_id !== undefined) {
        // SEC-ABS-M1과 동일 — 새 class_id가 caller 학원 소속인지 검증
        const c = await executeFirst<{ id: string }>(
          context.env.DB,
          'SELECT id FROM classes WHERE id = ? AND academy_id = ?',
          [body.class_id, getAcademyId(context)]
        );
        if (!c) return errorResponse('수업이 학원 소속이 아닙니다', 403);
        sets.push('class_id = ?'); params.push(body.class_id);
      }
      if (body.notifiedBy !== undefined) {
        sets.push('notified_by = ?');
        params.push(sanitizeText(body.notifiedBy, MAX_NOTIFIED_BY_LEN));
      }
      if (body.status !== undefined) {
        // SEC-ABS-M5: status 화이트리스트
        if (!ABSENCE_STATUS_VALUES.has(body.status)) {
          return errorResponse('유효하지 않은 결석 상태입니다', 400);
        }
        sets.push('status = ?'); params.push(body.status);
      }
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

      // 결석 상태 동기화
      const newStatus = body.status || (body.scheduled_date ? 'scheduled' : makeup.status);
      const absenceStatus = newStatus === 'completed' ? 'makeup_done'
        : newStatus === 'scheduled' ? 'makeup_scheduled'
        : 'absent';

      // PERF-ABS-M2: makeups + absences를 D1 batch로 1 RTT
      await context.env.DB.batch([
        context.env.DB
          .prepare(`UPDATE makeups SET ${sets.join(', ')} WHERE id = ?`)
          .bind(...params),
        context.env.DB
          .prepare('UPDATE absences SET status = ? WHERE id = ?')
          .bind(absenceStatus, makeup.absence_id),
      ]);

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

      // PERF-ABS-M2: 두 UPDATE를 D1 batch로 1 RTT
      await context.env.DB.batch([
        context.env.DB.prepare('DELETE FROM makeups WHERE id = ?').bind(id),
        context.env.DB
          .prepare(`UPDATE absences SET status = 'absent' WHERE id = ?`)
          .bind(makeup.absence_id),
      ]);
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

      // PERF-ABS-M2: 두 UPDATE를 D1 batch로 1 RTT
      await context.env.DB.batch([
        context.env.DB
          .prepare(
            `UPDATE makeups SET status = 'completed', completed_date = ?, updated_at = datetime('now')
              WHERE id = ?`
          )
          .bind(today, makeupId),
        context.env.DB
          .prepare(`UPDATE absences SET status = 'makeup_done' WHERE id = ?`)
          .bind(makeup.absence_id),
      ]);

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

      // SEC-ABS-M3: 해당 수업이 caller 학원 소속인지 검증
      const academyIdGCS = getAcademyId(context);
      const cls = await executeFirst<{ id: string }>(
        context.env.DB,
        'SELECT id FROM classes WHERE id = ? AND academy_id = ?',
        [classId, academyIdGCS]
      );
      if (!cls) return errorResponse('수업을 찾을 수 없습니다', 404);

      const students = await executeQuery<any>(
        context.env.DB,
        `SELECT cs.id as assignment_id, s.id, s.name, s.status
         FROM class_students cs
         JOIN students s ON cs.student_id = s.id
         WHERE cs.class_id = ? AND s.academy_id = ? AND s.status = 'active'
         ORDER BY s.name`,
        [classId, academyIdGCS]
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

      // SEC-ABS-M1: tenant + (instructor면) 본인 수업 검증
      const academyIdPCS = getAcademyId(context);
      const isAdminPCS = context.auth!.role === 'admin';
      const guard = await assertStudentClassInAcademy(
        context.env.DB, studentId, classId, academyIdPCS,
        isAdminPCS ? {} : { instructorId: context.auth!.userId }
      );
      if (!guard.ok) return guard.response;

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

      // SEC-ABS-M2: 매핑이 caller 학원의 수업인지 검증
      const academyIdDCS = getAcademyId(context);
      const owned = await executeFirst<{ id: string }>(
        context.env.DB,
        `SELECT cs.id FROM class_students cs
         JOIN classes c ON cs.class_id = c.id
         WHERE cs.id = ? AND c.academy_id = ?`,
        [id, academyIdDCS]
      );
      if (!owned) return errorResponse('배정을 찾을 수 없습니다', 404);

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
