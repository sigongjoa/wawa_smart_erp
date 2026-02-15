import PageHeader from '../../components/common/PageHeader';

export default function History() {
  return (
    <div>
      <PageHeader title="채점 이력" description="과거 채점 기록을 확인합니다" />

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>채점일시</th>
              <th>학생</th>
              <th>시험</th>
              <th>점수</th>
              <th>정답률</th>
              <th style={{ textAlign: 'center' }}>상세</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6}>
                <div className="empty-state">
                  <span className="material-symbols-outlined empty-state-icon">history</span>
                  <div className="empty-state-title">채점 이력이 없습니다</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
