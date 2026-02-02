import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { createStudent, updateStudent, deleteStudent, fetchStudents } from '../services/notion';
import type { Student } from '../types';

const GRADES = ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const SUBJECTS = ['수학', '영어', '국어', '과학', '사회'];

export default function StudentManagePage() {
  const navigate = useNavigate();
  const { currentUser, students, setStudents } = useReportStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 폼 상태
  const [formName, setFormName] = useState('');
  const [formGrade, setFormGrade] = useState('중1');
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [formParentName, setFormParentName] = useState('');
  const [formExamDate, setFormExamDate] = useState('');

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const data = await fetchStudents();
      setStudents(data);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser?.teacher.isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>관리자만 접근할 수 있습니다.</p>
          <button
            onClick={() => navigate(-1)}
            style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const filteredStudents = students.filter(s =>
    s.name.includes(searchTerm) ||
    s.grade.includes(searchTerm) ||
    s.subjects.some(sub => sub.includes(searchTerm))
  );

  const openAddModal = () => {
    setEditingStudent(null);
    setFormName('');
    setFormGrade('중1');
    setFormSubjects([]);
    setFormParentName('');
    setFormExamDate('');
    setIsModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormName(student.name);
    setFormGrade(student.grade);
    setFormSubjects([...student.subjects]);
    setFormParentName(student.parentName || '');
    setFormExamDate(student.examDate || '');
    setIsModalOpen(true);
  };

  const handleSubjectToggle = (subject: string) => {
    setFormSubjects(prev =>
      prev.includes(subject)
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  const handleSave = async () => {
    if (!formName.trim() || formSubjects.length === 0) {
      alert('이름과 수강과목을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      if (editingStudent) {
        // 수정
        const success = await updateStudent(editingStudent.id, {
          name: formName,
          grade: formGrade,
          subjects: formSubjects,
          parentName: formParentName || undefined,
          examDate: formExamDate || undefined,
        });

        if (success) {
          setStudents(students.map(s =>
            s.id === editingStudent.id
              ? { ...s, name: formName, grade: formGrade, subjects: formSubjects, parentName: formParentName || undefined, examDate: formExamDate || undefined }
              : s
          ));
        }
      } else {
        // 추가
        const newStudent = await createStudent({
          name: formName,
          grade: formGrade,
          subjects: formSubjects,
          parentName: formParentName || undefined,
          examDate: formExamDate || undefined,
          status: 'active',
        });

        if (newStudent) {
          setStudents([...students, newStudent]);
        }
      }
      setIsModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (studentId: string) => {
    setIsLoading(true);
    try {
      const success = await deleteStudent(studentId);
      if (success) {
        setStudents(students.filter(s => s.id !== studentId));
      }
      setDeleteConfirm(null);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* 헤더 */}
      <header style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>학생 관리</h1>
          <button
            onClick={() => navigate('/admin')}
            style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            돌아가기
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* 상단 액션 바 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="text"
              placeholder="이름, 학년, 과목으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, width: '280px' }}
            />
            <span style={{ color: '#6b7280', fontSize: '14px' }}>
              총 {filteredStudents.length}명
            </span>
          </div>
          <button
            onClick={openAddModal}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            + 학생 추가
          </button>
        </div>

        {/* 학생 목록 테이블 */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>이름</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>학년</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>수강과목</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>학부모</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>시험일</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && students.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    로딩 중...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => (
                  <tr key={student.id} style={{ borderBottom: idx < filteredStudents.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '500', color: '#1f2937' }}>
                      {student.name}
                      {student.status === 'inactive' && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px' }}>
                          비활성
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#6b7280' }}>{student.grade}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {student.subjects.map(sub => (
                          <span
                            key={sub}
                            style={{
                              padding: '2px 8px',
                              backgroundColor: '#e0e7ff',
                              color: '#4338ca',
                              borderRadius: '4px',
                              fontSize: '12px',
                            }}
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#6b7280' }}>{student.parentName || '-'}</td>
                    <td style={{ padding: '14px 16px', color: '#6b7280' }}>
                      {student.examDate || '-'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={() => openEditModal(student)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                          }}
                        >
                          수정
                        </button>
                        {deleteConfirm === student.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(student.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#dc2626',
                                color: '#ffffff',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                              }}
                            >
                              확인
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#f3f4f6',
                                color: '#374151',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                              }}
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(student.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#fee2e2',
                              color: '#dc2626',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '13px',
                            }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* 학생 추가/수정 모달 */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '480px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#1f2937' }}>
              {editingStudent ? '학생 정보 수정' : '새 학생 추가'}
            </h2>

            {/* 이름 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                이름 <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="학생 이름"
                style={inputStyle}
              />
            </div>

            {/* 학년 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                학년 <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={formGrade}
                onChange={(e) => setFormGrade(e.target.value)}
                style={inputStyle}
              >
                {GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* 수강과목 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                수강과목 <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {SUBJECTS.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleSubjectToggle(sub)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: formSubjects.includes(sub) ? '2px solid #2563eb' : '1px solid #d1d5db',
                      backgroundColor: formSubjects.includes(sub) ? '#eff6ff' : '#ffffff',
                      color: formSubjects.includes(sub) ? '#2563eb' : '#6b7280',
                      cursor: 'pointer',
                      fontWeight: formSubjects.includes(sub) ? '500' : '400',
                    }}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* 학부모 이름 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                학부모 이름
              </label>
              <input
                type="text"
                value={formParentName}
                onChange={(e) => setFormParentName(e.target.value)}
                placeholder="학부모 이름 (선택)"
                style={inputStyle}
              />
            </div>

            {/* 시험 예정일 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                시험 예정일
              </label>
              <input
                type="date"
                value={formExamDate}
                onChange={(e) => setFormExamDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                {isLoading ? '저장 중...' : editingStudent ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
