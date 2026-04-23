/**
 * 시험 결시 학생 개별 타이머 핸들러
 * 설계 문서: docs/EXAM_MAKEUP_TIMER_DESIGN.md §3
 *
 * 두 종류의 라우트를 한 핸들러에서 처리:
 *  - /api/exam-attempts/...        : 교사 JWT 인증 (instructor/admin)
 *  - /api/play/exam-attempts/...   : 학생 PIN 토큰 인증 (본인 attempt만)
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse, forbiddenResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { generatePrefixedId } from '@/utils/id';
import { handleRouteError } from '@/utils/error-handler';
import { logger } from '@/utils/logger';

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
interface ExamAttemptRow {
  id: string;
  exam_assignment_id: string;
  student_id: string;
  academy_id: string;
  realtime_session_id: string | null;
  duration_minutes: number;
  status: 'ready' | 'running' | 'paused' | 'submitted' | 'expired' | 'voided';
  started_at: string | null;
  ended_at: string | null;
  pause_history: string;
  total_paused_seconds: number;
  proctor_user_id: string | null;
  submit_note: string | null;
  created_at: string;
  updated_at: string;
}

interface PauseEvent {
  pausedAt: string;
  resumedAt?: string;
  reason?: string;
  byUserId?: string;
}

interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

// ─────────────────────────────────────────────
// 학생 PIN 토큰 인증 (gacha-play-handler 와 동일 KV 형식)
// ─────────────────────────────────────────────
async function getPlayAuth(context: RequestContext): Promise<PlayAuth | null> {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const data = await context.env.KV.get(`play:${token}`, 'json') as PlayAuth | null;
  return data;
}

// ─────────────────────────────────────────────
// 시간 계산 유틸
// ─────────────────────────────────────────────
function nowIso(): string {
  return new Date().toISOString();
}

function calcRemainingSeconds(row: ExamAttemptRow, nowMs: number = Date.now()): number {
  if (row.status === 'submitted' || row.status === 'expired' || row.status === 'voided') return 0;
  if (!row.started_at) return row.duration_minutes * 60;

  const startedMs = new Date(row.started_at).getTime();
  const totalAllowedSec = row.duration_minutes * 60 + (row.total_paused_seconds || 0);

  if (row.status === 'paused') {
    // 마지막 pausedAt 기준으로 계산 (정지 시점에 시계 멈춤)
    const history = safeParseHistory(row.pause_history);
    const last = history[history.length - 1];
    if (last && !last.resumedAt) {
      const pausedAtMs = new Date(last.pausedAt).getTime();
      const elapsed = Math.floor((pausedAtMs - startedMs) / 1000);
      return Math.max(0, totalAllowedSec - elapsed);
    }
  }

  const elapsed = Math.floor((nowMs - startedMs) / 1000);
  return Math.max(0, totalAllowedSec - elapsed);
}

function calcDeadlineIso(row: ExamAttemptRow): string | null {
  if (!row.started_at) return null;
  const startedMs = new Date(row.started_at).getTime();
  const totalAllowedSec = row.duration_minutes * 60 + (row.total_paused_seconds || 0);
  return new Date(startedMs + totalAllowedSec * 1000).toISOString();
}

function safeParseHistory(json: string | null): PauseEvent[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shapeAttempt(row: ExamAttemptRow, extras: Record<string, any> = {}) {
  const remainingSeconds = calcRemainingSeconds(row);
  return {
    id: row.id,
    examAssignmentId: row.exam_assignment_id,
    studentId: row.student_id,
    durationMinutes: row.duration_minutes,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    deadlineAt: calcDeadlineIso(row),
    pausedSeconds: row.total_paused_seconds || 0,
    isPaused: row.status === 'paused',
    remainingSeconds,
    pauseHistory: safeParseHistory(row.pause_history),
    proctorUserId: row.proctor_user_id,
    submitNote: row.submit_note,
    ...extras,
  };
}

// ─────────────────────────────────────────────
// 교사 권한 헬퍼: assignment 가 본인 학원 + 본인(또는 admin) 담당인지
// admin 도 본인 담당 학생만 처리 (feedback memory 참조)
// ─────────────────────────────────────────────
async function loadAssignmentForTeacher(
  context: RequestContext,
  assignmentId: string
): Promise<{ id: string; student_id: string; academy_id: string } | null> {
  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  return executeFirst<{ id: string; student_id: string; academy_id: string }>(
    context.env.DB,
    `SELECT a.id, a.student_id, a.academy_id
       FROM exam_assignments a
       JOIN student_teachers st ON st.student_id = a.student_id
      WHERE a.id = ? AND a.academy_id = ? AND st.teacher_id = ?`,
    [assignmentId, academyId, userId]
  );
}

async function loadAttemptForTeacher(
  context: RequestContext,
  attemptId: string
): Promise<ExamAttemptRow | null> {
  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  return executeFirst<ExamAttemptRow>(
    context.env.DB,
    `SELECT ea.* FROM exam_attempts ea
       JOIN student_teachers st ON st.student_id = ea.student_id
      WHERE ea.id = ? AND ea.academy_id = ? AND st.teacher_id = ?`,
    [attemptId, academyId, userId]
  );
}

// ─────────────────────────────────────────────
// 핵심 액션 (재사용)
// ─────────────────────────────────────────────

async function actionSubmit(
  context: RequestContext,
  row: ExamAttemptRow,
  note: string | null
): Promise<ExamAttemptRow> {
  const now = nowIso();
  await executeUpdate(
    context.env.DB,
    `UPDATE exam_attempts
        SET status='submitted', ended_at=?, submit_note=?, updated_at=?
      WHERE id=?`,
    [now, note, now, row.id]
  );
  // exam_assignments.exam_status='completed' 동기화
  await executeUpdate(
    context.env.DB,
    `UPDATE exam_assignments SET exam_status='completed' WHERE id=?`,
    [row.exam_assignment_id]
  );
  const fresh = await executeFirst<ExamAttemptRow>(
    context.env.DB,
    `SELECT * FROM exam_attempts WHERE id=?`,
    [row.id]
  );
  return fresh!;
}

// ─────────────────────────────────────────────
// 교사 라우트: /api/exam-attempts/*
// ─────────────────────────────────────────────

async function handleTeacherRoutes(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  if (!requireRole(context, 'instructor', 'admin')) return forbiddenResponse();

  const db = context.env.DB;
  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  const isAdmin = context.auth!.role === 'admin';

  // POST /api/exam-attempts — 시작
  if (method === 'POST' && pathname === '/api/exam-attempts') {
    const body = await request.json() as any;
    const { examAssignmentId, durationMinutes, realtimeSessionId } = body || {};
    if (!examAssignmentId || !durationMinutes) {
      return errorResponse('examAssignmentId, durationMinutes 필수', 400);
    }
    const dur = parseInt(String(durationMinutes), 10);
    if (!Number.isFinite(dur) || dur <= 0 || dur > 600) {
      return errorResponse('durationMinutes 는 1~600 사이여야 합니다', 400);
    }

    const assign = await loadAssignmentForTeacher(context, examAssignmentId);
    if (!assign) return errorResponse('담당 학생의 시험 배정이 아닙니다', 403);

    // 중복 attempt 방지 (UNIQUE 제약과 함께 안전장치)
    const existing = await executeFirst<ExamAttemptRow>(
      db,
      `SELECT * FROM exam_attempts WHERE exam_assignment_id = ?`,
      [examAssignmentId]
    );
    if (existing) {
      return errorResponse('이미 시험 attempt 가 존재합니다', 409);
    }

    const id = generatePrefixedId('eatt');
    const now = nowIso();
    await executeInsert(
      db,
      `INSERT INTO exam_attempts
         (id, exam_assignment_id, student_id, academy_id, realtime_session_id,
          duration_minutes, status, started_at, pause_history, total_paused_seconds,
          proctor_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'running', ?, '[]', 0, ?, ?, ?)`,
      [id, examAssignmentId, assign.student_id, academyId, realtimeSessionId || null,
        dur, now, userId, now, now]
    );

    const fresh = await executeFirst<ExamAttemptRow>(db, `SELECT * FROM exam_attempts WHERE id=?`, [id]);
    return successResponse(shapeAttempt(fresh!), 201);
  }

  // POST /api/exam-attempts/:id/pause
  const pauseMatch = pathname.match(/^\/api\/exam-attempts\/([^/]+)\/pause$/);
  if (method === 'POST' && pauseMatch) {
    const id = pauseMatch[1];
    const body = await request.json().catch(() => ({})) as any;
    const reason = (body?.reason || '').toString().trim();
    if (!reason) return errorResponse('reason 필수', 400);

    const row = await loadAttemptForTeacher(context, id);
    if (!row) return notFoundResponse();
    if (row.status !== 'running') {
      return errorResponse(`현재 상태(${row.status})에서는 일시정지할 수 없습니다`, 409);
    }

    const history = safeParseHistory(row.pause_history);
    history.push({ pausedAt: nowIso(), reason, byUserId: userId });

    const now = nowIso();
    await executeUpdate(
      db,
      `UPDATE exam_attempts SET status='paused', pause_history=?, updated_at=? WHERE id=?`,
      [JSON.stringify(history), now, id]
    );
    const fresh = await executeFirst<ExamAttemptRow>(db, `SELECT * FROM exam_attempts WHERE id=?`, [id]);
    return successResponse(shapeAttempt(fresh!));
  }

  // POST /api/exam-attempts/:id/resume
  const resumeMatch = pathname.match(/^\/api\/exam-attempts\/([^/]+)\/resume$/);
  if (method === 'POST' && resumeMatch) {
    const id = resumeMatch[1];
    const row = await loadAttemptForTeacher(context, id);
    if (!row) return notFoundResponse();
    if (row.status !== 'paused') {
      return errorResponse(`현재 상태(${row.status})에서는 재개할 수 없습니다`, 409);
    }

    const history = safeParseHistory(row.pause_history);
    const last = history[history.length - 1];
    if (!last || last.resumedAt) {
      return errorResponse('일시정지 이벤트를 찾을 수 없습니다', 500);
    }
    const now = nowIso();
    last.resumedAt = now;

    const pausedAtMs = new Date(last.pausedAt).getTime();
    const addedPaused = Math.max(0, Math.floor((Date.now() - pausedAtMs) / 1000));
    const newTotalPaused = (row.total_paused_seconds || 0) + addedPaused;

    await executeUpdate(
      db,
      `UPDATE exam_attempts
          SET status='running', pause_history=?, total_paused_seconds=?, updated_at=?
        WHERE id=?`,
      [JSON.stringify(history), newTotalPaused, now, id]
    );
    const fresh = await executeFirst<ExamAttemptRow>(db, `SELECT * FROM exam_attempts WHERE id=?`, [id]);
    return successResponse(shapeAttempt(fresh!));
  }

  // POST /api/exam-attempts/:id/submit (교사 경로)
  const submitMatch = pathname.match(/^\/api\/exam-attempts\/([^/]+)\/submit$/);
  if (method === 'POST' && submitMatch) {
    const id = submitMatch[1];
    const body = await request.json().catch(() => ({})) as any;
    const note = body?.note ? String(body.note) : null;

    const row = await loadAttemptForTeacher(context, id);
    if (!row) return notFoundResponse();
    if (!['running', 'paused', 'ready'].includes(row.status)) {
      return errorResponse(`현재 상태(${row.status})에서는 제출할 수 없습니다`, 409);
    }
    const fresh = await actionSubmit(context, row, note);
    return successResponse(shapeAttempt(fresh));
  }

  // POST /api/exam-attempts/:id/void — admin only
  const voidMatch = pathname.match(/^\/api\/exam-attempts\/([^/]+)\/void$/);
  if (method === 'POST' && voidMatch) {
    if (!isAdmin) return forbiddenResponse();
    const id = voidMatch[1];

    // admin 도 본인 담당만? 무효처리는 admin 권한만으로 학원 전체 허용 (운영상 필요)
    const row = await executeFirst<ExamAttemptRow>(
      db,
      `SELECT * FROM exam_attempts WHERE id=? AND academy_id=?`,
      [id, academyId]
    );
    if (!row) return notFoundResponse();

    const now = nowIso();
    await executeUpdate(
      db,
      `UPDATE exam_attempts SET status='voided', ended_at=?, updated_at=? WHERE id=?`,
      [now, now, id]
    );
    const fresh = await executeFirst<ExamAttemptRow>(db, `SELECT * FROM exam_attempts WHERE id=?`, [id]);
    return successResponse(shapeAttempt(fresh!));
  }

  // GET /api/exam-attempts/today
  if (method === 'GET' && pathname === '/api/exam-attempts/today') {
    const today = new Date().toISOString().split('T')[0];

    // 1) 본인 담당 학생의 오늘 attempt (오늘 생성/시작/종료된 것)
    const attempts = await executeQuery<ExamAttemptRow & { student_name: string; paper_title: string | null }>(
      db,
      `SELECT ea.*, s.name AS student_name, ep.title AS period_title, epaper.title AS paper_title
         FROM exam_attempts ea
         JOIN student_teachers st ON st.student_id = ea.student_id
         JOIN students s ON s.id = ea.student_id
         JOIN exam_assignments asg ON asg.id = ea.exam_assignment_id
         LEFT JOIN exam_periods ep ON ep.id = asg.exam_period_id
         LEFT JOIN exam_papers epaper ON epaper.id = asg.exam_paper_id
        WHERE ea.academy_id = ?
          AND st.teacher_id = ?
          AND (date(ea.created_at) = ? OR date(ea.started_at) = ? OR ea.status IN ('running','paused'))
        ORDER BY ea.created_at DESC`,
      [academyId, userId, today, today]
    );

    // 2) 결시(absent/rescheduled) 시험 배정 — 아직 attempt 없는 것
    const pendingAssignments = await executeQuery<any>(
      db,
      `SELECT a.id AS assignment_id, a.student_id, a.exam_status, a.absence_reason,
              a.rescheduled_date, a.exam_period_id, a.exam_paper_id,
              s.name AS student_name, s.grade AS student_grade,
              ep.title AS period_title, epaper.title AS paper_title
         FROM exam_assignments a
         JOIN student_teachers st ON st.student_id = a.student_id
         JOIN students s ON s.id = a.student_id
         LEFT JOIN exam_periods ep ON ep.id = a.exam_period_id
         LEFT JOIN exam_papers epaper ON epaper.id = a.exam_paper_id
        WHERE a.academy_id = ?
          AND st.teacher_id = ?
          AND a.exam_status IN ('absent', 'rescheduled')
          AND NOT EXISTS (SELECT 1 FROM exam_attempts ea WHERE ea.exam_assignment_id = a.id)
        ORDER BY s.grade, s.name`,
      [academyId, userId]
    );

    return successResponse({
      attempts: attempts.map(a => shapeAttempt(a as any, {
        studentName: (a as any).student_name,
        periodTitle: (a as any).period_title,
        paperTitle: (a as any).paper_title,
      })),
      pendingAssignments,
    });
  }

  // GET /api/exam-attempts/by-period/:periodId — 기간 내 모든 attempt (점수 포함)
  const byPeriodMatch = pathname.match(/^\/api\/exam-attempts\/by-period\/([^/]+)$/);
  if (method === 'GET' && byPeriodMatch) {
    const periodId = byPeriodMatch[1];
    const rows = await executeQuery<any>(
      db,
      `SELECT ea.id, ea.exam_assignment_id, ea.student_id, ea.status,
              ea.auto_score, ea.auto_correct, ea.auto_total,
              ea.started_at, ea.ended_at, ea.submit_note,
              COALESCE(s.name, gs.name) AS student_name
         FROM exam_attempts ea
         JOIN exam_assignments asg ON asg.id = ea.exam_assignment_id
         LEFT JOIN students s ON s.id = ea.student_id
         LEFT JOIN gacha_students gs ON gs.id = ea.student_id
        WHERE asg.exam_period_id = ? AND ea.academy_id = ?`,
      [periodId, academyId]
    );
    return successResponse(rows);
  }

  // GET /api/exam-attempts/:id/detail — 문항별 채점 breakdown
  const detailMatch = pathname.match(/^\/api\/exam-attempts\/([^/]+)\/detail$/);
  if (method === 'GET' && detailMatch) {
    const id = detailMatch[1];
    // 학원 단위 권한. student_teachers 조인이 필요하면 기간별 필터로 별도 제한.
    const attempt = await executeFirst<any>(
      db,
      `SELECT ea.*,
              COALESCE(s.name, gs.name) AS student_name,
              asg.exam_paper_id,
              ep.title AS paper_title
         FROM exam_attempts ea
         LEFT JOIN students s       ON s.id  = ea.student_id
         LEFT JOIN gacha_students gs ON gs.id = ea.student_id
         JOIN exam_assignments asg ON asg.id = ea.exam_assignment_id
         LEFT JOIN exam_papers ep ON ep.id = asg.exam_paper_id
        WHERE ea.id = ? AND ea.academy_id = ?`,
      [id, academyId]
    );
    if (!attempt) return notFoundResponse();

    const questions = await executeQuery<any>(
      db,
      `SELECT id, question_no, prompt, choices, correct_choice, points
         FROM exam_questions WHERE exam_paper_id = ?
         ORDER BY question_no`,
      [attempt.exam_paper_id]
    );
    const answers = await executeQuery<any>(
      db,
      `SELECT question_no, selected_choice, saved_at
         FROM exam_answers WHERE attempt_id = ?
         ORDER BY question_no`,
      [id]
    );
    const byNo = new Map(answers.map(a => [a.question_no, a]));

    const breakdown = questions.map((q: any) => {
      let choices: string[] = [];
      try { choices = JSON.parse(q.choices); } catch {}
      const ans = byNo.get(q.question_no);
      return {
        questionNo: q.question_no,
        prompt: q.prompt,
        choices,
        correctChoice: q.correct_choice,
        points: q.points,
        selectedChoice: ans?.selected_choice ?? null,
        savedAt: ans?.saved_at ?? null,
        correct: ans?.selected_choice === q.correct_choice,
      };
    });

    return successResponse({
      id: attempt.id,
      studentName: attempt.student_name,
      paperTitle: attempt.paper_title,
      status: attempt.status,
      startedAt: attempt.started_at,
      endedAt: attempt.ended_at,
      durationMinutes: attempt.duration_minutes,
      score: attempt.auto_score,
      correct: attempt.auto_correct,
      total: attempt.auto_total,
      submitNote: attempt.submit_note,
      breakdown,
    });
  }

  // GET /api/exam-attempts/:id — 단건 (교사)
  const getMatch = pathname.match(/^\/api\/exam-attempts\/([^/]+)$/);
  if (method === 'GET' && getMatch) {
    const id = getMatch[1];
    const row = await executeFirst<ExamAttemptRow & { student_name?: string }>(
      db,
      `SELECT ea.*, s.name AS student_name
         FROM exam_attempts ea
         JOIN student_teachers st ON st.student_id = ea.student_id
         JOIN students s ON s.id = ea.student_id
        WHERE ea.id = ? AND ea.academy_id = ? AND st.teacher_id = ?`,
      [id, academyId, userId]
    );
    if (!row) return notFoundResponse();
    return successResponse(shapeAttempt(row, { studentName: (row as any).student_name }));
  }

  return errorResponse('Not found', 404);
}

// ─────────────────────────────────────────────
// 학생 라우트: /api/play/exam-attempts/*
// ─────────────────────────────────────────────

async function handlePlayRoutes(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  const auth = await getPlayAuth(context);
  if (!auth) return unauthorizedResponse();

  const db = context.env.DB;

  // 학생용 활성 attempt 조회 (HomePage 폴링용 — 자동 진입)
  // NOTE: `/:id` 패턴보다 먼저 매칭해야 함 (그렇지 않으면 id='active'로 잡혀 404)
  if (method === 'GET' && pathname === '/api/play/exam-attempts/active') {
    const activeRow = await executeFirst<ExamAttemptRow>(
      db,
      `SELECT * FROM exam_attempts
        WHERE student_id = ? AND academy_id = ? AND status IN ('running','paused')
        ORDER BY started_at DESC LIMIT 1`,
      [auth.studentId, auth.academyId]
    );
    if (!activeRow) return successResponse({ active: null });
    return successResponse({
      active: {
        id: activeRow.id,
        status: activeRow.status,
        durationMinutes: activeRow.duration_minutes,
        remainingSeconds: calcRemainingSeconds(activeRow),
        isPaused: activeRow.status === 'paused',
        startedAt: activeRow.started_at,
        deadlineAt: calcDeadlineIso(activeRow),
      },
    });
  }

  // 학생용 단건 조회 (본인 attempt 만)
  const getMatch = pathname.match(/^\/api\/play\/exam-attempts\/([^/]+)$/);
  if (method === 'GET' && getMatch) {
    const id = getMatch[1];
    const row = await executeFirst<ExamAttemptRow>(
      db,
      `SELECT * FROM exam_attempts WHERE id = ? AND student_id = ? AND academy_id = ?`,
      [id, auth.studentId, auth.academyId]
    );
    if (!row) return notFoundResponse();

    // 학생 응답은 최소 필드만
    return successResponse({
      id: row.id,
      status: row.status,
      durationMinutes: row.duration_minutes,
      remainingSeconds: calcRemainingSeconds(row),
      isPaused: row.status === 'paused',
      startedAt: row.started_at,
      endedAt: row.ended_at,
      deadlineAt: calcDeadlineIso(row),
      studentName: auth.name,
    });
  }

  // 학생 본인 제출
  const submitMatch = pathname.match(/^\/api\/play\/exam-attempts\/([^/]+)\/submit$/);
  if (method === 'POST' && submitMatch) {
    const id = submitMatch[1];
    const body = await request.json().catch(() => ({})) as any;
    const note = body?.note ? String(body.note) : null;

    const row = await executeFirst<ExamAttemptRow>(
      db,
      `SELECT * FROM exam_attempts WHERE id = ? AND student_id = ? AND academy_id = ?`,
      [id, auth.studentId, auth.academyId]
    );
    if (!row) return notFoundResponse();
    if (!['running', 'paused', 'ready'].includes(row.status)) {
      return errorResponse(`현재 상태(${row.status})에서는 제출할 수 없습니다`, 409);
    }

    const fresh = await actionSubmit(context, row, note);
    logger.logSecurity('EXAM_ATTEMPT_SUBMIT_BY_STUDENT', 'low', { attemptId: id, studentId: auth.studentId });
    return successResponse({
      id: fresh.id,
      status: fresh.status,
      endedAt: fresh.ended_at,
      remainingSeconds: 0,
    });
  }

  return errorResponse('Not found', 404);
}

// ─────────────────────────────────────────────
// 외부에 노출되는 메인 엔트리
// ─────────────────────────────────────────────

export async function handleExamAttempt(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (pathname.startsWith('/api/play/exam-attempts')) {
      return await handlePlayRoutes(method, pathname, request, context);
    }
    if (pathname.startsWith('/api/exam-attempts')) {
      return await handleTeacherRoutes(method, pathname, request, context);
    }
    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, '시험 attempt 처리');
  }
}
