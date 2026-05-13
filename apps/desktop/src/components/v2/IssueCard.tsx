import { type ReactNode, type AnchorHTMLAttributes } from 'react';
import './layout.css';

interface IssueCardProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'title'> {
  title: ReactNode;
  meta?: ReactNode;
  tone?: 'danger' | 'warning' | 'info' | 'success';
}

/**
 * 좌측 사이드바용 이슈 카드 — mockup v2 의 .issue-card 패턴.
 * 좌측 borderColor 로 톤 전달. 클릭 가능 (anchor or button-like).
 */
export function IssueCard({ title, meta, tone, href, onClick, ...rest }: IssueCardProps) {
  const className = `v2-issue-card${tone ? ` v2-issue-card--${tone}` : ''}`;

  if (href) {
    return (
      <a className={className} href={href} {...rest}>
        <div className="v2-issue-card__title">{title}</div>
        {meta && <div className="v2-issue-card__meta">{meta}</div>}
      </a>
    );
  }
  // button-like span
  return (
    <span className={className} role="button" tabIndex={0} onClick={onClick} {...(rest as any)}>
      <div className="v2-issue-card__title">{title}</div>
      {meta && <div className="v2-issue-card__meta">{meta}</div>}
    </span>
  );
}
