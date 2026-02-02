import { useState, useRef, useEffect } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useAsync } from '../../hooks/useAsync';
import { saveScore } from '../../services/notion';

export default function Single() {
  const { students, exams } = useFilteredData();
  const { currentYearMonth, currentUser, fetchAllData } = useReportStore();
  const { addToast } = useToastStore();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [gradingResult, setGradingResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveAsync = useAsync(saveScore);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const studentExams = exams.filter(e => e.yearMonth === currentYearMonth && selectedStudent?.subjects.includes(e.subject));
  const selectedExam = studentExams.find(e => e.subject === selectedSubject);

  useEffect(() => {
    if (selectedStudent && selectedStudent.subjects.length > 0) {
      setSelectedSubject(selectedStudent.subjects[0]);
    } else {
      setSelectedSubject('');
    }
    setGradingResult(null);
  }, [selectedStudentId]);

  const handleUploadClick = () => {
    if (!selectedStudentId) {
      addToast('학생을 먼저 선택해주세요.', 'warning');
      return;
    }
    if (!selectedSubject) {
      addToast('과목을 선택해주세요.', 'warning');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    addToast('OMR 카드를 분석 중입니다...', 'info');

    // Mock OMR Processing
    setTimeout(() => {
      setIsUploading(false);
      const mockResult = {
        score: Math.floor(Math.random() * 20) + 80,
        wrongAnswers: [3, 7, 12, 18].slice(0, 1 + Math.floor(Math.random() * 3)),
        omrUrl: URL.createObjectURL(file),
        examSubject: selectedSubject,
        examDifficulty: selectedExam?.difficulty || 'C'
      };
      setGradingResult(mockResult);
      addToast('채점이 완료되었습니다.', 'success');
    }, 2000);
  };

  const handleSaveResult = async () => {
    if (!selectedStudent || !gradingResult) return;

    const teacherId = currentUser?.teacher?.id || '';
    const result = await saveAsync.execute(
      selectedStudent.id,
      selectedStudent.name,
      currentYearMonth,
      selectedSubject,
      gradingResult.score,
      teacherId,
      '', // comment
      gradingResult.examDifficulty
    );

    if (result.success) {
      addToast('성적이 성공적으로 저장되었습니다.', 'success');
      await fetchAllData();
      setGradingResult(null);
    } else {
      addToast(result.error?.message || '저장에 실패했습니다.', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">단건 채점</h1>
            <p className="page-description">OMR 카드를 스캔하여 개별 채점합니다</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div className="card" style={{ padding: '0', height: 'fit-content' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>학생 선택</h3>
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {students.map(s => (
              <div
                key={s.id}
                onClick={() => setSelectedStudentId(s.id)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: selectedStudentId === s.id ? 'var(--primary-light)' : 'transparent',
                  borderBottom: '1px solid var(--border-light)',
                  borderLeft: selectedStudentId === s.id ? '4px solid var(--primary)' : '4px solid transparent'
                }}
              >
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.grade}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>OMR 카드 업로드</h2>

            {selectedStudentId && (
              <div style={{ marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>과목 선택</label>
                  <select
                    className="search-input"
                    style={{ width: '100%' }}
                    value={selectedSubject}
                    onChange={e => setSelectedSubject(e.target.value)}
                  >
                    {selectedStudent?.subjects.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>시험 정보</label>
                  <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', fontSize: '14px', border: '1px solid #e2e8f0' }}>
                    {selectedExam ? `난이도: ${selectedExam.difficulty} | ${selectedExam.yearMonth}` : '등록된 시험지 없음'}
                  </div>
                </div>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleFileChange}
            />
            <div
              className={`upload-area ${isUploading ? 'uploading' : ''}`}
              onClick={handleUploadClick}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '48px',
                textAlign: 'center',
                cursor: (selectedStudentId && selectedSubject) ? 'pointer' : 'not-allowed',
                background: isUploading ? 'var(--bg-light)' : 'transparent',
                transition: 'all 0.2s',
                opacity: (selectedStudentId && selectedSubject) ? 1 : 0.6
              }}
            >
              {isUploading ? (
                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
              ) : (
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: (selectedStudentId && selectedSubject) ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {(selectedStudentId && selectedSubject) ? 'upload_file' : 'person_search'}
                </span>
              )}
              <div style={{ marginTop: '16px', fontWeight: 500 }}>
                {isUploading ? '분석 중...' : selectedStudentId ? `${selectedStudent?.name} 학생 OMR 업로드` : '왼쪽에서 학생을 먼저 선택하세요'}
              </div>
            </div>
          </div>

          {gradingResult && (
            <div className="card" style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600 }}>채점 결과: {selectedStudent?.name} ({gradingResult.examSubject})</h2>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{gradingResult.score}점</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: 'var(--bg-light)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '12px' }}>오답 문항</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {gradingResult.wrongAnswers.map((num: number) => (
                      <span key={num} style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                        {num}번
                      </span>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>시험 난이도</div>
                    <span className={`badge badge-${gradingResult.examDifficulty.toLowerCase()}`} style={{ minWidth: '30px' }}>{gradingResult.examDifficulty}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>이미지 미리보기</div>
                  <img src={gradingResult.omrUrl} style={{ width: '100%', borderRadius: '4px', border: '1px solid var(--border)' }} alt="OMR Result" />
                </div>
              </div>
              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveResult}
                  disabled={saveAsync.isLoading}
                >
                  <span className="material-symbols-outlined">save</span>
                  {saveAsync.isLoading ? '저장 중...' : '결과 저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .upload-area:hover:not(.uploading) {
          border-color: var(--primary) !important;
          background: var(--primary-light) !important;
        }
        .badge-a { background: #dcfce7; color: #166534; }
        .badge-b { background: #dbeafe; color: #1e40af; }
        .badge-c { background: #fef9c3; color: #854d0e; }
        .badge-d { background: #ffedd5; color: #9a3412; }
        .badge-e { background: #fce7f3; color: #9d174d; }
        .badge-f { background: #fee2e2; color: #991b1b; }
      `}</style>
    </div>
  );
}
