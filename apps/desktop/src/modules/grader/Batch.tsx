export default function Batch() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">일괄 채점</h1>
            <p className="page-description">여러 학생의 OMR 카드를 한 번에 채점합니다</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>1. 정답 PDF 업로드</h2>
          <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--primary)' }}>picture_as_pdf</span>
            <div style={{ marginTop: '12px', fontWeight: 500 }}>정답 PDF 업로드</div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>2. OMR 이미지 업로드</h2>
          <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--success)' }}>image</span>
            <div style={{ marginTop: '12px', fontWeight: 500 }}>OMR 이미지 업로드</div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button className="btn btn-primary" style={{ padding: '14px 32px' }} disabled>
          <span className="material-symbols-outlined">play_arrow</span>
          일괄 채점 시작
        </button>
      </div>
    </div>
  );
}
