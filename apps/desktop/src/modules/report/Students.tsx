import { useState, useEffect } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useAsync } from '../../hooks/useAsync';
import { createStudent, updateStudent, deleteStudent } from '../../services/notion';
import type { Student } from '../../types';

export default function Students() {
  const { students } = useFilteredData();
  const { fetchAllData, isLoading: storeLoading } = useReportStore();
  const { addToast } = useToastStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const createAsync = useAsync(createStudent);
  const updateAsync = useAsync(updateStudent);
  const deleteAsync = useAsync(deleteStudent);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const isLoading = storeLoading || createAsync.isLoading || updateAsync.isLoading || deleteAsync.isLoading;

  const handleCreate = async (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await createAsync.execute(student);
    if (result.success) {
      addToast('학생이 성공적으로 등록되었습니다.', 'success');
      await fetchAllData();
      setIsModalOpen(false);
    } else {
      addToast(result.error?.message || '학생 등록에 실패했습니다.', 'error');
    }
  };

  const handleUpdate = async (id: string, updates: any) => {
    const result = await updateAsync.execute(id, updates);
    if (result.success) {
      addToast('학생 정보가 수정되었습니다.', 'success');
      await fetchAllData();
      setIsModalOpen(false);
      setEditingStudent(null);
    } else {
      addToast(result.error?.message || '수정에 실패했습니다.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      const result = await deleteAsync.execute(id);
      if (result.success) {
        addToast('학생이 삭제되었습니다.', 'success');
        await fetchAllData();
      } else {
        addToast(result.error?.message || '삭제에 실패했습니다.', 'error');
      }
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">학생 관리</h1>
            <p className="page-description">학생 정보를 관리하고 시험 일정을 확인합니다</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => { setEditingStudent(null); setIsModalOpen(true); }}>
              <span className="material-symbols-outlined">add</span>학생 추가
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>학년</th>
              <th>이름</th>
              <th>수강과목</th>
              <th>학부모</th>
              <th>연락처</th>
              <th>상태</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id}>
                <td><span className={`grade-badge ${student.grade.toLowerCase()}`}>{student.grade}</span></td>
                <td style={{ fontWeight: 600 }}>{student.name}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {student.subjects.map(sub => <span key={sub} className="subject-badge">{sub}</span>)}
                  </div>
                </td>
                <td>{student.parentName}</td>
                <td>{student.parentPhone}</td>
                <td>
                  <span className={`status-badge ${student.status === 'active' ? 'success' : 'danger'}`}>
                    <span className="dot"></span>{student.status === 'active' ? '활성' : '비활성'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-icon" onClick={() => { setEditingStudent(student); setIsModalOpen(true); }}>
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(student.id)}>
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>}
        {!isLoading && students.length === 0 && <div className="empty-state">학생이 없습니다.</div>}
      </div>

      {isModalOpen && (
        <StudentModal
          student={editingStudent}
          onClose={() => setIsModalOpen(false)}
          onSubmit={editingStudent ? (data) => handleUpdate(editingStudent.id, data) : handleCreate}
        />
      )}
    </div>
  );
}

function StudentModal({ student, onClose, onSubmit }: { student: any; onClose: () => void; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: student?.name || '',
    grade: student?.grade || '중1',
    subjects: student?.subjects || [],
    parentName: student?.parentName || '',
    parentPhone: student?.parentPhone || '',
    status: student?.status || 'active',
  });

  const availableSubjects = ['국어', '영어', '수학', '사회', '과학', '기타'];

  const toggleSubject = (sub: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(sub)
        ? prev.subjects.filter((s: string) => s !== sub)
        : [...prev.subjects, sub]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('이름을 입력해주세요.');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: '450px', padding: '32px', boxShadow: 'var(--shadow-lg)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>{student ? '학생 정보 수정' : '새 학생 추가'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="filter-group-label" style={{ display: 'block', marginBottom: '8px' }}>학생 이름</label>
            <input className="search-input" style={{ width: '100%' }} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="이름을 입력하세요" required />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="filter-group-label" style={{ display: 'block', marginBottom: '8px' }}>학년</label>
            <select className="search-input" style={{ width: '100%' }} value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })}>
              <option>중1</option><option>중2</option><option>중3</option>
              <option>고1</option><option>고2</option><option>고3</option>
              <option>검정고시</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="filter-group-label" style={{ display: 'block', marginBottom: '8px' }}>수강 과목</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {availableSubjects.map(sub => (
                <button
                  key={sub}
                  type="button"
                  className={`filter-btn ${formData.subjects.includes(sub) ? 'active' : ''}`}
                  onClick={() => toggleSubject(sub)}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="filter-group-label" style={{ display: 'block', marginBottom: '8px' }}>학부모 성함</label>
              <input className="search-input" style={{ width: '100%' }} value={formData.parentName} onChange={e => setFormData({ ...formData, parentName: e.target.value })} placeholder="성함" />
            </div>
            <div className="form-group">
              <label className="filter-group-label" style={{ display: 'block', marginBottom: '8px' }}>학부모 연락처</label>
              <input className="search-input" style={{ width: '100%' }} value={formData.parentPhone} onChange={e => setFormData({ ...formData, parentPhone: e.target.value })} placeholder="010-0000-0000" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="filter-group-label" style={{ display: 'block', marginBottom: '8px' }}>상태</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="radio" checked={formData.status === 'active'} onChange={() => setFormData({ ...formData, status: 'active' })} /> 활성
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="radio" checked={formData.status === 'inactive'} onChange={() => setFormData({ ...formData, status: 'inactive' })} /> 비활성
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary">
              <span className="material-symbols-outlined">save</span>
              {student ? '변경사항 저장' : '학생 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
