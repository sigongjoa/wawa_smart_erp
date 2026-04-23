/**
 * 학생 앱 시험 응시 (영어 전용 MVP) — PIN 토큰
 *
 * 경로:
 *   GET  /api/play/exams                           — 오늘 열린 영어 시험 목록
 *   POST /api/play/exams/:assignmentId/start       — 응시 시작
 *   GET  /api/play/attempts/:id                    — 문제 + 내가 지금까지 찍은 답
 *   PUT  /api/play/attempts/:id/answer             — 답 저장 (upsert)
 *   POST /api/play/attempts/:id/submit             — 제출 + 자동 채점
 */
import { RequestContext } from '@/types';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';

interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

async function getPlayAuth(context: RequestContext): Promise<PlayAuth | null> {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return (await context.env.KV.get(`play:${token}`, 'json')) as PlayAuth | null;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── 1) 오늘 열린 영어 시험 목록 ──
async function handleListExams(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const today = todayYmd();
  // 본인 배정 AND 과목=영어 AND (exam_date is null OR exam_date <= today) AND exam_status in (scheduled, in_progress)
  const rows = await executeQuery<any>(
    context.env.DB,
    `SELECT ea.id AS assignmentId,
            ep.id AS paperId, ep.title, ep.subject, ep.duration_minutes,
            ea.exam_date, ea.exam_status,
            (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_paper_id = ep.id) AS question_count,
            (SELECT id FROM exam_attempts at WHERE at.exam_assignment_id = ea.id LIMIT 1) AS attempt_id,
            (SELECT status FROM exam_attempts at WHERE at.exam_assignment_id = ea.id LIMIT 1) AS attempt_status
       FROM exam_assignments ea
       JOIN exam_papers ep ON ep.id = ea.exam_paper_id
      WHERE ea.student_id = ? AND ea.academy_id = ?
        AND ep.subject = 'english'
        AND (ea.exam_date IS NULL OR ea.exam_date <= ?)
        AND ea.exam_status IN ('scheduled', 'in_progress')
      ORDER BY ea.exam_date DESC, ep.title`,
    [auth.studentId, auth.academyId, today]
  );
  return successResponse(
    rows.map(r => ({
      assignmentId: r.assignmentId,
      paperId: r.paperId,
      title: r.title,
      durationMinutes: r.duration_minutes ?? 50,
      examDate: r.exam_date,
      examStatus: r.exam_status,
      questionCount: r.question_count ?? 0,
      attemptId: r.attempt_id ?? null,
      attemptStatus: r.attempt_status ?? null,
    }))
  );
}

// ── 2) 응시 시작 ──
async function handleStart(
  assignmentId: string,
  context: RequestContext,
  auth: PlayAuth
): Promise<Response> {
  const db = context.env.DB;
  const assign = await executeFirst<any>(
    db,
    `SELECT ea.id, ea.exam_paper_id, ea.exam_status, ep.subject, ep.duration_minutes,
            (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_paper_id = ep.id) AS question_count
       FROM exam_assignments ea
       JOIN exam_papers ep ON ep.id = ea.exam_paper_id
      WHERE ea.id = ? AND ea.student_id = ? AND ea.academy_id = ?`,
    [assignmentId, auth.studentId, auth.academyId]
  );
  if (!assign) return notFoundResponse();
  if (assign.subject !== 'english') return errorResponse('영어 시험만 응시 가능합니다', 400);
  if (Number(assign.question_count ?? 0) === 0) {
    return errorResponse('아직 문제가 등록되지 않았습니다', 409);
  }
  if (!['scheduled', 'in_progress'].includes(assign.exam_status)) {
    return errorResponse(`응시할 수 없는 상태입니다 (${assign.exam_status})`, 409);
  }

  // 기존 attempt가 있으면 그걸 반환 (멱등)
  const existing = await executeFirst<any>(
    db,
    `SELECT * FROM exam_attempts WHERE exam_assignment_id = ?`,
    [assignmentId]
  );
  if (existing) {
    if (['submitted', 'expired', 'voided'].includes(existing.status)) {
      return errorResponse('이미 종료된 시험입니다', 409);
    }
    return successResponse({
      id: existing.id,
      status: existing.status,
      durationMinutes: existing.duration_minutes,
      startedAt: existing.started_at,
    });
  }

  const id = generatePrefixedId('ea');
  const now = new Date().toISOString();
  const duration = Number(assign.duration_minutes ?? 50);
  await executeInsert(
    db,
    `INSERT INTO exam_attempts
       (id, exam_assignment_id, student_id, academy_id, duration_minutes, status, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)`,
    [id, assignmentId, auth.studentId, auth.academyId, duration, now, now, now]
  );
  await executeUpdate(
    db,
    `UPDATE exam_assignments SET exam_status='in_progress' WHERE id=?`,
    [assignmentId]
  );
  return successResponse({
    id,
    status: 'running',
    durationMinutes: duration,
    startedAt: now,
  }, 201);
}

function calcRemainingSeconds(row: any, nowMs: number = Date.now()): number {
  if (['submitted', 'expired', 'voided'].includes(row.status)) return 0;
  if (!row.started_at) return row.duration_minutes * 60;
  const startedMs = new Date(row.started_at).getTime();
  const total = row.duration_minutes * 60 + (row.total_paused_seconds || 0);
  const elapsed = Math.floor((nowMs - startedMs) / 1000);
  return Math.max(0, total - elapsed);
}

// ── 3) 문제 + 내 답 ──
async function handleGetAttempt(
  attemptId: string,
  context: RequestContext,
  auth: PlayAuth
): Promise<Response> {
  const db = context.env.DB;
  const row = await executeFirst<any>(
    db,
    `SELECT ea.*, epa.exam_paper_id, epo.title, epo.subject
       FROM exam_attempts ea
       JOIN exam_assignments epa ON epa.id = ea.exam_assignment_id
       JOIN exam_papers epo ON epo.id = epa.exam_paper_id
      WHERE ea.id = ? AND ea.student_id = ? AND ea.academy_id = ?`,
    [attemptId, auth.studentId, auth.academyId]
  );
  if (!row) return notFoundResponse();

  // 종료 상태면 채점 결과 포함
  if (['submitted', 'expired', 'voided'].includes(row.status)) {
    const answers = await executeQuery<any>(
      db,
      `SELECT question_no, selected_choice FROM exam_answers WHERE attempt_id = ? ORDER BY question_no`,
      [attemptId]
    );
    const key = await executeQuery<any>(
      db,
      `SELECT question_no, correct_choice FROM exam_questions WHERE exam_paper_id = ? ORDER BY question_no`,
      [row.exam_paper_id]
    );
    const byNo = new Map(answers.map(a => [a.question_no, a.selected_choice]));
    const breakdown = key.map(k => ({
      questionNo: k.question_no,
      correct: byNo.get(k.question_no) === k.correct_choice,
      selected: byNo.get(k.question_no) ?? null,
      correctChoice: k.correct_choice,
    }));
    return successResponse({
      id: row.id,
      status: row.status,
      title: row.title,
      durationMinutes: row.duration_minutes,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      remainingSeconds: 0,
      score: row.auto_score,
      correct: row.auto_correct,
      total: row.auto_total,
      breakdown,
      questions: null,  // 종료 후에는 문제 숨김 (결과만)
      answers: null,
    });
  }

  // 진행 중: 문제(정답 제외) + 내 답
  const questions = await executeQuery<any>(
    db,
    `SELECT question_no, prompt, choices, points FROM exam_questions WHERE exam_paper_id = ? ORDER BY question_no`,
    [row.exam_paper_id]
  );
  const myAnswers = await executeQuery<any>(
    db,
    `SELECT question_no, selected_choice FROM exam_answers WHERE attempt_id = ? ORDER BY question_no`,
    [attemptId]
  );

  return successResponse({
    id: row.id,
    status: row.status,
    title: row.title,
    durationMinutes: row.duration_minutes,
    startedAt: row.started_at,
    remainingSeconds: calcRemainingSeconds(row),
    questions: questions.map(q => ({
      questionNo: q.question_no,
      prompt: q.prompt,
      choices: safeParseJson(q.choices) ?? [],
      points: q.points,
    })),
    answers: myAnswers.map(a => ({
      questionNo: a.question_no,
      selectedChoice: a.selected_choice,
    })),
  });
}

function safeParseJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

// ── 4) 답 저장 ──
async function handleSaveAnswer(
  attemptId: string,
  request: Request,
  context: RequestContext,
  auth: PlayAuth
): Promise<Response> {
  const body = await request.json().catch(() => ({})) as any;
  const questionNo = Number(body.questionNo);
  const choice = body.choice === null ? null : Number(body.choice);
  if (!Number.isInteger(questionNo) || questionNo < 1) return errorResponse('questionNo 필수', 400);
  if (choice !== null && (choice < 1 || choice > 5)) return errorResponse('choice는 1~5', 400);

  const db = context.env.DB;
  const row = await executeFirst<any>(
    db,
    `SELECT status FROM exam_attempts WHERE id = ? AND student_id = ? AND academy_id = ?`,
    [attemptId, auth.studentId, auth.academyId]
  );
  if (!row) return notFoundResponse();
  if (row.status !== 'running') return errorResponse('진행 중인 시험이 아닙니다', 409);

  await db.prepare(
    `INSERT INTO exam_answers (attempt_id, question_no, selected_choice, saved_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(attempt_id, question_no) DO UPDATE SET
       selected_choice = excluded.selected_choice,
       saved_at = datetime('now')`
  ).bind(attemptId, questionNo, choice).run();

  return successResponse({ savedAt: new Date().toISOString() });
}

// ── 5) 제출 + 자동 채점 ──
async function handleSubmit(
  attemptId: string,
  context: RequestContext,
  auth: PlayAuth
): Promise<Response> {
  const db = context.env.DB;
  const row = await executeFirst<any>(
    db,
    `SELECT ea.*, epa.exam_paper_id
       FROM exam_attempts ea
       JOIN exam_assignments epa ON epa.id = ea.exam_assignment_id
      WHERE ea.id = ? AND ea.student_id = ? AND ea.academy_id = ?`,
    [attemptId, auth.studentId, auth.academyId]
  );
  if (!row) return notFoundResponse();
  if (['submitted', 'expired', 'voided'].includes(row.status)) {
    return errorResponse(`이미 종료된 시험(${row.status})`, 409);
  }

  // 자동 채점
  const answers = await executeQuery<any>(
    db,
    `SELECT question_no, selected_choice FROM exam_answers WHERE attempt_id = ?`,
    [attemptId]
  );
  const key = await executeQuery<any>(
    db,
    `SELECT question_no, correct_choice, points FROM exam_questions WHERE exam_paper_id = ?`,
    [row.exam_paper_id]
  );
  const byNo = new Map(answers.map(a => [a.question_no, a.selected_choice]));
  let correct = 0, total = 0, scoreSum = 0;
  for (const k of key) {
    total += 1;
    if (byNo.get(k.question_no) === k.correct_choice) {
      correct += 1;
      scoreSum += Number(k.points ?? 1);
    }
  }

  const now = new Date().toISOString();
  await executeUpdate(
    db,
    `UPDATE exam_attempts SET
       status='submitted', ended_at=?,
       auto_score=?, auto_correct=?, auto_total=?,
       updated_at=?
     WHERE id=?`,
    [now, scoreSum, correct, total, now, attemptId]
  );
  await executeUpdate(
    db,
    `UPDATE exam_assignments SET exam_status='completed', score=? WHERE id=?`,
    [scoreSum, row.exam_assignment_id]
  );

  return successResponse({
    id: attemptId,
    status: 'submitted',
    endedAt: now,
    score: scoreSum,
    correct,
    total,
  });
}

// ── 라우터 엔트리 ──
export async function handleExamPlay(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    const auth = await getPlayAuth(context);
    if (!auth) return unauthorizedResponse();

    if (pathname === '/api/play/exams') {
      if (method === 'GET') return await handleListExams(context, auth);
      return errorResponse('Method not allowed', 405);
    }

    const startMatch = pathname.match(/^\/api\/play\/exams\/([^/]+)\/start$/);
    if (startMatch) {
      if (method === 'POST') return await handleStart(startMatch[1], context, auth);
      return errorResponse('Method not allowed', 405);
    }

    const attemptMatch = pathname.match(/^\/api\/play\/attempts\/([^/]+)$/);
    if (attemptMatch) {
      if (method === 'GET') return await handleGetAttempt(attemptMatch[1], context, auth);
      return errorResponse('Method not allowed', 405);
    }

    const answerMatch = pathname.match(/^\/api\/play\/attempts\/([^/]+)\/answer$/);
    if (answerMatch) {
      if (method === 'PUT') return await handleSaveAnswer(answerMatch[1], request, context, auth);
      return errorResponse('Method not allowed', 405);
    }

    const submitMatch = pathname.match(/^\/api\/play\/attempts\/([^/]+)\/submit$/);
    if (submitMatch) {
      if (method === 'POST') return await handleSubmit(submitMatch[1], context, auth);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, 'Exam Play');
  }
}
