/**
 * 페이지네이션 + counts 공통 헬퍼.
 *
 * "200건 캡 + 클라사이드 필터" 부류 버그를 라우트마다 재구현하지 않게.
 *
 * 사용 예 (vocab_words):
 *   const result = await paginatedList<VocabWordRow>({
 *     db: context.env.DB,
 *     table: 'vocab_words',
 *     baseFilters: [
 *       { sql: 'academy_id = ?', param: academyId },
 *       studentId && { sql: 'student_id = ?', param: studentId },
 *     ],
 *     extraFilters: [
 *       status && { sql: 'status = ?', param: status },
 *     ],
 *     countsBy: { column: 'status', values: ['pending', 'approved'] },
 *     orderBy: "CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC",
 *     pagination: pg,
 *   });
 *   return successResponse({ items: result.items, pagination: result.pagination, counts: result.counts });
 */

import { executeQuery, executeFirst } from './db';
import { Pagination, PagedResult, toPagedResult } from './pagination';

export type Filter = { sql: string; param?: unknown } | null | false | undefined;

/**
 * countsBy.column / orderBy / table / selectColumns / join 은 SQL에 그대로 보간되므로
 * 호출부에서 사용자 입력을 직접 넘기면 안 됨. 컬럼명은 다음 패턴만 허용:
 *   word_chars (a-z, A-Z, 0-9, _)  + 선택적 alias prefix ("s.", "j." 등)
 * 예: 'status', 's.status', 'j.status'.
 */
const SAFE_IDENT_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)?$/;

function assertSafeColumn(col: string, label: string): void {
  if (!SAFE_IDENT_RE.test(col)) {
    throw new Error(`paginatedList: ${label} must be a safe identifier (a-z 0-9 _ with optional alias.), got: ${col}`);
  }
}

export interface PaginatedListOptions {
  db: D1Database;
  table: string;
  /** SELECT 컬럼 — JOIN 시 alias 포함 자유 형식. 기본 '*' */
  selectColumns?: string;
  /** JOIN 절 (선택) — 'JOIN gacha_students s ON s.id = j.student_id' */
  join?: string;
  /** counts/total/items 모두에 적용되는 필터 */
  baseFilters: Filter[];
  /** items/total에만 추가 적용 (counts에는 무시 — 메트릭 카드 정확도를 위해) */
  extraFilters?: Filter[];
  /** 메트릭 카드용 — 컬럼별 값 빈도 카운트. baseFilters만 적용. */
  countsBy?: { column: string; values: string[] };
  orderBy: string;
  pagination: Pagination;
}

export interface PaginatedListResult<T> extends PagedResult<T> {
  counts: { all: number } & Record<string, number>;
}

function compactFilters(fs: Filter[]): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const f of fs) {
    if (!f) continue;
    parts.push(f.sql);
    if ('param' in f && f.param !== undefined) params.push(f.param);
  }
  return { sql: parts.join(' AND '), params };
}

export async function paginatedList<T>(
  opts: PaginatedListOptions,
): Promise<PaginatedListResult<T>> {
  const select = opts.selectColumns ?? '*';
  const join = opts.join ? ` ${opts.join}` : '';
  const base = compactFilters(opts.baseFilters);
  const extra = compactFilters(opts.extraFilters ?? []);

  const baseWhere = base.sql || '1=1';
  const fullWhere = extra.sql ? `${baseWhere} AND ${extra.sql}` : baseWhere;
  const fullParams = [...base.params, ...extra.params];

  // counts (baseFilters 만)
  let counts: { all: number } & Record<string, number> = { all: 0 };
  if (opts.countsBy) {
    assertSafeColumn(opts.countsBy.column, 'countsBy.column');
    const sumExprs = opts.countsBy.values
      .map(v => `SUM(CASE WHEN ${opts.countsBy!.column} = '${v.replace(/'/g, "''")}' THEN 1 ELSE 0 END) AS "${v.replace(/"/g, '')}"`)
      .join(', ');
    const row = await executeFirst<Record<string, number>>(
      opts.db,
      `SELECT COUNT(*) AS all_, ${sumExprs} FROM ${opts.table}${join} WHERE ${baseWhere}`,
      base.params,
    );
    counts = { all: Number(row?.all_ ?? 0) } as { all: number } & Record<string, number>;
    for (const v of opts.countsBy.values) {
      counts[v] = Number(row?.[v] ?? 0);
    }
  } else {
    const row = await executeFirst<{ all_: number }>(
      opts.db,
      `SELECT COUNT(*) AS all_ FROM ${opts.table}${join} WHERE ${baseWhere}`,
      base.params,
    );
    counts = { all: Number(row?.all_ ?? 0) };
  }

  // total (extraFilters 적용)
  const totalRow = await executeFirst<{ n: number }>(
    opts.db,
    `SELECT COUNT(*) AS n FROM ${opts.table}${join} WHERE ${fullWhere}`,
    fullParams,
  );
  const total = Number(totalRow?.n ?? 0);

  // items
  const rows = await executeQuery<T>(
    opts.db,
    `SELECT ${select} FROM ${opts.table}${join} WHERE ${fullWhere} ORDER BY ${opts.orderBy} LIMIT ? OFFSET ?`,
    [...fullParams, opts.pagination.limit, opts.pagination.offset],
  );

  const paged = toPagedResult(rows, opts.pagination, total);
  return { ...paged, counts };
}
