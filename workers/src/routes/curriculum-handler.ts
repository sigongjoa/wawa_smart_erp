/**
 * 커리큘럼 관리 — 학원 단위 카탈로그
 *
 * GET    /api/curricula?term=&grade=&subject=&include_archived= 카탈로그 목록
 * POST   /api/curricula                                          생성
 * GET    /api/curricula/:id                                      상세 + 항목 + 사용 학생수
 * PATCH  /api/curricula/:id                                      메타 수정
 * DELETE /api/curricula/:id                                      soft archive
 * POST   /api/curricula/:id/items                                항목 추가
 * PATCH  /api/curricula/:id/items/:itemId                        항목 수정
 * DELETE /api/curricula/:id/items/:itemId                        항목 삭제
 * POST   /api/curricula/:id/items/reorder                        order_idx 일괄 변경
 *
 * 권한: admin / instructor 모두 편집 가능 (academy 격리는 academy_id로)
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeUpdate } from '@/utils/db';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  createdResponse,
} from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { generateId } from '@/utils/id';
import { logger } from '@/utils/logger';

interface CurriculumRow {
  id: string;
  academy_id: string;
  term: string;
  grade: string;
  subject: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface CurriculumItemRow {
  id: string;
  curriculum_id: string;
  textbook: string | null;
  unit_name: string;
  kind: string;
  order_idx: number;
  description: string | null;
  default_purpose: string | null;
  created_at: string;
}

const ALLOWED_KINDS = ['unit', 'type'] as const;

const FIELD_MAX_LEN = {
  term: 32,
  grade: 16,
  subject: 32,
  title: 128,
  description: 1024,
  textbook: 128,
  unit_name: 256,
  default_purpose: 64,
} as const;

function lenError(field: keyof typeof FIELD_MAX_LEN, v: any): Response | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return errorResponse(`${field}: must be string`, 400);
  if (v.length > FIELD_MAX_LEN[field]) return errorResponse(`${field}: max length ${FIELD_MAX_LEN[field]}`, 400);
  return null;
}

/** 빈 문자열을 null로 정규화 (DB 저장 일관성) */
function normalizeNullable(v: any): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
}

export async function handleCurriculum(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (!requireAuth(context)) return unauthorizedResponse();
    const db = context.env.DB;
    const academyId = getAcademyId(context);
    const userId = getUserId(context);
    const role = context.auth!.role;
    const isAdmin = role === 'admin';

    /** PATCH/DELETE는 작성자 또는 admin만 가능 */
    function canEdit(c: CurriculumRow): boolean {
      return isAdmin || c.created_by === userId;
    }

    // GET /api/curricula
    if (method === 'GET' && pathname === '/api/curricula') {
      const url = new URL(request.url);
      const term = url.searchParams.get('term');
      const grade = url.searchParams.get('grade');
      const subject = url.searchParams.get('subject');
      const includeArchived = url.searchParams.get('include_archived') === '1';

      const params: any[] = [academyId];
      // LEFT JOIN으로 한 번에 카운트 (correlated subquery N+1 회피)
      let sql = `SELECT c.*,
                        COUNT(DISTINCT ci.id) AS item_count,
                        COUNT(DISTINCT sli.student_id) AS student_count
                 FROM curricula c
                 LEFT JOIN curriculum_items ci ON ci.curriculum_id = c.id
                 LEFT JOIN student_lesson_items sli
                   ON sli.curriculum_item_id = ci.id AND sli.archived_at IS NULL
                 WHERE c.academy_id = ?`;
      if (!includeArchived) sql += ' AND c.archived_at IS NULL';
      if (term)    { sql += ' AND c.term = ?';    params.push(term); }
      if (grade)   { sql += ' AND c.grade = ?';   params.push(grade); }
      if (subject) { sql += ' AND c.subject = ?'; params.push(subject); }
      sql += ' GROUP BY c.id ORDER BY c.term DESC, c.grade, c.subject';

      const rows = await executeQuery<CurriculumRow & { item_count: number; student_count: number }>(
        db, sql, params
      );
      return successResponse(rows);
    }

    // POST /api/curricula
    if (method === 'POST' && pathname === '/api/curricula') {
      const body = (await request.json().catch(() => ({}))) as Partial<CurriculumRow>;
      if (!body.term || !body.grade || !body.subject || !body.title) {
        return errorResponse('term, grade, subject, title 필수', 400);
      }
      for (const f of ['term', 'grade', 'subject', 'title', 'description'] as const) {
        const e = lenError(f, body[f]); if (e) return e;
      }
      const id = generateId();
      await executeUpdate(
        db,
        `INSERT INTO curricula (id, academy_id, term, grade, subject, title, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, academyId, body.term, body.grade, body.subject, body.title, body.description ?? null, userId]
      );
      const row = await executeFirst<CurriculumRow>(
        db, 'SELECT * FROM curricula WHERE id = ?', [id]
      );
      return createdResponse({ ...row!, item_count: 0, student_count: 0 });
    }

    // /:id 와 하위 경로 — 라우트 매칭 순서 의존성 명시:
    //   reorderMatch는 itemPatchMatch보다 먼저 분기되어야 함 (둘 다 /items/X 형태)
    const RESERVED_ITEM_ACTIONS = new Set(['reorder']);
    const idMatch = pathname.match(/^\/api\/curricula\/([^/]+)$/);
    const itemsAddMatch = pathname.match(/^\/api\/curricula\/([^/]+)\/items$/);
    const itemPatchMatch = pathname.match(/^\/api\/curricula\/([^/]+)\/items\/([^/]+)$/);
    const reorderMatch = pathname.match(/^\/api\/curricula\/([^/]+)\/items\/reorder$/);

    async function loadCurriculum(id: string): Promise<CurriculumRow | null> {
      return await executeFirst<CurriculumRow>(
        db,
        'SELECT * FROM curricula WHERE id = ? AND academy_id = ?',
        [id, academyId]
      );
    }

    // GET /:id (상세 + 항목)
    if (method === 'GET' && idMatch) {
      const c = await loadCurriculum(idMatch[1]);
      if (!c) return notFoundResponse();
      const items = await executeQuery<CurriculumItemRow>(
        db,
        'SELECT * FROM curriculum_items WHERE curriculum_id = ? ORDER BY order_idx, created_at',
        [c.id]
      );
      return successResponse({ ...c, items });
    }

    // PATCH /:id
    if (method === 'PATCH' && idMatch) {
      const c = await loadCurriculum(idMatch[1]);
      if (!c) return notFoundResponse();
      if (!canEdit(c)) return errorResponse('편집 권한이 없습니다 (작성자/관리자만)', 403);
      const body = (await request.json().catch(() => ({}))) as Partial<CurriculumRow>;
      const updates: string[] = []; const params: any[] = [];
      for (const k of ['term', 'grade', 'subject', 'title', 'description'] as const) {
        if (k in body) {
          const e = lenError(k, (body as any)[k]);
          if (e) return e;
          // description은 빈 문자열 → null 정규화
          const val = k === 'description' ? normalizeNullable((body as any)[k]) : (body as any)[k];
          updates.push(`${k} = ?`); params.push(val);
        }
      }
      if (updates.length === 0) return successResponse({ ok: true });
      updates.push("updated_at = datetime('now')");
      params.push(c.id);
      await executeUpdate(db, `UPDATE curricula SET ${updates.join(', ')} WHERE id = ?`, params);
      return successResponse({ ok: true });
    }

    // DELETE /:id (soft archive)
    if (method === 'DELETE' && idMatch) {
      const c = await loadCurriculum(idMatch[1]);
      if (!c) return notFoundResponse();
      if (!canEdit(c)) return errorResponse('삭제 권한이 없습니다 (작성자/관리자만)', 403);
      await executeUpdate(
        db,
        "UPDATE curricula SET archived_at = datetime('now') WHERE id = ?",
        [c.id]
      );
      return successResponse({ ok: true });
    }

    // POST /:id/items/reorder — 라우트 가드: reorder는 RESERVED_ITEM_ACTIONS에 등록되어
    //                            아래 itemPatchMatch가 itemId='reorder'로 오인 분기하지 않도록 함
    if (method === 'POST' && reorderMatch) {
      const c = await loadCurriculum(reorderMatch[1]);
      if (!c) return notFoundResponse();
      if (!canEdit(c)) return errorResponse('편집 권한 없음', 403);
      const body = (await request.json().catch(() => ({}))) as {
        items?: Array<{ id: string; order_idx: number }>;
      };
      if (!Array.isArray(body.items)) return errorResponse('items 배열 필요', 400);
      // batch 처리 — N+1 회피
      const stmts = body.items.map((it) =>
        db.prepare(
          'UPDATE curriculum_items SET order_idx = ? WHERE id = ? AND curriculum_id = ?'
        ).bind(it.order_idx, it.id, c.id)
      );
      if (stmts.length > 0) await db.batch(stmts);
      return successResponse({ ok: true });
    }

    // POST /:id/items
    if (method === 'POST' && itemsAddMatch) {
      const c = await loadCurriculum(itemsAddMatch[1]);
      if (!c) return notFoundResponse();
      if (!canEdit(c)) return errorResponse('편집 권한 없음', 403);
      const body = (await request.json().catch(() => ({}))) as Partial<CurriculumItemRow>;
      if (!body.unit_name) return errorResponse('unit_name 필수', 400);
      for (const f of ['textbook', 'unit_name', 'description', 'default_purpose'] as const) {
        const e = lenError(f, body[f]); if (e) return e;
      }
      const kind = body.kind && (ALLOWED_KINDS as readonly string[]).includes(body.kind)
        ? body.kind : 'type';
      const id = generateId();
      await executeUpdate(
        db,
        `INSERT INTO curriculum_items
         (id, curriculum_id, textbook, unit_name, kind, order_idx, description, default_purpose)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, c.id,
          normalizeNullable(body.textbook),
          body.unit_name,
          kind,
          body.order_idx ?? 0,
          normalizeNullable(body.description),
          normalizeNullable(body.default_purpose),
        ]
      );
      const row = await executeFirst<CurriculumItemRow>(
        db, 'SELECT * FROM curriculum_items WHERE id = ?', [id]
      );
      return createdResponse(row);
    }

    // PATCH/DELETE /:id/items/:itemId — RESERVED_ITEM_ACTIONS 가드
    if (itemPatchMatch) {
      const [, curriculumId, itemId] = itemPatchMatch;
      if (RESERVED_ITEM_ACTIONS.has(itemId)) {
        // 'reorder' 등 예약 키워드는 위에서 이미 분기됐어야 함. 여기 도달했다면 method 불일치
        return errorResponse('Method not allowed for this action', 405);
      }
      const c = await loadCurriculum(curriculumId);
      if (!c) return notFoundResponse();
      const item = await executeFirst<CurriculumItemRow>(
        db, 'SELECT * FROM curriculum_items WHERE id = ? AND curriculum_id = ?',
        [itemId, c.id]
      );
      if (!item) return notFoundResponse();

      if (method === 'DELETE') {
        if (!canEdit(c)) return errorResponse('삭제 권한 없음', 403);
        await executeUpdate(db, 'DELETE FROM curriculum_items WHERE id = ?', [itemId]);
        return successResponse({ ok: true });
      }
      if (method === 'PATCH') {
        if (!canEdit(c)) return errorResponse('편집 권한 없음', 403);
        const body = (await request.json().catch(() => ({}))) as Partial<CurriculumItemRow>;
        const updates: string[] = []; const params: any[] = [];

        // 명시적 if 분기로 exception flow control 제거
        if ('textbook' in body) {
          const e = lenError('textbook', body.textbook); if (e) return e;
          updates.push('textbook = ?'); params.push(normalizeNullable(body.textbook));
        }
        if ('unit_name' in body) {
          const e = lenError('unit_name', body.unit_name); if (e) return e;
          if (!body.unit_name || (typeof body.unit_name === 'string' && body.unit_name.trim() === '')) {
            return errorResponse('unit_name은 비울 수 없습니다', 400);
          }
          updates.push('unit_name = ?'); params.push(body.unit_name);
        }
        if ('kind' in body && (ALLOWED_KINDS as readonly string[]).includes(body.kind!)) {
          updates.push('kind = ?'); params.push(body.kind);
        }
        if ('order_idx' in body) {
          updates.push('order_idx = ?'); params.push(body.order_idx);
        }
        if ('description' in body) {
          const e = lenError('description', body.description); if (e) return e;
          updates.push('description = ?'); params.push(normalizeNullable(body.description));
        }
        if ('default_purpose' in body) {
          const e = lenError('default_purpose', body.default_purpose); if (e) return e;
          updates.push('default_purpose = ?'); params.push(normalizeNullable(body.default_purpose));
        }
        if (updates.length === 0) return successResponse({ ok: true });
        params.push(itemId);
        await executeUpdate(db, `UPDATE curriculum_items SET ${updates.join(', ')} WHERE id = ?`, params);
        return successResponse({ ok: true });
      }
    }

    return errorResponse('Not found', 404);
  } catch (err) {
    logger.error('curriculum handler error', err instanceof Error ? err : new Error(String(err)));
    return errorResponse('커리큘럼 처리 실패', 500);
  }
}
