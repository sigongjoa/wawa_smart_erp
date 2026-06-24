/**
 * /api/ssaem/* — ssaemkeeper (공유 D1 통합). 주로 신호 소비 + 활동 기록.
 *   POST /api/ssaem/activity — 활동 기록 + activity 신호 내부 emit
 *   GET  /api/ssaem/feed?erp_student_id= — recommendations 소비(읽기 전용)
 * 설계: cloudflare-integration.md §4 (ssaemkeeper | activity | signals·recommend 소비 | 내부+소비).
 */
import { RequestContext } from '@/types';
import { getAcademyId } from '@/utils/context';
import { successResponse, errorResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { generatePrefixedId } from '@/utils/id';
import { isValidId } from '@/utils/sanitize';
import { executeFirst } from '@/utils/db';
import { emitSignal } from '@/services/signal-service';
import { handleRecommendQueue, handleRecommendPatch } from '@/routes/ssaem-rs-handler';

export async function handleSsaem(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    const academyId = getAcademyId(context);
    const env = context.env;

    // ── 소비: 추천 피드 읽기 ──
    if (method === 'GET' && pathname === '/api/ssaem/feed') {
      const sid = new URL(request.url).searchParams.get('erp_student_id') ?? '';
      if (!isValidId(sid)) return errorResponse('erp_student_id 필요', 400);
      const row = await executeFirst<{ items: string }>(
        env.DB,
        'SELECT items FROM recommendations WHERE academy_id = ? AND erp_student_id = ?',
        [academyId, sid]
      );
      const items = row ? JSON.parse(row.items) : [];
      return successResponse({ erp_student_id: sid, items });
    }

    // ── 발신: 활동 기록 + activity 신호 ──
    if (method === 'POST' && pathname === '/api/ssaem/activity') {
      const body = (await request.json()) as {
        erp_student_id?: string; kind?: string; subject?: string;
        topic?: string; grade?: number; tags?: string[];
      };
      if (!isValidId(body.erp_student_id)) return errorResponse('erp_student_id 필요', 400);
      if (!body.kind || !body.subject) return errorResponse('kind·subject 필요', 400);
      let grade: number | null = null;
      if (body.grade != null) {
        grade = Number(body.grade);
        if (!Number.isFinite(grade)) return errorResponse('grade 값 오류', 400);
      }

      // 활동행 + 태그를 신호와 같은 원자 배치로 (정합성 + 태그 N+1 제거)
      const actId = generatePrefixedId('sa');
      const extra: D1PreparedStatement[] = [
        env.DB.prepare(
          `INSERT INTO ssaem_activities (id, academy_id, erp_student_id, kind, subject, topic, grade)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(actId, academyId, body.erp_student_id, body.kind, body.subject, body.topic ?? null, grade),
      ];
      for (const tag of (body.tags ?? []).slice(0, 10)) {
        if (typeof tag === 'string' && tag.length <= 40) {
          extra.push(env.DB.prepare(
            'INSERT INTO ssaem_activity_tags (id, academy_id, activity_id, tag) VALUES (?, ?, ?, ?)'
          ).bind(generatePrefixedId('st'), academyId, actId, tag));
        }
      }

      const sig = await emitSignal(env, {
        academyId, source: 'ssaemkeeper', kind: 'activity',
        payload: { kind: body.kind, subject: body.subject, topic: body.topic ?? '', grade: grade ?? 0 },
        ts: new Date().toISOString(), ingestId: actId, erpStudentId: body.erp_student_id, trust: 'server',
        actorId: context.auth?.userId,
      }, { extraStatements: extra });
      if (!sig.ok) return errorResponse(`신호 실패: ${sig.reason}`, 422);

      return successResponse({ activity: actId, signal: sig.inserted });
    }

    // ── 2계층 RS — 강사 추천 큐 (override) ──
    if (method === 'GET' && pathname === '/api/ssaem/recommendations') {
      return await handleRecommendQueue(request, context, academyId);
    }
    const patchMatch = pathname.match(/^\/api\/ssaem\/recommendations\/([^/]+)$/);
    if (method === 'PATCH' && patchMatch) {
      return await handleRecommendPatch(request, context, academyId, patchMatch[1]);
    }

    return errorResponse('지원하지 않는 요청', 404);
  } catch (e) {
    return handleRouteError(e, 'ssaem');
  }
}
