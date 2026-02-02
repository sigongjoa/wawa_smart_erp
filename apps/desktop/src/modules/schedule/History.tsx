export default function History() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">시험 이력</h1>
            <p className="page-description">지난 시험 기록과 결시 이력을 확인합니다</p>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-group-label">기간</span>
          <div className="filter-buttons">
            <button className="filter-btn active">전체</button>
            <button className="filter-btn">이번 달</button>
            <button className="filter-btn">지난 달</button>
            <button className="filter-btn">최근 3개월</button>
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-group-label">검색</span>
          <input type="text" className="search-input" placeholder="학생 이름 검색..." />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>시험일</th>
              <th>학생</th>
              <th>학년</th>
              <th>과목</th>
              <th>상태</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6}>
                <div className="empty-state">
                  <span className="material-symbols-outlined empty-state-icon">history</span>
                  <div className="empty-state-title">시험 이력이 없습니다</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
