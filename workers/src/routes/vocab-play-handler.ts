/**
 * Vocab Gacha 학생용 핸들러 (PIN 토큰)
 * 로그인은 /api/play/login (gacha-play-handler) 공유 — 같은 KV 토큰
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

// ═══════════════════════════════════════════════════════════════
// Phase 3b — 시험지 응시 (학생)
// ═══════════════════════════════════════════════════════════════

const PRINT_ACTIVE = ['pending', 'in_progress'];

/**
 * 학생이 직접 시험지 생성 + 시작 — 선생님 배정 없이 스스로 응시
 * body: { max_words?: number }
 * 선생님 assign 플로우와 동일한 pick 로직 (box 가중치) 재사용.
 */
async function handleSelfStartPrintJob(
  request: Request,
  context: RequestContext,
  auth: PlayAuth
): Promise<Response> {
  const db = context.env.DB;
  const body = (await request.json().catch(() => ({}))) as any;
  const maxWords = Math.min(30, Math.max(4, parseInt(body.max_words) || 10));

  // 본인 approved 단어 중 box < 5
  const candidates = await executeQuery<any>(
    db,
    `SELECT * FROM vocab_words
      WHERE academy_id = ? AND student_id = ? AND status = 'approved' AND box < 5`,
    [auth.academyId, auth.studentId]
  );
  if (candidates.length < 1) {
    return errorResponse('시험을 치려면 승인된 단어가 최소 1개 필요해요', 409);
  }
  // 4지선다 오답은 학원 전체 풀에서 뽑으니 본인 단어가 1~3개여도 진행 가능

  // 가중치 샘플링 (box 1→5x, 2→3x, 3→2x, 4→1x)
  const weightMap: Record<number, number> = { 1: 5, 2: 3, 3: 2, 4: 1 };
  const pool: any[] = [];
  for (const w of candidates) {
    const weight = weightMap[w.box] || 1;
    for (let i = 0; i < weight; i++) pool.push(w);
  }
  const seen = new Set<string>();
  const selected: any[] = [];
  while (selected.length < maxWords && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    const w = pool[idx];
    if (!seen.has(w.id)) { seen.add(w.id); selected.push(w); }
    pool.splice(idx, 1);
  }

  // job 생성 — created_by 는 학생 자신 (self-start 구분용)
  const jobId = generatePrefixedId('vpj');
  await executeInsert(
    db,
    `INSERT INTO vocab_print_jobs
       (id, academy_id, student_id, word_ids_json, created_by, status, started_at)
     VALUES (?, ?, ?, ?, ?, 'in_progress', datetime('now'))`,
    [jobId, auth.academyId, auth.studentId,
     JSON.stringify(selected.map(w => w.id)),
     `student:${auth.studentId}`]
  );

  // choices snapshot 생성 (start 로직과 동일)
  const allPool = await executeQuery<any>(
    db,
    `SELECT id, english, korean FROM vocab_words
      WHERE academy_id = ? AND status = 'approved' LIMIT 500`,
    [auth.academyId]
  );
  for (const t of selected) {
    const q = buildQuestion(t, allPool);
    await db.prepare(
      `INSERT INTO vocab_print_answers (print_job_id, word_id, correct_index, choices_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(print_job_id, word_id) DO NOTHING`
    ).bind(jobId, t.id, q.correctIndex, JSON.stringify(q.choices)).run();
  }

  // 생성된 job의 문제 목록 그대로 반환 — 클라는 enterPrintTake 로 이어 받기
  return handleGetPrintJob(jobId, context, auth);
}

async function handleListPendingPrintJobs(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const rows = await executeQuery<any>(
    context.env.DB,
    `SELECT id AS job_id, status, created_at, started_at,
            (SELECT COUNT(*) FROM json_each(word_ids_json)) AS word_count
       FROM vocab_print_jobs
      WHERE student_id = ? AND academy_id = ? AND status IN ('pending','in_progress')
      ORDER BY created_at DESC`,
    [auth.studentId, auth.academyId]
  );
  return successResponse(rows);
}

async function loadOwnPrintJob(jobId: string, auth: PlayAuth, db: D1Database) {
  return executeFirst<any>(
    db,
    `SELECT * FROM vocab_print_jobs
      WHERE id = ? AND student_id = ? AND academy_id = ?`,
    [jobId, auth.studentId, auth.academyId]
  );
}

function buildQuestion(target: any, pool: any[]): { prompt: string; choices: string[]; correctIndex: number } {
  const distractors = pool
    .filter(w => w.id !== target.id && w.korean !== target.korean)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const choices = distractors.map(w => String(w.korean || ''));
  const insertAt = Math.floor(Math.random() * 4);
  choices.splice(insertAt, 0, String(target.korean || ''));
  // 혹시 부족하면 빈 문자열 채움 (fallback)
  while (choices.length < 4) choices.push('—');
  return { prompt: String(target.english || ''), choices: choices.slice(0, 4), correctIndex: insertAt };
}

async function handleStartPrintJob(jobId: string, context: RequestContext, auth: PlayAuth): Promise<Response> {
  const db = context.env.DB;
  const job = await loadOwnPrintJob(jobId, auth, db);
  if (!job) return notFoundResponse();
  if (!PRINT_ACTIVE.includes(job.status)) {
    return errorResponse(`이미 종료된 시험지입니다 (${job.status})`, 409);
  }

  const wordIds: string[] = JSON.parse(job.word_ids_json || '[]');
  if (wordIds.length === 0) return errorResponse('출제된 단어가 없습니다', 409);

  // 기존 answers 있으면 그대로, 없으면 새로 snapshot 생성
  const existing = await executeQuery<any>(
    db,
    `SELECT word_id FROM vocab_print_answers WHERE print_job_id = ?`,
    [jobId]
  );
  if (existing.length === 0) {
    // 대상 단어 + 학원 전체 단어 pool (오답 후보)
    const targets = await executeQuery<any>(
      db,
      `SELECT * FROM vocab_words WHERE id IN (${wordIds.map(() => '?').join(',')})`,
      wordIds
    );
    const pool = await executeQuery<any>(
      db,
      `SELECT id, english, korean FROM vocab_words
        WHERE academy_id = ? AND status = 'approved'
        LIMIT 500`,
      [auth.academyId]
    );

    for (const t of targets) {
      const q = buildQuestion(t, pool);
      await db.prepare(
        `INSERT INTO vocab_print_answers (print_job_id, word_id, correct_index, choices_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(print_job_id, word_id) DO NOTHING`
      ).bind(jobId, t.id, q.correctIndex, JSON.stringify(q.choices)).run();
    }
  }

  const now = new Date().toISOString();
  if (job.status === 'pending') {
    await executeUpdate(
      db,
      `UPDATE vocab_print_jobs SET status='in_progress', started_at=? WHERE id=?`,
      [now, jobId]
    );
  }

  return handleGetPrintJob(jobId, context, auth);
}

async function handleGetPrintJob(jobId: string, context: RequestContext, auth: PlayAuth): Promise<Response> {
  const db = context.env.DB;
  const job = await loadOwnPrintJob(jobId, auth, db);
  if (!job) return notFoundResponse();

  const rows = await executeQuery<any>(
    db,
    `SELECT a.word_id, a.selected_index, a.correct_index, a.choices_json,
            w.english
       FROM vocab_print_answers a
       JOIN vocab_words w ON w.id = a.word_id
      WHERE a.print_job_id = ?
      ORDER BY w.id`,
    [jobId]
  );
  const questions = rows.map((r: any) => {
    let choices: string[] = [];
    try { choices = JSON.parse(r.choices_json); } catch {}
    return {
      wordId: r.word_id,
      prompt: r.english,
      choices,
      selectedIndex: r.selected_index,
    };
  });

  return successResponse({
    id: job.id,
    status: job.status,
    startedAt: job.started_at,
    submittedAt: job.submitted_at,
    questions,
    total: questions.length,
    ...(job.status === 'submitted' ? {
      autoCorrect: job.auto_correct,
      autoTotal: job.auto_total,
      // 제출 후에는 정답도 공개
      breakdown: rows.map((r: any) => ({
        wordId: r.word_id,
        prompt: r.english,
        choices: (() => { try { return JSON.parse(r.choices_json); } catch { return []; } })(),
        selectedIndex: r.selected_index,
        correctIndex: r.correct_index,
        correct: r.selected_index === r.correct_index,
      })),
    } : {}),
  });
}

async function handleSaveAnswer(
  jobId: string,
  wordId: string,
  request: Request,
  context: RequestContext,
  auth: PlayAuth
): Promise<Response> {
  const db = context.env.DB;
  const job = await loadOwnPrintJob(jobId, auth, db);
  if (!job) return notFoundResponse();
  if (job.status !== 'in_progress') return errorResponse('진행 중인 시험지가 아닙니다', 409);

  const body = (await request.json().catch(() => ({}))) as any;
  const sel = body.selected_index;
  const selected = sel === null ? null :
    (Number.isInteger(sel) && sel >= 0 && sel <= 3) ? sel : undefined;
  if (selected === undefined) return errorResponse('selected_index는 0..3 또는 null', 400);

  const result = await db.prepare(
    `UPDATE vocab_print_answers
        SET selected_index = ?, saved_at = datetime('now')
      WHERE print_job_id = ? AND word_id = ?`
  ).bind(selected, jobId, wordId).run();
  if (!result.success || (result.meta?.changes ?? 0) === 0) {
    return errorResponse('문항을 찾을 수 없습니다', 404);
  }
  return successResponse({ savedAt: new Date().toISOString() });
}

async function handleSubmitPrintJob(jobId: string, context: RequestContext, auth: PlayAuth): Promise<Response> {
  const db = context.env.DB;
  const job = await loadOwnPrintJob(jobId, auth, db);
  if (!job) return notFoundResponse();
  if (job.status !== 'in_progress' && job.status !== 'pending') {
    return errorResponse(`이미 종료된 시험지입니다 (${job.status})`, 409);
  }

  const answers = await executeQuery<any>(
    db,
    `SELECT word_id, selected_index, correct_index FROM vocab_print_answers
      WHERE print_job_id = ?`,
    [jobId]
  );

  let correct = 0;
  const total = answers.length;
  for (const a of answers) {
    const isCorrect = a.selected_index !== null && a.selected_index === a.correct_index;
    if (isCorrect) correct++;

    // 기존 vocab_words.box/wrong_count 업데이트 로직 재사용
    const word = await executeFirst<any>(
      db,
      `SELECT box, wrong_count FROM vocab_words WHERE id = ? AND academy_id = ?`,
      [a.word_id, auth.academyId]
    );
    if (!word) continue;
    const boxBefore = word.box || 1;
    const boxAfter = isCorrect ? Math.min(5, boxBefore + 1) : 1;
    await executeUpdate(
      db,
      `UPDATE vocab_words
          SET box = ?, review_count = review_count + 1,
              wrong_count = wrong_count + ?,
              updated_at = datetime('now')
        WHERE id = ?`,
      [boxAfter, isCorrect ? 0 : 1, a.word_id]
    );

    // 결과 이력도 남김 (수기 O/X와 동일 포맷)
    const rid = generatePrefixedId('vgr');
    await executeInsert(
      db,
      `INSERT INTO vocab_grade_results (id, print_job_id, word_id, correct, box_before, box_after)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rid, jobId, a.word_id, isCorrect ? 1 : 0, boxBefore, boxAfter]
    );
  }

  const now = new Date().toISOString();
  await executeUpdate(
    db,
    `UPDATE vocab_print_jobs
        SET status = 'submitted', submitted_at = ?,
            auto_correct = ?, auto_total = ?
      WHERE id = ?`,
    [now, correct, total, jobId]
  );

  return successResponse({ correct, total, submittedAt: now });
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

    // ── Phase 3b: 시험지 응시 ──
    if (pathname === '/api/play/vocab/print/pending') {
      if (method === 'GET') return await handleListPendingPrintJobs(context, auth);
      return errorResponse('Method not allowed', 405);
    }
    if (pathname === '/api/play/vocab/print/self-start') {
      if (method === 'POST') return await handleSelfStartPrintJob(request, context, auth);
      return errorResponse('Method not allowed', 405);
    }
    const startMatch = pathname.match(/^\/api\/play\/vocab\/print\/([^/]+)\/start$/);
    if (startMatch) {
      if (method === 'POST') return await handleStartPrintJob(startMatch[1], context, auth);
      return errorResponse('Method not allowed', 405);
    }
    const submitMatch = pathname.match(/^\/api\/play\/vocab\/print\/([^/]+)\/submit$/);
    if (submitMatch) {
      if (method === 'POST') return await handleSubmitPrintJob(submitMatch[1], context, auth);
      return errorResponse('Method not allowed', 405);
    }
    const saveMatch = pathname.match(/^\/api\/play\/vocab\/print\/([^/]+)\/answers\/([^/]+)$/);
    if (saveMatch) {
      if (method === 'PUT') return await handleSaveAnswer(saveMatch[1], saveMatch[2], request, context, auth);
      return errorResponse('Method not allowed', 405);
    }
    const jobMatch = pathname.match(/^\/api\/play\/vocab\/print\/([^/]+)$/);
    if (jobMatch) {
      if (method === 'GET') return await handleGetPrintJob(jobMatch[1], context, auth);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, 'Vocab Play');
  }
}
