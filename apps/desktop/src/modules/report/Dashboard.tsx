export default function Dashboard() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">리포트 대시보드</h1>
            <p className="page-description">월말평가 리포트 시스템 현황을 확인합니다</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary">
              <span className="material-symbols-outlined">add</span>
              새 리포트 작성
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-symbols-outlined">groups</span></div>
          <div><span className="stat-label">총 학생 수</span><div className="stat-value">42<span className="stat-unit">명</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-symbols-outlined">task_alt</span></div>
          <div><span className="stat-label">리포트 완료</span><div className="stat-value">38<span className="stat-unit">명</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><span className="material-symbols-outlined">pending</span></div>
          <div><span className="stat-label">대기 중</span><div className="stat-value">4<span className="stat-unit">명</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><span className="material-symbols-outlined">send</span></div>
          <div><span className="stat-label">전송 완료</span><div className="stat-value">35<span className="stat-unit">건</span></div></div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>최근 활동</h2>
        <div className="empty-state" style={{ padding: '40px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>history</span>
          <div className="empty-state-title">최근 활동이 없습니다</div>
        </div>
      </div>
    </div>
  );
}
