import type { ReactNode } from 'react';

export interface MetricTab<K extends string> {
  key: K;
  label: string;
  count: number;
  /** 'warning'|'primary'|'success'|'danger' (CSS 클래스 suffix) */
  tone?: 'warning' | 'primary' | 'success' | 'danger';
  /** 카운트가 0이면 비활성 (현재 선택된 탭은 예외) */
  disableWhenZero?: boolean;
}

interface Props<K extends string> {
  tabs: MetricTab<K>[];
  active: K;
  onChange: (key: K) => void;
  /** 라벨 위에 추가 요소 (예: 아이콘) */
  ariaLabel?: string;
}

/**
 * vocab/exam/assignments 등 메트릭 카드 + 탭 필터 UI 공통.
 * counts는 부모(서버 응답)에서 받아 표시만 함 — 클라사이드 카운트 금지.
 */
export function MetricTabs<K extends string>({ tabs, active, onChange, ariaLabel = '상태 필터' }: Props<K>): ReactNode {
  return (
    <div className="vocab-metrics" role="tablist" aria-label={ariaLabel}>
      {tabs.map(t => {
        const toneClass = t.tone ? `vocab-metric--${t.tone}` : '';
        const activeClass = active === t.key ? 'vocab-metric--active' : '';
        const emptyClass = t.count === 0 ? 'vocab-metric--empty' : '';
        const disabled = !!t.disableWhenZero && t.count === 0 && active !== t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            className={`vocab-metric ${toneClass} ${activeClass} ${emptyClass}`.trim()}
            onClick={() => onChange(t.key)}
            disabled={disabled}
          >
            <span className="vocab-metric-value">{t.count}</span>
            <span className="vocab-metric-label">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
