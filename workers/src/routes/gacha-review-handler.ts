/**
 * POST /api/gacha/review — concept-gacha 카드 결과 기록 + review 신호 내부 emit.
 * 서비스 상태(gacha_session_cards)를 쓰고, 같은 Worker 안에서 emitSignal을 직접 호출(HTTP 없음).
 * academy_id는 JWT 파생, erp_student_id 소유권은 emitSignal이 최종 검증.
 * 설계: cloudflare-integration.md §1·§4 (내부 발신).
 */
import { RequestContext } from '@/types';
import { getAcademyId } from '@/utils/context';
import { successResponse, errorResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { generatePrefixedId } from '@/utils/id';
import { isValidId } from '@/utils/sanitize';
import { executeFirst } from '@/utils/db';
import { emitSignal } from '@/services/signal-service';

export async function handleGachaReview(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (method !== 'POST' || pathname !== '/api/gacha/review') {
      return errorResponse('지원하지 않는 요청', 404);
    }
    const academyId = getAcademyId(context);
    const env = context.env;
    const body = (await request.json()) as {
      session_id?: string; card_id?: string; result?: string;
      box_from?: number; box_to?: number; concept?: string; erp_student_id?: string;
    };

    if (!isValidId(body.erp_student_id)) return errorResponse('erp_student_id 필요', 400);
    if (!isValidId(body.card_id)) return errorResponse('card_id 필요', 400);
    if (body.result !== 'pass' && body.result !== 'fail') return errorResponse("result는 pass|fail", 400);
    const boxFrom = Number(body.box_from ?? 1);
    const boxTo = Number(body.box_to ?? 1);
    if (!Number.isFinite(boxFrom) || !Number.isFinite(boxTo)) return errorResponse('box 값 오류', 400);

    // 서비스행을 신호와 같은 원자 배치에 — 세션(신규)·카드행을 extraStatements로 묶음.
    const extra: D1PreparedStatement[] = [];
    let sessionId = body.session_id;
    if (sessionId) {
      const own = await executeFirst<{ ok: number }>(
        env.DB, 'SELECT 1 AS ok FROM gacha_sessions WHERE id = ? AND academy_id = ?', [sessionId, academyId]
      );
      if (!own) return errorResponse('세션 없음/타학원', 404);
    } else {
      sessionId = generatePrefixedId('gs');
      extra.push(env.DB.prepare(
        'INSERT INTO gacha_sessions (id, academy_id, erp_student_id) VALUES (?, ?, ?)'
      ).bind(sessionId, academyId, body.erp_student_id));
    }
    const cardRowId = generatePrefixedId('gsc');
    extra.push(env.DB.prepare(
      `INSERT INTO gacha_session_cards (id, academy_id, session_id, card_id, result, box_from, box_to)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(cardRowId, academyId, sessionId, body.card_id, body.result, boxFrom, boxTo));

    // 내부 emit (server-trust). 서비스행+신호 원자 적재. ingest_id = 카드 행 id → 자연 멱등.
    const sig = await emitSignal(env, {
      academyId, source: 'gacha', kind: 'review',
      payload: { card_id: body.card_id, result: body.result, box_from: boxFrom, box_to: boxTo, concept: body.concept ?? '' },
      ts: new Date().toISOString(), ingestId: cardRowId, erpStudentId: body.erp_student_id, trust: 'server',
      actorId: context.auth?.userId,
    }, { extraStatements: extra });
    if (!sig.ok) return errorResponse(`신호 실패: ${sig.reason}`, 422);

    return successResponse({ session_id: sessionId, card: cardRowId, signal: sig.inserted });
  } catch (e) {
    return handleRouteError(e, 'gacha review');
  }
}
