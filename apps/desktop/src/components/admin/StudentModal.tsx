import { useState, useEffect, useRef } from 'react';
import { fetchEnrollmentsByStudent, updateStudentEnrollments } from '../../services/notion';
import type { Student, Teacher } from '../../types';

interface StudentModalProps {
  student: Student | null;
  teachers: Teacher[];
  onClose: () => void;
  onSubmit: (data: any, enrollments: any[]) => void;
}

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
}

const STYLES = {
  sectionContainer: { marginBottom: '24px' },
  sectionTitle: { fontSize: '14px', color: 'var(--primary)', marginBottom: '16px', fontWeight: 600 },
  errorText: { fontSize: '12px', color: 'var(--error, #e74c3c)', marginTop: '4px', display: 'block' as const },
  subjectButton: (isSelected: boolean) => ({
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid',
    fontSize: '13px',
    cursor: 'pointer' as const,
    fontWeight: 500,
    background: isSelected ? 'var(--primary-light)' : 'var(--surface)',
    borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
    color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
    transition: 'all 0.2s ease'
  }),
  statusLabel: (isSelected: boolean) => ({
    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
  }),
  subjectBadgeContainer: { background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '13px' },
  timeInputGrid: { gridTemplateColumns: '80px 1fr 20px 1fr', gap: '8px', alignItems: 'center' },
  timeInput: { padding: '4px 8px', fontSize: '12px', height: '32px' },
};

export default function StudentModal({
  student,
  teachers,
  onClose,
  onSubmit,
}: StudentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    grade: '중1',
    subjects: [] as string[],
    parentName: '',
    parentPhone: '',
    status: 'active' as 'active' | 'inactive',
  });

  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, string>>({});
  const [subjectSchedules, setSubjectSchedules] = useState<Record<string, Schedule[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 데이터 초기화
  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name,
        grade: student.grade || '중1',
        subjects: student.subjects || [],
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
        status: student.status || 'active',
      });

      const mapping: Record<string, string> = {};
      if (student.teacherIds && student.teacherIds.length > 0) {
        student.subjects.forEach(sub => {
          const matchedTeacher = teachers.find(t =>
            student.teacherIds?.includes(t.id) && t.subjects.includes(sub)
          );
          if (matchedTeacher) {
            mapping[sub] = matchedTeacher.id;
          }
        });
      }
      setSubjectTeachers(mapping);

      fetchEnrollmentsByStudent(student.id).then(enrollments => {
        const scheduleMap: Record<string, Schedule[]> = {};
        enrollments.forEach(en => {
          if (!scheduleMap[en.subject]) {
            scheduleMap[en.subject] = [];
          }
          scheduleMap[en.subject].push({
            day: en.day,
            startTime: en.startTime,
            endTime: en.endTime,
          });
        });

        const paddedMap: Record<string, Schedule[]> = {};
        student.subjects.forEach(sub => {
          const existing = scheduleMap[sub] || [];
          paddedMap[sub] = [
            existing[0] || { day: '월', startTime: '', endTime: '' },
            existing[1] || { day: '화', startTime: '', endTime: '' },
            existing[2] || { day: '수', startTime: '', endTime: '' },
            existing[3] || { day: '목', startTime: '', endTime: '' },
            existing[4] || { day: '금', startTime: '', endTime: '' },
          ];
        });

        setSubjectSchedules(paddedMap);
      });
    } else {
      setFormData({
        name: '',
        grade: '중1',
        subjects: [],
        parentName: '',
        parentPhone: '',
        status: 'active',
      });
      setSubjectTeachers({});
      setSubjectSchedules({});
    }
  }, [student, teachers]);

  // 포커스 트랩
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC 키로 모달 닫기
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      // Tab 키로 포커스 순환
      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusableArray = Array.from(focusableElements) as HTMLElement[];

        if (focusableArray.length === 0) return;

        const currentFocus = document.activeElement;
        const focusedIndex = focusableArray.indexOf(currentFocus as HTMLElement);

        let nextIndex = focusedIndex + 1;
        if (event.shiftKey) {
          nextIndex = focusedIndex - 1;
        }

        // 순환 처리
        if (nextIndex >= focusableArray.length) {
          nextIndex = 0;
        } else if (nextIndex < 0) {
          nextIndex = focusableArray.length - 1;
        }

        event.preventDefault();
        focusableArray[nextIndex].focus();
      }
    };

    // 모달 첫 포커스 가능 요소로 이동
    if (modalRef.current) {
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }, 0);
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // 모달 닫을 때 이전 포커스 복구
      if (previousActiveElement.current && previousActiveElement.current.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, [onClose]);

  const availableSubjects = ['국어', '영어', '수학', '사회', '과학', '화학', '생물', '기타'];

  const toggleSubject = (sub: string) => {
    setFormData(prev => {
      const isAdding = !prev.subjects.includes(sub);
      const newSubjects = isAdding
        ? [...prev.subjects, sub]
        : prev.subjects.filter(s => s !== sub);

      if (!isAdding) {
        setSubjectTeachers(curr => {
          const next = { ...curr };
          delete next[sub];
          return next;
        });
        setSubjectSchedules(curr => {
          const next = { ...curr };
          delete next[sub];
          return next;
        });
      } else {
        setSubjectSchedules(curr => ({
          ...curr,
          [sub]: [
            { day: '월', startTime: '', endTime: '' },
            { day: '화', startTime: '', endTime: '' },
            { day: '수', startTime: '', endTime: '' },
            { day: '목', startTime: '', endTime: '' },
            { day: '금', startTime: '', endTime: '' },
          ]
        }));
      }

      return { ...prev, subjects: newSubjects };
    });
  };

  const handleTeacherChange = (subject: string, teacherId: string) => {
    setSubjectTeachers(prev => ({ ...prev, [subject]: teacherId }));
  };

  const handleScheduleChange = (subject: string, index: number, field: keyof Schedule, value: string) => {
    setSubjectSchedules(prev => {
      const currentList = prev[subject] || [
        { day: '월', startTime: '', endTime: '' },
        { day: '화', startTime: '', endTime: '' },
        { day: '수', startTime: '', endTime: '' },
        { day: '목', startTime: '', endTime: '' },
        { day: '금', startTime: '', endTime: '' }
      ];

      const newList = [...currentList];
      if (!newList[index]) newList[index] = { day: '월', startTime: '', endTime: '' };

      newList[index] = { ...newList[index], [field]: value };

      return { ...prev, [subject]: newList };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검사
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = '학생 이름은 필수입니다';
    }
    if (formData.subjects.length === 0) {
      newErrors.subjects = '최소 1개 이상의 과목을 선택해야 합니다';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const distinctTeacherIds = Array.from(new Set(Object.values(subjectTeachers).filter(Boolean)));
      const enrollments = Object.entries(subjectSchedules).flatMap(([subject, schedules]) =>
        schedules
          .filter(s => s.startTime && s.endTime)
          .map(s => ({ subject, ...s }))
      );

      await onSubmit({ ...formData, teacherIds: distinctTeacherIds }, enrollments);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .student-modal {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            border-radius: 16px 16px 0 0 !important;
            max-height: 95vh !important;
          }
          .student-modal-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <div
        ref={modalRef}
        className="modal-content student-modal"
        style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{student ? '학생 정보 수정' : '새 학생 추가'}</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label="모달 닫기">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          <form id="student-form" onSubmit={handleSubmit}>
            <section style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '16px', fontWeight: 600 }}>기본 정보</h3>
              <div className="form-group">
                <label className="form-label">학생 이름 *</label>
                <input
                  className="form-input"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="학생 이름을 입력하세요"
                  style={{ borderColor: errors.name ? 'var(--error, #e74c3c)' : undefined }}
                />
                {errors.name && (
                  <span style={{ fontSize: '12px', color: 'var(--error, #e74c3c)', marginTop: '4px', display: 'block' }}>
                    {errors.name}
                  </span>
                )}
              </div>
              <div className="student-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">학년 *</label>
                  <select
                    className="form-select"
                    value={formData.grade}
                    onChange={e => setFormData({ ...formData, grade: e.target.value })}
                  >
                    {['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '검정고시'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">상태</label>
                  <div style={{ display: 'flex', gap: '12px', height: '42px', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                      <input
                        type="radio"
                        name="status"
                        checked={formData.status === 'active'}
                        onChange={() => setFormData({ ...formData, status: 'active' })}
                      />
                      <span style={{ color: formData.status === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>활성</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                      <input
                        type="radio"
                        name="status"
                        checked={formData.status === 'inactive'}
                        onChange={() => setFormData({ ...formData, status: 'inactive' })}
                      />
                      <span style={{ color: formData.status === 'inactive' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>비활성</span>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '16px', fontWeight: 600 }}>수강 과목 및 일정</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {availableSubjects.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => toggleSubject(sub)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: '1px solid',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      background: formData.subjects.includes(sub) ? 'var(--primary-light)' : 'var(--surface)',
                      borderColor: formData.subjects.includes(sub) ? 'var(--primary)' : 'var(--border)',
                      color: formData.subjects.includes(sub) ? 'var(--primary)' : 'var(--text-secondary)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {sub}
                  </button>
                ))}
              </div>
              {errors.subjects && (
                <span style={{ fontSize: '12px', color: 'var(--error, #e74c3c)', marginBottom: '12px', display: 'block' }}>
                  {errors.subjects}
                </span>
              )}

              {formData.subjects.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {formData.subjects.map(sub => {
                    const subTeachers = teachers.filter(t => t.subjects.includes(sub));
                    const schedules = subjectSchedules[sub] || [
                      { day: '월', startTime: '', endTime: '' },
                      { day: '화', startTime: '', endTime: '' },
                      { day: '수', startTime: '', endTime: '' },
                      { day: '목', startTime: '', endTime: '' },
                      { day: '금', startTime: '', endTime: '' }
                    ];

                    return (
                      <div key={sub} style={{ background: 'var(--background)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="subject-badge" style={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '13px' }}>{sub}</span>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>담당 선생님</span>
                          </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                          <select
                            className="form-select"
                            value={subjectTeachers[sub] || ''}
                            onChange={e => handleTeacherChange(sub, e.target.value)}
                            style={{ padding: '8px 12px', fontSize: '13px', background: 'var(--surface)' }}
                          >
                            <option value="">선생님 미지정</option>
                            {subTeachers.map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.subjects.join(', ')})</option>
                            ))}
                            {subTeachers.length === 0 && <option disabled>해당 과목 선생님 없음</option>}
                          </select>
                        </div>

                        <div>
                          <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>수강 시간표 (5개)</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[0, 1, 2, 3, 4].map(idx => (
                              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 20px 1fr', gap: '8px', alignItems: 'center' }}>
                                <select
                                  className="form-select"
                                  style={{ padding: '6px', fontSize: '12px', height: '32px' }}
                                  value={schedules[idx]?.day || '월'}
                                  onChange={e => handleScheduleChange(sub, idx, 'day', e.target.value)}
                                >
                                  {['월', '화', '수', '목', '금', '토', '일'].map(d => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                                <input
                                  type="time"
                                  className="form-input"
                                  style={{ padding: '4px 8px', fontSize: '12px', height: '32px' }}
                                  value={schedules[idx]?.startTime || ''}
                                  onChange={e => handleScheduleChange(sub, idx, 'startTime', e.target.value)}
                                />
                                <span style={{ textAlign: 'center', color: 'var(--text-muted)' }}>~</span>
                                <input
                                  type="time"
                                  className="form-input"
                                  style={{ padding: '4px 8px', fontSize: '12px', height: '32px' }}
                                  value={schedules[idx]?.endTime || ''}
                                  onChange={e => handleScheduleChange(sub, idx, 'endTime', e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h3 style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '16px', fontWeight: 600 }}>학부모 정보</h3>
              <div className="student-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">성함</label>
                  <input
                    className="form-input"
                    value={formData.parentName}
                    onChange={e => setFormData({ ...formData, parentName: e.target.value })}
                    placeholder="학부모 성함"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">연락처</label>
                  <input
                    className="form-input"
                    value={formData.parentPhone}
                    onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>
            </section>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>취소</button>
          <button type="submit" form="student-form" className="btn btn-primary" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.6 : 1 }}>
            <span className="material-symbols-outlined">{isSubmitting ? 'hourglass_empty' : 'save'}</span>
            {isSubmitting ? '저장 중...' : (student ? '수정 완료' : '학생 등록')}
          </button>
        </div>
      </div>
    </div>
  );
}
