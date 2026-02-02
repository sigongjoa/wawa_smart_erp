export default function Upcoming() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">예정된 시험</h1>
            <p className="page-description">앞으로 예정된 시험 일정을 확인합니다</p>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>시험 예정일</th>
              <th>학생</th>
              <th>학년</th>
              <th>과목</th>
              <th>D-Day</th>
              <th style={{ textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6}>
                <div className="empty-state">
                  <span className="material-symbols-outlined empty-state-icon">event_upcoming</span>
                  <div className="empty-state-title">예정된 시험이 없습니다</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
