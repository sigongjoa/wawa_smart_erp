export default function Send() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">리포트 전송</h1>
            <p className="page-description">완성된 리포트를 학부모에게 전송합니다</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary"><span className="material-symbols-outlined">send</span>일괄 전송</button>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-symbols-outlined">check_circle</span></div>
          <div><span className="stat-label">전송 완료</span><div className="stat-value">0<span className="stat-unit">건</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><span className="material-symbols-outlined">schedule</span></div>
          <div><span className="stat-label">전송 대기</span><div className="stat-value">0<span className="stat-unit">건</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon rose"><span className="material-symbols-outlined">error</span></div>
          <div><span className="stat-label">전송 실패</span><div className="stat-value">0<span className="stat-unit">건</span></div></div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>학생</th>
              <th>학부모</th>
              <th>연락처</th>
              <th>상태</th>
              <th>전송일시</th>
              <th style={{ textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6}>
                <div className="empty-state">
                  <span className="material-symbols-outlined empty-state-icon">send</span>
                  <div className="empty-state-title">전송할 리포트가 없습니다</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
