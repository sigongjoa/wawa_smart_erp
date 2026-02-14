
import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';
import { useReportStore } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useSearch } from '../../hooks/useSearch';
import { createStudent, updateStudent, deleteStudent, fetchEnrollmentsByStudent, updateStudentEnrollments } from '../../services/notion';
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
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    useEffect(() => {
        // Ensure teachers are loaded for the modal
        if (teachers.length === 0) {
            import('../../services/notion').then(mod => {
                mod.fetchTeachers().then(setTeachers);
            });
        }
    }, [teachers.length, setTeachers]);

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
    // Base filtering for non-search criteria
    const baseFilteredStudents = useMemo(() => {
        return students.filter(student => {
            if (filters.grade !== '전체' && student.grade !== filters.grade) return false;
            if (filters.status !== '전체' && (filters.status === '활성' ? student.status !== 'active' : student.status === 'active')) return false;
            if (filters.subject !== '전체') {
                const hasSubject = student.subjects.includes(filters.subject) || student.subject === filters.subject;
                if (!hasSubject) return false;
            }
            return true;
        });
    }, [students, filters]);

    // Apply unified search with Chosung support
    const { searchTerm, setSearchTerm, filteredItems: filteredStudents } = useSearch(baseFilteredStudents, 'name');

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

    const handleSave = async (data: any, enrollments: any[]) => {
        let result;
        let finalStudentId = editingStudent?.id;

        if (editingStudent) {
            result = await updateStudent(editingStudent.id, data);
        } else {
            result = await createStudent(data);
            if (result.success && result.data) {
                finalStudentId = result.data.id;
            }
        }

        if (result.success) {
            // Save Enrollments
            if (finalStudentId) {
                const enrollResult = await updateStudentEnrollments(finalStudentId, enrollments);
                if (!enrollResult.success) {
                    addToast('학생 정보는 저장되었으나, 수강 일정 저장에 실패했습니다.', 'warning');
                } else {
                    addToast(editingStudent ? '학생 정보가 수정되었습니다.' : '새 학생이 등록되었습니다.', 'success');
                }
            }

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
                        placeholder="이름 검색 (초성 검색 가능)"
                        className="search-input"
                        style={{ width: '100%', paddingLeft: '36px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
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
                    onClick={() => {
                        setFilters({ grade: '전체', status: '전체', subject: '전체' });
                        setSearchTerm('');
                    }}
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

function StudentModal({ student, teachers, onClose, onSubmit }: { student: Student | null; teachers: Teacher[]; onClose: () => void; onSubmit: (data: any, enrollments: any[]) => void }) {
    const [formData, setFormData] = useState({
        name: '',
        grade: '중1',
        subjects: [] as string[],
        parentName: '',
        parentPhone: '',
        status: 'active' as 'active' | 'inactive',
    });

    const [subjectTeachers, setSubjectTeachers] = useState<Record<string, string>>({});

    // Enrollments State: Subject -> Array of { day, startTime, endTime }
    type Schedule = { day: string; startTime: string; endTime: string };
    const [subjectSchedules, setSubjectSchedules] = useState<Record<string, Schedule[]>>({});

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

            // Fetch Enrollments
            fetchEnrollmentsByStudent(student.id).then(enrollments => {
                const scheduleMap: Record<string, Schedule[]> = {};
                enrollments.forEach(en => {
                    if (!scheduleMap[en.subject]) {
                        scheduleMap[en.subject] = [];
                        // Initial Fill with 3 empty slots is NOT done here, we just fill with actual data
                        // and then padding will happen in render or setter helpers?
                        // Let's just push actual data.
                    }
                    scheduleMap[en.subject].push({
                        day: en.day,
                        startTime: en.startTime,
                        endTime: en.endTime,
                    });
                });

                // Pad to 3 slots for UI consistency if needed, or just let dynamic adding handle it?
                // Request said "3 time slots", implying fixed 3 slots or at least up to 3.
                // Let's standardise to always having 3 slots in the state for easier UI mapping.

                const paddedMap: Record<string, Schedule[]> = {};
                // Only for current subjects
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
            setSubjectSchedules({});
        }
    }, [student, teachers]);

    const availableSubjects = ['국어', '영어', '수학', '사회', '과학', '기타'];

    const toggleSubject = (sub: string) => {
        setFormData(prev => {
            const isAdding = !prev.subjects.includes(sub);
            const newSubjects = isAdding
                ? [...prev.subjects, sub]
                : prev.subjects.filter(s => s !== sub);

            // If removing subject, also remove from map
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
                // Initialize empty schedule for new subject
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Collect distinct teacher IDs
        const distinctTeacherIds = Array.from(new Set(Object.values(subjectTeachers).filter(Boolean)));

        // Flatten enrollments
        const enrollments = Object.entries(subjectSchedules).flatMap(([subject, schedules]) =>
            schedules
                .filter(s => s.startTime && s.endTime) // Only valid schedules
                .map(s => ({ subject, ...s }))
        );

        onSubmit({ ...formData, teacherIds: distinctTeacherIds }, enrollments);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
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
                            <h3 style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '16px', fontWeight: 600 }}>수강 과목 및 일정</h3>
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

                            {/* Teacher & Schedule Selection */}
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

                                                {/* Teacher Select */}
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

                                                {/* Schedule Table */}
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

