import { useScheduleStore } from '../stores/scheduleStore';
import type { GradeType } from '../types';

// 학년별 CSS 클래스 매핑
const gradeClassMap: Record<GradeType, string> = {
  '중1': 'm1',
  '중2': 'm2',
  '중3': 'm3',
  '고1': 'h1',
  '고2': 'h2',
  '고3': 'h3',
  '검정고시': 'etc',
};

// 요일별 CSS 클래스 매핑
const dayClassMap: Record<string, string> = {
  '화': 'tue',
  '목': 'thu',
  '토': 'sat',
};

export default function DayView() {
  const { students, filters, getFilteredStudents } = useScheduleStore();
  const filteredStudents = getFilteredStudents();

  // 시간순 정렬
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (a.day !== b.day) {
      const dayOrder = { '화': 0, '목': 1, '토': 2 };
      return dayOrder[a.day] - dayOrder[b.day];
    }
    return a.startTime.localeCompare(b.startTime);
  });

  // 통계
  const stats = {
    total: students.length,
    today: students.filter(s => {
      const dayMap: Record<number, string> = { 2: '화', 4: '목', 6: '토' };
      return s.day === dayMap[new Date().getDay()];
    }).length,
    filtered: filteredStudents.length,
  };

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <span className="material-symbols-outlined">groups</span>
          </div>
          <div className="stat-content">
            <span className="stat-label">전체 학생</span>
            <span className="stat-value">
              {stats.total}
              <span className="stat-unit">명</span>
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <span className="material-symbols-outlined">today</span>
          </div>
          <div className="stat-content">
            <span className="stat-label">오늘 수업</span>
            <span className="stat-value">
              {stats.today}
              <span className="stat-unit">명</span>
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <span className="material-symbols-outlined">filter_list</span>
          </div>
          <div className="stat-content">
            <span className="stat-label">필터 결과</span>
            <span className="stat-value">
              {stats.filtered}
              <span className="stat-unit">명</span>
            </span>
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
              <th>수업 비고 (학습 지침)</th>
              <th style={{ width: '120px' }}>과목</th>
              <th style={{ width: '160px' }}>학습 리소스</th>
              <th style={{ width: '100px', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {sortedStudents.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <span className="material-symbols-outlined icon-lg">person_off</span>
                    </div>
                    <div className="empty-state-title">등록된 학생이 없습니다</div>
                    <div className="empty-state-description">
                      '학생 추가' 버튼을 눌러 새 학생을 등록해보세요.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sortedStudents.map((student) => (
                <tr key={student.id} className={`grade-${gradeClassMap[student.grade]}`}>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {student.name}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`grade-badge ${gradeClassMap[student.grade]}`}>
                      {student.grade}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`day-badge ${dayClassMap[student.day]}`}>
                      {student.day}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 500, letterSpacing: '-0.025em' }}>
                      {student.startTime} — {student.endTime}
                    </span>
                  </td>
                  <td>
                    {student.note ? (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                        {student.note}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className="subject-badge">{student.subject}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {student.localFolder && (
                        <button className="btn btn-sm btn-success">
                          <span className="material-symbols-outlined icon-sm">folder</span>
                          자료
                        </button>
                      )}
                      {student.driveLinks && student.driveLinks.length > 0 && (
                        <button className="btn btn-sm" style={{ background: '#ea4335', color: 'white' }}>
                          <span className="material-symbols-outlined icon-sm">cloud</span>
                          Drive
                        </button>
                      )}
                      {!student.localFolder && (!student.driveLinks || student.driveLinks.length === 0) && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                          자료 없음
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                      <button className="btn-icon" title="수정">
                        <span className="material-symbols-outlined icon-sm">edit_square</span>
                      </button>
                      <button className="btn-icon" title="삭제" style={{ color: 'var(--danger)' }}>
                        <span className="material-symbols-outlined icon-sm">delete</span>
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
