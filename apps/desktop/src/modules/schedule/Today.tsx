export default function Today() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">오늘 시험</h1>
            <p className="page-description">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 시험 일정
            </p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary"><span className="material-symbols-outlined">calendar_add_on</span>일괄 날짜 지정</button>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-symbols-outlined">assignment</span></div>
          <div><span className="stat-label">오늘 시험</span><div className="stat-value">0<span className="stat-unit">명</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon rose"><span className="material-symbols-outlined">error</span></div>
          <div><span className="stat-label">결시 / 미지정</span><div className="stat-value">0<span className="stat-unit">명</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-symbols-outlined">group</span></div>
          <div><span className="stat-label">예정 학생</span><div className="stat-value">0<span className="stat-unit">명</span></div></div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}><input type="checkbox" /></th>
              <th>학생 정보</th>
              <th>학년</th>
              <th>수강과목</th>
              <th>시험 상태</th>
              <th>시험 예정일</th>
              <th style={{ textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7}>
                <div className="empty-state">
                  <span className="material-symbols-outlined empty-state-icon">event_busy</span>
                  <div className="empty-state-title">오늘 예정된 시험이 없습니다</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
