import { useState, useEffect } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useAsync } from '../../hooks/useAsync';
import { saveScore } from '../../services/notion';

export default function Input() {
  const { students, reports } = useFilteredData();
  const { teachers, currentYearMonth, currentUser, fetchAllData } = useReportStore();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [formData, setFormData] = useState<any>({});

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const currentReport = reports.find(r => r.studentId === selectedStudentId);

  useEffect(() => {
    if (selectedStudentId && currentReport) {
      const initialForm: any = {};
      selectedStudent?.subjects.forEach(sub => {
        const existingScore = currentReport.scores.find(s => s.subject === sub);
        initialForm[sub] = {
          score: existingScore?.score || 0,
          comment: existingScore?.comment || '',
        };
      });
      // Initialize Total Comment
      initialForm['__TOTAL_COMMENT__'] = {
        score: 0,
        comment: currentReport.totalComment || '',
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">성적 입력 ({currentYearMonth})</h1>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <input className="search-input" style={{ width: '100%' }} placeholder="학생 검색..." />
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {students.map(s => (
              <div
                key={s.id}
                onClick={() => setSelectedStudentId(s.id)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: selectedStudentId === s.id ? 'var(--primary-light)' : 'transparent',
                  borderBottom: '1px solid var(--border-light)'
                }}
              >
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.grade}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {selectedStudent ? (
            <div>
              <h2 style={{ marginBottom: '20px' }}>{selectedStudent.name} 학생 성적 입력</h2>
              {selectedStudent.subjects.map(sub => (
                <div key={sub} className="card" style={{ padding: '16px', marginBottom: '16px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '12px' }}>{sub}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                    <label>점수</label>
                    <input
                      type="number"
                      className="search-input"
                      style={{ width: '100px' }}
                      value={formData[sub]?.score ?? ''}
                      onChange={e => setFormData({ ...formData, [sub]: { ...formData[sub], score: parseInt(e.target.value) } })}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '12px' }}>
                    <label>코멘트</label>
                    <textarea
                      className="search-input"
                      style={{ width: '100%', height: '60px', padding: '10px' }}
                      value={formData[sub]?.comment ?? ''}
                      onChange={e => setFormData({ ...formData, [sub]: { ...formData[sub], comment: e.target.value } })}
                    />
                  </div>
                  <div style={{ textAlign: 'right', marginTop: '12px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleSave(sub)}
                      disabled={saveAsync.isLoading}
                    >
                      {saveAsync.isLoading ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ))}

              {/* Comprehensive Evaluation */}
              <div className="card" style={{ padding: '16px', marginBottom: '16px', border: '1px solid var(--border-light)', background: '#fffbeb' }}>
                <div style={{ fontWeight: 700, marginBottom: '12px', color: '#b45309' }}>종합 평가</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  <textarea
                    className="search-input"
                    style={{ width: '100%', height: '100px', padding: '10px' }}
                    placeholder="학생의 전반적인 학습 태도와 향후 계획을 입력해주세요."
                    value={formData['__TOTAL_COMMENT__']?.comment ?? ''}
                    onChange={e => setFormData({ ...formData, '__TOTAL_COMMENT__': { ...formData['__TOTAL_COMMENT__'], comment: e.target.value, score: 0 } })}
                  />
                </div>
                <div style={{ textAlign: 'right', marginTop: '12px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSave('__TOTAL_COMMENT__')}
                    disabled={saveAsync.isLoading}
                  >
                    {saveAsync.isLoading ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">학생을 선택해주세요.</div>
          )}
        </div>
      </div>
    </div>
  );
}
