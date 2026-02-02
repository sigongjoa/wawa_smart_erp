import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useScheduleStore } from '../stores/scheduleStore';
import type { ViewMode } from '../types';

const viewModes: { key: ViewMode; label: string; path: string }[] = [
  { key: 'realtime', label: '실시간', path: '/realtime' },
  { key: 'day', label: '요일별', path: '/day' },
  { key: 'student', label: '학생별', path: '/student' },
  { key: 'timeslot', label: '시간대별', path: '/timeslot' },
];

const days = [
  { key: 'all', label: '전체' },
  { key: '화', label: '화요일' },
  { key: '목', label: '목요일' },
  { key: '토', label: '토요일' },
] as const;

const grades = [
  { key: 'all', label: '전체' },
  { key: '중1', label: '중1' },
  { key: '중2', label: '중2' },
  { key: '중3', label: '중3' },
  { key: '고1', label: '고1' },
  { key: '고2', label: '고2' },
  { key: '고3', label: '고3' },
  { key: '검정고시', label: '기타' },
] as const;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, setDayFilter, setGradeFilter, setSearchFilter } = useScheduleStore();

  const currentPath = location.pathname;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">
            <div className="app-logo-icon">
              <span className="material-symbols-outlined">schedule</span>
            </div>
            <span className="app-logo-text">수학 시간표</span>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {new Date().toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long'
            })}
          </span>
        </div>
        <div className="app-header-right">
          <button className="btn btn-success" onClick={() => {}}>
            <span className="material-symbols-outlined icon-sm">add</span>
            학생 추가
          </button>
          <button className="btn btn-primary" onClick={() => {}}>
            <span className="material-symbols-outlined icon-sm">save</span>
            저장
          </button>
          <button className="btn-icon" onClick={() => navigate('/settings')}>
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Legend */}
        <div className="legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--grade-m1)' }} />
            <span>중1</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--grade-m2)' }} />
            <span>중2</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--grade-m3)' }} />
            <span>중3</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--grade-h1)' }} />
            <span>고1</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--grade-h2)' }} />
            <span>고2</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--grade-h3)' }} />
            <span>고3</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--grade-etc)' }} />
            <span>기타</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="filter-bar">
          {/* View Mode */}
          <div className="filter-group">
            <span className="filter-group-label">보기 유형</span>
            <div className="filter-buttons">
              {viewModes.map((mode) => (
                <button
                  key={mode.key}
                  className={`filter-btn ${currentPath === mode.path ? 'active' : ''}`}
                  onClick={() => navigate(mode.path)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-divider" />

          {/* Day Filter */}
          <div className="filter-group">
            <span className="filter-group-label">요일 선택</span>
            <div className="filter-buttons">
              {days.map((day) => (
                <button
                  key={day.key}
                  className={`filter-btn ${filters.day === day.key ? 'active' : ''}`}
                  onClick={() => setDayFilter(day.key)}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-divider" />

          {/* Grade Filter */}
          <div className="filter-group" style={{ flex: 1 }}>
            <span className="filter-group-label">학년 필터</span>
            <div className="filter-buttons">
              {grades.map((grade) => (
                <button
                  key={grade.key}
                  className={`filter-btn ${filters.grade === grade.key ? 'active' : ''}`}
                  onClick={() => setGradeFilter(grade.key)}
                >
                  {grade.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="filter-group">
            <span className="filter-group-label">검색</span>
            <input
              type="text"
              className="search-input"
              placeholder="학생 이름 검색..."
              value={filters.search}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Page Content */}
        <Outlet />
      </main>
    </div>
  );
}
