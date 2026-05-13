import { type ReactNode } from 'react';
import './layout.css';

interface PageHeaderProps {
  crumb?: ReactNode;
  title: ReactNode;
  titleExtra?: ReactNode;  // 제목 옆 추가 요소 (월 picker 등)
  sub?: ReactNode;
  actions?: ReactNode;
}

/**
 * 페이지 헤더 — mockup v2 의 .page-head 패턴.
 * crumb / title (+titleExtra) / sub / 우측 actions.
 */
export function PageHeader({ crumb, title, titleExtra, sub, actions }: PageHeaderProps) {
  return (
    <header className="v2-page-head">
      <div>
        {crumb && <div className="v2-page-head__crumb">{crumb}</div>}
        {titleExtra ? (
          <div className="v2-page-head__title-row">
            <h1 className="v2-page-head__title">{title}</h1>
            {titleExtra}
          </div>
        ) : (
          <h1 className="v2-page-head__title">{title}</h1>
        )}
        {sub && <div className="v2-page-head__sub">{sub}</div>}
      </div>
      {actions && <div className="v2-page-head__actions">{actions}</div>}
    </header>
  );
}
