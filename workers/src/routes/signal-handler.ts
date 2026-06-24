/**
 * POST /api/signal — 외부 생성 워커(edu-arch·수행평가)용 신호 수신 입구.
 * 내부 서비스(가챠·징검다리·쌤키퍼)는 emitSignal을 직접 호출(HTTP 불필요).
 *
 * 인증 두 갈래:
 *  ① 워커키(X-Signal-Worker-Key == env.SIGNAL_WORKER_KEY) → server-trust.
 *     신뢰된 서버측 코드이므로 academy_id를 바디로 받음(emitSignal 소유권 가드가 최종 방어).
 *  ② JWT(getAcademyId, IDOR 방어) → client-trust. academy_id는 토큰에서 파생, 바디 무시.
 * 설계: cloudflare-integration.md §3.2 · /sc:analyze 반영(워커키 server-trust 경로).
 */
import { RequestContext } from '@/types';
import { successResponse, errorResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { isValidId } from '@/utils/sanitize';
import { emitSignal } from '@/services/signal-service';

/** 공유 시크릿 상수시간 비교 (타이밍 누설 차단). 미설정/길이불일치는 즉시 false. */
function safeEqual(a: string | null, b: string | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function handleSignal(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (method !== 'POST' || pathname !== '/api/signal') {
      return errorResponse('지원하지 않는 요청', 404);
    }

    const body = (await request.json()) as {
      source?: string; kind?: string; payload?: Record<string, unknown>;
      ts?: string; ingest_id?: string; erp_student_id?: string;
      external_id?: string; academy_id?: string;
    };

    // /api/signal은 외부 생성 워커 전용 — 워커키(server-trust)로 자체 인증.
    // (전역 JWT 게이트를 우회해 이 핸들러 앞단에서 디스패치됨. 내부 서비스는 emitSignal 직접 호출.)
    const workerKey = request.headers.get('X-Signal-Worker-Key');
    if (!safeEqual(workerKey, context.env.SIGNAL_WORKER_KEY)) {
      return errorResponse('유효한 워커키 필요 (X-Signal-Worker-Key)', 401);
    }
    if (!body.academy_id || !isValidId(body.academy_id)) {
      return errorResponse('academy_id 필요', 400);
    }
    const academyId = body.academy_id; // 신뢰된 워커 — 소유권 가드가 최종 검증
    const trust: 'server' | 'client' = 'server';

    const res = await emitSignal(context.env, {
      academyId,
      source: body.source ?? '',
      kind: body.kind ?? '',
      payload: body.payload ?? {},
      ts: body.ts ?? new Date().toISOString(),
      ingestId: body.ingest_id ?? '',
      erpStudentId: body.erp_student_id,
      externalId: body.external_id,
      trust,
    });

    if (!res.ok) return errorResponse(res.reason ?? '신호 거부', 422);
    return successResponse({ inserted: res.inserted });
  } catch (e) {
    return handleRouteError(e, '신호 수신');
  }
}
