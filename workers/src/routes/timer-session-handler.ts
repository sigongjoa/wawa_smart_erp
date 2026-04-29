/**
 * Timer 세션/수강일정 핸들러
 * v1.9.0 timer 시스템 복원 — enrollment + realtime_session + attendance_record
 *
 * 인가 원칙:
 *   모든 조회/수정은 student_teachers INNER JOIN teacher_id = userId.
 *   admin 도 본인 담당 학생만. (MEMORY: feedback_admin_scope)
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';

// ─── JSON 파싱 헬퍼 ────────────────────────────────────────
function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  try { return json ? JSON.parse(json) : fallback; } catch { return fallback; }
}

// ─── 타입 ───────────────────────────────────────────────
interface PauseRecord {
  pausedAt: string;
  resumedAt?: string;
  reason?: string;
}

interface SessionRow {
  id: string;
  student_id: string;
  teacher_id: string;
  date: string;
  check_in_time: string;
  check_out_time: string | null;
  status: 'active' | 'paused' | 'completed' | 'overtime';
  scheduled_minutes: number;
  added_minutes: number;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  pause_history: string;
  subject: string | null;
}

// ─── 유틸 ───────────────────────────────────────────────
function calcScheduledMinutes(startTime?: string | null, endTime?: string | null): number {
  if (!startTime || !endTime) return 90; // 기본 90분
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : 90;
}

function calcPausedMinutes(history: PauseRecord[], now: Date): number {
  let total = 0;
  for (const p of history) {
    const start = new Date(p.pausedAt);
    const end = p.resumedAt ? new Date(p.resumedAt) : now;
    total += (end.getTime() - start.getTime()) / 1000 / 60;
  }
  return Math.floor(total);
}

async function assertTeacherOwnsStudent(
  db: any,
  teacherId: string,
  studentId: string
): Promise<boolean> {
  const row = await executeFirst<{ n: number }>(
    db,
    'SELECT 1 AS n FROM student_teachers WHERE teacher_id = ? AND student_id = ? LIMIT 1',
    [teacherId, studentId]
  );
  return !!row;
}

// ═══════════════════════════════════════════════════════
// 메인 라우터
// ═══════════════════════════════════════════════════════
export async function handleTimerSession(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response | null> {
  // GET /api/timer/realtime-today?day=월&date=YYYY-MM-DD
  if (method === 'GET' && pathname === '/api/timer/realtime-today') {
    return handleRealtimeToday(request, context);
  }

  // GET /api/timer/enrollments?studentId=xxx
  if (method === 'GET' && pathname === '/api/timer/enrollments') {
    return handleListEnrollments(request, context);
  }

  // POST /api/timer/enrollments
  if (method === 'POST' && pathname === '/api/timer/enrollments') {
    return handleCreateEnrollment(request, context);
  }

  // DELETE /api/timer/enrollments/:id
  if (method === 'DELETE' && pathname.startsWith('/api/timer/enrollments/')) {
    const id = pathname.split('/').pop()!;
    return handleDeleteEnrollment(id, context);
  }

  // ═══ 임시 수업 (adhoc) ═══
  // GET /api/timer/adhoc?date=YYYY-MM-DD
  if (method === 'GET' && pathname === '/api/timer/adhoc') {
    return handleListAdhoc(request, context);
  }

  // POST /api/timer/adhoc
  if (method === 'POST' && pathname === '/api/timer/adhoc') {
    return handleCreateAdhoc(request, context);
  }

  // DELETE /api/timer/adhoc/:id
  if (method === 'DELETE' && pathname.startsWith('/api/timer/adhoc/')) {
    const id = pathname.split('/').pop()!;
    return handleDeleteAdhoc(id, context);
  }

  // POST /api/timer/sessions/check-in
  if (method === 'POST' && pathname === '/api/timer/sessions/check-in') {
    return handleCheckIn(request, context);
  }

  // POST /api/timer/sessions/:id/pause
  if (method === 'POST' && /^\/api\/timer\/sessions\/[^/]+\/pause$/.test(pathname)) {
    const id = pathname.split('/')[4];
    return handlePause(id, request, context);
  }

  // POST /api/timer/sessions/:id/resume
  if (method === 'POST' && /^\/api\/timer\/sessions\/[^/]+\/resume$/.test(pathname)) {
    const id = pathname.split('/')[4];
    return handleResume(id, context);
  }

  // POST /api/timer/sessions/:id/check-out
  if (method === 'POST' && /^\/api\/timer\/sessions\/[^/]+\/check-out$/.test(pathname)) {
    const id = pathname.split('/')[4];
    return handleCheckOut(id, request, context);
  }

  return null;
}

// ─── GET /api/timer/realtime-today ─────────────────────
// 본인 담당 학생 + 오늘 요일 enrollment + 현재 active/paused 세션 조합
async function handleRealtimeToday(
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const dayParam = url.searchParams.get('day'); // '월' 등
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

  const userId = context.auth!.userId;
  const academyId = context.auth!.academyId;

  // 1) 담당 학생 — INNER JOIN student_teachers (admin 도 본인만)
  const students = await executeQuery<any>(
    context.env.DB,
    `SELECT s.id, s.name, s.grade, s.subjects
       FROM students s
       INNER JOIN student_teachers st ON s.id = st.student_id AND st.teacher_id = ?
      WHERE s.academy_id = ? AND s.status = 'active'
      ORDER BY s.grade DESC, s.name`,
    [userId, academyId]
  );

  const studentIds = students.map((s: any) => s.id);
  if (studentIds.length === 0) {
    return successResponse({ date, day: dayParam, students: [] });
  }

  // 2) 오늘 요일 enrollment
  const placeholders = studentIds.map(() => '?').join(',');
  const enrollmentSql = dayParam
    ? `SELECT id, student_id, day, start_time, end_time, subject
         FROM enrollments
        WHERE student_id IN (${placeholders}) AND day = ?
        ORDER BY start_time`
    : `SELECT id, student_id, day, start_time, end_time, subject
         FROM enrollments
        WHERE student_id IN (${placeholders})
        ORDER BY start_time`;
  const enrollmentParams = dayParam ? [...studentIds, dayParam] : studentIds;
  const enrollments = await executeQuery<any>(context.env.DB, enrollmentSql, enrollmentParams);

  // 학원 전체에 enrollment이 하나라도 있는지 (시간표 설정 여부 판단)
  const allEnrollmentCount = await executeFirst<{ cnt: number }>(
    context.env.DB,
    `SELECT COUNT(*) as cnt FROM enrollments WHERE student_id IN (${placeholders})`,
    studentIds
  );
  const hasAnyEnrollments = (allEnrollmentCount?.cnt || 0) > 0;

  // 3) 오늘 진행 중/완료 세션 (본인이 체크인한 것만)
  const sessions = await executeQuery<SessionRow>(
    context.env.DB,
    `SELECT * FROM realtime_sessions
      WHERE teacher_id = ? AND date = ?`,
    [userId, date]
  );

  // 3-1) 해당 날짜의 임시 수업
  const adhocRows = await executeQuery<any>(
    context.env.DB,
    `SELECT id, student_id, teacher_id, date, start_time, end_time, subject, reason, status
       FROM adhoc_sessions
      WHERE teacher_id = ? AND date = ? AND academy_id = ? AND status = 'scheduled'`,
    [userId, date, academyId]
  );

  // 3-2) 해당 날짜의 예정된 보강 (담당 학생)
  const makeupRows = await executeQuery<any>(
    context.env.DB,
    `SELECT m.id, m.absence_id, m.notes, m.status as makeup_status,
            m.scheduled_start_time, m.scheduled_end_time,
            a.absence_date as original_date, a.class_id, a.student_id,
            c.name as class_name
       FROM makeups m
       JOIN absences a ON m.absence_id = a.id
       JOIN classes c ON a.class_id = c.id
      WHERE m.scheduled_date = ?
        AND m.status IN ('scheduled','completed')
        AND a.student_id IN (${placeholders})
        AND (c.instructor_id = ? OR c.instructor_id IS NULL)`,
    [date, ...studentIds, userId]
  );

  // 4) 조합
  const enrollmentsByStudent = new Map<string, any[]>();
  for (const e of enrollments) {
    if (!enrollmentsByStudent.has(e.student_id)) enrollmentsByStudent.set(e.student_id, []);
    enrollmentsByStudent.get(e.student_id)!.push({
      id: e.id,
      day: e.day,
      startTime: e.start_time,
      endTime: e.end_time,
      subject: e.subject,
    });
  }

  const sessionsByStudent = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    if (!sessionsByStudent.has(s.student_id)) sessionsByStudent.set(s.student_id, []);
    sessionsByStudent.get(s.student_id)!.push(s);
  }

  const adhocsByStudent = new Map<string, any[]>();
  for (const a of adhocRows) {
    if (!adhocsByStudent.has(a.student_id)) adhocsByStudent.set(a.student_id, []);
    adhocsByStudent.get(a.student_id)!.push({
      id: a.id,
      date: a.date,
      startTime: a.start_time,
      endTime: a.end_time,
      subject: a.subject,
      reason: a.reason,
    });
  }

  const makeupsByStudent = new Map<string, any[]>();
  for (const m of makeupRows) {
    if (!makeupsByStudent.has(m.student_id)) makeupsByStudent.set(m.student_id, []);
    makeupsByStudent.get(m.student_id)!.push({
      id: m.id,
      absenceId: m.absence_id,
      originalDate: m.original_date,
      classId: m.class_id,
      className: m.class_name,
      notes: m.notes || '',
      status: m.makeup_status,
      scheduledStartTime: m.scheduled_start_time || null,
      scheduledEndTime: m.scheduled_end_time || null,
    });
  }

  const result: any[] = [];
  for (const s of students) {
    let subjects: string[] = [];
    try {
      subjects = s.subjects ? JSON.parse(s.subjects) : [];
    } catch {
      subjects = [];
    }

    const studentEnrollments = enrollmentsByStudent.get(s.id) || [];
    const studentMakeups = makeupsByStudent.get(s.id) || [];
    const studentAdhocs = adhocsByStudent.get(s.id) || [];
    const studentSessions = (sessionsByStudent.get(s.id) || []).map((row) => ({
      id: row.id,
      status: row.status,
      checkInTime: row.check_in_time,
      checkOutTime: row.check_out_time,
      scheduledMinutes: row.scheduled_minutes,
      addedMinutes: row.added_minutes,
      scheduledStartTime: row.scheduled_start_time,
      scheduledEndTime: row.scheduled_end_time,
      pauseHistory: safeJsonParse<PauseRecord[]>(row.pause_history, []),
      subject: row.subject,
      makeupId: (row as any).makeup_id || null,
    }));

    const activeSession = studentSessions.find(
      (s) => s.status === 'active' || s.status === 'paused' || s.status === 'overtime'
    ) || null;
    const completedSession = studentSessions.find((s) => s.status === 'completed') || null;

    // 해당 요일에 수업이 없고 진행/완료 세션도 없고 보강/임시도 없으면 목록에서 제외
    // 단, enrollment이 하나도 없는 학원(시간표 미설정)은 담당 학생 전원 표시
    if (dayParam && hasAnyEnrollments && studentEnrollments.length === 0 && studentMakeups.length === 0 && studentAdhocs.length === 0 && !activeSession && !completedSession) {
      continue;
    }

    result.push({
      id: s.id,
      name: s.name,
      grade: s.grade,
      subjects,
      enrollments: studentEnrollments,
      makeups: studentMakeups,
      adhocs: studentAdhocs,
      activeSession,
      completedSession,
    });
  }

  return successResponse({ date, day: dayParam, students: result });
}

// ─── GET /api/timer/enrollments ────────────────────────
async function handleListEnrollments(
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const url = new URL(request.url);
  const studentId = url.searchParams.get('studentId');
  const userId = context.auth!.userId;

  if (!studentId) {
    return errorResponse('studentId 필요', 400);
  }

  const isAdmin = context.auth!.role === 'admin';
  if (!isAdmin && !(await assertTeacherOwnsStudent(context.env.DB, userId, studentId))) {
    return unauthorizedResponse();
  }

  const rows = await executeQuery<any>(
    context.env.DB,
    `SELECT id, student_id, day, start_time, end_time, subject, created_at, updated_at
       FROM enrollments
      WHERE student_id = ?
      ORDER BY day, start_time`,
    [studentId]
  );

  return successResponse(
    rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      day: r.day,
      startTime: r.start_time,
      endTime: r.end_time,
      subject: r.subject,
    }))
  );
}

// ─── POST /api/timer/enrollments ───────────────────────
async function handleCreateEnrollment(
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  const body = (await request.json()) as {
    studentId?: string;
    day?: string;
    startTime?: string;
    endTime?: string;
    subject?: string;
  };

  if (!body.studentId || !body.day || !body.startTime || !body.endTime) {
    return errorResponse('studentId, day, startTime, endTime 필수', 400);
  }

  const userId = context.auth!.userId;
  const academyId = context.auth!.academyId;
  const isAdmin = context.auth!.role === 'admin';

  // SEC-TIMERSESS-H1: studentId가 본인 학원 소속인지 검증 (admin도 cross-tenant 차단)
  const student = await executeFirst<{ id: string }>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ?',
    [body.studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);

  if (!isAdmin && !(await assertTeacherOwnsStudent(context.env.DB, userId, body.studentId))) {
    return unauthorizedResponse();
  }

  const id = crypto.randomUUID();
  await executeInsert(
    context.env.DB,
    `INSERT INTO enrollments (id, student_id, day, start_time, end_time, subject, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, body.studentId, body.day, body.startTime, body.endTime, body.subject || null]
  );

  return successResponse(
    {
      id,
      studentId: body.studentId,
      day: body.day,
      startTime: body.startTime,
      endTime: body.endTime,
      subject: body.subject || null,
    },
    201
  );
}

// ─── DELETE /api/timer/enrollments/:id ─────────────────
async function handleDeleteEnrollment(
  id: string,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  // SEC-TIMERSESS-H2: enrollment의 student academy 검증 — admin도 cross-tenant 차단
  const row = await executeFirst<{ student_id: string; academy_id: string }>(
    context.env.DB,
    `SELECT e.student_id, s.academy_id
       FROM enrollments e
       LEFT JOIN students s ON s.id = e.student_id
      WHERE e.id = ?`,
    [id]
  );
  if (!row) return notFoundResponse();
  if (row.academy_id && row.academy_id !== context.auth!.academyId) {
    return notFoundResponse();
  }

  const isAdmin = context.auth!.role === 'admin';
  if (!isAdmin && !(await assertTeacherOwnsStudent(context.env.DB, context.auth!.userId, row.student_id))) {
    return unauthorizedResponse();
  }

  await executeUpdate(context.env.DB, 'DELETE FROM enrollments WHERE id = ?', [id]);
  return successResponse({ id, deleted: true });
}

// ─── POST /api/timer/sessions/check-in ─────────────────
async function handleCheckIn(
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  const body = (await request.json()) as {
    studentId?: string;
    enrollmentId?: string;
    makeupId?: string;
    adhocId?: string;
    scheduledStartTime?: string;
    scheduledEndTime?: string;
    subject?: string;
  };

  if (!body.studentId) {
    return errorResponse('studentId 필수', 400);
  }

  const userId = context.auth!.userId;
  const academyId = context.auth!.academyId;
  const isAdmin = context.auth!.role === 'admin';

  if (!isAdmin && !(await assertTeacherOwnsStudent(context.env.DB, userId, body.studentId))) {
    return unauthorizedResponse();
  }

  const today = new Date().toISOString().split('T')[0];

  // 이미 진행 중 세션이 있으면 409
  const existing = await executeFirst<{ id: string; status: string }>(
    context.env.DB,
    `SELECT id, status FROM realtime_sessions
      WHERE student_id = ? AND date = ? AND status IN ('active','paused','overtime')
      LIMIT 1`,
    [body.studentId, today]
  );
  if (existing) {
    return errorResponse('이미 진행 중인 세션이 있습니다', 409);
  }

  // enrollment 에서 시간 복사 (있으면)
  let startTime: string | null = body.scheduledStartTime || null;
  let endTime: string | null = body.scheduledEndTime || null;
  let subject: string | null = body.subject || null;

  if (body.enrollmentId) {
    const e = await executeFirst<any>(
      context.env.DB,
      'SELECT start_time, end_time, subject FROM enrollments WHERE id = ? AND student_id = ?',
      [body.enrollmentId, body.studentId]
    );
    if (e) {
      startTime = e.start_time;
      endTime = e.end_time;
      subject = subject || e.subject;
    }
  }

  // 보강 체크인이면 makeups 의 scheduled_start/end_time 사용
  if (body.makeupId) {
    const m = await executeFirst<any>(
      context.env.DB,
      'SELECT scheduled_start_time, scheduled_end_time FROM makeups WHERE id = ?',
      [body.makeupId]
    );
    if (m && m.scheduled_start_time && m.scheduled_end_time) {
      startTime = m.scheduled_start_time;
      endTime = m.scheduled_end_time;
    }
  }

  // 임시 수업 체크인이면 adhoc_sessions 의 start/end_time 사용
  if (body.adhocId) {
    const a = await executeFirst<any>(
      context.env.DB,
      'SELECT start_time, end_time, subject FROM adhoc_sessions WHERE id = ? AND student_id = ?',
      [body.adhocId, body.studentId]
    );
    if (a) {
      startTime = a.start_time;
      endTime = a.end_time;
      subject = subject || a.subject;
    }
  }

  const scheduledMinutes = calcScheduledMinutes(startTime, endTime);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await executeInsert(
    context.env.DB,
    `INSERT INTO realtime_sessions (
       id, student_id, teacher_id, academy_id, date,
       check_in_time, status, scheduled_minutes, added_minutes,
       scheduled_start_time, scheduled_end_time, pause_history, subject,
       makeup_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 0, ?, ?, '[]', ?, ?, datetime('now'), datetime('now'))`,
    [id, body.studentId, userId, academyId, today, now, scheduledMinutes, startTime, endTime, subject, body.makeupId || null]
  );

  logger.logRequest('POST', '/api/timer/sessions/check-in', userId);

  return successResponse(
    {
      id,
      studentId: body.studentId,
      checkInTime: now,
      status: 'active',
      scheduledMinutes,
      addedMinutes: 0,
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      pauseHistory: [],
      subject,
      makeupId: body.makeupId || null,
    },
    201
  );
}

// ─── POST /api/timer/sessions/:id/pause ────────────────
async function handlePause(
  id: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as { reason?: string };

  const session = await executeFirst<SessionRow>(
    context.env.DB,
    'SELECT * FROM realtime_sessions WHERE id = ? AND teacher_id = ?',
    [id, context.auth!.userId]
  );
  if (!session) return notFoundResponse();
  if (session.status !== 'active') {
    return errorResponse('진행 중인 세션만 일시정지할 수 있습니다', 400);
  }

  const history: PauseRecord[] = safeJsonParse<PauseRecord[]>(session.pause_history, []);
  history.push({ pausedAt: new Date().toISOString(), reason: body.reason });

  await executeUpdate(
    context.env.DB,
    `UPDATE realtime_sessions
        SET status = 'paused', pause_history = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [JSON.stringify(history), id]
  );

  return successResponse({ id, status: 'paused', pauseHistory: history });
}

// ─── POST /api/timer/sessions/:id/resume ───────────────
async function handleResume(id: string, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  const session = await executeFirst<SessionRow>(
    context.env.DB,
    'SELECT * FROM realtime_sessions WHERE id = ? AND teacher_id = ?',
    [id, context.auth!.userId]
  );
  if (!session) return notFoundResponse();
  if (session.status !== 'paused') {
    return errorResponse('정지된 세션만 재개할 수 있습니다', 400);
  }

  const history: PauseRecord[] = safeJsonParse<PauseRecord[]>(session.pause_history, []);
  const last = history[history.length - 1];
  if (last && !last.resumedAt) {
    last.resumedAt = new Date().toISOString();
  }

  await executeUpdate(
    context.env.DB,
    `UPDATE realtime_sessions
        SET status = 'active', pause_history = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [JSON.stringify(history), id]
  );

  return successResponse({ id, status: 'active', pauseHistory: history });
}

// ─── POST /api/timer/sessions/:id/check-out ────────────
async function handleCheckOut(
  id: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as { note?: string };

  const session = await executeFirst<SessionRow>(
    context.env.DB,
    'SELECT * FROM realtime_sessions WHERE id = ? AND teacher_id = ?',
    [id, context.auth!.userId]
  );
  if (!session) return notFoundResponse();
  if (session.status === 'completed') {
    return errorResponse('이미 완료된 세션입니다', 400);
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 정지 중이었으면 마지막 pause 종료
  const history: PauseRecord[] = safeJsonParse<PauseRecord[]>(session.pause_history, []);
  if (session.status === 'paused') {
    const last = history[history.length - 1];
    if (last && !last.resumedAt) last.resumedAt = nowIso;
  }

  const pausedMins = calcPausedMinutes(history, now);
  const totalElapsed = Math.floor(
    (now.getTime() - new Date(session.check_in_time).getTime()) / 1000 / 60
  );
  const netMinutes = Math.max(totalElapsed - pausedMins, 0);
  const wasOvertime = netMinutes > session.scheduled_minutes;

  // 학생 이름 (감사 기록용)
  // realtime_sessions.status = 'completed', check_out_time = now
  await executeUpdate(
    context.env.DB,
    `UPDATE realtime_sessions
        SET status = 'completed',
            check_out_time = ?,
            pause_history = ?,
            updated_at = datetime('now')
      WHERE id = ?`,
    [nowIso, JSON.stringify(history), id]
  );

  // attendance_records 생성
  const recordId = crypto.randomUUID();
  await executeInsert(
    context.env.DB,
    `INSERT INTO attendance_records (
       id, session_id, student_id, teacher_id, academy_id, date,
       check_in_time, check_out_time,
       scheduled_start_time, scheduled_end_time,
       scheduled_minutes, net_minutes, total_paused_minutes, pause_count,
       pause_history, subject, was_late, was_overtime, note, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`,
    [
      recordId,
      session.id,
      session.student_id,
      session.teacher_id,
      context.auth!.academyId,
      session.date,
      session.check_in_time,
      nowIso,
      session.scheduled_start_time,
      session.scheduled_end_time,
      session.scheduled_minutes,
      netMinutes,
      pausedMins,
      history.length,
      JSON.stringify(history),
      session.subject,
      wasOvertime ? 1 : 0,
      body.note || null,
    ]
  );

  // 보강 세션이면 makeups/absences 자동 완료 처리
  const makeupId = (session as any).makeup_id as string | null;
  if (makeupId) {
    const today = session.date;
    await executeUpdate(
      context.env.DB,
      `UPDATE makeups SET status = 'completed', completed_date = ?, updated_at = datetime('now') WHERE id = ?`,
      [today, makeupId]
    );
    const mk = await executeFirst<{ absence_id: string }>(
      context.env.DB,
      'SELECT absence_id FROM makeups WHERE id = ?',
      [makeupId]
    );
    if (mk) {
      await executeUpdate(
        context.env.DB,
        `UPDATE absences SET status = 'makeup_done' WHERE id = ?`,
        [mk.absence_id]
      );
    }
  }

  logger.logRequest('POST', '/api/timer/sessions/check-out', context.auth!.userId);

  return successResponse({
    id,
    recordId,
    status: 'completed',
    checkOutTime: nowIso,
    netMinutes,
    totalPausedMinutes: pausedMins,
    pauseCount: history.length,
    wasOvertime,
    makeupCompleted: !!makeupId,
  });
}

// ═══════════════════════════════════════════════════════
// 임시 수업 (adhoc_sessions) CRUD
// ═══════════════════════════════════════════════════════

async function handleListAdhoc(
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date) return errorResponse('date 필요 (YYYY-MM-DD)', 400);

  const userId = context.auth!.userId;
  const academyId = context.auth!.academyId;

  const rows = await executeQuery<any>(
    context.env.DB,
    `SELECT a.*, s.name as student_name, s.grade as student_grade
       FROM adhoc_sessions a
       JOIN students s ON s.id = a.student_id
      WHERE a.teacher_id = ? AND a.date = ? AND a.academy_id = ?
      ORDER BY a.start_time`,
    [userId, date, academyId]
  );

  return successResponse(rows.map(r => ({
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    studentGrade: r.student_grade,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    subject: r.subject,
    reason: r.reason,
    status: r.status,
  })));
}

async function handleCreateAdhoc(
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  const body = (await request.json()) as {
    studentId?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    subject?: string;
    reason?: string;
  };

  if (!body.studentId || !body.date || !body.startTime || !body.endTime) {
    return errorResponse('studentId, date, startTime, endTime 필수', 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return errorResponse('date는 YYYY-MM-DD 형식이어야 합니다', 400);
  }

  const userId = context.auth!.userId;
  const academyId = context.auth!.academyId;

  // 학생 존재 확인 (같은 학원)
  const student = await executeFirst<{ id: string }>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ? AND status = ?',
    [body.studentId, academyId, 'active']
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);

  const id = crypto.randomUUID();
  await executeInsert(
    context.env.DB,
    `INSERT INTO adhoc_sessions (id, student_id, teacher_id, academy_id, date, start_time, end_time, subject, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', datetime('now'))`,
    [id, body.studentId, userId, academyId, body.date, body.startTime, body.endTime, body.subject || null, body.reason || null]
  );

  logger.logRequest('POST', '/api/timer/adhoc', userId);

  return successResponse({
    id,
    studentId: body.studentId,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    subject: body.subject || null,
    reason: body.reason || null,
    status: 'scheduled',
  }, 201);
}

async function handleDeleteAdhoc(
  id: string,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  const row = await executeFirst<{ id: string; teacher_id: string }>(
    context.env.DB,
    'SELECT id, teacher_id FROM adhoc_sessions WHERE id = ? AND academy_id = ?',
    [id, context.auth!.academyId]
  );
  if (!row) return notFoundResponse();

  if (row.teacher_id !== context.auth!.userId && context.auth!.role !== 'admin') {
    return unauthorizedResponse();
  }

  await executeUpdate(
    context.env.DB,
    `UPDATE adhoc_sessions SET status = 'cancelled' WHERE id = ?`,
    [id]
  );

  return successResponse({ id, deleted: true });
}
