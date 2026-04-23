import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import VocabWordsTab from './vocab/VocabWordsTab';

const SUB_TABS: Array<{ to: string; label: string; ready: boolean }> = [
  { to: '/vocab',            label: '단어 관리',   ready: true  },
  { to: '/vocab/questions',  label: '학생 질문',   ready: false },
  { to: '/vocab/wrong',      label: '오답 현황',   ready: false },
  { to: '/vocab/grammar',    label: '문법 Q&A',    ready: false },
  { to: '/vocab/print',      label: '프린트',      ready: false },
  { to: '/vocab/grade',      label: '채점',        ready: false },
  { to: '/vocab/students',   label: '학생 관리',   ready: false },
  { to: '/vocab/textbooks',  label: '교재',        ready: false },
];

export default function VocabAdminPage() {
  const loc = useLocation();
  useEffect(() => {
    document.title = '학습 (영단어) · WAWA';
  }, []);

  return (
    <div className="vocab-admin">
      <div className="vocab-header">
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>학습 (영단어)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            word-gacha 학생 데이터 관리
          </p>
        </div>
      </div>

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
              className={`vocab-subtab ${active ? 'vocab-subtab--active' : ''} ${t.ready ? '' : 'vocab-subtab--pending'}`}
              onClick={(e) => { if (!t.ready) e.preventDefault(); }}
              tabIndex={t.ready ? 0 : -1}
            >
              {t.label}
              {!t.ready && <span className="vocab-subtab__badge">준비중</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="vocab-body">
        <Outlet />
      </div>
    </div>
  );
}

// 루트 /vocab 접근 시 기본 탭으로 단어 관리 보여주기 위한 래퍼
// 실제 라우팅은 App.tsx에서
export { VocabWordsTab };
