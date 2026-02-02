export default function Settings() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">리포트 설정</h1>
            <p className="page-description">리포트 시스템 설정을 관리합니다</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>카카오 알림톡 설정</h2>
        <div className="form-group">
          <label className="form-label">발신 프로필 키</label>
          <input type="text" className="form-input" placeholder="카카오 비즈니스 발신 프로필 키" />
        </div>
        <div className="form-group">
          <label className="form-label">템플릿 코드</label>
          <input type="text" className="form-input" placeholder="알림톡 템플릿 코드" />
        </div>
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
          <button className="btn btn-primary"><span className="material-symbols-outlined">save</span>설정 저장</button>
        </div>
      </div>
    </div>
  );
}
