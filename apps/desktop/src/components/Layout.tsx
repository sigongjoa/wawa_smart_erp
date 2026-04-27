import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';

type NavLeaf = { to: string; label: string; iconClass?: string; exact?: boolean; external?: boolean };
type NavGroup = { key: string; label: string; iconClass: string; paths: string[]; items: NavLeaf[] };

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'class',
    label: '수업',
    iconClass: 'nav-icon--timer',
    paths: ['/timer', '/exam-timer', '/absence'],
    items: [
      { to: '/timer', label: '수업 타이머' },
      { to: '/exam-timer', label: '시험 타이머' },
      { to: '/absence', label: '보강 관리' },
    ],
  },
  {
    key: 'student',
    label: '학생',
    iconClass: 'nav-icon--student',
    paths: ['/student', '/lessons', '/exams', '/report', '/assignments'],
    items: [
      { to: '/student', label: '학생 관리' },
      { to: '/lessons', label: '학습 기록' },
      { to: '/exams', label: '정기고사' },
      { to: '/assignments', label: '과제 회수·첨삭' },
      { to: '/report', label: '평가/리포트' },
    ],
  },
  {
    key: 'homeroom',
    label: '담임',
    iconClass: 'nav-icon--student',
    paths: ['/homeroom'],
    items: [
      { to: '/homeroom', label: '대시보드', exact: true },
      { to: '/homeroom/consultations', label: '학부모 상담' },
      { to: '/homeroom/follow-ups', label: '후속 상담' },
      { to: '/homeroom/exams', label: '시험 전후 상담' },
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
    key: 'vocab',
    label: '학습 (영단어)',
    iconClass: 'nav-icon--gacha',
    paths: ['/vocab'],
    items: [
      { to: '/vocab',             label: '단어 관리',       exact: true },
      { to: '/vocab/wrong',       label: '오답 현황' },
      { to: '/vocab/grading',       label: '출제·채점' },
      { to: '/vocab/admin.html',  label: '전체 관리 (구)',  external: true },
    ],
  },
  {
    key: 'schedule',
    label: '학원 일정',
    iconClass: 'nav-icon--meeting',
    paths: ['/board', '/meeting', '/exam-papers', '/curriculum'],
    items: [
      { to: '/board', label: '보드' },
      { to: '/meeting', label: '회의 요약' },
      { to: '/exam-papers', label: '시험지' },
      { to: '/curriculum', label: '커리큘럼' },
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggle = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // 라우트 변경 시 활성 NavLink가 사이드바 스크롤 영역 안에 보이도록 살짝 스크롤
  // 모바일 drawer가 닫혀있을 땐 hidden 영역 스크롤 의미 없으므로 스킵
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile && !drawerOpen) return;
    const active = document.querySelector<HTMLElement>('.sidebar-nav a.active');
    active?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

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
              if (it.external) {
                return (
                  <a key={it.to} href={it.to}>
                    <span className={`nav-icon ${group.iconClass}`} aria-hidden="true" />
                    {group.label}
                  </a>
                );
              }
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
                      it.external ? (
                        <a key={it.to} href={it.to}>{it.label}</a>
                      ) : (
                        <NavLink key={it.to} to={it.to} end={it.exact}>
                          {it.label}
                        </NavLink>
                      )
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {user?.role === 'admin' && (
            <NavLink to="/academy">
              <span className="nav-icon nav-icon--settings" aria-hidden="true" />
              학원 관리
            </NavLink>
          )}
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

      {/* Mobile: Bottom Navigation — 핵심 4개 + 더보기 */}
      <nav className="app-bottom-nav" aria-label="모바일 내비게이션">
        <NavLink to="/timer"><span className="nav-icon nav-icon--timer" aria-hidden="true" />수업</NavLink>
        <NavLink to="/student"><span className="nav-icon nav-icon--student" aria-hidden="true" />학생</NavLink>
        <NavLink to="/exams"><span className="nav-icon nav-icon--exam" aria-hidden="true" />정기고사</NavLink>
        <NavLink to="/gacha"><span className="nav-icon nav-icon--gacha" aria-hidden="true" />학습</NavLink>
        <button
          type="button"
          className={`app-bottom-nav-more ${drawerOpen ? 'active' : ''}`}
          onClick={() => setDrawerOpen(v => !v)}
          aria-expanded={drawerOpen}
          aria-controls="app-drawer"
          aria-label="더보기 메뉴 열기"
        >
          <span className="nav-icon nav-icon--more" aria-hidden="true" />더보기
        </button>
      </nav>

      {/* Mobile: Drawer for overflow nav items */}
      {drawerOpen && (
        <div
          className="app-drawer-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}
        >
          <div
            id="app-drawer"
            className="app-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="전체 메뉴"
          >
            <div className="app-drawer-handle" aria-hidden="true" />
            <div className="app-drawer-header">
              <div className="app-drawer-user">
                <div className="app-drawer-user-name">{user?.name || '사용자'}</div>
                <div className="app-drawer-user-meta">
                  {user?.academyName || 'WAWA'} · {user?.role === 'admin' ? '관리자' : '강사'}
                </div>
              </div>
              <button
                type="button"
                className="app-drawer-close"
                onClick={() => setDrawerOpen(false)}
                aria-label="메뉴 닫기"
              >
                ×
              </button>
            </div>

            <nav className="app-drawer-nav" aria-label="전체 메뉴">
              {NAV_GROUPS.map(group => (
                <div key={group.key} className="app-drawer-group">
                  <div className="app-drawer-group-label">
                    <span className={`nav-icon ${group.iconClass}`} aria-hidden="true" />
                    {group.label}
                  </div>
                  <div className="app-drawer-group-items">
                    {group.items.map(it => (
                      it.external ? (
                        <a key={it.to} href={it.to}>{it.label}</a>
                      ) : (
                        <NavLink key={it.to} to={it.to} end={it.exact}>
                          {it.label}
                        </NavLink>
                      )
                    ))}
                  </div>
                </div>
              ))}
              <div className="app-drawer-group">
                <div className="app-drawer-group-items">
                  {user?.role === 'admin' && (
                    <NavLink to="/academy">
                      <span className="nav-icon nav-icon--settings" aria-hidden="true" />
                      학원 관리
                    </NavLink>
                  )}
                  <NavLink to="/settings">
                    <span className="nav-icon nav-icon--settings" aria-hidden="true" />
                    설정
                  </NavLink>
                  <button
                    type="button"
                    className="app-drawer-logout"
                    onClick={() => { setDrawerOpen(false); logout(); }}
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
