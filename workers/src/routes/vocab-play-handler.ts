/**
 * Vocab Gacha 학생용 핸들러 (PIN 토큰)
 * 로그인은 /api/play/login (gacha-play-handler) 공유 — 같은 KV 토큰
 */
import { RequestContext } from '@/types';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
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
  return await context.env.KV.get(`play:${token}`, 'json') as PlayAuth | null;
}

// ── 학생 단어장 ──

async function handleGetMyWords(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const words = await executeQuery<any>(
    context.env.DB,
    `SELECT id, english, korean, pos, example, box, blank_type, status, review_count, wrong_count, created_at
     FROM vocab_words
     WHERE academy_id = ? AND student_id = ?
     ORDER BY created_at DESC LIMIT 500`,
    [auth.academyId, auth.studentId]
  );
  return successResponse(words);
}

const ALLOWED_POS = new Set(['noun', 'verb', 'adj', 'adv', 'prep', 'conj']);

async function handleAddMyWord(request: Request, context: RequestContext, auth: PlayAuth): Promise<Response> {
  const body = await request.json() as any;
  if (!body.english?.trim() || !body.korean?.trim()) {
    return errorResponse('english, korean은 필수입니다', 400);
  }
  const pos = typeof body.pos === 'string' && ALLOWED_POS.has(body.pos) ? body.pos : null;
  const example = typeof body.example === 'string' && body.example.trim()
    ? body.example.trim().slice(0, 500) : null;
  const id = generatePrefixedId('vw');
  await executeInsert(
    context.env.DB,
    `INSERT INTO vocab_words (id, academy_id, student_id, english, korean, pos, example, status, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'student')`,
    [id, auth.academyId, auth.studentId, body.english.trim(), body.korean.trim(), pos, example]
  );
  return successResponse({ id }, 201);
}

// ── 문법 질문 ──

async function handleGetMyGrammar(context: RequestContext, auth: PlayAuth): Promise<Response> {
  // 본인 질문 + 답변된 모든 학원 Q&A
  const list = await executeQuery<any>(
    context.env.DB,
    `SELECT id, question, answer, status, answered_by, created_at, answered_at, student_id
     FROM vocab_grammar_qa
     WHERE academy_id = ? AND (student_id = ? OR (status = 'answered' AND include_in_print = 1))
     ORDER BY created_at DESC LIMIT 100`,
    [auth.academyId, auth.studentId]
  );
  return successResponse(list);
}

async function handleAddMyGrammar(request: Request, context: RequestContext, auth: PlayAuth): Promise<Response> {
  const body = await request.json() as any;
  if (!body.question?.trim()) return errorResponse('질문은 필수입니다', 400);

  const id = generatePrefixedId('vqa');
  await executeInsert(
    context.env.DB,
    `INSERT INTO vocab_grammar_qa (id, academy_id, student_id, question, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [id, auth.academyId, auth.studentId, body.question.trim()]
  );
  return successResponse({ id }, 201);
}

// ── 교과서 ──

async function handleGetTextbooks(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const books = await executeQuery<any>(
    context.env.DB,
    `SELECT id, school, grade, semester, title FROM vocab_textbooks
     WHERE academy_id = ? ORDER BY school, grade, semester`,
    [auth.academyId]
  );
  return successResponse(books);
}

async function handleGetTextbookWords(context: RequestContext, auth: PlayAuth, textbookId: string): Promise<Response> {
  const book = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM vocab_textbooks WHERE id = ? AND academy_id = ?',
    [textbookId, auth.academyId]
  );
  if (!book) return errorResponse('교과서를 찾을 수 없습니다', 404);

  const words = await executeQuery<any>(
    context.env.DB,
    'SELECT * FROM vocab_textbook_words WHERE textbook_id = ? ORDER BY unit, english',
    [textbookId]
  );
  return successResponse(words);
}

// ── 게임 상태 blob (profile/quizHistory/badges/seen/creature) ──

async function handleGetState(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const row = await executeFirst<{ state_json: string; updated_at: string }>(
    context.env.DB,
    `SELECT state_json, updated_at FROM student_play_state
     WHERE student_id = ? AND academy_id = ?`,
    [auth.studentId, auth.academyId]
  );
  if (!row) return successResponse({ state: null, updatedAt: null });
  let state: any;
  try { state = JSON.parse(row.state_json); } catch { state = null; }
  return successResponse({ state, updatedAt: row.updated_at });
}

async function handlePutState(request: Request, context: RequestContext, auth: PlayAuth): Promise<Response> {
  const body = await request.json() as any;
  if (typeof body !== 'object' || body === null) {
    return errorResponse('state object is required', 400);
  }
  const json = JSON.stringify(body);
  if (json.length > 512 * 1024) return errorResponse('state 너무 큼 (512KB 제한)', 413);

  await executeUpdate(
    context.env.DB,
    `INSERT INTO student_play_state (student_id, academy_id, state_json, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(student_id, academy_id) DO UPDATE SET
       state_json = excluded.state_json,
       updated_at = datetime('now')`,
    [auth.studentId, auth.academyId, json]
  );
  return successResponse({ ok: true });
}

// ── 단어 진도 patch (퀴즈 결과: box, wrong_count) ──

async function handlePatchWordProgress(
  wordId: string, request: Request, context: RequestContext, auth: PlayAuth
): Promise<Response> {
  const body = await request.json() as any;
  const sets: string[] = [];
  const params: any[] = [];
  if (typeof body.box === 'number' && body.box >= 1 && body.box <= 5) {
    sets.push('box = ?'); params.push(body.box);
  }
  if (typeof body.wrongCount === 'number' && body.wrongCount >= 0) {
    sets.push('wrong_count = ?'); params.push(body.wrongCount);
  }
  if (typeof body.reviewDelta === 'number' && body.reviewDelta > 0) {
    sets.push('review_count = review_count + ?'); params.push(body.reviewDelta);
  }
  if (sets.length === 0) return errorResponse('업데이트할 필드가 없습니다', 400);

  params.push(wordId, auth.studentId, auth.academyId);
  const result = await context.env.DB.prepare(
    `UPDATE vocab_words SET ${sets.join(', ')}
     WHERE id = ? AND student_id = ? AND academy_id = ?`
  ).bind(...params).run();
  if (!result.success || (result.meta?.changes ?? 0) === 0) {
    return errorResponse('단어를 찾을 수 없습니다', 404);
  }
  return successResponse({ ok: true });
}

// ── 메인 라우터 ──

export async function handleVocabPlay(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    const auth = await getPlayAuth(context);
    if (!auth) return unauthorizedResponse();

    if (pathname === '/api/play/vocab/words') {
      if (method === 'GET') return await handleGetMyWords(context, auth);
      if (method === 'POST') return await handleAddMyWord(request, context, auth);
      return errorResponse('Method not allowed', 405);
    }

    if (pathname === '/api/play/vocab/state') {
      if (method === 'GET') return await handleGetState(context, auth);
      if (method === 'PUT') return await handlePutState(request, context, auth);
      return errorResponse('Method not allowed', 405);
    }

    const progressMatch = pathname.match(/^\/api\/play\/vocab\/words\/([^/]+)\/progress$/);
    if (progressMatch) {
      if (method === 'PATCH') return await handlePatchWordProgress(progressMatch[1], request, context, auth);
      return errorResponse('Method not allowed', 405);
    }

    if (pathname === '/api/play/vocab/grammar') {
      if (method === 'GET') return await handleGetMyGrammar(context, auth);
      if (method === 'POST') return await handleAddMyGrammar(request, context, auth);
      return errorResponse('Method not allowed', 405);
    }

    if (pathname === '/api/play/vocab/textbooks') {
      if (method === 'GET') return await handleGetTextbooks(context, auth);
      return errorResponse('Method not allowed', 405);
    }

    const tbMatch = pathname.match(/^\/api\/play\/vocab\/textbooks\/([^/]+)\/words$/);
    if (tbMatch) {
      if (method === 'GET') return await handleGetTextbookWords(context, auth, tbMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, 'Vocab Play');
  }
}
