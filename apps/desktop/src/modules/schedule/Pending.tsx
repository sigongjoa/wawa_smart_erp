export default function Pending() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">미지정 학생</h1>
            <p className="page-description">시험 일정이 지정되지 않은 학생 목록입니다</p>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}><input type="checkbox" /></th>
              <th>학생 정보</th>
              <th>학년</th>
              <th>수강과목</th>
              <th>등록일</th>
              <th style={{ textAlign: 'center' }}>일정 지정</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6}>
                <div className="empty-state">
                  <span className="material-symbols-outlined empty-state-icon">check_circle</span>
                  <div className="empty-state-title">모든 학생의 일정이 지정되었습니다</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
