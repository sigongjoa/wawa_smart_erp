import { NavLink } from 'react-router-dom';
import type { ModuleType } from '../types';

interface ModuleTab {
  id: ModuleType;
  label: string;
  icon: string;
  path: string;
}

const modules: ModuleTab[] = [
  { id: 'timer', label: '시간표', icon: 'schedule', path: '/timer' },
  { id: 'report', label: '리포트', icon: 'description', path: '/report' },
  { id: 'grader', label: '채점', icon: 'grading', path: '/grader' },
  { id: 'schedule', label: '시험일정', icon: 'event', path: '/schedule' },
];

export default function Header() {
  return (
    <header className="app-header">
      {/* Logo */}
      <div className="header-left">
        <div className="header-logo">
          <div className="header-logo-icon">
            <span className="material-symbols-outlined">school</span>
          </div>
          <span className="header-logo-text">WAWA ERP</span>
        </div>
      </div>

      {/* Module Navigation */}
      <nav className="header-nav">
        {modules.map((module) => (
          <NavLink
            key={module.id}
            to={module.path}
            className={({ isActive }) => `header-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">{module.icon}</span>
            <span>{module.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Right Section */}
      <div className="header-right">
        <button className="header-icon-btn" title="검색">
          <span className="material-symbols-outlined">search</span>
        </button>
        <button className="header-icon-btn" title="알림">
          <span className="material-symbols-outlined">notifications</span>
          <span className="notification-dot"></span>
        </button>
        <div className="header-divider"></div>
        <div className="header-user">
          <div className="header-user-info">
            <span className="header-user-name">김수학 선생님</span>
            <span className="header-user-role">관리자</span>
          </div>
          <div className="header-avatar">김</div>
        </div>
      </div>
    </header>
  );
}
