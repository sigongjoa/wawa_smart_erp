/**
 * POST /api/jingdari/attempt — 징검다리 문항 시도 기록 + (오답 시) wrong_answer 신호 내부 emit.
 * 백엔드 0→1: attempts를 D1에 저장(localStorage 폐기). 오답만 학습신호로 발신.
 * 설계: cloudflare-integration.md §4 (jingdari | wrong_answer → recommend | 내부).
 */
import { RequestContext } from '@/types';
import { getAcademyId } from '@/utils/context';
import { successResponse, errorResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { generatePrefixedId } from '@/utils/id';
import { isValidId } from '@/utils/sanitize';
import { emitSignal } from '@/services/signal-service';

export async function handleJingdariAttempt(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (method !== 'POST' || pathname !== '/api/jingdari/attempt') {
      return errorResponse('지원하지 않는 요청', 404);
    }
    const academyId = getAcademyId(context);
    const env = context.env;
    const body = (await request.json()) as {
      item_kid?: string; correct?: boolean; n?: number;
      type?: string; lv?: string; unit?: string; erp_student_id?: string;
    };

    if (!isValidId(body.erp_student_id)) return errorResponse('erp_student_id 필요', 400);
    if (!isValidId(body.item_kid, 128)) return errorResponse('item_kid 필요', 400);
    if (typeof body.correct !== 'boolean') return errorResponse('correct(boolean) 필요', 400);
    const n = Number(body.n ?? 1);
    if (!Number.isFinite(n)) return errorResponse('n 값 오류', 400);

    const attemptId = generatePrefixedId('ja');
    const attemptStmt = env.DB.prepare(
      `INSERT INTO jingdari_attempts (id, academy_id, erp_student_id, item_kid, correct, n)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(attemptId, academyId, body.erp_student_id, body.item_kid, body.correct ? 1 : 0, n);

    // 오답일 때만 wrong_answer 신호 발신 — 시도행을 신호와 같은 원자 배치로.
    let signalInserted = false;
    if (!body.correct) {
      const sig = await emitSignal(env, {
        academyId, source: 'jingdari', kind: 'wrong_answer',
        payload: { kid: body.item_kid, type: body.type ?? '', lv: body.lv ?? '', unit: body.unit ?? '', n },
        ts: new Date().toISOString(), ingestId: attemptId, erpStudentId: body.erp_student_id, trust: 'server',
        actorId: context.auth?.userId,
      }, { extraStatements: [attemptStmt] });
      if (!sig.ok) return errorResponse(`신호 실패: ${sig.reason}`, 422);
      signalInserted = sig.inserted ?? false;
    } else {
      await attemptStmt.run(); // 정답은 신호 없이 시도행만 기록
    }

    return successResponse({ attempt: attemptId, signal: signalInserted });
  } catch (e) {
    return handleRouteError(e, 'jingdari attempt');
  }
}
