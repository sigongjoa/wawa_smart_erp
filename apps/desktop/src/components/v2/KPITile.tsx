import { type ReactNode } from 'react';
import './layout.css';

interface KPITileProps {
  label: ReactNode;
  value: ReactNode;
  /** value 뒤 작은 텍스트 (예: "/ 24" 또는 "%") */
  valueSub?: ReactNode;
  /** 헤더 우측 (배지/스파크 등) */
  headerExtra?: ReactNode;
  /** 하단 부가 설명 */
  sub?: ReactNode;
  /** 강조 색 */
  tone?: 'default' | 'danger' | 'warning' | 'success' | 'primary';
}

const TONE_COLOR: Record<NonNullable<KPITileProps['tone']>, string> = {
  default: 'var(--text-primary)',
  danger: 'var(--danger)',
  warning: 'var(--warning)',
  success: 'var(--success)',
  primary: 'var(--primary)',
};

/**
 * KPI 카드 (큰 숫자 강조) — mockup 02-dashboard 의 .kpi-tile 패턴.
 */
export function KPITile({ label, value, valueSub, headerExtra, sub, tone = 'default' }: KPITileProps) {
  return (
    <div className="v2-kpi-tile">
      <div className="v2-kpi-tile__head">
        <span className="v2-kpi-tile__label">{label}</span>
        {headerExtra}
      </div>
      <div className="v2-kpi-tile__value" style={{ color: TONE_COLOR[tone] }}>
        {value}
        {valueSub && (
          <span style={{ fontSize: 19, color: 'var(--text-tertiary)', fontWeight: 700, marginLeft: 4 }}>
            {valueSub}
          </span>
        )}
      </div>
      {sub && <div className="v2-kpi-tile__sub">{sub}</div>}
    </div>
  );
}
