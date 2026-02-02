export default function Preview() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">리포트 미리보기</h1>
            <p className="page-description">전송 전 리포트를 미리 확인합니다</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div className="empty-state">
          <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>preview</span>
          <div className="empty-state-title">미리볼 리포트가 없습니다</div>
        </div>
      </div>
    </div>
  );
}
