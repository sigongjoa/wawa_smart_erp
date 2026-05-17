import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';
import NotificationBell from './NotificationBell';
import { Icon, type IconName } from './icons/Icon';

type NavLeaf = {
  to: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  external?: boolean;
  /** 상단 우측에 표시할 카운트 (없으면 미표시) */
  count?: number;
  /** admin 권한 필요 */
  adminOnly?: boolean;
};

type NavSection = { label: string; items: NavLeaf[] };

const NAV_SECTIONS: NavSection[] = [
  {
    label: '운영',
    items: [
      { to: '/timer', label: '수업 타이머', icon: 'Timer' },
      { to: '/exam-timer', label: '시험 타이머', icon: 'CalendarClock' },
      { to: '/calendar', label: '캘린더', icon: 'Calendar' },
      { to: '/absence', label: '보강 관리', icon: 'CalendarX' },
    ],
  },
  {
    label: '학생',
    items: [
      { to: '/student', label: '학생 관리', icon: 'Users' },
      { to: '/lessons', label: '학습 기록', icon: 'BookOpen' },
      { to: '/exams', label: '정기고사', icon: 'ClipboardList' },
      { to: '/assignments', label: '과제 회수·첨삭', icon: 'PencilLine' },
      { to: '/report', label: '평가/리포트', icon: 'BarChart3' },
    ],
  },
  {
    label: '담임',
    items: [
      { to: '/homeroom', label: '담임 대시보드', icon: 'LayoutDashboard', exact: true },
      { to: '/homeroom/consultations', label: '학부모 상담', icon: 'MessageCircle' },
      { to: '/homeroom/follow-ups', label: '후속 상담', icon: 'MessageSquareText' },
      { to: '/homeroom/exams', label: '시험 전후 상담', icon: 'ClipboardCheck' },
    ],
  },
  {
    label: '학습 · 수학',
    items: [
      { to: '/gacha', label: '학생 현황', icon: 'User', exact: true },
      { to: '/gacha/cards', label: '카드 관리', icon: 'Layers' },
      { to: '/gacha/proofs', label: '증명 연습', icon: 'FunctionSquare' },
      { to: '/gacha/dashboard', label: '학습 현황', icon: 'Activity' },
    ],
  },
  {
    label: '학습 · 영단어',
    items: [
      { to: '/vocab', label: '단어 관리', icon: 'BookMarked', exact: true },
      { to: '/vocab/wrong', label: '오답 현황', icon: 'AlertCircle' },
      { to: '/vocab/grading', label: '출제·채점', icon: 'CheckSquare' },
    ],
  },
  {
    label: '학원',
    items: [
      { to: '/board', label: '보드', icon: 'Megaphone' },
      { to: '/meeting', label: '회의 요약', icon: 'FileText' },
      { to: '/exam-papers', label: '시험지', icon: 'FilePlus2' },
      { to: '/curriculum', label: '커리큘럼', icon: 'Calendar' },
    ],
  },
  {
    label: '시스템',
    items: [
      { to: '/academy', label: '학원 관리', icon: 'School', adminOnly: true },
      { to: '/settings', label: '설정', icon: 'Settings' },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // 활성 NavLink 가 사이드바 스크롤 안에 보이도록
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile && !drawerOpen) return;
    const active = document.querySelector<HTMLElement>('.app-nav__item.is-active');
    active?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const visibleSections = NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((it) => !it.adminOnly || user?.role === 'admin'),
  })).filter((sec) => sec.items.length > 0);

  return (
    <div className="app-shell">
      {/* PC: Sidebar */}
      <nav className="app-nav" aria-label="주 내비게이션">
        <div className="app-nav__brand">
          <div className="app-nav__brand-mark">W</div>
          <div className="app-nav__brand-text">
            <span className="app-nav__brand-name">{user?.academyName || 'WAWA'}</span>
            <span className="app-nav__brand-sub">ERP</span>
          </div>
        </div>

        {visibleSections.map((section) => (
          <div key={section.label} className="app-nav__group">
            <div className="app-nav__label">{section.label}</div>
            {section.items.map((it) =>
              it.external ? (
                <a key={it.to} className="app-nav__item" href={it.to}>
                  <Icon name={it.icon} size={18} />
                  {it.label}
                  {typeof it.count === 'number' && it.count > 0 && (
                    <span className="app-nav__count">{it.count}</span>
                  )}
                </a>
              ) : (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.exact}
                  className={({ isActive }) =>
                    `app-nav__item${isActive ? ' is-active' : ''}`
                  }
                >
                  <Icon name={it.icon} size={18} />
                  {it.label}
                  {typeof it.count === 'number' && it.count > 0 && (
                    <span className="app-nav__count">{it.count}</span>
                  )}
                </NavLink>
              )
            )}
          </div>
        ))}

        <div className="app-nav__footer">
          <div className="app-nav__user">
            <div className="app-nav__user-name">{user?.name || '사용자'}</div>
            <div className="app-nav__user-role">
              {user?.role === 'admin' ? '관리자' : '강사'}
            </div>
          </div>
          <button className="app-nav__logout" onClick={logout} type="button">
            <Icon name="LogIn" size={14} style={{ transform: 'rotate(180deg)' }} />
            로그아웃
          </button>
        </div>
      </nav>

      {/* Mobile: Bottom Navigation */}
      <nav className="app-bottom-nav" aria-label="모바일 내비게이션">
        <NavLink to="/timer"><Icon name="Timer" size={18} />수업</NavLink>
        <NavLink to="/student"><Icon name="Users" size={18} />학생</NavLink>
        <NavLink to="/exams"><Icon name="ClipboardList" size={18} />정기고사</NavLink>
        <NavLink to="/gacha"><Icon name="Layers" size={18} />학습</NavLink>
        <button
          type="button"
          className={`app-bottom-nav-more${drawerOpen ? ' active' : ''}`}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-expanded={drawerOpen}
          aria-controls="app-drawer"
          aria-label="더보기 메뉴 열기"
        >
          <Icon name="MoreHorizontal" size={18} />더보기
        </button>
      </nav>

      {/* Mobile: Drawer */}
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
              {visibleSections.map((section) => (
                <div key={section.label} className="app-drawer-group">
                  <div className="app-drawer-group-label">{section.label}</div>
                  <div className="app-drawer-group-items">
                    {section.items.map((it) =>
                      it.external ? (
                        <a key={it.to} href={it.to}>
                          <Icon name={it.icon} size={16} />
                          {it.label}
                        </a>
                      ) : (
                        <NavLink key={it.to} to={it.to} end={it.exact}>
                          <Icon name={it.icon} size={16} />
                          {it.label}
                        </NavLink>
                      )
                    )}
                  </div>
                </div>
              ))}
              <div className="app-drawer-group">
                <button
                  type="button"
                  className="app-drawer-logout"
                  onClick={() => { setDrawerOpen(false); logout(); }}
                >
                  로그아웃
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      <main className="app-main">
        <div className="app-topbar">
          <div className="app-topbar-spacer" />
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
