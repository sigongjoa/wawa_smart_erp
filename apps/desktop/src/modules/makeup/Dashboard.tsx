import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMakeupStore } from '../../stores/makeupStore';
import { useReportStore } from '../../stores/reportStore';
import { getTeacherName } from '../../constants/common';

export default function MakeupDashboard() {
  const { records, isLoading, fetchRecords } = useMakeupStore();
  const { teachers } = useReportStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const pending = records.filter((r) => r.status === '시작 전');
  const inProgress = records.filter((r) => r.status === '진행 중');
  const completed = records.filter((r) => r.status === '완료');

  const stats = [
    { label: '대기 중', value: pending.length, icon: 'pending_actions', color: 'var(--warning)', path: '/makeup/pending' },
    { label: '진행 중', value: inProgress.length, icon: 'autorenew', color: 'var(--primary)', path: '/makeup/progress' },
    { label: '완료', value: completed.length, icon: 'task_alt', color: 'var(--success)', path: '/makeup/completed' },
    { label: '전체', value: records.length, icon: 'list_alt', color: '#6b7280', path: '/makeup/pending' },
  ];

  // 최근 등록된 보강 (최근 5개)
  const recentRecords = [...records].slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">보강관리 대시보드</h1>
            <p className="page-description">결석 학생의 보강 수업 현황을 한눈에 확인합니다</p>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(stat.path)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-md)',
                background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ color: stat.color, fontSize: 24 }}>{stat.icon}</span>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{stat.label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{isLoading ? '-' : stat.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 최근 보강 목록 */}
      <div className="card">
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>최근 등록된 보강</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>학생명</th>
              <th>과목</th>
              <th>담당</th>
              <th>결석일</th>
              <th>보강예정일</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</td></tr>
            ) : recentRecords.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>등록된 보강이 없습니다</td></tr>
            ) : (
              recentRecords.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.studentName}</td>
                  <td>{r.subject}</td>
                  <td>{getTeacherName(teachers, r.teacherId || '')}</td>
                  <td>{r.absentDate}</td>
                  <td>{r.makeupDate || <span style={{ color: 'var(--danger)' }}>미지정</span>}</td>
                  <td>
                    <span className={`status-badge ${r.status === '완료' ? 'success' : r.status === '진행 중' ? 'info' : 'warning'}`}>
                      <span className="dot"></span>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
