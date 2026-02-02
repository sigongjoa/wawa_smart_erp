import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';
import { useReportStore } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { createStudent, updateStudent, deleteStudent } from '../../services/notion';
import type { Student, GradeType, Teacher } from '../../types';

export default function StudentList() {
    const { students, fetchStudents } = useAppStore();
    const { teachers, setTeachers } = useReportStore();
    const { addToast } = useToastStore();
    const location = useLocation();

    const [filters, setFilters] = useState({
        grade: '전체',
        status: '전체',
        subject: '전체',
        search: '',
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    useEffect(() => {
        fetchStudents();
        // Ensure teachers are loaded for the modal
        if (teachers.length === 0) {
            import('../../services/notion').then(mod => {
                mod.fetchTeachers().then(setTeachers);
            });
        }
    }, [fetchStudents, teachers.length, setTeachers]);

    // Parse query params
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const statusParam = params.get('status');
        if (statusParam === 'inactive') {
            setFilters(prev => ({ ...prev, status: '비활성' }));
        } else if (statusParam === 'active') {
            setFilters(prev => ({ ...prev, status: '활성' }));
        }
    }, [location.search]);

    // Derived state for filtering
    const filteredStudents = useMemo(() => {
        return students.filter(student => {
            if (filters.grade !== '전체' && student.grade !== filters.grade) return false;
            if (filters.status !== '전체' && (filters.status === '활성' ? student.status !== 'active' : student.status === 'active')) return false;
            // Subject filter is tricky because a student has multiple subjects.
            // If student.subjects includes the filter, or student.subject (string) equals it.
            if (filters.subject !== '전체') {
                const hasSubject = student.subjects.includes(filters.subject) || student.subject === filters.subject;
                if (!hasSubject) return false;
            }
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                return student.name.toLowerCase().includes(searchLower) ||
                    (student.parentName || '').toLowerCase().includes(searchLower);
            }
            return true;
        });
    }, [students, filters]);

    const stats = {
        total: students.length,
        active: students.filter(s => s.status === 'active').length,
        inactive: students.filter(s => s.status !== 'active').length,
    };

    const handleDelete = async (id: string) => {
        if (confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            const result = await deleteStudent(id);
            if (result.success) {
                addToast('학생이 삭제되었습니다.', 'success');
                fetchStudents();
            } else {
                addToast('삭제 실패: ' + result.error?.message, 'error');
            }
        }
    };

    const handleSave = async (data: any) => {
        let result;
        if (editingStudent) {
            result = await updateStudent(editingStudent.id, data);
        } else {
            result = await createStudent(data);
        }

        if (result.success) {
            addToast(editingStudent ? '학생 정보가 수정되었습니다.' : '새 학생이 등록되었습니다.', 'success');
            fetchStudents();
            setIsModalOpen(false);
            setEditingStudent(null);
        } else {
            addToast('저장 실패: ' + result.error?.message, 'error');
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">학생 관리</h1>
                        <p className="page-description">학생 정보를 관리하고 수강 일정을 확인합니다</p>
                    </div>
                    <div className="page-actions">
                        <button className="btn btn-primary" onClick={() => { setEditingStudent(null); setIsModalOpen(true); }}>
                            <span className="material-symbols-outlined">add</span>
                            학생 추가
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div className="search-box" style={{ flex: 1, maxWidth: '300px', position: 'relative' }}>
                    <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '20px' }}>search</span>
                    <input
                        type="text"
                        placeholder="이름, 학부모 이름 검색..."
                        className="search-input"
                        style={{ width: '100%', paddingLeft: '36px' }}
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    />
                </div>

                <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 8px' }}></div>

                <select
                    className="search-input"
                    value={filters.grade}
                    onChange={(e) => setFilters(prev => ({ ...prev, grade: e.target.value }))}
                    style={{ width: '120px' }}
                >
                    <option value="전체">모든 학년</option>
                    <option value="초1">초1</option><option value="초2">초2</option><option value="초3">초3</option>
                    <option value="초4">초4</option><option value="초5">초5</option><option value="초6">초6</option>
                    <option value="중1">중1</option><option value="중2">중2</option><option value="중3">중3</option>
                    <option value="고1">고1</option><option value="고2">고2</option><option value="고3">고3</option>
                    <option value="검정고시">검정고시</option>
                </select>

                <select
                    className="search-input"
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    style={{ width: '120px' }}
                >
                    <option value="전체">모든 상태</option>
                    <option value="활성">활성</option>
                    <option value="비활성">비활성</option>
                </select>

                <select
                    className="search-input"
                    value={filters.subject}
                    onChange={(e) => setFilters(prev => ({ ...prev, subject: e.target.value }))}
                    style={{ width: '120px' }}
                >
                    <option value="전체">모든 과목</option>
                    <option value="국어">국어</option>
                    <option value="영어">영어</option>
                    <option value="수학">수학</option>
                    <option value="과학">과학</option>
                    <option value="사회">사회</option>
                </select>

                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setFilters({ grade: '전체', status: '전체', subject: '전체', search: '' })}
                    style={{ marginLeft: 'auto' }}
                >
                    초기화
                </button>
            </div>

            {/* Stats Table Header */}
            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: '80px' }}>학년</th>
                            <th style={{ width: '120px' }}>이름</th>
                            <th>수강과목</th>
                            <th style={{ width: '120px' }}>학부모</th>
                            <th style={{ width: '140px' }}>연락처</th>
                            <th style={{ width: '80px', textAlign: 'center' }}>상태</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>액션</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStudents.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    데이터가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            filteredStudents.map(student => (
                                <tr key={student.id}>
                                    <td><span className={`grade-badge ${student.grade || 'etc'}`}>{student.grade}</span></td>
                                    <td style={{ fontWeight: 600 }}>{student.name}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {student.subjects && student.subjects.length > 0 ? (
                                                student.subjects.map(sub => <span key={sub} className="subject-badge">{sub}</span>)
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>{student.parentName || '-'}</td>
                                    <td>{student.parentPhone || '-'}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {student.status === 'active' ? (
                                            <span style={{ color: 'var(--success)', fontSize: '12px', fontWeight: 600 }}>● 활성</span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>○ 비활성</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                            <button className="btn-icon" onClick={() => { setEditingStudent(student); setIsModalOpen(true); }} title="수정">
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                                            </button>
                                            <button className="btn-icon" onClick={() => handleDelete(student.id)} title="삭제">
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--danger)' }}>delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Stats */}
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <span>총 <strong>{stats.total}</strong>명</span>
                    <span>활성 <strong>{stats.active}</strong>명</span>
                    <span>비활성 <strong>{stats.inactive}</strong>명</span>
                </div>
                {/* Pagination could go here */}
            </div>

            {isModalOpen && (
                <StudentModal
                    student={editingStudent}
                    teachers={teachers}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleSave}
                />
            )}
        </div>
    );
}

function StudentModal({ student, teachers, onClose, onSubmit }: { student: Student | null; teachers: Teacher[]; onClose: () => void; onSubmit: (data: any) => void }) {
    const [formData, setFormData] = useState({
        name: '',
        grade: '중1',
        subjects: [] as string[],
        parentName: '',
        parentPhone: '',
        status: 'active' as 'active' | 'inactive',
    });

    const [subjectTeachers, setSubjectTeachers] = useState<Record<string, string>>({});

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

            // Initialize subject teachers
            const mapping: Record<string, string> = {};
            if (student.teacherIds && student.teacherIds.length > 0) {
                student.subjects.forEach(sub => {
                    // Find a teacher who teaches this subject AND matches one of the student's teacherIds
                    const matchedTeacher = teachers.find(t =>
                        student.teacherIds?.includes(t.id) && t.subjects.includes(sub)
                    );
                    if (matchedTeacher) {
                        mapping[sub] = matchedTeacher.id;
                    }
                });
            }
            setSubjectTeachers(mapping);
        } else {
            // Reset when adding new student
            setFormData({
                name: '',
                grade: '중1',
                subjects: [],
                parentName: '',
                parentPhone: '',
                status: 'active',
            });
            setSubjectTeachers({});
        }
    }, [student, teachers]);

    const availableSubjects = ['국어', '영어', '수학', '사회', '과학', '기타'];

    const toggleSubject = (sub: string) => {
        setFormData(prev => {
            const newSubjects = prev.subjects.includes(sub)
                ? prev.subjects.filter(s => s !== sub)
                : [...prev.subjects, sub];

            // If removing subject, also remove from map
            if (prev.subjects.includes(sub)) {
                setSubjectTeachers(curr => {
                    const next = { ...curr };
                    delete next[sub];
                    return next;
                });
            }

            return { ...prev, subjects: newSubjects };
        });
    };

    const handleTeacherChange = (subject: string, teacherId: string) => {
        setSubjectTeachers(prev => ({ ...prev, [subject]: teacherId }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Collect distinct teacher IDs
        const distinctTeacherIds = Array.from(new Set(Object.values(subjectTeachers).filter(Boolean)));
        onSubmit({ ...formData, teacherIds: distinctTeacherIds });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2 className="modal-title">{student ? '학생 정보 수정' : '새 학생 추가'}</h2>
                    <button onClick={onClose} className="modal-close-btn">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="modal-body">
                    <form id="student-form" onSubmit={handleSubmit}>
                        {/* Basic Info */}
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
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

                        {/* Subjects */}
                        <section style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '16px', fontWeight: 600 }}>수강 과목</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                                {availableSubjects.map(sub => (
                                    <button
                                        key={sub}
                                        type="button"
                                        onClick={() => toggleSubject(sub)}
                                        style={{
                                            padding: '8px 16px', borderRadius: '20px', border: '1px solid',
                                            fontSize: '13px', cursor: 'pointer', fontWeight: 500,
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

                            {/* Teacher Selection */}
                            {formData.subjects.length > 0 && (
                                <div style={{ background: 'var(--background)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                                    <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>담당 선생님 배정</h4>
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {formData.subjects.map(sub => {
                                            const subTeachers = teachers.filter(t => t.subjects.includes(sub));
                                            return (
                                                <div key={sub} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', gap: '12px' }}>
                                                    <span className="subject-badge" style={{ justifyContent: 'center', background: 'var(--surface)', border: '1px solid var(--border)' }}>{sub}</span>
                                                    <select
                                                        className="form-select"
                                                        value={subjectTeachers[sub] || ''}
                                                        onChange={e => handleTeacherChange(sub, e.target.value)}
                                                        style={{ padding: '8px 12px', fontSize: '13px' }}
                                                    >
                                                        <option value="">선생님 미지정</option>
                                                        {subTeachers.map(t => (
                                                            <option key={t.id} value={t.id}>{t.name} ({t.subjects.join(', ')})</option>
                                                        ))}
                                                        {subTeachers.length === 0 && <option disabled>해당 과목 선생님 없음</option>}
                                                    </select>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Parents */}
                        <section>
                            <h3 style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '16px', fontWeight: 600 }}>학부모 정보</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                    <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
                    <button type="submit" form="student-form" className="btn btn-primary">
                        <span className="material-symbols-outlined">save</span>
                        {student ? '수정 완료' : '학생 등록'}
                    </button>
                </div>
            </div>
        </div>
    );
}
