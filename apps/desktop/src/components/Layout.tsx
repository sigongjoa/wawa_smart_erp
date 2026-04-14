import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';

const NAV_ITEMS = [
  { to: '/timer', label: '수업', iconClass: 'nav-icon--timer' },
  { to: '/report', label: '평가', iconClass: 'nav-icon--report' },
  { to: '/materials', label: '교재', iconClass: 'nav-icon--materials' },
  { to: '/absence', label: '보강', iconClass: 'nav-icon--absence' },
  { to: '/student', label: '학생', iconClass: 'nav-icon--student' },
  { to: '/exams', label: '정기고사', iconClass: 'nav-icon--exam' },
  { to: '/meeting', label: '회의', iconClass: 'nav-icon--meeting' },
  { to: '/board', label: '보드', iconClass: 'nav-icon--board' },
];

const GACHA_SUB_ITEMS = [
  { to: '/gacha', label: '학생 관리', exact: true },
  { to: '/gacha/cards', label: '카드 관리' },
  { to: '/gacha/proofs', label: '증명 연습' },
  { to: '/gacha/dashboard', label: '학습 현황' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [gachaOpen, setGachaOpen] = useState(location.pathname.startsWith('/gacha'));

  const isGachaActive = location.pathname.startsWith('/gacha');

  return (
    <div className="app-layout">
      {/* PC: Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-text">{user?.academyName || 'WAWA'}</span>
          <span className="sidebar-logo-sub">ERP</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, iconClass }) => (
            <NavLink key={to} to={to}>
              <span className={`nav-icon ${iconClass}`} aria-hidden="true" />
              {label}
            </NavLink>
          ))}

          {/* 학습 (가차/증명) — 서브메뉴 */}
          <div className={`sidebar-nav-group ${isGachaActive ? 'active' : ''}`}>
            <button
              className={`sidebar-nav-group-toggle ${isGachaActive ? 'active' : ''}`}
              onClick={() => setGachaOpen(!gachaOpen)}
            >
              <span className="nav-icon nav-icon--gacha" aria-hidden="true" />
              학습
              <span className={`sidebar-nav-arrow ${gachaOpen ? 'open' : ''}`}>&#9662;</span>
            </button>
            {gachaOpen && (
              <div className="sidebar-nav-sub">
                {GACHA_SUB_ITEMS.map(({ to, label, exact }) => (
                  <NavLink key={to} to={to} end={exact}>
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <NavLink to="/settings">
            <span className="nav-icon nav-icon--settings" aria-hidden="true" />
            설정
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user?.name || '사용자'}</div>
            <div className="sidebar-user-role">
              {user?.role === 'admin' ? '관리자' : '강사'}
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout}>
            로그아웃
          </button>
        </div>
      </aside>

      {/* Mobile: Bottom Navigation — 핵심 5개만 */}
      <nav className="app-bottom-nav" aria-label="모바일 내비게이션">
        {['/timer', '/report', '/materials', '/student', '/gacha'].map(to => {
          const item = to === '/gacha'
            ? { to: '/gacha', label: '학습', iconClass: 'nav-icon--gacha' }
            : NAV_ITEMS.find(n => n.to === to)!;
          return (
            <NavLink key={item.to} to={item.to}>
              <span className={`nav-icon ${item.iconClass}`} aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
