export default function Exams() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">시험 관리</h1>
            <p className="page-description">월말평가 시험 정보를 관리합니다</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary"><span className="material-symbols-outlined">add</span>시험 추가</button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>시험명</th>
              <th>과목</th>
              <th>시험일</th>
              <th>총점</th>
              <th>응시자</th>
              <th style={{ textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6}>
                <div className="empty-state">
                  <span className="material-symbols-outlined empty-state-icon">quiz</span>
                  <div className="empty-state-title">등록된 시험이 없습니다</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
