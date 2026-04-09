import { useState, useEffect } from 'react';
import { useReportStore } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import apiClient from '../../services/api';
import type { Student } from '../../types';

type SettingsTab = 'students' | 'exams' | 'basic';

export default function GlobalSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('students');
  const { appSettings, setAppSettings } = useReportStore();
  const { addToast } = useToastStore();

  // 학생 관리
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    name: '',
    grade: '중1',
    status: 'active' as 'active' | 'inactive',
  });

  // 시험 월 설정
  const [activeExamMonth, setActiveExamMonth] = useState(appSettings.activeExamMonth);

  // 기본 설정
  const [basicForm, setBasicForm] = useState({
    academyName: appSettings.academyName || '',
  });

  // 시험 월 설정 로드 (탭 전환 시마다)
  useEffect(() => {
    if (activeTab === 'exams') {
      const loadExamMonth = async () => {
        try {
          const response = await apiClient.get('/api/settings/active-exam-month');
          if (response) {
            setActiveExamMonth(response.activeExamMonth);
            setAppSettings({ ...appSettings, activeExamMonth: response.activeExamMonth });
          }
        } catch (error) {
          console.log('시험 월 조회 실패 (아직 설정되지 않음)', error);
        }
      };

      loadExamMonth();
    }
  }, [activeTab]);

  // 학생 목록 로드
  useEffect(() => {
    if (activeTab === 'students') {
      loadStudents();
    }
  }, [activeTab]);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getStudents();
      setStudents(data || []);
    } catch (error) {
      console.error('Failed to load students:', error);
      addToast('학생 목록 로드 실패', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStudent = () => {
    setEditingStudent(null);
    setStudentForm({ name: '', grade: '중1', status: 'active' });
    setShowStudentForm(true);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name,
      grade: student.grade,
      status: student.status as 'active' | 'inactive',
    });
    setShowStudentForm(true);
  };

  const handleSaveStudent = async () => {
    if (!studentForm.name.trim()) {
      addToast('학생 이름을 입력해주세요', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      if (editingStudent) {
        await apiClient.updateStudent(editingStudent.id, {
          name: studentForm.name,
          grade: studentForm.grade,
          status: studentForm.status,
        });
        addToast('학생 정보가 수정되었습니다', 'success');
      } else {
        await apiClient.createStudent({
          name: studentForm.name,
          grade: studentForm.grade,
          status: studentForm.status,
        });
        addToast('학생이 추가되었습니다', 'success');
      }
      setShowStudentForm(false);
      await loadStudents();
    } catch (error) {
      console.error('Failed to save student:', error);
      addToast('학생 저장 실패', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    setIsLoading(true);
    try {
      await apiClient.deleteStudent(id);
      addToast('학생이 삭제되었습니다', 'success');
      await loadStudents();
    } catch (error) {
      console.error('Failed to delete student:', error);
      addToast('학생 삭제 실패', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveExamMonth = async () => {
    setIsLoading(true);
    try {
      // API에 저장
      await apiClient.post('/api/settings/active-exam-month', {
        activeExamMonth
      });

      // Zustand 상태 업데이트 (localStorage)
      setAppSettings({ ...appSettings, activeExamMonth });

      // 저장 직후 최신값 재조회 (다른 선생님의 변경사항 반영)
      const response = await apiClient.get('/api/settings/active-exam-month');
      if (response) {
        setActiveExamMonth(response.activeExamMonth);
      }

      addToast('시험 월이 저장되었습니다', 'success');
    } catch (error) {
      console.error('Failed to save exam month:', error);
      addToast('시험 월 저장 실패', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBasic = () => {
    setAppSettings({ ...appSettings, academyName: basicForm.academyName });
    addToast('기본 설정이 저장되었습니다', 'success');
  };

  const grades = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];

  // 현재 월 기준으로 이전 3개월 ~ 이후 8개월 표시
  const months = Array.from({ length: 12 }, (_, i) => {
    const now = new Date();
    const monthOffset = i - 3; // 현재 월 기준 -3개월부터 +8개월까지
    const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '28px', fontWeight: 800 }}>관리 설정</h1>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        {(['students', 'exams', 'basic'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: activeTab === tab ? 'var(--primary)' : 'transparent',
              color: activeTab === tab ? 'white' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            {tab === 'students' && '학생 관리'}
            {tab === 'exams' && '시험 월 설정'}
            {tab === 'basic' && '기본 설정'}
          </button>
        ))}
      </div>

      {/* 학생 관리 탭 */}
      {activeTab === 'students' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>학생 목록</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                총 {students.length}명
              </p>
            </div>
            <button
              onClick={handleAddStudent}
              disabled={isLoading}
              style={{
                padding: '10px 16px',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              + 학생 추가
            </button>
          </div>

          {/* 학생 폼 */}
          {showStudentForm && (
            <div style={{
              padding: '16px',
              background: 'var(--surface)',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid var(--border)',
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                {editingStudent ? '학생 수정' : '학생 추가'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    학생 이름
                  </label>
                  <input
                    type="text"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    placeholder="예: 강은서"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      학년
                    </label>
                    <select
                      value={studentForm.grade}
                      onChange={(e) => setStudentForm({ ...studentForm, grade: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    >
                      {grades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      상태
                    </label>
                    <select
                      value={studentForm.status}
                      onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value as 'active' | 'inactive' })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="active">활성</option>
                      <option value="inactive">비활성</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleSaveStudent}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    {editingStudent ? '수정' : '추가'}
                  </button>
                  <button
                    onClick={() => setShowStudentForm(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 학생 목록 */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
              로딩 중...
            </div>
          ) : students.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
              등록된 학생이 없습니다
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {students.map((student) => (
                <div
                  key={student.id}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--surface)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                      {student.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {student.grade} · {student.status === 'active' ? '활성' : '비활성'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleEditStudent(student)}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDeleteStudent(student.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#ffebee',
                        color: '#c62828',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 시험 월 설정 탭 */}
      {activeTab === 'exams' && (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            활성 시험 월 설정
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
            선택된 월에만 성적 입력이 가능합니다
          </p>
          <div style={{ maxWidth: '300px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              활성 월
            </label>
            <select
              value={appSettings.activeExamMonth || activeExamMonth}
              onChange={(e) => setActiveExamMonth(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            >
              {months.map((month) => (
                <option key={month} value={month}>
                  {month} ({new Date(`${month}-01`).toLocaleDateString('ko-KR', { month: 'long' })})
                </option>
              ))}
            </select>
            <button
              onClick={handleSaveExamMonth}
              style={{
                width: '100%',
                padding: '10px',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 기본 설정 탭 */}
      {activeTab === 'basic' && (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            기본 설정
          </h2>
          <div style={{ maxWidth: '400px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              학원 이름
            </label>
            <input
              type="text"
              value={basicForm.academyName}
              onChange={(e) => setBasicForm({ ...basicForm, academyName: e.target.value })}
              placeholder="예: 와와 학원"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            />
            <button
              onClick={handleSaveBasic}
              style={{
                width: '100%',
                padding: '10px',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
