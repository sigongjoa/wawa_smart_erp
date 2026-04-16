import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';

type NavLeaf = { to: string; label: string; iconClass?: string; exact?: boolean };
type NavGroup = { key: string; label: string; iconClass: string; paths: string[]; items: NavLeaf[] };

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'class',
    label: '수업',
    iconClass: 'nav-icon--timer',
    paths: ['/timer', '/absence'],
    items: [
      { to: '/timer', label: '수업 타이머' },
      { to: '/absence', label: '보강 관리' },
    ],
  },
  {
    key: 'student',
    label: '학생',
    iconClass: 'nav-icon--student',
    paths: ['/student', '/exams', '/report'],
    items: [
      { to: '/student', label: '학생 관리' },
      { to: '/exams', label: '정기고사' },
      { to: '/report', label: '평가/리포트' },
    ],
  },
  {
    key: 'gacha',
    label: '학습 (수학)',
    iconClass: 'nav-icon--gacha',
    paths: ['/gacha'],
    items: [
      { to: '/gacha', label: '학생 관리', exact: true },
      { to: '/gacha/cards', label: '카드 관리' },
      { to: '/gacha/proofs', label: '증명 연습' },
      { to: '/gacha/dashboard', label: '학습 현황' },
    ],
  },
  {
    key: 'content',
    label: '자료',
    iconClass: 'nav-icon--materials',
    paths: ['/materials', '/exam-papers'],
    items: [
      { to: '/materials', label: '교재' },
      { to: '/exam-papers', label: '시험지' },
    ],
  },
  {
    key: 'schedule',
    label: '학원 일정',
    iconClass: 'nav-icon--meeting',
    paths: ['/board', '/meeting'],
    items: [
      { to: '/board', label: '보드' },
      { to: '/meeting', label: '회의 요약' },
    ],
  },
];

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.paths.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV_GROUPS.forEach(g => { init[g.key] = isGroupActive(g, location.pathname); });
    return init;
  });

  const toggle = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="app-layout">
      {/* PC: Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-text">{user?.academyName || 'WAWA'}</span>
          <span className="sidebar-logo-sub">ERP</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => {
            const active = isGroupActive(group, location.pathname);
            const open = openGroups[group.key];
            // 단일 항목인 경우 NavLink로 바로
            if (group.items.length === 1) {
              const it = group.items[0];
              return (
                <NavLink key={it.to} to={it.to} end={it.exact}>
                  <span className={`nav-icon ${group.iconClass}`} aria-hidden="true" />
                  {group.label}
                </NavLink>
              );
            }
            return (
              <div key={group.key} className={`sidebar-nav-group ${active ? 'active' : ''}`}>
                <button
                  className={`sidebar-nav-group-toggle ${active ? 'active' : ''}`}
                  onClick={() => toggle(group.key)}
                >
                  <span className={`nav-icon ${group.iconClass}`} aria-hidden="true" />
                  {group.label}
                  <span className={`sidebar-nav-arrow ${open ? 'open' : ''}`}>&#9662;</span>
                </button>
                {open && (
                  <div className="sidebar-nav-sub">
                    {group.items.map(it => (
                      <NavLink key={it.to} to={it.to} end={it.exact}>
                        {it.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

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

      {/* Mobile: Bottom Navigation — 핵심 5개 */}
      <nav className="app-bottom-nav" aria-label="모바일 내비게이션">
        <NavLink to="/timer"><span className="nav-icon nav-icon--timer" aria-hidden="true" />수업</NavLink>
        <NavLink to="/student"><span className="nav-icon nav-icon--student" aria-hidden="true" />학생</NavLink>
        <NavLink to="/exams"><span className="nav-icon nav-icon--exam" aria-hidden="true" />정기고사</NavLink>
        <NavLink to="/materials"><span className="nav-icon nav-icon--materials" aria-hidden="true" />교재</NavLink>
        <NavLink to="/gacha"><span className="nav-icon nav-icon--gacha" aria-hidden="true" />학습</NavLink>
      </nav>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
