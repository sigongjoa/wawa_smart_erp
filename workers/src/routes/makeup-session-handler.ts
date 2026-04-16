/**
 * 분할 보강 세션 핸들러 (1 makeup → N sessions)
 * Migration 028 기반
 */
import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate, executeDelete } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId } from '@/utils/context';
import { handleRouteError } from '@/utils/error-handler';
import { generatePrefixedId } from '@/utils/id';
import { logger } from '@/utils/logger';

// ── Helpers ──────────────────────────────────────

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) throw new Error('시간 형식 오류 (HH:MM)');
  return h * 60 + m;
}

function calcDuration(start: string, end: string): number {
  const d = parseTimeToMinutes(end) - parseTimeToMinutes(start);
  if (d <= 0) throw new Error('종료 시각이 시작보다 빨라요');
  return d;
}

async function assertMakeupAccess(
  db: any,
  makeupId: string,
  context: RequestContext
): Promise<any | null> {
  const academyId = getAcademyId(context);
  const role = context.auth!.role;
  const userId = context.auth!.userId;

  // admin 도 본인 담당 학생만 (MEMORY: feedback_admin_scope) — scope=all 은 아직 미지원
  if (role === 'instructor' || role === 'admin') {
    return await executeFirst<any>(
      db,
      `SELECT m.id, m.required_minutes, m.completed_minutes
       FROM makeups m
       JOIN absences a ON m.absence_id = a.id
       JOIN students s ON a.student_id = s.id
       INNER JOIN student_teachers st ON st.student_id = s.id AND st.teacher_id = ?
       WHERE m.id = ? AND s.academy_id = ?`,
      [userId, makeupId, academyId]
    );
  }

  return await executeFirst<any>(
    db,
    `SELECT m.id, m.required_minutes, m.completed_minutes
     FROM makeups m
     JOIN absences a ON m.absence_id = a.id
     JOIN students s ON a.student_id = s.id
     WHERE m.id = ? AND s.academy_id = ?`,
    [makeupId, academyId]
  );
}

async function recomputeMakeup(db: any, makeupId: string): Promise<{ completed: number; required: number; status: string }> {
  const sum = await executeFirst<{ completed: number }>(
    db,
    `SELECT COALESCE(SUM(duration_minutes), 0) AS completed
     FROM makeup_sessions WHERE makeup_id = ? AND status = 'completed'`,
    [makeupId]
  );
  const mk = await executeFirst<{ required: number }>(
    db,
    `SELECT required_minutes AS required FROM makeups WHERE id = ?`,
    [makeupId]
  );

  const completed = sum?.completed || 0;
  const required = mk?.required || 0;
  const hasAnySession = await executeFirst<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM makeup_sessions WHERE makeup_id = ? AND status != 'cancelled'`,
    [makeupId]
  );

  let status: string;
  if (required > 0 && completed >= required) status = 'completed';
  else if (completed > 0) status = 'in_progress';
  else if ((hasAnySession?.n || 0) > 0) status = 'scheduled';
  else status = 'pending';

  await executeUpdate(
    db,
    `UPDATE makeups
     SET completed_minutes = ?,
         status = ?,
         completed_date = CASE WHEN ? = 'completed' THEN date('now') ELSE completed_date END,
         updated_at = datetime('now')
     WHERE id = ?`,
    [completed, status, status, makeupId]
  );

  return { completed, required, status };
}

// ── Handler 함수들 ──────────────────────────────

async function listSessions(makeupId: string, context: RequestContext): Promise<Response> {
  const mk = await assertMakeupAccess(context.env.DB, makeupId, context);
  if (!mk) return errorResponse('보강을 찾을 수 없습니다', 404);

  const sessions = await executeQuery<any>(
    context.env.DB,
    `SELECT id, makeup_id, session_index, scheduled_date,
            scheduled_start_time, scheduled_end_time, duration_minutes,
            status, completed_at, notes, created_at, updated_at
     FROM makeup_sessions
     WHERE makeup_id = ?
     ORDER BY scheduled_date, scheduled_start_time`,
    [makeupId]
  );

  const required = mk.required_minutes || 0;
  const completed = mk.completed_minutes || 0;
  return successResponse({
    makeup: {
      id: mk.id,
      required_minutes: required,
      completed_minutes: completed,
      progress: required > 0 ? Math.round((completed / required) * 100) / 100 : 0,
    },
    sessions,
  });
}

async function addSession(makeupId: string, request: Request, context: RequestContext): Promise<Response> {
  const mk = await assertMakeupAccess(context.env.DB, makeupId, context);
  if (!mk) return errorResponse('보강을 찾을 수 없습니다', 404);

  const body = await request.json() as any;
  const { scheduled_date, scheduled_start_time, scheduled_end_time, notes } = body;

  if (!scheduled_date || !scheduled_start_time || !scheduled_end_time) {
    return errorResponse('scheduled_date, scheduled_start_time, scheduled_end_time 필수', 400);
  }

  let duration: number;
  try {
    duration = calcDuration(scheduled_start_time, scheduled_end_time);
  } catch (e: any) {
    return errorResponse(e.message, 400);
  }

  // UNIQUE(makeup_id, session_index) 덕분에 경합 시 실패 → 재시도 (최대 5회)
  const id = generatePrefixedId('msess');
  let sessionIndex = 0;
  let inserted = false;
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    const last = await executeFirst<{ max_idx: number }>(
      context.env.DB,
      `SELECT COALESCE(MAX(session_index), 0) AS max_idx FROM makeup_sessions WHERE makeup_id = ?`,
      [makeupId]
    );
    sessionIndex = (last?.max_idx || 0) + 1;
    try {
      await executeInsert(
        context.env.DB,
        `INSERT INTO makeup_sessions
           (id, makeup_id, session_index, scheduled_date, scheduled_start_time,
            scheduled_end_time, duration_minutes, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
        [id, makeupId, sessionIndex, scheduled_date,
         scheduled_start_time, scheduled_end_time, duration, notes || '']
      );
      inserted = true;
    } catch (e: any) {
      if (!/UNIQUE|constraint/i.test(String(e?.message || e))) throw e;
      // 다음 루프에서 max_idx 재조회
    }
  }
  if (!inserted) return errorResponse('회차 번호 할당 실패 (재시도 초과)', 409);

  const recomputed = await recomputeMakeup(context.env.DB, makeupId);
  logger.logAudit('MAKEUP_SESSION_ADD', 'MakeupSession', id, context.auth!.userId);

  return successResponse({
    id, makeup_id: makeupId, session_index: sessionIndex,
    scheduled_date, scheduled_start_time, scheduled_end_time,
    duration_minutes: duration, status: 'scheduled',
    makeup: recomputed,
  }, 201);
}

async function updateSession(
  makeupId: string, sessionId: string, request: Request, context: RequestContext
): Promise<Response> {
  const mk = await assertMakeupAccess(context.env.DB, makeupId, context);
  if (!mk) return errorResponse('보강을 찾을 수 없습니다', 404);

  const sess = await executeFirst<any>(
    context.env.DB,
    `SELECT * FROM makeup_sessions WHERE id = ? AND makeup_id = ?`,
    [sessionId, makeupId]
  );
  if (!sess) return errorResponse('회차를 찾을 수 없습니다', 404);

  const body = await request.json() as any;
  const start = body.scheduled_start_time ?? sess.scheduled_start_time;
  const end = body.scheduled_end_time ?? sess.scheduled_end_time;

  let duration = sess.duration_minutes;
  if (body.scheduled_start_time !== undefined || body.scheduled_end_time !== undefined) {
    try {
      duration = calcDuration(start, end);
    } catch (e: any) {
      return errorResponse(e.message, 400);
    }
  }

  const sets: string[] = [];
  const params: any[] = [];
  if (body.scheduled_date !== undefined) { sets.push('scheduled_date = ?'); params.push(body.scheduled_date); }
  if (body.scheduled_start_time !== undefined) { sets.push('scheduled_start_time = ?'); params.push(body.scheduled_start_time); }
  if (body.scheduled_end_time !== undefined) { sets.push('scheduled_end_time = ?'); params.push(body.scheduled_end_time); }
  if (body.scheduled_start_time !== undefined || body.scheduled_end_time !== undefined) {
    sets.push('duration_minutes = ?'); params.push(duration);
  }
  if (body.notes !== undefined) { sets.push('notes = ?'); params.push(body.notes || ''); }
  if (sets.length === 0) return errorResponse('수정할 필드가 없습니다', 400);

  sets.push("updated_at = datetime('now')");
  params.push(sessionId);
  await executeUpdate(
    context.env.DB,
    `UPDATE makeup_sessions SET ${sets.join(', ')} WHERE id = ?`,
    params
  );

  const recomputed = await recomputeMakeup(context.env.DB, makeupId);
  return successResponse({ id: sessionId, updated: true, makeup: recomputed });
}

async function completeSession(
  makeupId: string, sessionId: string, context: RequestContext
): Promise<Response> {
  const mk = await assertMakeupAccess(context.env.DB, makeupId, context);
  if (!mk) return errorResponse('보강을 찾을 수 없습니다', 404);

  const sess = await executeFirst<any>(
    context.env.DB,
    `SELECT * FROM makeup_sessions WHERE id = ? AND makeup_id = ?`,
    [sessionId, makeupId]
  );
  if (!sess) return errorResponse('회차를 찾을 수 없습니다', 404);

  // 멱등 가드: scheduled 일 때만 completed 로 전환 (cancelled/completed 는 그대로)
  await executeUpdate(
    context.env.DB,
    `UPDATE makeup_sessions
     SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND status = 'scheduled'`,
    [sessionId]
  );

  const recomputed = await recomputeMakeup(context.env.DB, makeupId);
  logger.logAudit('MAKEUP_SESSION_COMPLETE', 'MakeupSession', sessionId, context.auth!.userId);

  return successResponse({
    id: sessionId,
    completed: true,
    makeup: recomputed,
    fully_completed: recomputed.status === 'completed',
  });
}

async function cancelSession(
  makeupId: string, sessionId: string, context: RequestContext
): Promise<Response> {
  const mk = await assertMakeupAccess(context.env.DB, makeupId, context);
  if (!mk) return errorResponse('보강을 찾을 수 없습니다', 404);

  const sess = await executeFirst<any>(
    context.env.DB,
    `SELECT id FROM makeup_sessions WHERE id = ? AND makeup_id = ?`,
    [sessionId, makeupId]
  );
  if (!sess) return errorResponse('회차를 찾을 수 없습니다', 404);

  // soft delete: status=cancelled (진행률 계산 제외)
  await executeUpdate(
    context.env.DB,
    `UPDATE makeup_sessions SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`,
    [sessionId]
  );

  const recomputed = await recomputeMakeup(context.env.DB, makeupId);
  return successResponse({ id: sessionId, cancelled: true, makeup: recomputed });
}

// ── Dispatcher ────────────────────────────────────

export async function handleMakeupSession(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
      return unauthorizedResponse();
    }

    // POST /api/makeup/:id/sessions/:sid/complete
    const completeMatch = pathname.match(/^\/api\/makeup\/([^/]+)\/sessions\/([^/]+)\/complete$/);
    if (completeMatch && method === 'POST') {
      return await completeSession(completeMatch[1], completeMatch[2], context);
    }

    // /api/makeup/:id/sessions/:sid
    const itemMatch = pathname.match(/^\/api\/makeup\/([^/]+)\/sessions\/([^/]+)$/);
    if (itemMatch) {
      if (method === 'PATCH') return await updateSession(itemMatch[1], itemMatch[2], request, context);
      if (method === 'DELETE') return await cancelSession(itemMatch[1], itemMatch[2], context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/makeup/:id/sessions
    const listMatch = pathname.match(/^\/api\/makeup\/([^/]+)\/sessions$/);
    if (listMatch) {
      if (method === 'GET') return await listSessions(listMatch[1], context);
      if (method === 'POST') return await addSession(listMatch[1], request, context);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, '보강 세션');
  }
}
