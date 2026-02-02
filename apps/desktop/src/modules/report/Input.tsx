export default function Input() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">성적 입력</h1>
            <p className="page-description">학생별 성적과 선생님 코멘트를 입력합니다</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div className="empty-state">
          <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>edit_note</span>
          <div className="empty-state-title">입력할 리포트가 없습니다</div>
          <div className="empty-state-description">먼저 시험과 학생을 등록해주세요</div>
        </div>
      </div>
    </div>
  );
}
