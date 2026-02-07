import { useState } from 'react';
import { useMakeupStore } from '../../../stores/makeupStore';
import { useToastStore } from '../../../stores/toastStore';
import type { Student, Teacher } from '../../../types';

interface Props {
  students: Student[];
  teachers: Teacher[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddAbsenceModal({ students, teachers, onClose, onSuccess }: Props) {
  const { addRecord } = useMakeupStore();
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    studentId: '',
    subject: '',
    teacherId: '',
    absentDate: '',
    absentReason: '',
    makeupDate: '',
    makeupTime: '',
    memo: '',
  });

  const [studentSearch, setStudentSearch] = useState('');

  const filteredStudents = students.filter(
    (s) => s.status === 'active' && s.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const selectedStudent = students.find((s) => s.id === formData.studentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.absentDate || !formData.absentReason || !formData.subject) {
      addToast('필수 항목을 모두 입력해주세요.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const success = await addRecord({
      studentId: formData.studentId,
      studentName: selectedStudent?.name || '',
      subject: formData.subject,
      teacherId: formData.teacherId || undefined,
      absentDate: formData.absentDate,
      absentReason: formData.absentReason,
      makeupDate: formData.makeupDate || undefined,
      makeupTime: formData.makeupTime || undefined,
      memo: formData.memo || undefined,
    });
    setIsSubmitting(false);

    if (success) {
      addToast('결석 기록이 추가되었습니다.', 'success');
      onSuccess();
    } else {
      addToast('결석 기록 추가에 실패했습니다.', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">결석 기록 추가</h2>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 학생 선택 */}
            <div>
              <label className="form-label">학생 선택 *</label>
              <input
                className="search-input"
                placeholder="학생 검색..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{ marginBottom: '0.5rem' }}
              />
              <select
                className="search-input"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                size={4}
                style={{ height: 'auto' }}
                required
              >
                <option value="" disabled>학생을 선택하세요</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
                ))}
              </select>
            </div>

            {/* 과목 */}
            <div>
              <label className="form-label">과목 *</label>
              {selectedStudent && selectedStudent.subjects.length > 0 ? (
                <select
                  className="search-input"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                >
                  <option value="">과목을 선택하세요</option>
                  {selectedStudent.subjects.map((subj) => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="search-input"
                  placeholder="과목을 입력하세요"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              )}
            </div>

            {/* 담당선생님 */}
            <div>
              <label className="form-label">담당선생님</label>
              <select
                className="search-input"
                value={formData.teacherId}
                onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              >
                <option value="">선택 안함</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* 결석일 */}
            <div>
              <label className="form-label">결석일 *</label>
              <input
                type="date"
                className="search-input"
                value={formData.absentDate}
                onChange={(e) => setFormData({ ...formData, absentDate: e.target.value })}
                required
              />
            </div>

            {/* 결석사유 */}
            <div>
              <label className="form-label">결석사유 *</label>
              <textarea
                className="search-input"
                placeholder="결석 사유를 입력하세요"
                value={formData.absentReason}
                onChange={(e) => setFormData({ ...formData, absentReason: e.target.value })}
                rows={2}
                required
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* 보강예정일 (선택) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label">보강예정일 (선택)</label>
                <input
                  type="date"
                  className="search-input"
                  value={formData.makeupDate}
                  onChange={(e) => setFormData({ ...formData, makeupDate: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">보강시간 (선택)</label>
                <input
                  className="search-input"
                  placeholder="예: 14:00~15:00"
                  value={formData.makeupTime}
                  onChange={(e) => setFormData({ ...formData, makeupTime: e.target.value })}
                />
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="form-label">메모</label>
              <input
                className="search-input"
                placeholder="추가 메모"
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
