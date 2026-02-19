import { NavLink, useLocation } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import type { ModuleType, SidebarItem } from '../types';

// 각 모듈별 사이드바 메뉴 설정
const moduleMenus: Record<ModuleType, SidebarItem[]> = {
  timer: [
    { id: 'day', label: '요일별 보기', icon: 'view_week', path: '/timer/day' },
    { id: 'realtime', label: '실시간 관리', icon: 'timer', path: '/timer/realtime' },
    { id: 'student', label: '학생별 보기', icon: 'person', path: '/timer/student' },
    { id: 'timeslot', label: '시간대별 보기', icon: 'schedule', path: '/timer/timeslot' },
  ],
  report: [
    { id: 'dashboard', label: '대시보드', icon: 'dashboard', path: '/report' },
    { id: 'students', label: '학생 관리', icon: 'groups', path: '/report/students' },
    { id: 'exams', label: '시험 관리', icon: 'quiz', path: '/report/exams' },
    { id: 'input', label: '성적 입력', icon: 'edit_note', path: '/report/input' },
    { id: 'preview', label: '리포트 미리보기', icon: 'preview', path: '/report/preview' },
    { id: 'send', label: '리포트 전송', icon: 'send', path: '/report/send' },
  ],
  grader: [
    { id: 'single', label: '단건 채점', icon: 'document_scanner', path: '/grader' },
    { id: 'batch', label: '일괄 채점', icon: 'library_books', path: '/grader/batch' },
    { id: 'history', label: '채점 이력', icon: 'history', path: '/grader/history' },
    { id: 'stats', label: '통계', icon: 'analytics', path: '/grader/stats' },
  ],
  student: [
    { id: 'list', label: '전체 학생', icon: 'groups', path: '/student' },
    { id: 'inactive', label: '비활성 학생', icon: 'person_off', path: '/student?status=inactive' },
  ],
  makeup: [
    { id: 'dashboard', label: '대시보드', icon: 'dashboard', path: '/makeup' },
    { id: 'pending', label: '대기 중', icon: 'pending_actions', path: '/makeup/pending' },
    { id: 'progress', label: '진행 중', icon: 'autorenew', path: '/makeup/progress' },
    { id: 'completed', label: '완료', icon: 'task_alt', path: '/makeup/completed' },
    { id: 'calendar', label: '캘린더', icon: 'calendar_month', path: '/makeup/calendar' },
    { id: 'share', label: '카톡 공유', icon: 'share', path: '/makeup/share' },
  ],
};

export default function Sidebar() {
  const location = useLocation();
  const { currentUser } = useReportStore();

  // 현재 모듈 추출
  const pathParts = location.pathname.split('/');
  const currentModule = (pathParts[1] || 'timer') as ModuleType;

  const rawMenuItems = moduleMenus[currentModule] || moduleMenus.timer;

  const menuItems = rawMenuItems;

  // 모듈 타이틀
  const moduleTitles: Record<ModuleType, string> = {
    timer: '시간표 관리',
    report: '리포트 시스템',
    grader: '채점 시스템',
    student: '학생 관리',
    makeup: '보강관리',
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">{moduleTitles[currentModule]}</h2>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === `/${currentModule}`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined sidebar-item-icon">{item.icon}</span>
            <span className="sidebar-item-label">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="sidebar-item-badge">{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-date">
          <span className="material-symbols-outlined">calendar_today</span>
          <span>
            {new Date().toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </aside>
  );
}
