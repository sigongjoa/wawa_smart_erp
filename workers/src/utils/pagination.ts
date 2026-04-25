/**
 * 공통 페이징 파라미터 파서.
 * Query string: ?limit=50&offset=0
 * - limit: 1~maxLimit (기본 50)
 * - offset: 0~ (기본 0)
 */

export interface Pagination {
  limit: number;
  offset: number;
}

export function parsePagination(
  url: URL,
  opts: { defaultLimit?: number; maxLimit?: number } = {}
): Pagination {
  const defaultLimit = opts.defaultLimit ?? 50;
  const maxLimit = opts.maxLimit ?? 500;

  const rawLimit = Number(url.searchParams.get('limit'));
  const rawOffset = Number(url.searchParams.get('offset'));

  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), maxLimit)
    : defaultLimit;

  const offset = Number.isFinite(rawOffset) && rawOffset >= 0
    ? Math.floor(rawOffset)
    : 0;

  return { limit, offset };
}

/**
 * 페이징 응답의 정식 스키마.
 *
 * 응답 envelope이 ApiResponse<PagedResult<T>>이므로 최종 JSON은
 *   { success: true, data: { items: [...], pagination: { ... } }, timestamp: ... }
 *
 * "data: T[]"로 두면 envelope의 data와 충돌해 이중 wrap이 되므로 반드시 items 사용.
 */
export interface PagedResult<T> {
  items: T[];
  pagination: {
    total?: number;       // 전체 행수 (선택)
    limit: number;
    offset: number;
    nextOffset: number | null;
  };
}

export function toPagedResult<T>(rows: T[], pagination: Pagination, total?: number): PagedResult<T> {
  const { limit, offset } = pagination;
  const nextOffset = rows.length < limit ? null : offset + limit;
  return { items: rows, pagination: { total, limit, offset, nextOffset } };
}
