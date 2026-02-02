export default function Stats() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">채점 통계</h1>
            <p className="page-description">채점 결과 통계를 분석합니다</p>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-symbols-outlined">description</span></div>
          <div><span className="stat-label">총 채점 수</span><div className="stat-value">0<span className="stat-unit">건</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-symbols-outlined">trending_up</span></div>
          <div><span className="stat-label">평균 정답률</span><div className="stat-value">-<span className="stat-unit">%</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><span className="material-symbols-outlined">person</span></div>
          <div><span className="stat-label">채점 학생 수</span><div className="stat-value">0<span className="stat-unit">명</span></div></div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div className="empty-state">
          <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>analytics</span>
          <div className="empty-state-title">통계 데이터가 없습니다</div>
          <div className="empty-state-description">채점을 진행하면 통계가 표시됩니다</div>
        </div>
      </div>
    </div>
  );
}
