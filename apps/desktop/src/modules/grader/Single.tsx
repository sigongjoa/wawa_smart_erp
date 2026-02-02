export default function Single() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">단건 채점</h1>
            <p className="page-description">OMR 카드를 스캔하여 개별 채점합니다</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>OMR 카드 업로드</h2>
          <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: '48px', textAlign: 'center', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--text-muted)' }}>upload_file</span>
            <div style={{ marginTop: '16px', fontWeight: 500 }}>OMR 이미지를 드래그하거나 클릭하여 업로드</div>
            <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>PNG, JPG 지원 (최대 10MB)</div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>채점 결과</h2>
          <div className="empty-state" style={{ padding: '40px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>grading</span>
            <div className="empty-state-title">OMR 카드를 업로드하세요</div>
          </div>
        </div>
      </div>
    </div>
  );
}
