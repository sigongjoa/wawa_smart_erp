export default function Settings() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">시험 일정 설정</h1>
            <p className="page-description">시험 일정 관리 설정을 변경합니다</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>알림 설정</h2>
        <div className="form-group">
          <label className="form-label">시험 D-Day 알림</label>
          <select className="form-input">
            <option>시험 1일 전</option>
            <option>시험 2일 전</option>
            <option>시험 3일 전</option>
            <option>시험 1주일 전</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">결시 자동 기록</label>
          <select className="form-input">
            <option>사용</option>
            <option>사용 안함</option>
          </select>
        </div>
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
          <button className="btn btn-primary"><span className="material-symbols-outlined">save</span>설정 저장</button>
        </div>
      </div>
    </div>
  );
}
