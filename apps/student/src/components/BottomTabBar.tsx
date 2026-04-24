import { NavLink } from 'react-router-dom';
import './BottomTabBar.css';

interface TabItem {
  to: string;
  label: string;
  match?: string[];
  icon: (active: boolean) => JSX.Element;
}

const STROKE = 1.8;

function IconHome(active: boolean) {
  const fill = active ? 'var(--ink)' : 'none';
  const stroke = active ? 'var(--ink)' : 'var(--ink-60)';
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function IconLearn(active: boolean) {
  const fill = active ? 'var(--ink)' : 'none';
  const stroke = active ? 'var(--ink)' : 'var(--ink-60)';
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19a1 1 0 0 1 1 1v13H5.5A1.5 1.5 0 0 1 4 16.5z" />
      <path d="M20 18v2H5.5A1.5 1.5 0 0 1 4 18.5" fill="none" />
    </svg>
  );
}

function IconDex(active: boolean) {
  const stroke = active ? 'var(--ink)' : 'var(--ink-60)';
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <line x1="3.5" y1="12" x2="20.5" y2="12" />
      <line x1="12" y1="3.5" x2="12" y2="20.5" />
      {active && <circle cx="12" cy="12" r="2.2" fill="var(--ink)" stroke="none" />}
    </svg>
  );
}

function IconProfile(active: boolean) {
  const fill = active ? 'var(--ink)' : 'none';
  const stroke = active ? 'var(--ink)' : 'var(--ink-60)';
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </svg>
  );
}

const TABS: TabItem[] = [
  { to: '/', label: '홈', icon: IconHome, match: ['/'] },
  { to: '/learn', label: '학습', icon: IconLearn, match: ['/learn', '/gacha', '/proof', '/assignments', '/exam'] },
  { to: '/dex', label: '도감', icon: IconDex, match: ['/dex', '/archives'] },
  { to: '/me', label: '나', icon: IconProfile, match: ['/me'] },
];

export default function BottomTabBar() {
  return (
    <nav className="tabbar" role="navigation" aria-label="하단 네비게이션">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => {
            const active = isActive || !!t.match?.some((m) => m !== '/' && window.location.hash.startsWith(`#${m}`));
            return `tabbar-item${active ? ' tabbar-item--active' : ''}`;
          }}
          aria-label={t.label}
        >
          {({ isActive }) => {
            const active = isActive || !!t.match?.some((m) => m !== '/' && window.location.hash.startsWith(`#${m}`));
            return (
              <>
                {t.icon(active)}
                <span className="tabbar-label">{t.label}</span>
              </>
            );
          }}
        </NavLink>
      ))}
    </nav>
  );
}
