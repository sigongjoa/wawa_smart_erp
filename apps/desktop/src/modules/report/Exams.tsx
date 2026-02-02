import { useState, useEffect } from 'react';
import { useReportStore } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useAsync } from '../../hooks/useAsync';
import { createExamEntry, updateExamDifficulty } from '../../services/notion';
import type { Exam, DifficultyGrade } from '../../types';

export default function Exams() {
  const { exams, fetchAllData, isLoading, currentYearMonth, currentUser } = useReportStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { addToast } = useToastStore();
  const updateAsync = useAsync(updateExamDifficulty);
  const createAsync = useAsync(createExamEntry);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleUpdateDifficulty = async (id: string, diff: DifficultyGrade) => {
    const result = await updateAsync.execute(id, diff);
    if (result.success) {
      addToast('난이도가 수정되었습니다.', 'success');
      await fetchAllData();
    } else {
      addToast(result.error?.message || '수정에 실패했습니다.', 'error');
    }
  };

  const handleCreate = async (data: any) => {
    const result = await createAsync.execute({
      ...data,
      yearMonth: currentYearMonth,
      uploadedBy: currentUser?.teacher?.name || '관리자'
    });
    if (result.success) {
      addToast('시험지가 등록되었습니다.', 'success');
      await fetchAllData();
      setIsModalOpen(false);
    } else {
      addToast(result.error?.message || '등록에 실패했습니다.', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">시험 관리 ({currentYearMonth})</h1>
            <p className="page-description">과목별 시험지 및 난이도를 관리합니다</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <span className="material-symbols-outlined">add</span>시험 추가
            </button>
          </div>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {exams.map(exam => (
          <div key={exam.id} className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="subject-badge">{exam.subject}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{exam.yearMonth}</span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>난이도</label>
              <select
                className="search-input"
                style={{ width: '100%' }}
                value={exam.difficulty}
                onChange={(e) => handleUpdateDifficulty(exam.id, e.target.value as DifficultyGrade)}
              >
                {['A', 'B', 'C', 'D', 'E', 'F'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              범위: {exam.scope || '미지정'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              등록자: {exam.uploadedBy}
            </div>
            {exam.examFileUrl && (
              <a href={exam.examFileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ marginTop: '12px', width: '100%' }}>
                <span className="material-symbols-outlined">attachment</span>시험지 보기
              </a>
            )}
          </div>
        ))}
      </div>

      {isLoading && <p style={{ textAlign: 'center', marginTop: '40px' }}>로딩 중...</p>}
      {!isLoading && exams.length === 0 && (
        <div className="empty-state">
          <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>description</span>
          <div className="empty-state-title">등록된 시험이 없습니다.</div>
          <p className="empty-state-description">새 시험 정보를 추가하여 관리를 시작하세요.</p>
        </div>
      )}

      {isModalOpen && (
        <ExamModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}

function ExamModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    subject: '국어',
    difficulty: 'A' as DifficultyGrade,
    scope: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: '400px', padding: '32px', boxShadow: 'var(--shadow-lg)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>새 시험지 정보 등록</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="filter-group-label" style={{ display: 'block', marginBottom: '8px' }}>과목</label>
            <select className="search-input" style={{ width: '100%' }} value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })}>
              {['국어', '영어', '수학', '사회', '과학', '기타'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="filter-group-label" style={{ display: 'block', marginBottom: '8px' }}>기본 난이도</label>
            <select className="search-input" style={{ width: '100%' }} value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value as DifficultyGrade })}>
              {['A', 'B', 'C', 'D', 'E', 'F'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="filter-group-label" style={{ display: 'block', marginBottom: '8px' }}>시험 범위</label>
            <input className="search-input" style={{ width: '100%' }} value={formData.scope} onChange={e => setFormData({ ...formData, scope: e.target.value })} placeholder="예: 평면좌표 ~ 원의 방정식" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary">
              <span className="material-symbols-outlined">add</span>
              등록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
