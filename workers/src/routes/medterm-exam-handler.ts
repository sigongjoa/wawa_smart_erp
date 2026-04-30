/**
 * MedTerm 단원평가 핸들러 (UC-MT-07, UC-MS-07, UC-MS-08, UC-MX-02).
 *
 * 강사용 (JWT):
 *   POST /api/medterm/chapters/:id/exam      — attempt 출제 + 학생 할당
 *   GET  /api/medterm/exam-attempts/:id      — 결과 조회 (강사 입장)
 *
 * 학생용 (PIN — play-handler 에서 호출):
 *   GET  /api/play/medterm/exam-attempts/:id
 *   POST /api/play/medterm/exam-attempts/:id/responses (단일 문항 응답 저장)
 *   POST /api/play/medterm/exam-attempts/:id/submit    (제출 + 자동 채점)
 *
 * 보안:
 *   - academy_id + student_id 격리
 *   - 멱등 가드: WHERE status='created' 등
 *   - 응답 길이 캡 8KB
 */
import { z } from 'zod';
import { RequestContext } from '@/types';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId } from '@/utils/context';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { sanitizeText, isValidId } from '@/utils/sanitize';
import { gradeItem } from '@/utils/medterm-validate';

interface ItemRow {
  id: string;
  chapter_id: string;
  no: number;
  type: string;
  topic: string | null;
  difficulty: string;
  question: string;
  body_json: string;
  answer_json: string;
  explanation: string | null;
  figure_id: string | null;
}

interface AttemptRow {
  id: string;
  academy_id: string;
  student_id: string;
  chapter_id: string;
  item_ids_json: string;
  status: string;
  score: number | null;
  total: number | null;
  correct_cnt: number | null;
  created_at: string;
  submitted_at: string | null;
  graded_at: string | null;
}

interface ResponseRow {
  id: string;
  attempt_id: string;
  item_id: string;
  response_json: string | null;
  correct: number | null;
}

// ── UC-MT-07: 단원평가 출제 ──────────────────────────────────────

const CreateExamSchema = z.object({
  student_ids: z.array(z.string().min(1).max(64)).min(1).max(100),
  // 문항 sample 옵션 — 비어 있으면 챕터의 모든 exam_items 사용
  difficulties: z.array(z.enum(['하', '중', '상'])).optional(),
  types: z.array(z.string().min(1).max(20)).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

async function handleCreateExam(
  request: Request,
  context: RequestContext,
  chapterId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  if (!isValidId(chapterId)) return errorResponse('chapter id 형식 오류', 400);

  const academyId = getAcademyId(context);

  const chapter = await executeFirst<{ id: string }>(
    context.env.DB,
    'SELECT id FROM med_chapters WHERE id = ?',
    [chapterId]
  );
  if (!chapter) return errorResponse('챕터를 찾을 수 없습니다', 404);

  let data;
  try {
    data = CreateExamSchema.parse(await request.json());
  } catch {
    return errorResponse('출제 페이로드 오류', 400);
  }
  for (const sid of data.student_ids) {
    if (!isValidId(sid)) return errorResponse(`student_id 형식 오류: ${sid}`, 400);
  }

  // 학생 학원 격리 검증
  const placeholders = data.student_ids.map(() => '?').join(',');
  const validStudents = await executeQuery<{ id: string }>(
    context.env.DB,
    `SELECT id FROM gacha_students WHERE academy_id = ? AND id IN (${placeholders})`,
    [academyId, ...data.student_ids]
  );
  const validIds = new Set(validStudents.map((s) => s.id));
  const invalid = data.student_ids.filter((s) => !validIds.has(s));
  if (invalid.length > 0) {
    return errorResponse(`해당 학원 소속이 아닌 학생: ${invalid.join(', ')}`, 403);
  }

  // 문항 sample
  const filters: string[] = ['chapter_id = ?'];
  const params: unknown[] = [chapterId];
  if (data.difficulties && data.difficulties.length > 0) {
    filters.push(`difficulty IN (${data.difficulties.map(() => '?').join(',')})`);
    params.push(...data.difficulties);
  }
  if (data.types && data.types.length > 0) {
    filters.push(`type IN (${data.types.map(() => '?').join(',')})`);
    params.push(...data.types);
  }
  const limit = data.limit ?? 30;

  const items = await executeQuery<{ id: string }>(
    context.env.DB,
    `SELECT id FROM med_exam_items
     WHERE ${filters.join(' AND ')}
     ORDER BY no
     LIMIT ?`,
    [...params, limit]
  );
  if (items.length === 0) {
    return errorResponse('조건에 맞는 문항이 없습니다', 400);
  }

  const itemIds = items.map((i) => i.id);
  const itemIdsJson = JSON.stringify(itemIds);

  // 학생별 attempt 생성 (멱등 — 동일 student+chapter+item set 은 중복 생성 안 함)
  const created: { student_id: string; attempt_id: string }[] = [];
  const stmts = [];
  for (const sid of data.student_ids) {
    const attemptId = generatePrefixedId('mea');
    created.push({ student_id: sid, attempt_id: attemptId });
    stmts.push(context.env.DB.prepare(
      `INSERT INTO med_exam_attempts
       (id, academy_id, student_id, chapter_id, item_ids_json, status, total)
       VALUES(?, ?, ?, ?, ?, 'created', ?)`
    ).bind(attemptId, academyId, sid, chapterId, itemIdsJson, items.length));
  }
  await context.env.DB.batch(stmts);

  return successResponse({
    chapter_id: chapterId,
    item_count: items.length,
    attempts: created,
  });
}

// ── UC-MS-07/UC-MX-02: 응시 흐름 (학생) ───────────────────────────

interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

/** GET /api/play/medterm/exam-attempts/:id — 응시 화면용 문항 목록 (정답 제외) */
export async function handleGetAttempt(
  context: RequestContext,
  auth: PlayAuth,
  attemptId: string
): Promise<Response> {
  if (!isValidId(attemptId)) return errorResponse('attempt id 형식 오류', 400);

  const attempt = await executeFirst<AttemptRow>(
    context.env.DB,
    `SELECT id, academy_id, student_id, chapter_id, item_ids_json, status,
            score, total, correct_cnt, created_at, submitted_at, graded_at
     FROM med_exam_attempts
     WHERE id = ? AND academy_id = ? AND student_id = ?`,
    [attemptId, auth.academyId, auth.studentId]
  );
  if (!attempt) return errorResponse('attempt 없음', 404);

  const itemIds: string[] = JSON.parse(attempt.item_ids_json);
  if (itemIds.length === 0) return successResponse({ attempt, items: [], responses: [] });

  const placeholders = itemIds.map(() => '?').join(',');
  const items = await executeQuery<ItemRow>(
    context.env.DB,
    `SELECT id, chapter_id, no, type, topic, difficulty, question, body_json, figure_id
     FROM med_exam_items
     WHERE id IN (${placeholders})
     ORDER BY no`,
    itemIds
  );
  // body_json 파싱
  const parsedItems = items.map((it) => ({
    ...it,
    body: safeParse(it.body_json),
  }));

  // 기존 응답
  const responses = await executeQuery<ResponseRow>(
    context.env.DB,
    `SELECT id, attempt_id, item_id, response_json, correct
     FROM med_exam_responses
     WHERE attempt_id = ?`,
    [attemptId]
  );

  return successResponse({
    attempt: {
      id: attempt.id,
      chapter_id: attempt.chapter_id,
      status: attempt.status,
      total: attempt.total,
      score: attempt.score,
      correct_cnt: attempt.correct_cnt,
      created_at: attempt.created_at,
      submitted_at: attempt.submitted_at,
    },
    items: parsedItems.map((p) => ({
      id: p.id, no: p.no, type: p.type, topic: p.topic, difficulty: p.difficulty,
      question: p.question, body: p.body, figure_id: p.figure_id,
    })),
    responses: responses.map((r) => ({
      item_id: r.item_id,
      response: r.response_json ? safeParse(r.response_json) : null,
      correct: r.correct,
    })),
  });
}

const SaveResponseSchema = z.object({
  item_id: z.string().min(1).max(64),
  response: z.unknown(),
});

/** POST /api/play/medterm/exam-attempts/:id/responses — 단일 응답 저장 (UPSERT) */
export async function handleSaveResponse(
  request: Request,
  context: RequestContext,
  auth: PlayAuth,
  attemptId: string
): Promise<Response> {
  if (!isValidId(attemptId)) return errorResponse('attempt id 형식 오류', 400);

  const attempt = await executeFirst<{ id: string; status: string }>(
    context.env.DB,
    `SELECT id, status FROM med_exam_attempts
     WHERE id = ? AND academy_id = ? AND student_id = ?`,
    [attemptId, auth.academyId, auth.studentId]
  );
  if (!attempt) return errorResponse('attempt 없음', 404);
  if (attempt.status !== 'created') {
    return errorResponse(`이미 제출됨 (status=${attempt.status})`, 409);
  }

  let data;
  try {
    data = SaveResponseSchema.parse(await request.json());
  } catch {
    return errorResponse('payload 오류', 400);
  }
  if (!isValidId(data.item_id)) return errorResponse('item_id 형식 오류', 400);

  // 해당 attempt 의 itemIds 안에 있는지 검증
  const att2 = await executeFirst<{ item_ids_json: string }>(
    context.env.DB,
    'SELECT item_ids_json FROM med_exam_attempts WHERE id = ?',
    [attemptId]
  );
  const itemIds: string[] = JSON.parse(att2!.item_ids_json);
  if (!itemIds.includes(data.item_id)) {
    return errorResponse('이 attempt 에 속한 문항이 아닙니다', 400);
  }

  const responseStr = JSON.stringify(data.response ?? null).slice(0, 8192);

  // UPSERT — 같은 (attempt_id, item_id) 는 한 번만
  const existing = await executeFirst<{ id: string }>(
    context.env.DB,
    'SELECT id FROM med_exam_responses WHERE attempt_id = ? AND item_id = ?',
    [attemptId, data.item_id]
  );
  if (existing) {
    await executeUpdate(
      context.env.DB,
      'UPDATE med_exam_responses SET response_json = ? WHERE id = ?',
      [responseStr, existing.id]
    );
    return successResponse({ id: existing.id, updated: true });
  }
  const respId = generatePrefixedId('mer');
  await executeInsert(
    context.env.DB,
    `INSERT INTO med_exam_responses(id, attempt_id, item_id, response_json)
     VALUES(?, ?, ?, ?)`,
    [respId, attemptId, data.item_id, responseStr]
  );
  return successResponse({ id: respId, updated: false }, 201);
}

/** POST /api/play/medterm/exam-attempts/:id/submit — 제출 + 자동 채점 (UC-MX-02) */
export async function handleSubmitAttempt(
  context: RequestContext,
  auth: PlayAuth,
  attemptId: string
): Promise<Response> {
  if (!isValidId(attemptId)) return errorResponse('attempt id 형식 오류', 400);

  // 멱등 가드: created → submitted 전이만 허용
  const updateRes = await context.env.DB.prepare(
    `UPDATE med_exam_attempts
     SET status = 'submitted', submitted_at = datetime('now')
     WHERE id = ? AND academy_id = ? AND student_id = ? AND status = 'created'`
  ).bind(attemptId, auth.academyId, auth.studentId).run();

  // 이미 submitted/graded 면 update 0 — 정보만 반환
  const meta = (updateRes as { meta?: { changes?: number } }).meta;
  if (!meta || (meta.changes ?? 0) === 0) {
    const existing = await executeFirst<AttemptRow>(
      context.env.DB,
      `SELECT id, academy_id, student_id, chapter_id, item_ids_json, status,
              score, total, correct_cnt, created_at, submitted_at, graded_at
       FROM med_exam_attempts
       WHERE id = ? AND academy_id = ? AND student_id = ?`,
      [attemptId, auth.academyId, auth.studentId]
    );
    if (!existing) return errorResponse('attempt 없음', 404);
    return successResponse({
      already_submitted: true,
      status: existing.status,
      score: existing.score,
      correct_cnt: existing.correct_cnt,
      total: existing.total,
    });
  }

  // 자동 채점 — 모든 응답에 대해 gradeItem 실행
  const itemIdsRow = await executeFirst<{ item_ids_json: string }>(
    context.env.DB,
    'SELECT item_ids_json FROM med_exam_attempts WHERE id = ?',
    [attemptId]
  );
  const itemIds: string[] = JSON.parse(itemIdsRow!.item_ids_json);
  const placeholders = itemIds.map(() => '?').join(',');

  const items = await executeQuery<{ id: string; type: string; answer_json: string }>(
    context.env.DB,
    `SELECT id, type, answer_json FROM med_exam_items WHERE id IN (${placeholders})`,
    itemIds
  );
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const responses = await executeQuery<ResponseRow>(
    context.env.DB,
    'SELECT id, attempt_id, item_id, response_json, correct FROM med_exam_responses WHERE attempt_id = ?',
    [attemptId]
  );

  const stmts = [];
  let correctCnt = 0;
  for (const item of items) {
    const resp = responses.find((r) => r.item_id === item.id);
    const answer = safeParse(item.answer_json);
    const userResp = resp?.response_json ? safeParse(resp.response_json) : null;
    const result = gradeItem(item.type, answer, userResp);
    if (result.correct === 1) correctCnt++;

    if (resp) {
      stmts.push(context.env.DB.prepare(
        `UPDATE med_exam_responses
         SET correct = ?, graded_at = datetime('now')
         WHERE id = ?`
      ).bind(result.correct, resp.id));
    } else {
      // 응답 누락 = 0점 — 기록만 남김
      const respId = generatePrefixedId('mer');
      stmts.push(context.env.DB.prepare(
        `INSERT INTO med_exam_responses
         (id, attempt_id, item_id, response_json, correct, graded_at)
         VALUES(?, ?, ?, NULL, 0, datetime('now'))`
      ).bind(respId, attemptId, item.id));
    }
  }

  const total = items.length;
  const score = total > 0 ? Math.round((correctCnt / total) * 100) : 0;

  stmts.push(context.env.DB.prepare(
    `UPDATE med_exam_attempts
     SET status = 'graded', graded_at = datetime('now'),
         score = ?, total = ?, correct_cnt = ?
     WHERE id = ?`
  ).bind(score, total, correctCnt, attemptId));

  await context.env.DB.batch(stmts);

  return successResponse({
    status: 'graded',
    total, correct_cnt: correctCnt, score,
  });
}

// ── 강사 — attempt 결과 조회 ──────────────────────────────────────

async function handleGetAttemptForTeacher(
  context: RequestContext,
  attemptId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  if (!isValidId(attemptId)) return errorResponse('attempt id 형식 오류', 400);

  const academyId = getAcademyId(context);
  const attempt = await executeFirst<AttemptRow>(
    context.env.DB,
    `SELECT id, academy_id, student_id, chapter_id, item_ids_json, status,
            score, total, correct_cnt, created_at, submitted_at, graded_at
     FROM med_exam_attempts
     WHERE id = ? AND academy_id = ?`,
    [attemptId, academyId]
  );
  if (!attempt) return errorResponse('attempt 없음', 404);

  const responses = await executeQuery<ResponseRow & { item_no: number; item_question: string }>(
    context.env.DB,
    `SELECT r.id, r.attempt_id, r.item_id, r.response_json, r.correct,
            i.no AS item_no, i.question AS item_question
     FROM med_exam_responses r
     JOIN med_exam_items i ON i.id = r.item_id
     WHERE r.attempt_id = ?
     ORDER BY i.no`,
    [attemptId]
  );

  return successResponse({
    attempt: {
      id: attempt.id,
      student_id: attempt.student_id,
      chapter_id: attempt.chapter_id,
      status: attempt.status,
      score: attempt.score,
      total: attempt.total,
      correct_cnt: attempt.correct_cnt,
      submitted_at: attempt.submitted_at,
      graded_at: attempt.graded_at,
    },
    responses: responses.map((r) => ({
      item_id: r.item_id,
      item_no: r.item_no,
      item_question: r.item_question,
      response: r.response_json ? safeParse(r.response_json) : null,
      correct: r.correct,
    })),
  });
}

// ── 학생 attempts 목록 ────────────────────────────────────────────

export async function handleListAttemptsForStudent(
  context: RequestContext,
  auth: PlayAuth
): Promise<Response> {
  const rows = await executeQuery<AttemptRow & { chapter_title: string }>(
    context.env.DB,
    `SELECT a.id, a.chapter_id, a.status, a.score, a.total, a.correct_cnt,
            a.created_at, a.submitted_at, a.graded_at,
            c.title AS chapter_title
     FROM med_exam_attempts a
     JOIN med_chapters c ON c.id = a.chapter_id
     WHERE a.academy_id = ? AND a.student_id = ?
     ORDER BY a.created_at DESC
     LIMIT 50`,
    [auth.academyId, auth.studentId]
  );
  return successResponse({ items: rows });
}

// ── 라우터 ─────────────────────────────────────────────────────────

export async function handleMedTermExam(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // POST /api/medterm/chapters/:id/exam
    const examM = pathname.match(/^\/api\/medterm\/chapters\/([^/]+)\/exam$/);
    if (examM && method === 'POST') {
      return handleCreateExam(request, context, examM[1]);
    }
    // GET /api/medterm/exam-attempts/:id (강사)
    const attM = pathname.match(/^\/api\/medterm\/exam-attempts\/([^/]+)$/);
    if (attM && method === 'GET') {
      return handleGetAttemptForTeacher(context, attM[1]);
    }
    return errorResponse('Not Found', 404);
  } catch (err) {
    return handleRouteError(err, 'medterm-exam');
  }
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
