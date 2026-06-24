/**
 * /api/ssaem/recommendations — 2계층 RS 강사 큐 + override.
 *   설계: vine-flywheel/docs/specs/rs-api-contract.md §3·§4 (SSOT) · rs-two-layer-design §1·§7(관리쌤).
 *   인증: JWT 강사 — index.ts authMiddleware/tenantMiddleware 통과 후 getAcademyId 해석.
 *
 *   GET   /api/ssaem/recommendations?academy_id=…   → 학생별 아이템 + risk{churn,stale_days}
 *   PATCH /api/ssaem/recommendations/:item_id        → approve|reject|boost|edit_reason|replace (+ intervention emit)
 */
import { RequestContext } from '@/types';
import { successResponse, errorResponse } from '@/utils/response';
import { executeQuery, executeFirst } from '@/utils/db';
import { isValidId, sanitizeNullable } from '@/utils/sanitize';
import { emitSignal } from '@/services/signal-service';
import { generatePrefixedId } from '@/utils/id';

interface ItemRow {
  id: string; erp_student_id: string; rank: number; action_type: string; action_ref: string | null;
  target_path: string; reason: string | null; urgency: string; score_total: number | null;
  status: string; teacher_note: string | null; generated_at: string; acted_at: string | null;
}

function toRecItem(r: ItemRow): Record<string, unknown> {
  return {
    id: r.id, rank: r.rank, type: r.action_type,
    title: r.reason ?? r.action_ref ?? '추천', reason: r.reason ?? '',
    urgency: r.urgency, score: r.score_total ?? 0, target_path: r.target_path,
    status: r.status, teacher_note: r.teacher_note ?? null,
  };
}

/** 이탈위험·미행동 일수 — 가장 최근 acted_at(없으면 generated_at) 기준 stale_days, urgency critical이면 churn. */
function riskOf(items: ItemRow[]): { churn: boolean; stale_days: number } {
  if (items.length === 0) return { churn: false, stale_days: 0 };
  // 마지막 행동 시각: acted_at 중 최대. 없으면 가장 오래된 generated_at으로 미행동 일수 측정.
  const now = Date.now();
  const lastActed = items.map((i) => (i.acted_at ? Date.parse(i.acted_at) : 0)).reduce((a, b) => Math.max(a, b), 0);
  const oldestGen = items.map((i) => Date.parse(i.generated_at)).reduce((a, b) => Math.min(a, b), now);
  const ref = lastActed > 0 ? lastActed : oldestGen;
  const staleDays = Math.max(0, Math.floor((now - ref) / 86_400_000));
  const churn = staleDays >= 3 || items.some((i) => i.urgency === 'critical');
  return { churn, stale_days: staleDays };
}

/** GET — 학생별 그룹핑된 전체 아이템(pending 포함, rejected 제외) + risk. */
export async function handleRecommendQueue(
  request: Request, context: RequestContext, academyId: string
): Promise<Response> {
  const qAcademy = new URL(request.url).searchParams.get('academy_id');
  // academy_id 쿼리는 명시적으로 와도 JWT academy와 일치해야 함(cross-tenant 차단).
  if (qAcademy && qAcademy !== academyId) return errorResponse('테넌트 불일치', 403);

  const rows = await executeQuery<ItemRow & { name: string | null; grade: string | null }>(
    context.env.DB,
    `SELECT ri.id, ri.erp_student_id, ri.rank, ri.action_type, ri.action_ref, ri.target_path,
            ri.reason, ri.urgency, ri.score_total, ri.status, ri.teacher_note, ri.generated_at, ri.acted_at,
            s.name AS name, s.grade AS grade
     FROM recommendation_items ri
     JOIN students s ON s.id = ri.erp_student_id AND s.academy_id = ri.academy_id
     WHERE ri.academy_id = ? AND ri.status != 'teacher_rejected'
     ORDER BY ri.erp_student_id, ri.rank ASC`,
    [academyId]
  );

  const byStudent = new Map<string, { name: string | null; grade: string | null; items: ItemRow[] }>();
  for (const r of rows) {
    let g = byStudent.get(r.erp_student_id);
    if (!g) { g = { name: r.name, grade: r.grade, items: [] }; byStudent.set(r.erp_student_id, g); }
    g.items.push(r);
  }

  const students = [...byStudent.entries()].map(([sid, g]) => ({
    erp_student_id: sid,
    name: g.name ?? '',
    grade: g.grade ?? null,
    items: g.items.map(toRecItem),
    risk: riskOf(g.items),
  }));

  return successResponse({ students });
}

const VALID_PATCH = new Set(['approve', 'reject', 'boost', 'edit_reason', 'replace']);
const LEVER: Record<string, string> = { approve: 'assign', reject: 'reject', boost: 'boost' };

/** PATCH — status 전이 + 선택적 intervention 신호. */
export async function handleRecommendPatch(
  request: Request, context: RequestContext, academyId: string, itemId: string
): Promise<Response> {
  if (!isValidId(itemId)) return errorResponse('item_id 형식 오류', 400);
  const body = (await request.json().catch(() => ({}))) as { action?: string; note?: string; new_target?: string };
  const action = body.action ?? '';
  if (!VALID_PATCH.has(action)) return errorResponse('action은 approve|reject|boost|edit_reason|replace', 400);

  const item = await executeFirst<{ erp_student_id: string; rank: number }>(
    context.env.DB,
    'SELECT erp_student_id, rank FROM recommendation_items WHERE id = ? AND academy_id = ?',
    [itemId, academyId]
  );
  if (!item) return errorResponse('추천 아이템을 찾을 수 없습니다', 404);

  let sql: string;
  let params: unknown[];
  switch (action) {
    case 'approve':
      sql = `UPDATE recommendation_items SET status='teacher_approved' WHERE id=? AND academy_id=?`;
      params = [itemId, academyId];
      break;
    case 'reject':
      sql = `UPDATE recommendation_items SET status='teacher_rejected' WHERE id=? AND academy_id=?`;
      params = [itemId, academyId];
      break;
    case 'boost':
      // 부스트 = 최상위. 같은 학생의 다른 행 rank를 +1 밀고 이 행을 1로.
      await context.env.DB.prepare(
        `UPDATE recommendation_items SET rank = rank + 1
         WHERE academy_id = ? AND erp_student_id = ? AND id != ?`
      ).bind(academyId, item.erp_student_id, itemId).run();
      sql = `UPDATE recommendation_items SET status='teacher_boosted', rank=1 WHERE id=? AND academy_id=?`;
      params = [itemId, academyId];
      break;
    case 'edit_reason':
      sql = `UPDATE recommendation_items SET reason=?, teacher_note=? WHERE id=? AND academy_id=?`;
      params = [sanitizeNullable(body.note, 200), sanitizeNullable(body.note, 200), itemId, academyId];
      break;
    case 'replace':
      if (!body.new_target) return errorResponse('replace는 new_target 필요', 400);
      sql = `UPDATE recommendation_items SET target_path=? WHERE id=? AND academy_id=?`;
      params = [sanitizeNullable(body.new_target, 200), itemId, academyId];
      break;
    default:
      return errorResponse('지원하지 않는 action', 400);
  }
  await context.env.DB.prepare(sql).bind(...params).run();

  // 관리쌤 개입 씨앗 데이터 — approve/reject/boost는 intervention 신호로 적재(개입→행동변화 인과 라벨).
  const lever = LEVER[action];
  if (lever) {
    await emitSignal(context.env, {
      academyId, source: 'ssaemkeeper', kind: 'intervention',
      payload: { lever, target_item: itemId },
      ts: new Date().toISOString(), ingestId: `intv-${itemId}-${action}-${generatePrefixedId('x')}`,
      erpStudentId: item.erp_student_id, trust: 'server', actorId: context.auth?.userId,
    });
  }

  const updated = await executeFirst<ItemRow>(
    context.env.DB,
    `SELECT id, erp_student_id, rank, action_type, action_ref, target_path, reason, urgency,
            score_total, status, teacher_note, generated_at, acted_at
     FROM recommendation_items WHERE id = ? AND academy_id = ?`,
    [itemId, academyId]
  );
  return successResponse({ ok: true, item: updated ? toRecItem(updated) : null });
}
