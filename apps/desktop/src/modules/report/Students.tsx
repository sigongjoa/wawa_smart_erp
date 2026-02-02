export default function Students() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">학생 관리</h1>
            <p className="page-description">리포트 대상 학생을 관리합니다</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-secondary"><span className="material-symbols-outlined">upload</span>엑셀 업로드</button>
            <button className="btn btn-primary"><span className="material-symbols-outlined">add</span>학생 추가</button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>학년</th>
              <th>학교</th>
              <th>연락처</th>
              <th>학부모 연락처</th>
              <th style={{ textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6}>
                <div className="empty-state">
                  <span className="material-symbols-outlined empty-state-icon">person_off</span>
                  <div className="empty-state-title">등록된 학생이 없습니다</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
