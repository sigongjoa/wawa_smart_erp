import { useState, useEffect } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useAsync } from '../../hooks/useAsync';
import { updateExamSchedulesBatch } from '../../services/notion';

export default function Today() {
  const { students, examSchedules } = useFilteredData();
  const { currentYearMonth, fetchAllData, isLoading: storeLoading } = useReportStore();
  const { addToast } = useToastStore();
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);

  const batchUpdateAsync = useAsync(updateExamSchedulesBatch);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(students.map(s => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleBatchUpdate = async () => {
    if (selectedStudentIds.length === 0) {
      addToast('선택된 학생이 없습니다.', 'warning');
      return;
    }

    const result = await batchUpdateAsync.execute(selectedStudentIds, currentYearMonth, batchDate);
    if (result.success) {
      addToast(`${selectedStudentIds.length}명의 시험 일정이 지정되었습니다.`, 'success');
      setIsModalOpen(false);
      setSelectedStudentIds([]);
      await fetchAllData();
    } else {
      addToast(result.error?.message || '업데이트에 실패했습니다.', 'error');
    }
  };

  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const todayDateStr = new Date().toISOString().split('T')[0];

  const todayExams = students.filter(s => {
    const schedule = examSchedules.find(sc => sc.studentId === s.id && sc.yearMonth === currentYearMonth);
    return schedule?.examDate === todayDateStr;
  });

  const pendingExams = students.filter(s => {
    const schedule = examSchedules.find(sc => sc.studentId === s.id && sc.yearMonth === currentYearMonth);
    return !schedule || !schedule.examDate;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">오늘 시험</h1>
            <p className="page-description">{todayStr} 시험 일정</p>
          </div>
          <div className="page-actions">
            <button
              className="btn btn-primary"
              onClick={() => setIsModalOpen(true)}
              disabled={selectedStudentIds.length === 0}
            >
              <span className="material-symbols-outlined">calendar_add_on</span>일괄 날짜 지정
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-symbols-outlined">assignment</span></div>
          <div><span className="stat-label">오늘 시험</span><div className="stat-value">{todayExams.length}<span className="stat-unit">명</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon rose"><span className="material-symbols-outlined">error</span></div>
          <div><span className="stat-label">미지정</span><div className="stat-value">{pendingExams.length}<span className="stat-unit">명</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-symbols-outlined">group</span></div>
          <div><span className="stat-label">전체 학생</span><div className="stat-value">{students.length}<span className="stat-unit">명</span></div></div>
        </div>
      </div>

      <div className="table-container card" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '48px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={selectedStudentIds.length === students.length && students.length > 0}
                />
              </th>
              <th>학생 정보</th>
              <th>학년</th>
              <th>수강과목</th>
              <th>시험 예정일</th>
              <th style={{ textAlign: 'center' }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {students.length > 0 ? (
              students.map(s => {
                const schedule = examSchedules.find(sc => sc.studentId === s.id && sc.yearMonth === currentYearMonth);
                const isSelected = selectedStudentIds.includes(s.id);
                return (
                  <tr key={s.id} className={isSelected ? 'selected-row' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectStudent(s.id)}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                    </td>
                    <td>{s.grade}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {s.subjects.map(sub => <span key={sub} className="subject-badge">{sub}</span>)}
                      </div>
                    </td>
                    <td style={{ color: schedule?.examDate ? 'inherit' : 'var(--text-muted)' }}>
                      {schedule?.examDate || '미지정'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${schedule?.examDate === todayDateStr ? 'badge-success' : schedule?.examDate ? 'badge-info' : 'badge-neutral'}`}>
                        {schedule?.examDate === todayDateStr ? '오늘' : schedule?.examDate ? '예정' : '대기'}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <span className="material-symbols-outlined empty-state-icon">event_busy</span>
                    <div className="empty-state-title">학생 정보가 없습니다</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">일괄 날짜 지정</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                선택한 {selectedStudentIds.length}명의 학생에게 동일한 시험 일정을 지정합니다.
              </p>
              <div className="form-group">
                <label>시험 예정일</label>
                <input
                  type="date"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={batchDate}
                  onChange={e => setBatchDate(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ border: 'none', paddingTop: '0' }}>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>취소</button>
              <button
                className="btn btn-primary"
                onClick={handleBatchUpdate}
                disabled={batchUpdateAsync.isLoading}
              >
                {batchUpdateAsync.isLoading ? '저장 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .selected-row { background: var(--primary-light) !important; }
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .modal-content { background: white; border-radius: 12px; padding: 24px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
}
