import type { ReactNode } from 'react';

interface Props {
  total: number;
  limit: number;
  offset: number;
  onChange: (nextOffset: number) => void;
  loading?: boolean;
}

/** 단순 prev/next 페이지바. total <= limit이면 렌더링 자체 스킵. */
export function Pager({ total, limit, offset, onChange, loading }: Props): ReactNode {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const last = Math.max(1, Math.ceil(total / limit));
  return (
    <div
      className="vocab-pager"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '12px 0',
        fontSize: 13,
        color: '#475569',
      }}
    >
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={offset === 0 || loading}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        ‹ 이전
      </button>
      <span>{page} / {last}</span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={offset + limit >= total || loading}
        onClick={() => onChange(offset + limit)}
      >
        다음 ›
      </button>
    </div>
  );
}
