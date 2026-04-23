import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import VocabWordsTab from './vocab/VocabWordsTab';

/**
 * 자식 탭이 헤더 오른쪽에 primary action을 렌더하기 위한 outlet context.
 *   const { setHeaderAction } = useOutletContext<VocabOutletContext>();
 *   useEffect(() => setHeaderAction(<button ...>+ 단어 추가</button>), []);
 */
export interface VocabOutletContext {
  setHeaderAction: (node: ReactNode) => void;
}

const SUB_TABS: Array<{ to: string; label: string; ready: boolean }> = [
  { to: '/vocab',       label: '단어 관리', ready: true },
  { to: '/vocab/wrong', label: '오답 현황', ready: true },
];

export default function VocabAdminPage() {
  const loc = useLocation();
  const [headerAction, setHeaderAction] = useState<ReactNode>(null);

  useEffect(() => {
    document.title = '학습 (영단어) · WAWA';
  }, []);

  return (
    <div className="vocab-admin">
      <header className="vocab-header">
        <h1 className="vocab-title">학습 (영단어)</h1>
        <div className="vocab-header-action">{headerAction}</div>
      </header>

      {SUB_TABS.length > 1 && (
        <nav className="vocab-subnav" role="tablist" aria-label="영단어 관리 탭">
          {SUB_TABS.map(t => {
            const active = loc.pathname === t.to || (t.to === '/vocab' && loc.pathname === '/vocab/');
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/vocab'}
                role="tab"
                aria-selected={active}
                className={`vocab-subtab ${active ? 'vocab-subtab--active' : ''}`}
              >
                {t.label}
              </NavLink>
            );
          })}
        </nav>
      )}

      <div className="vocab-body">
        <Outlet context={{ setHeaderAction } satisfies VocabOutletContext} />
      </div>
    </div>
  );
}

export { VocabWordsTab };
