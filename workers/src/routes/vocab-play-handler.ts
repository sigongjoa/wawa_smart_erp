/**
 * Vocab Gacha 학생용 핸들러 (PIN 토큰)
 * 로그인은 /api/play/login (gacha-play-handler) 공유 — 같은 KV 토큰
 */
import { z } from 'zod';
import { RequestContext } from '@/types';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { resolveVocabPolicy, checkAvailability, parseBoxFilter } from '@/utils/vocab-policy';

interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

// ─── DB 행 타입 ───
interface VocabWordRow {
  id: string;
  english: string;
  korean: string;
  pos: string | null;
  example: string | null;
  box: number;
  blank_type: string | null;
  status: string;
  review_count: number;
  wrong_count: number;
  created_at: string;
}
interface IdRow { id: string }
interface GrammarRow {
  id: string;
  question: string;
  answer: string | null;
  status: string;
  answered_by: string | null;
  created_at: string;
  answered_at: string | null;
  student_id: string;
}
interface TextbookRow {
  id: string;
  school: string | null;
  grade: string | null;
  semester: string | null;
  title: string;
}

// ─── Zod 스키마 ───
const POS_ENUM = z.enum(['noun', 'verb', 'adj', 'adv', 'prep', 'conj']);

const AddWordSchema = z.object({
  english: z.string().trim().min(1).max(100),
  korean: z.string().trim().min(1).max(200),
  pos: POS_ENUM.optional().nullable(),
  example: z.string().max(500).optional().nullable(),
});

const AddGrammarSchema = z.object({
  question: z.string().trim().min(1).max(2000),
});

const PatchProgressSchema = z.object({
  box: z.number().int().min(1).max(5).optional(),
  wrongCount: z.number().int().min(0).max(9999).optional(),
  reviewDelta: z.number().int().min(1).max(100).optional(),
}).refine((v) => v.box !== undefined || v.wrongCount !== undefined || v.reviewDelta !== undefined, {
  message: '업데이트할 필드가 없습니다',
});

const SelfStartSchema = z.object({
  max_words: z.number().int().min(4).max(30).optional(),
  // 출제 출처 — 'mywords'(기본, 학생 단어장) | 'csat'(공유 카탈로그)
  source: z.enum(['mywords', 'csat']).optional(),
  // CSAT 전용: 빈도 등급 (1=쉬움, 2=중, 3=어려움). 미지정 시 mixed.
  tier: z.number().int().min(1).max(3).optional(),
  // CSAT 카탈로그 id (기본 'csat-megastudy-2025')
  catalog_id: z.string().optional(),
});

function handleZodError(err: unknown): Response | null {
  if (err instanceof z.ZodError) {
    const msg = err.errors.map((e) => e.message).join(', ');
    return errorResponse(`입력 검증 오류: ${msg}`, 400);
  }
  return null;
}

function safeParse<T = unknown>(s: string | null | undefined): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
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
  const words = await executeQuery<VocabWordRow>(
    context.env.DB,
    `SELECT id, english, korean, pos, example, box, blank_type, status,
            review_count, wrong_count, last_quizzed_at, origin_catalog_word_id, created_at
     FROM vocab_words
     WHERE academy_id = ? AND student_id = ?
     ORDER BY created_at DESC LIMIT 500`,
    [auth.academyId, auth.studentId]
  );
  return successResponse(words);
}

async function handleAddMyWord(request: Request, context: RequestContext, auth: PlayAuth): Promise<Response> {
  let data: z.infer<typeof AddWordSchema>;
  try {
    data = AddWordSchema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    const zerr = handleZodError(err);
    if (zerr) return zerr;
    throw err;
  }
  const id = generatePrefixedId('vw');
  // 셀프-서브 모델: 학생 추가 단어는 자동 승인 → 즉시 시험 풀에 포함.
  // 교사 승인 단계 제거(routine 오버헤드 제거). 품질 관리는 사후 편집/삭제로.
  await executeInsert(
    context.env.DB,
    `INSERT INTO vocab_words (id, academy_id, student_id, english, korean, pos, example, status, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 'student')`,
    [id, auth.academyId, auth.studentId, data.english, data.korean, data.pos ?? null, data.example ?? null]
  );
  return successResponse({ id }, 201);
}

// ── 문법 질문 ──

async function handleGetMyGrammar(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const list = await executeQuery<GrammarRow>(
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
  let data: z.infer<typeof AddGrammarSchema>;
  try {
    data = AddGrammarSchema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    const zerr = handleZodError(err);
    if (zerr) return zerr;
    throw err;
  }
  const id = generatePrefixedId('vqa');
  await executeInsert(
    context.env.DB,
    `INSERT INTO vocab_grammar_qa (id, academy_id, student_id, question, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [id, auth.academyId, auth.studentId, data.question]
  );
  return successResponse({ id }, 201);
}

// ── 교과서 ──

async function handleGetTextbooks(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const books = await executeQuery<TextbookRow>(
    context.env.DB,
    `SELECT id, school, grade, semester, title FROM vocab_textbooks
     WHERE academy_id = ? ORDER BY school, grade, semester`,
    [auth.academyId]
  );
  return successResponse(books);
}

async function handleGetTextbookWords(context: RequestContext, auth: PlayAuth, textbookId: string): Promise<Response> {
  const book = await executeFirst<IdRow>(
    context.env.DB,
    'SELECT id FROM vocab_textbooks WHERE id = ? AND academy_id = ?',
    [textbookId, auth.academyId]
  );
  if (!book) return errorResponse('교과서를 찾을 수 없습니다', 404);

  const words = await executeQuery<Record<string, unknown>>(
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
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
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
  let data: z.infer<typeof PatchProgressSchema>;
  try {
    data = PatchProgressSchema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    const zerr = handleZodError(err);
    if (zerr) return zerr;
    throw err;
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (typeof data.box === 'number') { sets.push('box = ?'); params.push(data.box); }
  if (typeof data.wrongCount === 'number') { sets.push('wrong_count = ?'); params.push(data.wrongCount); }
  if (typeof data.reviewDelta === 'number') {
    sets.push('review_count = review_count + ?');
    params.push(data.reviewDelta);
  }
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
 * 응시 가능 여부 + 정책 요약
 */
async function handleAvailability(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const db = context.env.DB;
  const policy = await resolveVocabPolicy(db, auth.academyId, auth.teacherId, auth.studentId);
  const avail = await checkAvailability(db, policy, auth.academyId, auth.studentId);

  // 진행 중 시험 있으면 알림
  const inProgress = await executeFirst<{ id: string }>(
    db,
    `SELECT id FROM vocab_print_jobs
      WHERE academy_id = ? AND student_id = ? AND status IN ('pending','in_progress')
      ORDER BY created_at DESC LIMIT 1`,
    [auth.academyId, auth.studentId]
  );

  return successResponse({
    available: avail.ok,
    reason: avail.reason,
    retryAt: avail.retryAt,
    message: avail.message,
    todayCount: avail.todayCount,
    inProgressId: inProgress?.id ?? null,
    policy: {
      vocab_count: policy.vocab_count,
      writing_enabled: !!policy.writing_enabled,
      writing_type: policy.writing_type,
      time_limit_sec: policy.time_limit_sec,
      cooldown_min: policy.cooldown_min,
      daily_limit: policy.daily_limit,
      active_from: policy.active_from,
      active_to: policy.active_to,
    },
  });
}

/**
 * CSAT 카탈로그 단어를 학생 vocab_words 에 시드 (idempotent).
 * tier 미지정 시 모든 tier에서 표본 추출 (max 60개), 지정 시 해당 tier 전체.
 * 이미 학생에게 동일 origin_catalog_word_id가 있으면 skip.
 */
async function ensureCsatWordsForStudent(
  db: D1Database,
  auth: PlayAuth,
  catalogId: string,
  tier?: number
): Promise<void> {
  const tierClause = tier ? 'AND tier = ?' : '';
  const tierParams = tier ? [tier] : [];
  const limit = tier ? 250 : 120;
  const catalogWords = await executeQuery<{
    id: string; english: string; korean: string; pos: string | null; example: string | null;
  }>(
    db,
    `SELECT id, english, korean, pos, example FROM vocab_catalog_words
      WHERE catalog_id = ? ${tierClause}
      ORDER BY rank ASC LIMIT ?`,
    [catalogId, ...tierParams, limit]
  );
  if (catalogWords.length === 0) return;

  // 이미 시드된 catalog word id 목록
  const existingRows = await executeQuery<{ origin_catalog_word_id: string }>(
    db,
    `SELECT origin_catalog_word_id FROM vocab_words
      WHERE academy_id = ? AND student_id = ?
        AND origin_catalog_word_id IS NOT NULL`,
    [auth.academyId, auth.studentId]
  );
  const seeded = new Set(existingRows.map((r) => r.origin_catalog_word_id));

  const toInsert = catalogWords.filter((cw) => !seeded.has(cw.id));
  if (toInsert.length === 0) return;

  const stmts = toInsert.map((cw) => {
    const id = generatePrefixedId('vw');
    return db.prepare(
      `INSERT INTO vocab_words
         (id, academy_id, student_id, english, korean, pos, example, status, added_by, origin_catalog_word_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 'catalog', ?)`
    ).bind(
      id, auth.academyId, auth.studentId,
      cw.english, cw.korean, cw.pos, cw.example, cw.id
    );
  });
  if (stmts.length > 0) await db.batch(stmts);
}

/**
 * 학생이 직접 시험지 생성 + 시작 — 정책 기반 차단/풀 구성
 * body: { max_words?: number, source?: 'mywords'|'csat', tier?: 1|2|3, catalog_id? }
 */
async function handleSelfStartPrintJob(
  request: Request,
  context: RequestContext,
  auth: PlayAuth
): Promise<Response> {
  const db = context.env.DB;
  let parsed: z.infer<typeof SelfStartSchema>;
  try {
    parsed = SelfStartSchema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    const zerr = handleZodError(err);
    if (zerr) return zerr;
    throw err;
  }

  // 정책 resolve + 가용성 체크
  const policy = await resolveVocabPolicy(db, auth.academyId, auth.teacherId, auth.studentId);
  const avail = await checkAvailability(db, policy, auth.academyId, auth.studentId);
  if (!avail.ok) {
    return errorResponse(avail.message ?? '지금은 응시할 수 없습니다', 429);
  }

  // CSAT (공유 카탈로그) 시험: 카탈로그 단어를 학생 vocab_words 에 시드하여
  // 기존 my-words 흐름에 합류시킨다. 학생은 카탈로그 단어를 자기 단어장에 갖게 되어
  // 자연스러운 복습 루프로 연결.
  if (parsed.source === 'csat') {
    await ensureCsatWordsForStudent(db, auth, parsed.catalog_id ?? 'csat-megastudy-2025', parsed.tier);
  }

  // 정책 vocab_count를 기본, max_words 가 더 작으면 그걸 사용 (학생 입장에선 줄이는 것만 허용)
  const maxWords = Math.min(parsed.max_words ?? policy.vocab_count, policy.vocab_count);
  const allowedBoxes = parseBoxFilter(policy.box_filter);
  const boxPlaceholders = allowedBoxes.map(() => '?').join(',');

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

  // 정책 box_filter + word_cooldown_min 적용
  const cooldownClause = policy.word_cooldown_min > 0
    ? `AND (last_quizzed_at IS NULL OR datetime(last_quizzed_at) <= datetime('now', '-${policy.word_cooldown_min} minutes'))`
    : '';
  // CSAT 모드: 방금 시드한 카탈로그 출신 단어로만 풀 한정
  const csatClause = parsed.source === 'csat'
    ? `AND origin_catalog_word_id IS NOT NULL
       AND origin_catalog_word_id IN (
         SELECT id FROM vocab_catalog_words
          WHERE catalog_id = ? ${parsed.tier ? 'AND tier = ?' : ''}
       )`
    : '';
  const csatParams: unknown[] = parsed.source === 'csat'
    ? (parsed.tier ? [parsed.catalog_id ?? 'csat-megastudy-2025', parsed.tier] : [parsed.catalog_id ?? 'csat-megastudy-2025'])
    : [];
  const candidates = await executeQuery<any>(
    db,
    `SELECT * FROM vocab_words
      WHERE academy_id = ? AND student_id = ? AND status = 'approved'
        AND box IN (${boxPlaceholders}) ${cooldownClause} ${csatClause}`,
    [auth.academyId, auth.studentId, ...allowedBoxes, ...csatParams]
  );
  if (candidates.length < 1) {
    if (parsed.source === 'csat') {
      return errorResponse(
        '수능 단어 시드가 비어있어요. 잠시 후 다시 시도해 주세요.',
        409
      );
    }
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
  const jobSource = parsed.source === 'csat'
    ? (parsed.tier ? `csat-tier${parsed.tier}` : 'csat-mixed')
    : 'mywords';
  await executeInsert(
    db,
    `INSERT INTO vocab_print_jobs
       (id, academy_id, student_id, word_ids_json, created_by, status, started_at, policy_id, source)
     VALUES (?, ?, ?, ?, ?, 'in_progress', datetime('now'), ?, ?)`,
    [jobId, auth.academyId, auth.studentId,
     JSON.stringify(selected.map(w => w.id)),
     `student:${auth.studentId}`,
     policy.id,
     jobSource]
  );

  // last_quizzed_at 갱신 — 동일 단어 cooldown 적용용
  if (selected.length > 0) {
    const placeholders = selected.map(() => '?').join(',');
    await db.prepare(
      `UPDATE vocab_words SET last_quizzed_at = datetime('now')
        WHERE academy_id = ? AND id IN (${placeholders})`
    ).bind(auth.academyId, ...selected.map(w => w.id)).run();
  }

  // choices snapshot 생성 (start 로직과 동일). pool LIMIT 제거 — 전체 approved에서 distractor 샘플링.
  // buildQuestion 은 단어당 *한 번만* 호출 — DB 저장본과 클라 응답본이 동일한 셔플을 공유해야 한다.
  // (이전: 두 번 호출 → 학생이 본 화면의 정답 위치와 DB의 correct_index 가 어긋나 정답을 골라도 오답 판정됨)
  // distractor 풀: CSAT 모드면 동일 학생의 카탈로그 출신 단어로 한정
  // (mywords 풀과 섞이면 난이도 균형이 깨지고 한국어 뜻 풀에 어색한 답이 섞일 수 있음)
  const allPool = parsed.source === 'csat'
    ? await executeQuery<any>(
        db,
        `SELECT id, english, korean FROM vocab_words
          WHERE academy_id = ? AND student_id = ? AND status = 'approved'
            AND origin_catalog_word_id IS NOT NULL`,
        [auth.academyId, auth.studentId]
      )
    : await executeQuery<any>(
        db,
        `SELECT id, english, korean FROM vocab_words
          WHERE academy_id = ? AND status = 'approved'`,
        [auth.academyId]
      );
  const built = selected.map(t => ({ t, q: buildQuestion(t, allPool) }));

  const stmts = built.map(({ t, q }) =>
    db.prepare(
      `INSERT INTO vocab_print_answers (print_job_id, word_id, correct_index, choices_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(print_job_id, word_id) DO NOTHING`
    ).bind(jobId, t.id, q.correctIndex, JSON.stringify(q.choices))
  );
  if (stmts.length > 0) await db.batch(stmts);

  // 생성된 job + 오늘 N번째 정보 응답 — 위에서 만든 동일한 q를 재사용
  const questions = built.map(({ t, q }) => ({
    wordId: t.id,
    prompt: t.english,
    choices: q.choices,
    selectedIndex: null as number | null,
  }));
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

/** 오늘 제출된 self-start 시험 개수 — 기록 탭 stat 용 */
async function handleGetTodayStats(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const todayDone = await executeFirst<{ n: number }>(
    context.env.DB,
    `SELECT COUNT(*) AS n FROM vocab_print_jobs
      WHERE academy_id = ? AND student_id = ? AND created_by = ?
        AND status = 'submitted'
        AND date(submitted_at) = date('now')`,
    [auth.academyId, auth.studentId, `student:${auth.studentId}`]
  );
  return successResponse({ todayCount: todayDone?.n || 0 });
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
  // self-start 직후 batch insert 와 read 간 D1 consistency lag 방어: 1회 retry
  let owned = await executeFirst<any>(
    db,
    `SELECT 1 AS ok FROM vocab_print_answers WHERE print_job_id = ? AND word_id = ?`,
    [jobId, wordId]
  );
  if (!owned) {
    await new Promise((r) => setTimeout(r, 100));
    owned = await executeFirst<any>(
      db,
      `SELECT 1 AS ok FROM vocab_print_answers WHERE print_job_id = ? AND word_id = ?`,
      [jobId, wordId]
    );
  }
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
    if (pathname === '/api/play/vocab/stats/today') {
      if (method === 'GET') return await handleGetTodayStats(context, auth);
      return errorResponse('Method not allowed', 405);
    }
    if (pathname === '/api/play/vocab/print/self-start') {
      if (method === 'POST') return await handleSelfStartPrintJob(request, context, auth);
      return errorResponse('Method not allowed', 405);
    }
    if (pathname === '/api/play/vocab/exam/availability') {
      if (method === 'GET') return await handleAvailability(context, auth);
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
