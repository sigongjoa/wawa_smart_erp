import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store';

export default function Layout() {
  const { user, logout } = useAuthStore();

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>WAWA Smart ERP</h1>
        <nav className="app-nav">
          <NavLink to="/timer">시간표</NavLink>
          <NavLink to="/report">월말평가</NavLink>
          <NavLink to="/absence">보강관리</NavLink>
          <NavLink to="/student">학생</NavLink>
          <NavLink to="/board">보드</NavLink>
          <NavLink to="/settings">설정</NavLink>
        </nav>
        <button className="logout-btn" onClick={logout}>
          {user?.name || '사용자'} · 로그아웃
        </button>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
