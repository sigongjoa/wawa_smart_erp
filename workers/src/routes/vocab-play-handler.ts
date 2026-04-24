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

// 쓰기 요청에 대해 Origin 제한 — 정식 학생 앱 또는 same-site 요청만 허용 (defense-in-depth)
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_ORIGIN_HOSTS = new Set([
  'wawa-learn.pages.dev',
  'learn.wawa.app',
]);
function isAllowedOrigin(request: Request): boolean {
  if (!WRITE_METHODS.has(request.method)) return true;
  const site = request.headers.get('Sec-Fetch-Site');
  if (site === 'same-origin' || site === 'same-site') return true;
  const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';
  try {
    const host = new URL(origin).hostname;
    if (ALLOWED_ORIGIN_HOSTS.has(host)) return true;
    if (host.endsWith('.wawa-learn.pages.dev')) return true; // preview deploys
  } catch {
    // fetch 없는 서버-서버 호출 (테스트 등) — Origin 없어도 허용
    if (!origin) return true;
  }
  return false;
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

  // 1. 진행 중인 self-start 시험 있으면 resume (중복 생성 방지)
  const existingActive = await executeFirst<{ id: string; status: string; started_at: string | null }>(
    db,
    `SELECT id, status, started_at FROM vocab_print_jobs
      WHERE academy_id = ? AND student_id = ? AND created_by = ?
        AND status IN ('pending', 'in_progress')
      ORDER BY started_at DESC LIMIT 1`,
    [auth.academyId, auth.studentId, `student:${auth.studentId}`]
  );
  if (existingActive) {
    // 기존 job 의 questions + choices 를 돌려줌 (clientside 가 resume 로 인지)
    const answers = await executeQuery<any>(
      db,
      `SELECT a.word_id, a.selected_index, a.correct_index, a.choices_json,
              w.english, w.korean
       FROM vocab_print_answers a
       JOIN vocab_words w ON w.id = a.word_id
       WHERE a.print_job_id = ?`,
      [existingActive.id]
    );
    const questions = answers.map((r) => ({
      wordId: r.word_id,
      prompt: r.english,
      choices: safeParse(r.choices_json) || [],
      selectedIndex: r.selected_index,
    }));
    return successResponse({
      id: existingActive.id,
      status: existingActive.status,
      startedAt: existingActive.started_at,
      submittedAt: null,
      questions,
      resumed: true, // 클라이언트에서 "이어서 풀기" 메시지 노출
    });
  }

  // 2. 오늘 이미 제출한 self-start 시험 수 (정보 제공용)
  const todayDone = await executeFirst<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM vocab_print_jobs
      WHERE academy_id = ? AND student_id = ? AND created_by = ?
        AND status = 'submitted'
        AND date(submitted_at) = date('now')`,
    [auth.academyId, auth.studentId, `student:${auth.studentId}`]
  );

  // 3. 본인 단어 전체 분포 조회 (상세한 에러 제공용)
  const allMine = await executeQuery<{ status: string; box: number | null }>(
    db,
    `SELECT status, box FROM vocab_words
      WHERE academy_id = ? AND student_id = ?`,
    [auth.academyId, auth.studentId]
  );
  const totalMine = allMine.length;
  const approvedMine = allMine.filter((w) => w.status === 'approved').length;
  const masteredMine = allMine.filter((w) => w.status === 'approved' && (w.box ?? 0) >= 5).length;

  const candidates = await executeQuery<any>(
    db,
    `SELECT * FROM vocab_words
      WHERE academy_id = ? AND student_id = ? AND status = 'approved' AND box < 5`,
    [auth.academyId, auth.studentId]
  );
  if (candidates.length < 1) {
    if (totalMine === 0) {
      return errorResponse(
        '아직 등록된 단어가 없어요. "내 단어장" 에서 단어를 추가하거나 선생님께 문의해주세요.',
        409
      );
    }
    if (approvedMine === 0) {
      return errorResponse(
        `단어가 ${totalMine}개 있지만 선생님 승인 대기 중이에요. 승인을 기다려주세요.`,
        409
      );
    }
    if (masteredMine === approvedMine) {
      return errorResponse(
        `승인된 단어 ${approvedMine}개 모두 Box 5(마스터) 단계예요. 새 단어를 추가해야 시험을 볼 수 있어요.`,
        409
      );
    }
    return errorResponse('시험 가능한 단어가 없어요. "내 단어장" 을 확인해 주세요.', 409);
  }
  // 4지선다 오답은 학원 전체 풀에서 뽑으니 본인 단어가 1~3개여도 진행 가능

  // 가중치 샘플링 (box 1→5x, 2→3x, 3→2x, 4→1x)
  // Fisher-Yates: 가중치 확장 pool을 섞고 앞에서부터 고유 단어 maxWords개 추출 (O(n))
  const weightMap: Record<number, number> = { 1: 5, 2: 3, 3: 2, 4: 1 };
  const pool: any[] = [];
  for (const w of candidates) {
    const weight = weightMap[w.box] || 1;
    for (let i = 0; i < weight; i++) pool.push(w);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const seen = new Set<string>();
  const selected: any[] = [];
  for (const w of pool) {
    if (selected.length >= maxWords) break;
    if (!seen.has(w.id)) { seen.add(w.id); selected.push(w); }
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

  // choices snapshot 생성 (start 로직과 동일). pool LIMIT 제거 — 전체 approved에서 distractor 샘플링
  const allPool = await executeQuery<any>(
    db,
    `SELECT id, english, korean FROM vocab_words
      WHERE academy_id = ? AND status = 'approved'`,
    [auth.academyId]
  );
  const stmts = selected.map(t => {
    const q = buildQuestion(t, allPool);
    return db.prepare(
      `INSERT INTO vocab_print_answers (print_job_id, word_id, correct_index, choices_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(print_job_id, word_id) DO NOTHING`
    ).bind(jobId, t.id, q.correctIndex, JSON.stringify(q.choices));
  });
  if (stmts.length > 0) await db.batch(stmts);

  // 생성된 job + 오늘 N번째 정보 응답
  const questions = selected.map((t) => {
    const q = buildQuestion(t, allPool);
    return {
      wordId: t.id,
      prompt: t.english,
      choices: q.choices,
      selectedIndex: null as number | null,
    };
  });
  return successResponse({
    id: jobId,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    submittedAt: null,
    questions,
    total: questions.length,
    resumed: false,
    todayIndex: (todayDone?.n || 0) + 1,
  });
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
  // 정답을 먼저 랜덤 위치에 삽입 (삽입 가능한 최대 index = 오답 개수)
  const targetKor = String(target.korean || '');
  const insertAt = Math.floor(Math.random() * (choices.length + 1));
  choices.splice(insertAt, 0, targetKor);
  // distractor가 부족하면 correctIndex 이외 슬롯만 '—'로 패딩
  while (choices.length < 4) {
    const pos = choices.length;
    choices.push(pos === insertAt ? targetKor : '—');
  }
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
    // 대상 단어 + 학원 전체 단어 pool (오답 후보) — 학원 소유 검증 포함
    const targets = await executeQuery<any>(
      db,
      `SELECT * FROM vocab_words
        WHERE academy_id = ? AND id IN (${wordIds.map(() => '?').join(',')})`,
      [auth.academyId, ...wordIds]
    );
    const pool = await executeQuery<any>(
      db,
      `SELECT id, english, korean FROM vocab_words
        WHERE academy_id = ? AND status = 'approved'`,
      [auth.academyId]
    );

    const stmts = targets.map(t => {
      const q = buildQuestion(t, pool);
      return db.prepare(
        `INSERT INTO vocab_print_answers (print_job_id, word_id, correct_index, choices_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(print_job_id, word_id) DO NOTHING`
      ).bind(jobId, t.id, q.correctIndex, JSON.stringify(q.choices));
    });
    if (stmts.length > 0) await db.batch(stmts);
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

  // word_id가 이 잡의 소유 문항인지 명시 검증 — URL 변조 방지
  const owned = await executeFirst<any>(
    db,
    `SELECT 1 AS ok FROM vocab_print_answers WHERE print_job_id = ? AND word_id = ?`,
    [jobId, wordId]
  );
  if (!owned) return errorResponse('이 시험지의 문항이 아닙니다', 404);

  const result = await db.prepare(
    `UPDATE vocab_print_answers
        SET selected_index = ?, saved_at = datetime('now')
      WHERE print_job_id = ? AND word_id = ?`
  ).bind(selected, jobId, wordId).run();
  if (!result.success) return errorResponse('문항 저장 실패', 500);
  return successResponse({ savedAt: new Date().toISOString() });
}

async function handleSubmitPrintJob(jobId: string, context: RequestContext, auth: PlayAuth): Promise<Response> {
  const db = context.env.DB;
  // 낙관적 락: 소유권 + 상태 체크를 UPDATE 한 방으로 — 동시 제출에서 한 요청만 성공
  const now = new Date().toISOString();
  const lockRes = await db.prepare(
    `UPDATE vocab_print_jobs
        SET status = 'submitting', submitted_at = ?
      WHERE id = ? AND student_id = ? AND academy_id = ?
        AND status IN ('in_progress','pending')`
  ).bind(now, jobId, auth.studentId, auth.academyId).run();

  if (!lockRes.success) return errorResponse('제출 처리 실패', 500);
  const locked = (lockRes.meta?.changes ?? 0) > 0;

  // 락 실패 → 이미 제출됐거나 존재하지 않음. 현재 상태 조회 후 idempotent 응답 or 404
  if (!locked) {
    const job = await loadOwnPrintJob(jobId, auth, db);
    if (!job) return notFoundResponse();
    if (job.status === 'submitted' || job.status === 'submitting') {
      return successResponse({
        correct: job.auto_correct ?? 0,
        total: job.auto_total ?? 0,
        submittedAt: job.submitted_at,
        alreadySubmitted: true,
      });
    }
    return errorResponse(`이미 종료된 시험지입니다 (${job.status})`, 409);
  }

  // ── 채점 ── 이 시점부터 이 요청만이 해당 job을 처리
  const answers = await executeQuery<any>(
    db,
    `SELECT word_id, selected_index, correct_index FROM vocab_print_answers
      WHERE print_job_id = ?`,
    [jobId]
  );
  const total = answers.length;

  // 관련 단어 일괄 SELECT (N+1 제거)
  const wordIds = answers.map(a => a.word_id);
  const wordMap = new Map<string, { box: number; wrong_count: number }>();
  if (wordIds.length > 0) {
    const placeholders = wordIds.map(() => '?').join(',');
    const words = await executeQuery<any>(
      db,
      `SELECT id, box, wrong_count FROM vocab_words
        WHERE academy_id = ? AND id IN (${placeholders})`,
      [auth.academyId, ...wordIds]
    );
    for (const w of words) wordMap.set(w.id, { box: w.box ?? 1, wrong_count: w.wrong_count ?? 0 });
  }

  // 채점 + 업데이트 배치 구성
  const updateStmts: any[] = [];
  const insertStmts: any[] = [];
  let correct = 0;
  for (const a of answers) {
    const isCorrect = a.selected_index !== null && a.selected_index === a.correct_index;
    if (isCorrect) correct++;
    const w = wordMap.get(a.word_id);
    if (!w) continue;
    const boxBefore = w.box || 1;
    const boxAfter = isCorrect ? Math.min(5, boxBefore + 1) : 1;
    updateStmts.push(
      db.prepare(
        `UPDATE vocab_words
            SET box = ?, review_count = review_count + 1,
                wrong_count = wrong_count + ?,
                updated_at = datetime('now')
          WHERE id = ?`
      ).bind(boxAfter, isCorrect ? 0 : 1, a.word_id)
    );
    insertStmts.push(
      db.prepare(
        `INSERT INTO vocab_grade_results (id, print_job_id, word_id, correct, box_before, box_after)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(generatePrefixedId('vgr'), jobId, a.word_id, isCorrect ? 1 : 0, boxBefore, boxAfter)
    );
  }

  // 최종 job 상태 업데이트 + 배치 실행 (D1 batch는 순차 원자 실행)
  const finalizeStmt = db.prepare(
    `UPDATE vocab_print_jobs
        SET status = 'submitted', submitted_at = ?,
            auto_correct = ?, auto_total = ?
      WHERE id = ?`
  ).bind(now, correct, total, jobId);

  const batch = [...updateStmts, ...insertStmts, finalizeStmt];
  if (batch.length > 0) await db.batch(batch);

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
    if (!isAllowedOrigin(request)) return errorResponse('origin not allowed', 403);
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
