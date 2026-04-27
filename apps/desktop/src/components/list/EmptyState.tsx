import type { ReactNode } from 'react';

interface Props {
  hasFilter: boolean;
  hasAnyData?: boolean;
  filteredTitle?: string;
  filteredHint?: string;
  emptyTitle?: string;
  emptyHint?: string;
  onClearFilter?: () => void;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; href: string };
}

/** 필터 적용 vs 데이터 자체 부재를 분리해 UX 혼란 차단. */
export function EmptyState({
  hasFilter,
  hasAnyData = true,
  filteredTitle = '조건에 맞는 항목이 없어요',
  filteredHint = '필터를 바꾸거나 초기화해보세요.',
  emptyTitle = '아직 데이터가 없어요',
  emptyHint,
  onClearFilter,
  primary,
  secondary,
}: Props): ReactNode {
  if (hasFilter && hasAnyData) {
    return (
      <div className="vocab-empty-state">
        <div className="vocab-empty-state__title">{filteredTitle}</div>
        <p className="vocab-empty-state__hint">{filteredHint}</p>
        {onClearFilter && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClearFilter}>
            필터 초기화
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="vocab-empty-state">
      <div className="vocab-empty-state__title">{emptyTitle}</div>
      {emptyHint && <p className="vocab-empty-state__hint">{emptyHint}</p>}
      {primary && (
        <button type="button" className="btn btn-primary btn-sm" onClick={primary.onClick}>
          {primary.label}
        </button>
      )}
      {secondary && (
        <a className="btn btn-secondary btn-sm" href={secondary.href}>
          {secondary.label}
        </a>
      )}
    </div>
  );
}
