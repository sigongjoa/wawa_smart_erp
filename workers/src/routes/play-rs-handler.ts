/**
 * /api/play/today, /api/play/recommendations/:id/act — 학생 "오늘의 길" RS 표면.
 *   설계: vine-flywheel/docs/specs/rs-api-contract.md §1·§2 (SSOT shape) · rs-two-layer-design §1·§4.
 *   인증: 학생 PIN 토큰(KV play:*) — 기존 /api/play/* 패턴(gacha-play-handler.getPlayAuth) 재사용.
 *
 *   GET  /api/play/today                       → 랭크드 자동 피드 + 콜드스타트 폴백
 *   POST /api/play/recommendations/:id/act      → recommendation_action 신호 emit + acted_at 갱신
 */
import { RequestContext } from '@/types';
import { executeQuery, executeFirst } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { isValidId } from '@/utils/sanitize';
import { emitSignal } from '@/services/signal-service';
import { generatePrefixedId } from '@/utils/id';

interface PlayAuth { studentId: string; academyId: string; teacherId: string; name: string; }

async function getPlayAuth(context: RequestContext): Promise<PlayAuth | null> {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return (await context.env.KV.get(`play:${token}`, 'json')) as PlayAuth | null;
}

/** DB row → 계약(RecItem) shape. */
interface ItemRow {
  id: string; rank: number; action_type: string; action_ref: string | null; target_path: string;
  reason: string | null; urgency: string; score_total: number | null; status: string; teacher_note: string | null;
}
function toRecItem(r: ItemRow): Record<string, unknown> {
  return {
    id: r.id,
    rank: r.rank,
    type: r.action_type,
    title: r.reason ?? r.action_ref ?? '오늘의 추천', // title은 자동 생성 reason 기반 (FE가 카드 헤더로 표시)
    reason: r.reason ?? '',
    urgency: r.urgency,
    score: r.score_total ?? 0,
    target_path: r.target_path,
    status: r.status,
    teacher_note: r.teacher_note ?? null,
  };
}

/** GET /api/play/today — status∈(auto_served,teacher_approved,teacher_boosted), rejected 제외, acted(완료/거절) 제외. */
async function handleToday(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const rows = await executeQuery<ItemRow>(
    context.env.DB,
    `SELECT id, rank, action_type, action_ref, target_path, reason, urgency, score_total, status, teacher_note
     FROM recommendation_items
     WHERE academy_id = ? AND erp_student_id = ?
       AND status IN ('auto_served','teacher_approved','teacher_boosted')
       AND acted_at IS NULL
     ORDER BY rank ASC`,
    [auth.academyId, auth.studentId]
  );

  if (rows.length === 0) {
    // 콜드스타트 폴백 체인: 강사 배정 → 커리큘럼 기본 → 온보딩 픽. 빈 피드 금지.
    const fallback = await coldStartFallback(context, auth);
    return successResponse({ actions: fallback, generated_at: new Date().toISOString(), cold_start: true });
  }

  return successResponse({
    actions: rows.map(toRecItem),
    generated_at: new Date().toISOString(),
    cold_start: false,
  });
}

/**
 * 콜드스타트 폴백 — 신호0 학생에 빈 피드를 주지 않는다.
 *   1) 강사 배정 가챠 카드가 있으면 그 첫 개념으로 가챠 행동.
 *   2) 없으면 온보딩 픽(학생이 관심단원 고르도록 유도).
 */
async function coldStartFallback(context: RequestContext, auth: PlayAuth): Promise<Record<string, unknown>[]> {
  // 가챠 카탈로그에 개념이 하나라도 있으면 그걸 첫 행동으로.
  // gacha_cards는 ERP(019: topic/chapter) vs 공유D1(077: concept) 스키마 공유 — 양쪽 컬럼 coalesce, 실패 시 폴백.
  let concept: string | null | undefined;
  try {
    const card = await executeFirst<{ concept: string | null }>(
      context.env.DB,
      `SELECT COALESCE(concept, topic, chapter) AS concept FROM gacha_cards
       WHERE academy_id = ? AND COALESCE(concept, topic, chapter) IS NOT NULL LIMIT 1`,
      [auth.academyId]
    );
    concept = card?.concept;
  } catch {
    concept = null; // 컬럼/테이블 부재 → 온보딩 픽으로.
  }
  if (concept) {
    return [{
      id: `cold-${auth.studentId}`,
      rank: 1,
      type: 'gacha_deck',
      title: `${concept} 시작하기`,
      reason: '오늘 첫 한 걸음',
      urgency: 'medium',
      score: 0,
      target_path: `/gacha?concept=${encodeURIComponent(concept)}`,
      status: 'auto_served',
      teacher_note: null,
    }];
  }
  // 온보딩 픽
  return [{
    id: `onboard-${auth.studentId}`,
    rank: 1,
    type: 'review',
    title: '오늘 시작할 단원 고르기',
    reason: '관심 단원을 하나 골라봐요',
    urgency: 'low',
    score: 0,
    target_path: '/onboarding',
    status: 'auto_served',
    teacher_note: null,
  }];
}

const VALID_ACTIONS = new Set(['shown', 'clicked', 'completed', 'dismissed']);

/** POST /api/play/recommendations/:id/act — 신호 emit + acted_at 갱신(completed/dismissed면 피드서 제외). */
async function handleAct(request: Request, context: RequestContext, auth: PlayAuth, itemId: string): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action ?? '';
  if (!VALID_ACTIONS.has(action)) return errorResponse('action은 shown|clicked|completed|dismissed', 400);

  // 본인 아이템인지 확인 (cross-student IDOR 차단). 콜드/온보딩 가상 id(cold-/onboard-)는 신호만 적재.
  let realItem = false;
  if (isValidId(itemId)) {
    const own = await executeFirst<{ ok: number }>(
      context.env.DB,
      'SELECT 1 AS ok FROM recommendation_items WHERE id = ? AND academy_id = ? AND erp_student_id = ?',
      [itemId, auth.academyId, auth.studentId]
    );
    realItem = !!own;
  }

  // completed/dismissed → 피드서 제외(acted_at 세팅). 같은 배치에 신호와 합쳐 정합성 확보.
  const extra: D1PreparedStatement[] = [];
  if (realItem && (action === 'completed' || action === 'dismissed')) {
    extra.push(context.env.DB.prepare(
      `UPDATE recommendation_items SET acted_at = datetime('now') WHERE id = ? AND academy_id = ? AND erp_student_id = ?`
    ).bind(itemId, auth.academyId, auth.studentId));
  }

  const sig = await emitSignal(context.env, {
    academyId: auth.academyId, source: 'erp', kind: 'recommendation_action',
    payload: { item_id: itemId, action },
    ts: new Date().toISOString(), ingestId: `recact-${itemId}-${action}-${generatePrefixedId('x')}`,
    erpStudentId: auth.studentId, trust: 'server', actorId: auth.studentId,
  }, { extraStatements: extra });
  if (!sig.ok) return errorResponse(`신호 실패: ${sig.reason}`, 422);

  return successResponse({ ok: true });
}

export async function handlePlayRs(
  method: string, pathname: string, request: Request, context: RequestContext
): Promise<Response> {
  try {
    const auth = await getPlayAuth(context);
    if (!auth) return unauthorizedResponse();

    if (pathname === '/api/play/today') {
      if (method === 'GET') return await handleToday(context, auth);
      return errorResponse('Method not allowed', 405);
    }

    const actMatch = pathname.match(/^\/api\/play\/recommendations\/([^/]+)\/act$/);
    if (actMatch) {
      if (method === 'POST') return await handleAct(request, context, auth, actMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (e) {
    return handleRouteError(e, 'play-rs');
  }
}
