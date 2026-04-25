/**
 * Vocab Exam Policy 핸들러 (교사/admin JWT)
 *
 * GET    /api/vocab/policy                    학원 + 모든 오버라이드 목록
 * GET    /api/vocab/policy/effective?student=&teacher=
 *                                              실제 적용되는 정책 (resolve 결과)
 * PUT    /api/vocab/policy/:scope/:scopeId     생성/수정 (scopeId='_'면 academy)
 * DELETE /api/vocab/policy/:scope/:scopeId     오버라이드 삭제 (academy는 비활성으로만)
 */
import { z } from 'zod';
import { RequestContext } from '@/types';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert, executeUpdate, executeDelete } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { resolveVocabPolicy, VocabPolicy } from '@/utils/vocab-policy';

const PolicyUpdateSchema = z.object({
  vocab_count: z.number().int().min(1).max(50).optional(),
  context_count: z.number().int().min(0).max(20).optional(),
  grammar_count: z.number().int().min(0).max(20).optional(),
  writing_enabled: z.union([z.boolean(), z.number()]).optional(),
  writing_type: z.enum(['sentence_completion', 'word_arrangement', 'summary_writing', 'free_writing']).nullable().optional(),
  box_filter: z.string().regex(/^[1-5](,[1-5])*$/).optional(),
  source: z.enum(['student_pool', 'textbook', 'mixed']).optional(),
  textbook_id: z.string().nullable().optional(),
  time_limit_sec: z.number().int().min(0).max(7200).optional(),
  cooldown_min: z.number().int().min(0).max(1440).optional(),
  daily_limit: z.number().int().min(0).max(50).optional(),
  active_from: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  active_to: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  word_cooldown_min: z.number().int().min(0).max(10080).optional(),
  ai_grading: z.union([z.boolean(), z.number()]).optional(),
  enabled: z.union([z.boolean(), z.number()]).optional(),
});

function toInt01(v: unknown): number | undefined {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v ? 1 : 0;
  return undefined;
}

async function handleListPolicies(context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const rows = await executeQuery<VocabPolicy>(
    context.env.DB,
    `SELECT * FROM vocab_exam_policy WHERE academy_id = ? ORDER BY scope, scope_id`,
    [academyId]
  );
  return successResponse(rows);
}

async function handleGetEffective(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student');
  const teacherId = url.searchParams.get('teacher');
  const policy = await resolveVocabPolicy(context.env.DB, academyId, teacherId, studentId);
  return successResponse(policy);
}

async function handleUpsertPolicy(
  request: Request, context: RequestContext, scope: string, scopeId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  if (!['academy', 'teacher', 'student'].includes(scope)) {
    return errorResponse('scope는 academy|teacher|student', 400);
  }
  const academyId = getAcademyId(context);
  const userId = getUserId(context);

  let data: z.infer<typeof PolicyUpdateSchema>;
  try {
    data = PolicyUpdateSchema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(`입력 검증 오류: ${err.errors[0]?.message}`, 400);
    }
    throw err;
  }

  const sid = scope === 'academy' ? null : scopeId;

  // 기존 행 조회
  const existing = await executeFirst<{ id: string }>(
    context.env.DB,
    `SELECT id FROM vocab_exam_policy
      WHERE academy_id = ? AND scope = ? AND ${sid === null ? 'scope_id IS NULL' : 'scope_id = ?'}`,
    sid === null ? [academyId, scope] : [academyId, scope, sid]
  );

  if (existing) {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (k === 'writing_enabled' || k === 'ai_grading' || k === 'enabled') {
        sets.push(`${k} = ?`); params.push(toInt01(v));
      } else {
        sets.push(`${k} = ?`); params.push(v);
      }
    }
    if (sets.length === 0) return successResponse({ id: existing.id, updated: false });
    sets.push(`updated_at = datetime('now')`);
    params.push(existing.id);
    await executeUpdate(
      context.env.DB,
      `UPDATE vocab_exam_policy SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    return successResponse({ id: existing.id, updated: true });
  }

  // 신규
  const id = generatePrefixedId('vep');
  await executeInsert(
    context.env.DB,
    `INSERT INTO vocab_exam_policy
      (id, academy_id, scope, scope_id, vocab_count, context_count, grammar_count,
       writing_enabled, writing_type, box_filter, source, textbook_id,
       time_limit_sec, cooldown_min, daily_limit, active_from, active_to,
       word_cooldown_min, ai_grading, enabled, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, academyId, scope, sid,
      data.vocab_count ?? 10, data.context_count ?? 0, data.grammar_count ?? 0,
      toInt01(data.writing_enabled) ?? 0, data.writing_type ?? null,
      data.box_filter ?? '1,2,3,4', data.source ?? 'student_pool', data.textbook_id ?? null,
      data.time_limit_sec ?? 600, data.cooldown_min ?? 60, data.daily_limit ?? 3,
      data.active_from ?? null, data.active_to ?? null,
      data.word_cooldown_min ?? 30, toInt01(data.ai_grading) ?? 1, toInt01(data.enabled) ?? 1,
      userId,
    ]
  );
  return successResponse({ id, created: true }, 201);
}

async function handleDeletePolicy(
  context: RequestContext, scope: string, scopeId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  if (scope === 'academy') {
    return errorResponse('학원 기본 정책은 삭제할 수 없습니다 (enabled=false로만 가능)', 400);
  }
  const academyId = getAcademyId(context);
  const sid = scopeId;
  const result = await executeDelete(
    context.env.DB,
    `DELETE FROM vocab_exam_policy WHERE academy_id = ? AND scope = ? AND scope_id = ?`,
    [academyId, scope, sid]
  );
  return successResponse({ deleted: true, changes: (result as any)?.changes ?? 0 });
}

export async function handleVocabPolicy(
  method: string, pathname: string, request: Request, context: RequestContext
): Promise<Response> {
  try {
    if (pathname === '/api/vocab/policy') {
      if (method === 'GET') return await handleListPolicies(context);
      return errorResponse('Method not allowed', 405);
    }
    if (pathname === '/api/vocab/policy/effective') {
      if (method === 'GET') return await handleGetEffective(request, context);
      return errorResponse('Method not allowed', 405);
    }
    const m = pathname.match(/^\/api\/vocab\/policy\/(academy|teacher|student)\/([^/]+)$/);
    if (m) {
      const scope = m[1];
      const scopeId = decodeURIComponent(m[2]);
      if (method === 'PUT') return await handleUpsertPolicy(request, context, scope, scopeId);
      if (method === 'DELETE') return await handleDeletePolicy(context, scope, scopeId);
      return errorResponse('Method not allowed', 405);
    }
    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, 'Vocab Policy');
  }
}
