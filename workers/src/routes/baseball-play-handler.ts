/**
 * Word Baseball 학생용 핸들러 (PIN 토큰)
 * 로그인은 /api/play/login (gacha-play-handler) 공유 — 같은 KV 토큰.
 *
 * 듀얼 구조 (이닝별 분리)
 *   - 이닝 1·2 → "모르는 단어" 풀: box ≤ 2 OR wrong_count ≥ 2
 *   - 이닝 3·4 → "내 단어장" 풀: added_by = 'student'
 *   - 풀이 4개 미만이면 학생 전체 vocab_words 에서 fallback
 *
 * box는 직접 변경하지 않음 (SEC-VOCAB-H1 정책 — 시험 채점만이 box 채널).
 * wrong_count / review_count 만 누적.
 */
import { z } from 'zod';
import type { RequestContext } from '@/types';
import { executeQuery } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { isValidId } from '@/utils/sanitize';
import {
  baseballWordsRateLimit,
  baseballFinishRateLimit,
  baseballFinishIdempotency,
} from '@/middleware/rateLimit';

interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

interface WordRow {
  id: string;
  english: string;
  korean: string;
}

const POOL_SIZE = 20;       // 게임 시작 시 한 이닝당 미리 받아두는 단어 수
const MIN_FOR_DISTRACTORS = 4;
const MAX_FINISH_IDS = 60;  // 실제 게임 최대 = MAX_PITCHES_PER_HALF(7) × 8 half = 56 → 여유 +4

// ── 인증 ──
async function getPlayAuth(context: RequestContext): Promise<PlayAuth | null> {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return (await context.env.KV.get(`play:${token}`, 'json')) as PlayAuth | null;
}

// ── 단어 풀 ──
async function fetchWeakPool(
  context: RequestContext,
  academyId: string,
  studentId: string,
  limit: number,
): Promise<WordRow[]> {
  return executeQuery<WordRow>(
    context.env.DB,
    `SELECT id, english, korean
     FROM vocab_words
     WHERE academy_id = ?
       AND student_id = ?
       AND status = 'approved'
       AND (box <= 2 OR wrong_count >= 2)
     ORDER BY (box * 10) + (CASE WHEN wrong_count > 10 THEN 10 ELSE wrong_count END) ASC,
              RANDOM()
     LIMIT ?`,
    [academyId, studentId, limit],
  );
}

async function fetchMyAddedPool(
  context: RequestContext,
  academyId: string,
  studentId: string,
  limit: number,
): Promise<WordRow[]> {
  return executeQuery<WordRow>(
    context.env.DB,
    `SELECT id, english, korean
     FROM vocab_words
     WHERE academy_id = ?
       AND student_id = ?
       AND status = 'approved'
       AND added_by = 'student'
     ORDER BY RANDOM()
     LIMIT ?`,
    [academyId, studentId, limit],
  );
}

async function fetchAllApprovedPool(
  context: RequestContext,
  academyId: string,
  studentId: string,
  limit: number,
): Promise<WordRow[]> {
  return executeQuery<WordRow>(
    context.env.DB,
    `SELECT id, english, korean
     FROM vocab_words
     WHERE academy_id = ?
       AND student_id = ?
       AND status = 'approved'
     ORDER BY RANDOM()
     LIMIT ?`,
    [academyId, studentId, limit],
  );
}

function mergeUniq(...pools: WordRow[][]): WordRow[] {
  const seen = new Set<string>();
  const out: WordRow[] = [];
  for (const pool of pools) {
    for (const w of pool) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      out.push(w);
    }
  }
  return out;
}

// ── GET /api/play/baseball/words?inning=N ──
async function handleGetWords(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const rateBlock = await baseballWordsRateLimit(context.env.KV, auth.studentId);
  if (rateBlock) return rateBlock;

  const url = new URL(context.request.url);
  const inningRaw = url.searchParams.get('inning');
  const inning = Number(inningRaw);
  if (!Number.isInteger(inning) || inning < 1 || inning > 4) {
    return errorResponse('입력 검증 오류: inning은 1~4', 400);
  }
  const usesWeak = inning <= 2;

  const primary = usesWeak
    ? await fetchWeakPool(context, auth.academyId, auth.studentId, POOL_SIZE)
    : await fetchMyAddedPool(context, auth.academyId, auth.studentId, POOL_SIZE);

  let pool = primary;
  let source: 'weak' | 'my' | 'fallback' = usesWeak ? 'weak' : 'my';

  if (pool.length < MIN_FOR_DISTRACTORS) {
    const fallback = await fetchAllApprovedPool(context, auth.academyId, auth.studentId, POOL_SIZE);
    pool = mergeUniq(primary, fallback);
    if (pool.length < MIN_FOR_DISTRACTORS) {
      return successResponse({
        words: pool,
        source: 'empty',
        message: '단어장이 비어있어요. 선생님께 단어 등록을 부탁하세요.',
      });
    }
    source = 'fallback';
  }

  return successResponse({ words: pool, source });
}

// ── POST /api/play/baseball/finish ──
// Body: { gameId: string, missedIds: string[], correctIds: string[] }
//   - gameId: 클라이언트가 게임 시작 시 1회 생성한 uuid. 멱등성 키.
const FinishSchema = z.object({
  gameId: z.string().min(1).max(64),
  missedIds: z.array(z.string()).max(MAX_FINISH_IDS).default([]),
  correctIds: z.array(z.string()).max(MAX_FINISH_IDS).default([]),
});

async function handleFinish(
  request: Request,
  context: RequestContext,
  auth: PlayAuth,
): Promise<Response> {
  const rateBlock = await baseballFinishRateLimit(context.env.KV, auth.studentId);
  if (rateBlock) return rateBlock;

  let parsed: z.infer<typeof FinishSchema>;
  try {
    parsed = FinishSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(`입력 검증 오류: ${err.errors.map((e) => e.message).join(', ')}`, 400);
    }
    throw err;
  }

  if (!isValidId(parsed.gameId)) {
    return errorResponse('입력 검증 오류: gameId 형식', 400);
  }

  // 멱등성 — 같은 game_id 두 번째 호출은 즉시 통과 (CLAUDE.md Ⅱ-5)
  const idem = await baseballFinishIdempotency(context.env.KV, auth.studentId, parsed.gameId);
  if (idem.duplicate) {
    return successResponse({ updated: 0, duplicate: true });
  }

  // ID 형식 검증 + 중복 제거 + 양쪽 동시 출현 방지(맞은 게 우선)
  const correctSet = new Set(parsed.correctIds.filter((id) => isValidId(id)));
  const missedSet = new Set(parsed.missedIds.filter((id) => isValidId(id) && !correctSet.has(id)));

  if (missedSet.size === 0 && correctSet.size === 0) {
    return successResponse({ updated: 0 });
  }

  // 학생 자기 단어만 갱신되도록 academy_id + student_id 격리 보장.
  // N+1 방지 — IN(...) 단일 UPDATE 2회.
  const statements: any[] = [];
  if (missedSet.size > 0) {
    const ids = [...missedSet];
    const placeholders = ids.map(() => '?').join(',');
    statements.push(
      context.env.DB.prepare(
        `UPDATE vocab_words
         SET wrong_count = wrong_count + 1,
             updated_at = datetime('now')
         WHERE academy_id = ? AND student_id = ? AND id IN (${placeholders})`,
      ).bind(auth.academyId, auth.studentId, ...ids),
    );
  }
  if (correctSet.size > 0) {
    const ids = [...correctSet];
    const placeholders = ids.map(() => '?').join(',');
    statements.push(
      context.env.DB.prepare(
        `UPDATE vocab_words
         SET review_count = review_count + 1,
             updated_at = datetime('now')
         WHERE academy_id = ? AND student_id = ? AND id IN (${placeholders})`,
      ).bind(auth.academyId, auth.studentId, ...ids),
    );
  }
  await context.env.DB.batch(statements);

  return successResponse({
    updated: missedSet.size + correctSet.size,
    missed: missedSet.size,
    correct: correctSet.size,
  });
}

// ── 디스패처 ──
export async function handleBaseballPlay(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext,
): Promise<Response> {
  try {
    const auth = await getPlayAuth(context);
    if (!auth) return unauthorizedResponse();

    if (pathname === '/api/play/baseball/words' && method === 'GET') {
      return await handleGetWords(context, auth);
    }
    if (pathname === '/api/play/baseball/finish' && method === 'POST') {
      return await handleFinish(request, context, auth);
    }
    return errorResponse('Not Found', 404);
  } catch (err) {
    return handleRouteError(err, 'baseball-play');
  }
}
