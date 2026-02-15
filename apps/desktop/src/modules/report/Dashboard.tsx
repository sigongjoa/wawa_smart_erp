import { useNavigate } from 'react-router-dom';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import PageHeader from '../../components/common/PageHeader';

export default function Dashboard() {
  const navigate = useNavigate();
  const { students, reports, exams } = useFilteredData();
  const { sendHistories, fetchAllData, isLoading, currentYearMonth } = useReportStore();
  // AppShell에서 이미 fetchAllData 호출하므로 여기서는 중복 호출하지 않음

  if (isLoading && students.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>데이터 로딩 중...</h2>
      </div>
    );
  }

  const completedCount = reports.filter(r => r.status === 'complete' || r.status === 'sent').length;
  const pendingCount = students.length - completedCount;
  const sentCount = sendHistories.length;

  return (
    <div>
      <PageHeader
        title="리포트 대시보드"
        description="월말평가 리포트 시스템 현황을 확인합니다"
        actions={
          <>
            <button className="btn btn-primary" onClick={() => navigate('/report/input')}>
              <span className="material-symbols-outlined">add</span>
              새 리포트 작성
            </button>
            <button className="btn btn-secondary" onClick={() => fetchAllData()} disabled={isLoading}>
              <span className={`material-symbols-outlined ${isLoading ? 'spin' : ''}`}>refresh</span>
              새로고침
            </button>
          </>
        }
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-symbols-outlined">groups</span></div>
          <div><span className="stat-label">총 학생 수</span><div className="stat-value">{students.length}<span className="stat-unit">명</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-symbols-outlined">task_alt</span></div>
          <div><span className="stat-label">리포트 완료</span><div className="stat-value">{completedCount}<span className="stat-unit">명</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><span className="material-symbols-outlined">pending</span></div>
          <div><span className="stat-label">대기 중</span><div className="stat-value">{pendingCount > 0 ? pendingCount : 0}<span className="stat-unit">명</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><span className="material-symbols-outlined">send</span></div>
          <div><span className="stat-label">전송 완료</span><div className="stat-value">{sentCount}<span className="stat-unit">건</span></div></div>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>이번 달 시험 현황 ({currentYearMonth})</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/report/input')}>상세 입력</button>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table" style={{ border: 'none' }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px' }}>학생명</th>
                  <th>학년</th>
                  <th>시험 일정</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const report = reports.find(r => r.studentId === s.id);
                  const studentExams = exams.filter(e => e.studentId === s.id);
                  const latestExam = studentExams.length > 0
                    ? studentExams.sort((a, b) => (b.examDate || '').localeCompare(a.examDate || ''))[0]
                    : null;

                  const status = report
                    ? (report.scores.length >= s.subjects.length ? '완료' : '진행 중')
                    : (latestExam?.completedAt ? '채점 대기' : '미시작');

                  return (
                    <tr key={s.id} onClick={() => navigate('/report/input')} style={{ cursor: 'pointer' }}>
                      <td style={{ paddingLeft: '24px', fontWeight: 500 }}>{s.name}</td>
                      <td>{s.grade}</td>
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {latestExam?.examDate ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>event</span>
                              {latestExam.examDate}
                            </span>
                          ) : '일정 미지합'}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${status === '완료' ? 'badge-success' : status === '채점 대기' ? 'badge-info' : status === '진행 중' ? 'badge-warning' : 'badge-neutral'}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>바로가기</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/report/students')}>
              <span className="material-symbols-outlined">person</span>학생 관리
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/report/exams')}>
              <span className="material-symbols-outlined">description</span>시험 관리
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/report/input')}>
              <span className="material-symbols-outlined">edit_note</span>성적 입력
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>최근 발송 이력</h2>
        {sendHistories.length > 0 ? (
          <div className="activity-list">
            {sendHistories.slice(0, 5).map((history, idx) => (
              <div key={idx} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{history.studentName}</span> 학생 리포트 전송 ({history.recipientPhone})
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  {new Date(history.sentAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '40px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>history</span>
            <div className="empty-state-title">최근 전송 이력이 없습니다</div>
          </div>
        )}
      </div>
    </div>
  );
}
