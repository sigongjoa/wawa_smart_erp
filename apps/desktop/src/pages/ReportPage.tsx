import { useCallback, useEffect, useRef, useState } from 'react';
import { api, Student, ReportEntry } from '../api';

// Debounce hook
function useDebounce(fn: (...args: any[]) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return useCallback((...args: any[]) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// 저장 상태 타입
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// 개별 셀 저장 상태 관리
function useCellStatus() {
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const set = (key: string, status: SaveStatus) => {
    setStatuses((prev) => ({ ...prev, [key]: status }));
    if (status === 'saved') {
      setTimeout(() => setStatuses((prev) => ({ ...prev, [key]: 'idle' })), 2000);
    }
  };
  return { statuses, set };
}

export default function ReportPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [activeMonth, setActiveMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const cellStatus = useCellStatus();

  useEffect(() => {
    Promise.all([
      api.getActiveMonth().catch(() => ({ activeExamMonth: null })),
      api.getStudents().catch(() => []),
    ]).then(([settings, studentList]) => {
      const month = settings.activeExamMonth;
      if (month) {
        setActiveMonth(month);
        loadReports(month);
      }
      setStudents(studentList || []);
      setLoading(false);
    });
  }, []);

  const loadReports = async (ym: string) => {
    try {
      const data = await api.getReport(ym);
      setReports(data || []);
    } catch {
      setReports([]);
    }
  };

  // 점수 저장 (onBlur)
  const handleScoreSave = async (studentId: string, examId: string, value: string) => {
    const num = Number(value);
    if (isNaN(num) || num < 0) return;
    const key = `score-${studentId}-${examId}`;
    cellStatus.set(key, 'saving');
    try {
      await api.saveGrade({ student_id: studentId, exam_id: examId, score: num });
      cellStatus.set(key, 'saved');
    } catch {
      cellStatus.set(key, 'error');
    }
  };

  // 코멘트 저장 (debounce 500ms)
  const saveComment = useCallback(async (studentId: string, examId: string, comment: string, score: number) => {
    const key = `comment-${studentId}-${examId}`;
    cellStatus.set(key, 'saving');
    try {
      await api.saveGrade({ student_id: studentId, exam_id: examId, score, comments: comment });
      cellStatus.set(key, 'saved');
      // 리포트 갱신
      if (activeMonth) loadReports(activeMonth);
    } catch {
      cellStatus.set(key, 'error');
    }
  }, [activeMonth]);

  const debouncedSaveComment = useDebounce(saveComment, 500);

  const handleDownload = async () => {
    if (!reportRef.current || !selectedStudent) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `리포트-${currentStudent?.name || selectedStudent}-${activeMonth}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/jpeg', 0.95);
    } catch (err) {
      alert('다운로드 실패: ' + (err as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const currentStudent = students.find((s) => s.id === selectedStudent);
  const studentReport = reports.find((r) => r.studentId === selectedStudent);

  // 저장 상태 표시 스타일
  const statusStyle = (key: string): React.CSSProperties => {
    const s = cellStatus.statuses[key];
    if (s === 'saving') return { borderColor: '#1a73e8', outline: '1px solid #1a73e8' };
    if (s === 'saved') return { borderColor: '#2e7d32', outline: '1px solid #2e7d32' };
    if (s === 'error') return { borderColor: '#d32f2f', outline: '1px solid #d32f2f' };
    return {};
  };

  const statusIcon = (key: string) => {
    const s = cellStatus.statuses[key];
    if (s === 'saving') return '⏳';
    if (s === 'saved') return '✓';
    if (s === 'error') return '✗';
    return '';
  };

  return (
    <div>
      <h2 className="page-title">월말평가 리포트</h2>

      <div className="report-controls">
        <span style={{ fontSize: 14, color: '#666' }}>
          활성 월: <strong>{activeMonth || '미설정'}</strong>
        </span>
        <select
          id="student-select"
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
        >
          <option value="">학생 선택</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={handleDownload}
          disabled={!selectedStudent || downloading}
        >
          {downloading ? '생성 중...' : 'JPG 다운로드'}
        </button>
      </div>

      {loading && <p style={{ color: '#666' }}>로딩 중...</p>}

      {/* Report Preview — 이 영역이 JPG로 캡처됨 */}
      <div className="report-paper" ref={reportRef} id="report-paper">
        {!selectedStudent ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
            학생을 선택하세요
          </div>
        ) : (
          <>
            <h3>{activeMonth} 월말평가 리포트</h3>
            <p className="subtitle">{currentStudent?.name}</p>

            {studentReport && studentReport.scores?.length > 0 ? (
              <table className="score-table" style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>과목</th>
                    <th style={{ width: 70 }}>점수</th>
                    <th>코멘트</th>
                    <th style={{ width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {studentReport.scores.map((g) => {
                    const scoreKey = `score-${selectedStudent}-${g.examId}`;
                    const commentKey = `comment-${selectedStudent}-${g.examId}`;
                    return (
                      <tr key={g.examId}>
                        <td>{g.subject}</td>
                        <td>
                          <input
                            type="number"
                            defaultValue={g.score}
                            style={{ width: 50, textAlign: 'center', ...statusStyle(scoreKey) }}
                            onBlur={(e) => handleScoreSave(selectedStudent, g.examId, e.target.value)}
                          />
                        </td>
                        <td>
                          <textarea
                            defaultValue={g.comment}
                            placeholder="코멘트 입력..."
                            rows={2}
                            style={{
                              width: '100%',
                              padding: '4px 6px',
                              border: '1px solid #ddd',
                              borderRadius: 4,
                              fontSize: 13,
                              resize: 'vertical',
                              ...statusStyle(commentKey),
                            }}
                            onChange={(e) =>
                              debouncedSaveComment(selectedStudent, g.examId, e.target.value, g.score)
                            }
                          />
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 14 }}>
                          {statusIcon(scoreKey) || statusIcon(commentKey)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', textAlign: 'center', marginTop: 24 }}>
                이 학생의 {activeMonth} 성적 데이터가 없습니다
              </p>
            )}

            {studentReport?.totalComment && (
              <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 6 }}>
                <strong>총평:</strong> {studentReport.totalComment}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
