export default function Settings() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">채점 설정</h1>
            <p className="page-description">채점 시스템 설정을 관리합니다</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Notion 연동</h2>
        <div className="form-group">
          <label className="form-label">성적 DB ID</label>
          <input type="text" className="form-input" placeholder="채점 결과를 저장할 Notion DB ID" />
        </div>
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
          <button className="btn btn-primary"><span className="material-symbols-outlined">save</span>설정 저장</button>
        </div>
      </div>
    </div>
  );
}
