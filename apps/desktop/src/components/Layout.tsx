import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store';

const NAV_ITEMS = [
  { to: '/timer', label: '수업', iconClass: 'nav-icon--timer' },
  { to: '/report', label: '평가', iconClass: 'nav-icon--report' },
  { to: '/materials', label: '교재', iconClass: 'nav-icon--materials' },
  { to: '/absence', label: '보강', iconClass: 'nav-icon--absence' },
  { to: '/student', label: '학생', iconClass: 'nav-icon--student' },
  { to: '/board', label: '보드', iconClass: 'nav-icon--board' },
  { to: '/settings', label: '설정', iconClass: 'nav-icon--settings' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();

  return (
    <div className="app-layout">
      {/* PC: Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-text">WAWA</span>
          <span className="sidebar-logo-sub">ERP</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, iconClass }) => (
            <NavLink key={to} to={to}>
              <span className={`nav-icon ${iconClass}`} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
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
        {NAV_ITEMS.filter(({ to }) => ['/timer', '/report', '/materials', '/student', '/board'].includes(to)).map(({ to, label, iconClass }) => (
          <NavLink key={to} to={to}>
            <span className={`nav-icon ${iconClass}`} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
