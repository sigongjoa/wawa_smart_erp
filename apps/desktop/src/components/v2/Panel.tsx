import { type ReactNode } from 'react';
import './layout.css';

interface PanelProps {
  title?: ReactNode;
  titleMeta?: ReactNode;
  headerActions?: ReactNode;
  flush?: boolean;  // body padding 제거 (테이블 직접 넣을 때)
  children?: ReactNode;
  className?: string;
}

/**
 * 일반 패널 — mockup v2 의 .panel 패턴.
 * Header (옵션) + body.
 */
export function Panel({ title, titleMeta, headerActions, flush, children, className }: PanelProps) {
  return (
    <div className={`v2-panel ${className || ''}`.trim()}>
      {(title || titleMeta || headerActions) && (
        <div className="v2-panel__head">
          {(title || titleMeta) && (
            <h2 className="v2-panel__title">
              {title}
              {titleMeta && <span className="v2-panel__title-meta">{titleMeta}</span>}
            </h2>
          )}
          {headerActions && <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>{headerActions}</div>}
        </div>
      )}
      <div className={`v2-panel__body${flush ? ' v2-panel__body--flush' : ''}`}>
        {children}
      </div>
    </div>
  );
}
