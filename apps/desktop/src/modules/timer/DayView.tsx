import { useAppStore } from '../../stores/appStore';
import type { GradeType, DayType } from '../../types';

const gradeClassMap: Record<GradeType, string> = {
  '중1': 'm1', '중2': 'm2', '중3': 'm3',
  '고1': 'h1', '고2': 'h2', '고3': 'h3',
  '검정고시': 'etc',
};

const dayClassMap: Record<DayType, string> = {
  '화': 'tue', '목': 'thu', '토': 'sat',
};

const days = [
  { key: 'all' as const, label: '전체' },
  { key: '화' as const, label: '화요일' },
  { key: '목' as const, label: '목요일' },
  { key: '토' as const, label: '토요일' },
];

const grades = [
  { key: 'all' as const, label: '전체' },
  { key: '중1' as const, label: '중1' },
  { key: '중2' as const, label: '중2' },
  { key: '중3' as const, label: '중3' },
  { key: '고1' as const, label: '고1' },
  { key: '고2' as const, label: '고2' },
  { key: '고3' as const, label: '고3' },
  { key: '검정고시' as const, label: '기타' },
];

export default function DayView() {
  const {
    students,
    timerFilters,
    getFilteredStudents,
    setTimerDayFilter,
    setTimerGradeFilter,
    setTimerSearchFilter,
  } = useAppStore();

  const filteredStudents = getFilteredStudents();

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (a.day !== b.day) {
      const dayOrder = { '화': 0, '목': 1, '토': 2 };
      return dayOrder[a.day] - dayOrder[b.day];
    }
    return a.startTime.localeCompare(b.startTime);
  });

  const stats = {
    total: students.length,
    filtered: filteredStudents.length,
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">요일별 시간표</h1>
            <p className="page-description">학생들의 수업 일정을 요일별로 확인합니다</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-secondary">
              <span className="material-symbols-outlined">download</span>
              엑셀 다운로드
            </button>
            <button className="btn btn-primary">
              <span className="material-symbols-outlined">add</span>
              학생 추가
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="legend">
        {Object.entries(gradeClassMap).map(([grade, cls]) => (
          <div key={grade} className="legend-item">
            <div className="legend-color" style={{ background: `var(--grade-${cls})` }} />
            <span>{grade === '검정고시' ? '기타' : grade}</span>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-group-label">요일 선택</span>
          <div className="filter-buttons">
            {days.map((day) => (
              <button
                key={day.key}
                className={`filter-btn ${timerFilters.day === day.key ? 'active' : ''}`}
                onClick={() => setTimerDayFilter(day.key)}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-divider" />
        <div className="filter-group" style={{ flex: 1 }}>
          <span className="filter-group-label">학년 필터</span>
          <div className="filter-buttons">
            {grades.map((grade) => (
              <button
                key={grade.key}
                className={`filter-btn ${timerFilters.grade === grade.key ? 'active' : ''}`}
                onClick={() => setTimerGradeFilter(grade.key)}
              >
                {grade.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-group-label">검색</span>
          <input
            type="text"
            className="search-input"
            placeholder="학생 이름 검색..."
            value={timerFilters.search}
            onChange={(e) => setTimerSearchFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <span className="material-symbols-outlined">groups</span>
          </div>
          <div>
            <span className="stat-label">전체 학생</span>
            <div className="stat-value">{stats.total}<span className="stat-unit">명</span></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <span className="material-symbols-outlined">filter_list</span>
          </div>
          <div>
            <span className="stat-label">필터 결과</span>
            <div className="stat-value">{stats.filtered}<span className="stat-unit">명</span></div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>이름</th>
              <th style={{ width: '80px', textAlign: 'center' }}>학년</th>
              <th style={{ width: '60px', textAlign: 'center' }}>요일</th>
              <th style={{ width: '140px' }}>시간</th>
              <th>수업 비고</th>
              <th style={{ width: '120px' }}>과목</th>
              <th style={{ width: '100px', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {sortedStudents.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <span className="material-symbols-outlined empty-state-icon">person_off</span>
                    <div className="empty-state-title">등록된 학생이 없습니다</div>
                    <div className="empty-state-description">'학생 추가' 버튼을 눌러 새 학생을 등록해보세요.</div>
                  </div>
                </td>
              </tr>
            ) : (
              sortedStudents.map((student) => (
                <tr key={student.id}>
                  <td><span style={{ fontWeight: 600 }}>{student.name}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`grade-badge ${gradeClassMap[student.grade]}`}>{student.grade}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`day-badge ${dayClassMap[student.day]}`}>{student.day}</span>
                  </td>
                  <td><span style={{ fontWeight: 500 }}>{student.startTime} — {student.endTime}</span></td>
                  <td style={{ color: student.note ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {student.note || '—'}
                  </td>
                  <td><span className="subject-badge">{student.subject}</span></td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                      <button className="btn-icon" title="수정">
                        <span className="material-symbols-outlined">edit_square</span>
                      </button>
                      <button className="btn-icon" title="삭제" style={{ color: 'var(--danger)' }}>
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
