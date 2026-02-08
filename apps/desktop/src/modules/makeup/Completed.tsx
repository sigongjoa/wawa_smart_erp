import { useState, useEffect } from 'react';
import { useMakeupStore } from '../../stores/makeupStore';
import { useReportStore } from '../../stores/reportStore';
import { getTeacherName } from '../../constants/common';

export default function MakeupCompleted() {
  const { records, isLoading, fetchRecords } = useMakeupStore();
  const { teachers } = useReportStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const completedRecords = records
    .filter((r) => r.status === '완료')
    .filter((r) =>
      r.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.subject?.toLowerCase().includes(searchTerm.toLowerCase())
    );


  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">완료된 보강</h1>
            <p className="page-description">보강이 완료된 기록입니다</p>
          </div>
        </div>
      </div>

      <div className="search-bar" style={{ marginBottom: '1rem' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)' }}>search</span>
        <input
          className="search-input"
          placeholder="학생 이름 또는 과목 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>학생명</th>
              <th>과목</th>
              <th>담당선생님</th>
              <th>결석일</th>
              <th>결석사유</th>
              <th>보강일</th>
              <th>보강시간</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</td></tr>
            ) : completedRecords.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>완료된 보강이 없습니다</td></tr>
            ) : (
              completedRecords.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.studentName}</td>
                  <td>{r.subject}</td>
                  <td>{getTeacherName(teachers, r.teacherId || '')}</td>
                  <td>{r.absentDate}</td>
                  <td>{r.absentReason}</td>
                  <td>{r.makeupDate || '-'}</td>
                  <td>{r.makeupTime || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
