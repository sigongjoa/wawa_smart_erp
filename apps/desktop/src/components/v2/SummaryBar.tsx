import { type ReactNode } from 'react';
import './layout.css';

export interface SummaryCell {
  label: ReactNode;
  value: ReactNode;
  /** value 뒤 작은 부가 단위 (예: "/ 24") */
  sub?: ReactNode;
  /** alert 강조 (danger 색) */
  alert?: boolean;
  /** ARIA */
  hint?: string;
}

interface SummaryBarProps {
  cells: SummaryCell[];
}

/**
 * KPI 가로 strip — mockup v2 의 .summary-bar 패턴.
 * 자동으로 그리드 칸 분배 (minmax 140px).
 */
export function SummaryBar({ cells }: SummaryBarProps) {
  return (
    <div className="v2-summary-bar" role="group">
      {cells.map((c, i) => (
        <div key={i} className={`v2-summary-cell ${c.alert ? 'v2-summary-cell--alert' : ''}`} title={c.hint}>
          <span className="v2-summary-cell__label">{c.label}</span>
          <span className="v2-summary-cell__value">
            {c.value}
            {c.sub && <span className="v2-summary-cell__value-sub">{c.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
