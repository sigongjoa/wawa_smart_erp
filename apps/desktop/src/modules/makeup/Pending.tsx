import { useState, useEffect } from 'react';
import { useMakeupStore } from '../../stores/makeupStore';
import { useReportStore } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useSearch } from '../../hooks/useSearch';
import AddAbsenceModal from './components/AddAbsenceModal';
import ScheduleMakeupModal from './components/ScheduleMakeupModal';
import type { MakeupRecord } from '../../types';
import { getTeacherName } from '../../constants/common';

export default function MakeupPending() {
  const { records, isLoading, fetchRecords, updateRecord, deleteRecord } = useMakeupStore();
  const { students, teachers, currentUser } = useReportStore();
  const { addToast } = useToastStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<MakeupRecord | null>(null);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const basePendingRecords = records
    .filter((r) => r.status === '시작 전' || r.status === '진행 중');

  const { searchTerm, setSearchTerm, filteredItems: pendingRecords } = useSearch(basePendingRecords, ['studentName', 'subject']);

  const handleMarkComplete = async (record: MakeupRecord) => {
    if (!confirm(`${record.studentName} 학생의 보강을 완료 처리하시겠습니까?`)) return;
    const success = await updateRecord(record.id, { status: '완료' });
    if (success) {
      addToast('보강이 완료 처리되었습니다.', 'success');
    } else {
      addToast('완료 처리에 실패했습니다.', 'error');
    }
  };

  const handleDelete = async (record: MakeupRecord) => {
    if (!confirm(`${record.studentName} 학생의 보강 기록을 삭제하시겠습니까?`)) return;
    const success = await deleteRecord(record.id);
    if (success) {
      addToast('보강 기록이 삭제되었습니다.', 'success');
    } else {
      addToast('삭제에 실패했습니다.', 'error');
    }
  };


  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">대기 중인 보강</h1>
            <p className="page-description">보강이 필요한 학생 목록입니다</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <span className="material-symbols-outlined">add</span>
              결석 기록 추가
            </button>
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
              <th>보강예정일</th>
              <th>보강시간</th>
              <th>상태</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</td></tr>
            ) : pendingRecords.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>대기 중인 보강이 없습니다</td></tr>
            ) : (
              pendingRecords.map((r) => {
                const isOwner = currentUser?.teacher.id === r.teacherId;
                const isAdmin = currentUser?.teacher.isAdmin;
                const canEdit = isAdmin || isOwner;

                return (
                  <tr key={r.id} style={{ opacity: canEdit ? 1 : 0.7 }}>
                    <td style={{ fontWeight: 500 }}>{r.studentName}</td>
                    <td>{r.subject}</td>
                    <td style={{ fontWeight: isOwner ? 600 : 400 }}>
                      {getTeacherName(teachers, r.teacherId || '')}
                      {isOwner && <span style={{ marginLeft: '4px', fontSize: '10px', color: 'var(--primary)' }}>(나)</span>}
                    </td>
                    <td>{r.absentDate}</td>
                    <td>{r.absentReason}</td>
                    <td>{r.makeupDate || <span style={{ color: 'var(--danger)' }}>미지정</span>}</td>
                    <td>{r.makeupTime || '-'}</td>
                    <td>
                      <span className={`status-badge ${r.status === '진행 중' ? 'info' : 'warning'}`}>
                        <span className="dot"></span>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {canEdit ? (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setScheduleTarget(r)}
                              title="일정 등록"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_calendar</span>
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleMarkComplete(r)}
                              title="완료 처리"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDelete(r)}
                              title="삭제"
                              style={{ color: 'var(--danger)' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8', padding: '4px' }}>권한 없음</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isAddModalOpen && (
        <AddAbsenceModal
          students={students}
          teachers={teachers}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            fetchRecords();
          }}
        />
      )}

      {scheduleTarget && (
        <ScheduleMakeupModal
          record={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          onSuccess={() => {
            setScheduleTarget(null);
            fetchRecords();
          }}
        />
      )}
    </div>
  );
}
