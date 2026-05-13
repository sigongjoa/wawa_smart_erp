import { type ReactNode } from 'react';
import './layout.css';

type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}

/**
 * Status pill — mockup v2 의 .pill 패턴.
 * lucide Icon 을 아이콘으로 children 안에 직접 넣어 사용.
 *
 * 예: <Pill tone="success"><Icon name="Check" />완료</Pill>
 */
export function Pill({ tone = 'neutral', children, className }: PillProps) {
  return (
    <span className={`v2-pill v2-pill--${tone} ${className || ''}`.trim()}>
      {children}
    </span>
  );
}
