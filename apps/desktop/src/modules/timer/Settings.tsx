export default function Settings() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">시간표 설정</h1>
            <p className="page-description">시간표 관리 설정을 변경합니다</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined">cloud</span>
          Notion 연동 설정
        </h2>

        <div className="form-group">
          <label className="form-label">Notion API 키 *</label>
          <input type="password" className="form-input" placeholder="secret_xxxxxxxx..." />
          <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Notion Integration에서 발급받은 API 키</small>
        </div>

        <div className="form-group">
          <label className="form-label">학생 DB ID *</label>
          <input type="text" className="form-input" placeholder="32자리 ID 또는 Notion URL" />
        </div>

        <div className="form-group">
          <label className="form-label">출석 DB ID (선택)</label>
          <input type="text" className="form-input" placeholder="32자리 ID 또는 Notion URL" />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
          <button className="btn btn-secondary">연결 테스트</button>
          <button className="btn btn-primary">
            <span className="material-symbols-outlined">save</span>
            설정 저장
          </button>
        </div>
      </div>
    </div>
  );
}
