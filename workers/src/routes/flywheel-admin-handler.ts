/**
 * /api/flywheel/* — 운영/관리 엔드포인트 (강사·관리자 전용).
 *   POST /api/flywheel/drain          — recommend-infer 큐를 동기 드레인(테스트·수동 트리거). cron과 별개.
 *   POST /api/flywheel/erase {erp_student_id} — 삭제권: 학생 DEK 폐기(crypto-shred) + 추천 제거.
 * 설계: architecture.md §8.5 (삭제권) · cloudflare-integration.md §3.
 */
import { RequestContext } from '@/types';
import { getAcademyId } from '@/utils/context';
import { successResponse, errorResponse, forbiddenResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { isValidId } from '@/utils/sanitize';
import { executeFirst } from '@/utils/db';
import { drainRecommendJobs } from '@/services/recommend-service';

function requireStaff(context: RequestContext): boolean {
  const role = context.auth?.role;
  return role === 'admin' || role === 'instructor';
}

export async function handleFlywheelAdmin(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    const academyId = getAcademyId(context); // JWT 파생 + 테넌트 검증
    if (!requireStaff(context)) return forbiddenResponse();
    const env = context.env;

    if (method === 'POST' && pathname === '/api/flywheel/drain') {
      const processed = await drainRecommendJobs(env);
      return successResponse({ processed });
    }

    if (method === 'POST' && pathname === '/api/flywheel/erase') {
      const body = (await request.json()) as { erp_student_id?: string };
      if (!isValidId(body.erp_student_id)) return errorResponse('erp_student_id 필요', 400);
      // 소유권 — 타학원 학생 삭제권 행사 차단
      const own = await executeFirst<{ ok: number }>(
        env.DB, 'SELECT 1 AS ok FROM students WHERE id = ? AND academy_id = ?', [body.erp_student_id, academyId]
      );
      if (!own) return errorResponse('학생이 해당 academy 소속이 아님', 404);

      // DEK 폐기(복호 불가 = 사실상 삭제) + 추천 제거 (append-only 원본은 보존되나 복호 불가)
      await env.DB.batch([
        env.DB.prepare("UPDATE student_keys SET shredded_at = datetime('now') WHERE erp_student_id = ? AND academy_id = ?")
          .bind(body.erp_student_id, academyId),
        env.DB.prepare('DELETE FROM recommendations WHERE erp_student_id = ? AND academy_id = ?')
          .bind(body.erp_student_id, academyId),
        env.DB.prepare(
          `INSERT INTO access_log (id, academy_id, actor_id, erp_student_id, action, detail)
           VALUES (?, ?, ?, ?, 'erase', 'crypto-shred')`
        ).bind(`acl-${crypto.randomUUID().split('-')[0]}`, academyId, context.auth?.userId ?? 'staff', body.erp_student_id),
      ]);
      return successResponse({ erased: true });
    }

    return errorResponse('지원하지 않는 요청', 404);
  } catch (e) {
    return handleRouteError(e, 'flywheel admin');
  }
}
