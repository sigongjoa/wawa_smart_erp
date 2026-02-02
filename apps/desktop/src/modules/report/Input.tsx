import { useState, useEffect } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useAsync } from '../../hooks/useAsync';
import { saveScore } from '../../services/notion';

// 과목별 색상
const SUBJECT_COLORS: Record<string, string> = {
  '국어': '#FF6B00', '영어': '#3B82F6', '수학': '#10B981',
  '과학': '#8B5CF6', '사회': '#EC4899', '역사': '#F59E0B',
};
const getSubjectColor = (subject: string) => SUBJECT_COLORS[subject] || '#6B7280';

export default function Input() {
  const { students, reports } = useFilteredData();
  const { currentYearMonth, currentUser, fetchAllData, isLoading } = useReportStore();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Record<string, { score: number; comment: string }>>({});

  // 페이지 진입 시 데이터 로드
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const currentReport = reports.find(r => r.studentId === selectedStudentId);

  // 검색 필터링
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.grade.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 학생 선택 시 폼 초기화
  useEffect(() => {
    if (selectedStudentId && selectedStudent) {
      const initialForm: Record<string, { score: number; comment: string }> = {};
      selectedStudent.subjects.forEach(sub => {
        const existingScore = currentReport?.scores.find(s => s.subject === sub);
        initialForm[sub] = {
          score: existingScore?.score ?? 0,
          comment: existingScore?.comment || '',
        };
      });
      initialForm['__TOTAL_COMMENT__'] = {
        score: 0,
        comment: currentReport?.totalComment || '',
      };
      setFormData(initialForm);
    }
  }, [selectedStudentId, currentReport, selectedStudent]);

  const saveAsync = useAsync(saveScore);
  const { addToast } = useToastStore();

  const handleSave = async (subject: string) => {
    if (!selectedStudent) return;

    const teacherId = currentUser?.teacher?.id || '';
    const data = formData[subject];

    if (!data || data.score === undefined || isNaN(data.score)) {
      addToast('올바른 점수를 입력해주세요.', 'warning');
      return;
    }

    const result = await saveAsync.execute(
      selectedStudent.id,
      selectedStudent.name,
      currentYearMonth,
      subject,
      data.score,
      teacherId,
      data.comment
    );

    if (result.success) {
      addToast(`${subject} 점수가 저장되었습니다.`, 'success');
      await fetchAllData();
    } else {
      addToast(result.error?.message || '저장에 실패했습니다.', 'error');
    }
  };

  // 입력 완료 상태 계산
  const getStudentStatus = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const report = reports.find(r => r.studentId === studentId);
    if (!student || !report) return { status: 'none', count: 0, total: student?.subjects.length || 0 };
    const count = report.scores.length;
    const total = student.subjects.length;
    if (count >= total) return { status: 'complete', count, total };
    if (count > 0) return { status: 'partial', count, total };
    return { status: 'none', count, total };
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">성적 입력</h1>
            <p className="page-description">{currentYearMonth} 월말평가 성적을 입력합니다</p>
          </div>
          <button className="btn btn-secondary" onClick={() => fetchAllData()} disabled={isLoading}>
            <span className={`material-symbols-outlined ${isLoading ? 'spin' : ''}`}>refresh</span>
            새로고침
          </button>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
        <div className="card" style={{ padding: '0', overflow: 'hidden', maxHeight: 'calc(100vh - 180px)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-light)', position: 'sticky', top: 0, zIndex: 10 }}>
            <input
              className="search-input"
              style={{ width: '100%' }}
              placeholder="학생 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
            {filteredStudents.map(s => {
              const { status, count, total } = getStudentStatus(s.id);
              const isSelected = selectedStudentId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary-light)' : 'transparent',
                    borderBottom: '1px solid var(--border-light)',
                    borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <span className={`badge ${status === 'complete' ? 'badge-success' : status === 'partial' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                      {status === 'complete' ? '완료' : status === 'partial' ? '진행중' : '미입력'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{s.grade}</span>
                    <span>{count}/{total} 과목</span>
                  </div>
                </div>
              );
            })}
            {filteredStudents.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                검색 결과가 없습니다
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {selectedStudent ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{selectedStudent.name} 학생</h2>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{selectedStudent.grade} · {selectedStudent.subjects.join(', ')}</div>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => window.location.hash = '#/report/preview'}
                  >
                    <span className="material-symbols-outlined">visibility</span>
                    리포트 미리보기
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#f8fafc' }}>
                {selectedStudent.subjects.map(sub => {
                  const existingScore = currentReport?.scores.find(s => s.subject === sub);
                  const isSaved = !!existingScore;
                  return (
                    <div key={sub} style={{
                      padding: '20px',
                      marginBottom: '16px',
                      background: 'white',
                      borderRadius: '12px',
                      border: `1px solid ${isSaved ? '#10B981' : '#e2e8f0'}`,
                      borderLeft: `4px solid ${getSubjectColor(sub)}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            backgroundColor: `${getSubjectColor(sub)}20`,
                            color: getSubjectColor(sub),
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: 600
                          }}>
                            {sub}
                          </span>
                          {isSaved && (
                            <span style={{ color: '#10B981', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                              저장됨
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                        <label style={{ fontWeight: 500, color: '#64748B' }}>점수</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="search-input"
                            style={{ width: '100px', textAlign: 'center', fontWeight: 600, fontSize: '16px' }}
                            value={formData[sub]?.score ?? ''}
                            onChange={e => setFormData({ ...formData, [sub]: { ...formData[sub], score: parseInt(e.target.value) || 0 } })}
                          />
                          <span style={{ color: '#64748B' }}>/ 100점</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px' }}>
                        <label style={{ fontWeight: 500, color: '#64748B', paddingTop: '10px' }}>코멘트</label>
                        <textarea
                          className="search-input"
                          style={{ width: '100%', minHeight: '80px', padding: '12px', resize: 'vertical' }}
                          placeholder="학생에 대한 코멘트를 입력하세요..."
                          value={formData[sub]?.comment ?? ''}
                          onChange={e => setFormData({ ...formData, [sub]: { ...formData[sub], comment: e.target.value } })}
                        />
                      </div>
                      <div style={{ textAlign: 'right', marginTop: '16px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSave(sub)}
                          disabled={saveAsync.isLoading}
                          style={{ minWidth: '100px' }}
                        >
                          {saveAsync.isLoading ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 종합 평가 */}
                <div style={{
                  padding: '20px',
                  background: '#FFF7ED',
                  borderRadius: '12px',
                  border: '1px solid #FDBA74'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ color: '#FF6B00', fontSize: '20px' }}>📝</span>
                    <span style={{ fontWeight: 700, color: '#9A3412' }}>종합 평가</span>
                  </div>
                  <textarea
                    className="search-input"
                    style={{ width: '100%', minHeight: '120px', padding: '12px', resize: 'vertical', background: 'white' }}
                    placeholder="학생의 전반적인 학습 태도와 향후 계획을 입력해주세요..."
                    value={formData['__TOTAL_COMMENT__']?.comment ?? ''}
                    onChange={e => setFormData({ ...formData, '__TOTAL_COMMENT__': { score: 0, comment: e.target.value } })}
                  />
                  <div style={{ textAlign: 'right', marginTop: '16px' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSave('__TOTAL_COMMENT__')}
                      disabled={saveAsync.isLoading}
                      style={{ minWidth: '100px' }}
                    >
                      {saveAsync.isLoading ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ margin: 'auto', padding: '60px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#cbd5e1', marginBottom: '16px' }}>person_search</span>
              <div className="empty-state-title">학생을 선택해주세요</div>
              <p style={{ color: 'var(--text-muted)' }}>왼쪽 목록에서 성적을 입력할 학생을 선택하세요</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
