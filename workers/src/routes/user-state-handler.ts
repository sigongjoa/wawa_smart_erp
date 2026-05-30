/**
 * 페이지별 마지막 화면 자동 저장 (user_page_state)
 * migration 075 — 모든 페이지가 공유하는 범용 KV-스타일 테이블.
 *
 * GET  /api/user-state/:page_key  → { state: any | null }
 * PUT  /api/user-state/:page_key  → upsert. body = { state: any (≤2KB stringified) }
 */

import { RequestContext } from '@/types';
import { executeFirst, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { isValidId, sanitizeText } from '@/utils/sanitize';

const PAGE_KEY_RE = /^[a-z0-9_-]+$/;
const STATE_MAX_BYTES = 2048;

export async function handleUserState(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const db = context.env.DB;
  const academyId = context.auth!.academyId;
  const userId = context.auth!.userId;

  const match = pathname.match(/^\/api\/user-state\/([^/]+)$/);
  if (!match) return errorResponse('Not found', 404);

  const pageKey = match[1];
  if (!isValidId(pageKey, 32) || !PAGE_KEY_RE.test(pageKey)) {
    return errorResponse('잘못된 page_key', 400);
  }

  if (method === 'GET') {
    const row = await executeFirst<{ state_json: string; updated_at: string }>(
      db,
      `SELECT state_json, updated_at FROM user_page_state
        WHERE academy_id = ? AND user_id = ? AND page_key = ?`,
      [academyId, userId, pageKey]
    );
    if (!row) return successResponse({ state: null });
    let parsed: unknown = null;
    try { parsed = JSON.parse(row.state_json); } catch { parsed = null; }
    return successResponse({ state: parsed, updated_at: row.updated_at });
  }

  if (method === 'PUT') {
    const body = await request.json() as any;
    if (body?.state === undefined || body.state === null) {
      // null이면 삭제로 간주
      await executeUpdate(db,
        `DELETE FROM user_page_state WHERE academy_id = ? AND user_id = ? AND page_key = ?`,
        [academyId, userId, pageKey]
      );
      return successResponse({ cleared: true });
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(body.state);
    } catch {
      return errorResponse('state 직렬화 실패', 400);
    }
    // 위생화 + 사이즈 캡 (제어문자 제거 후 2KB 컷)
    const cleaned = sanitizeText(serialized, STATE_MAX_BYTES);
    if (!cleaned) return errorResponse('state가 비어있습니다', 400);

    await executeUpdate(db,
      `INSERT INTO user_page_state (academy_id, user_id, page_key, state_json, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(academy_id, user_id, page_key) DO UPDATE
         SET state_json = excluded.state_json,
             updated_at = excluded.updated_at`,
      [academyId, userId, pageKey, cleaned]
    );
    return successResponse({ saved: true });
  }

  return errorResponse('Method Not Allowed', 405);
}
