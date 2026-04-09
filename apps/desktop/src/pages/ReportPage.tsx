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

// html2canvas 캡처 헬퍼 (중복 제거)
async function captureReport(el: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default;
  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });
}

// textarea 자동 높이 조절
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

export default function ReportPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [activeMonth, setActiveMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);
  const [shareResult, setShareResult] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [totalComment, setTotalComment] = useState<Record<string, string>>({});
  const [scoreHistory, setScoreHistory] = useState<{ months: string[]; subjects: Record<string, (number | null)[]> } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const commentRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
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

  const captureWithMode = async (): Promise<HTMLCanvasElement> => {
    setCaptureMode(true);
    // React가 re-render할 시간을 줌
    await new Promise((r) => setTimeout(r, 100));
    const canvas = await captureReport(reportRef.current!);
    setCaptureMode(false);
    return canvas;
  };

  const handleDownload = async () => {
    if (!reportRef.current || !selectedStudent) return;
    setDownloading(true);
    try {
      const canvas = await captureWithMode();
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

  const handleShare = async () => {
    if (!reportRef.current || !selectedStudent || !currentStudent) return;
    setSharing(true);
    setShareResult('');
    try {
      const canvas = await captureWithMode();
      const dataUrl = canvas.toDataURL('image/png');
      const res = await api.uploadReportImage({
        imageBase64: dataUrl,
        studentName: currentStudent.name,
        yearMonth: activeMonth,
      });
      const monthNum = activeMonth.split('-')[1]?.replace(/^0/, '') || '';
      const message = `[와와학습코칭센터] ${activeMonth} 월말평가 리포트\n\n안녕하세요, ${currentStudent.name} 학생 학부모님.\n${monthNum}월 월말평가 리포트를 보내드립니다.\n\n리포트 보기:\n${res.shareUrl}`;
      await navigator.clipboard.writeText(message);
      setShareResult('copied');
      setTimeout(() => setShareResult(''), 3000);
    } catch (err) {
      setShareResult('error');
      alert('공유 실패: ' + (err as Error).message);
      setTimeout(() => setShareResult(''), 3000);
    } finally {
      setSharing(false);
    }
  };

  const currentStudent = students.find((s) => s.id === selectedStudent);
  const studentReport = reports.find((r) => r.studentId === selectedStudent);

  // 학생 선택 시 점수 추이 로드
  useEffect(() => {
    if (!selectedStudent) { setScoreHistory(null); return; }
    api.getScoreHistory(selectedStudent, 6).then(setScoreHistory).catch(() => setScoreHistory(null));
  }, [selectedStudent]);

  const handleAIComment = async (examId: string, subject: string, score: number, existingComment: string) => {
    if (!currentStudent) return;
    setAiLoading((prev) => ({ ...prev, [examId]: true }));
    try {
      const res = await api.generateComment({
        studentName: currentStudent.name,
        subject,
        score,
        yearMonth: activeMonth,
        existingComment: existingComment || undefined,
      });
      const textarea = commentRefs.current[examId];
      if (textarea) {
        textarea.value = res.comment;
        autoResize(textarea);
        debouncedSaveComment(selectedStudent, examId, res.comment, score);
      }
    } catch (err) {
      alert('AI 생성 실패: ' + (err as Error).message);
    } finally {
      setAiLoading((prev) => ({ ...prev, [examId]: false }));
    }
  };

  const handleGenerateSummary = async () => {
    if (!currentStudent || !studentReport || !studentReport.scores?.length) return;
    setSummaryLoading(true);
    try {
      const res = await api.generateSummary({
        studentName: currentStudent.name,
        yearMonth: activeMonth,
        scores: studentReport.scores.map((g) => ({
          subject: g.subject,
          score: g.score,
          comment: commentRefs.current[g.examId]?.value || g.comment || undefined,
        })),
      });
      setTotalComment((prev) => ({ ...prev, [selectedStudent]: res.summary }));
    } catch (err) {
      alert('AI 총평 생성 실패: ' + (err as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  };

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
          aria-label="학생 선택"
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
        <button
          className="btn btn-share"
          onClick={handleShare}
          disabled={!selectedStudent || sharing}
        >
          {sharing ? '업로드 중...' : shareResult === 'copied' ? '복사 완료!' : '카카오톡 공유 복사'}
        </button>
      </div>

      {loading && (
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>리포트 로딩 중...</span>
        </div>
      )}

      {/* Report Preview — 이 영역이 PNG로 캡처됨 */}
      <div className="report-paper" ref={reportRef} id="report-paper">
        {!selectedStudent ? (
          <div className="report-empty">학생을 선택하세요</div>
        ) : (
          <>
            {/* ── 헤더 ── */}
            <div className="rpt-header">
              <div className="rpt-header-left">
                <div className="rpt-logo">W</div>
                <div>
                  <div className="rpt-academy">와와학습코칭센터</div>
                  <div className="rpt-branch">알파시티점</div>
                </div>
              </div>
              <div className="rpt-header-right">
                <div className="rpt-month">{activeMonth?.split('-')[1]?.replace(/^0/, '')}월</div>
                <div className="rpt-year">{activeMonth?.split('-')[0]}</div>
              </div>
            </div>

            <div className="rpt-title-bar">
              <span className="rpt-title">월말평가 리포트</span>
            </div>

            <div className="rpt-student-row">
              <span className="rpt-student-label">학생</span>
              <span className="rpt-student-name">{currentStudent?.name}</span>
            </div>

            {/* ── 이번 달 성적 바 차트 + 전월 대비 ── */}
            {studentReport && studentReport.scores?.length > 0 && (() => {
              // 전월 점수 맵 구성 (scoreHistory에서 직전 월 데이터 추출)
              const prevScoreMap: Record<string, number | null> = {};
              if (scoreHistory && scoreHistory.months.length >= 2) {
                const prevMonth = scoreHistory.months[scoreHistory.months.length - 2];
                const prevIdx = scoreHistory.months.indexOf(prevMonth);
                for (const [subject, scores] of Object.entries(scoreHistory.subjects)) {
                  prevScoreMap[subject] = scores[prevIdx] ?? null;
                }
              }
              return (
                <>
                  <div className="rpt-section-label">{activeMonth?.split('-')[1]?.replace(/^0/, '')}월 성적</div>
                  <div className="rpt-chart">
                    {studentReport.scores.map((g) => {
                      const prev = prevScoreMap[g.subject];
                      const delta = prev != null && g.score > 0 ? g.score - prev : null;
                      return (
                        <div className="rpt-chart-row" key={g.examId}>
                          <span className="rpt-chart-subject">{g.subject}</span>
                          <div className="rpt-chart-track">
                            <div
                              className="rpt-chart-bar"
                              style={{ width: `${Math.min(Math.max(g.score, 0), 100)}%` }}
                            />
                          </div>
                          <span className="rpt-chart-value">{g.score}</span>
                          {delta != null ? (
                            <span className={`rpt-chart-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'}`}>
                              {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : '-'}
                            </span>
                          ) : (
                            <span className="rpt-chart-delta same">{' '}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {/* ── 과목별 상세 ── */}
            {studentReport && studentReport.scores?.length > 0 ? (
              <div className="rpt-details">
                <div className="rpt-section-label">과목별 코멘트</div>
                {studentReport.scores.map((g) => {
                  const scoreKey = `score-${selectedStudent}-${g.examId}`;
                  const commentKey = `comment-${selectedStudent}-${g.examId}`;
                  return (
                    <div className="rpt-detail-card" key={`${selectedStudent}-${g.examId}`}>
                      <div className="rpt-detail-top">
                        <span className="rpt-detail-subject">{g.subject}</span>
                        <div className="rpt-detail-score-wrap">
                          {captureMode ? (
                            <span className="rpt-score-display">{g.score}</span>
                          ) : (
                            <input
                              type="number"
                              defaultValue={g.score}
                              className="rpt-score-input"
                              aria-label={`${g.subject} 점수`}
                              style={statusStyle(scoreKey)}
                              onBlur={(e) => handleScoreSave(selectedStudent, g.examId, e.target.value)}
                            />
                          )}
                          <span className="rpt-score-unit">점</span>
                          {!captureMode && (statusIcon(scoreKey) || statusIcon(commentKey)) && (
                            <span className="rpt-status-icon" aria-live="polite">
                              {statusIcon(scoreKey) || statusIcon(commentKey)}
                            </span>
                          )}
                        </div>
                      </div>
                      {captureMode ? (
                        <p className="rpt-comment-text">{commentRefs.current[g.examId]?.value || g.comment || ''}</p>
                      ) : (
                        <>
                          <textarea
                            ref={(el) => {
                              commentRefs.current[g.examId] = el;
                              if (el) autoResize(el);
                            }}
                            defaultValue={g.comment}
                            placeholder="코멘트 입력..."
                            rows={2}
                            className="rpt-comment"
                            aria-label={`${g.subject} 코멘트`}
                            style={statusStyle(commentKey)}
                            onChange={(e) => {
                              autoResize(e.target);
                              debouncedSaveComment(selectedStudent, g.examId, e.target.value, g.score);
                            }}
                          />
                          <button
                            className="rpt-ai-btn"
                            disabled={aiLoading[g.examId]}
                            onClick={() => handleAIComment(g.examId, g.subject, g.score, commentRefs.current[g.examId]?.value || g.comment)}
                          >
                            {aiLoading[g.examId] ? 'AI 생성 중...' : 'AI 코멘트 생성'}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}

                <div className="rpt-total-comment">
                  <div className="rpt-section-label" style={{ padding: 0, margin: '0 0 8px 0' }}>총평</div>
                  {captureMode ? (
                    (totalComment[selectedStudent] || studentReport?.totalComment) ? (
                      <p className="rpt-comment-text">{totalComment[selectedStudent] || studentReport?.totalComment}</p>
                    ) : null
                  ) : (
                    <>
                      <textarea
                        className="rpt-comment"
                        aria-label="총평"
                        rows={4}
                        placeholder="AI 총평을 생성하거나 직접 입력하세요..."
                        value={totalComment[selectedStudent] || studentReport?.totalComment || ''}
                        onChange={(e) => {
                          autoResize(e.target);
                          setTotalComment((prev) => ({ ...prev, [selectedStudent]: e.target.value }));
                        }}
                        ref={(el) => { if (el) autoResize(el); }}
                      />
                      <button
                        className="rpt-ai-btn"
                        style={{ marginTop: 10 }}
                        disabled={summaryLoading}
                        onClick={handleGenerateSummary}
                      >
                        {summaryLoading ? 'AI 총평 생성 중...' : 'AI 총평 생성'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className="report-empty" style={{ marginTop: 24 }}>
                이 학생의 {activeMonth} 성적 데이터가 없습니다
              </p>
            )}

            {/* ── 푸터 ── */}
            <div className="rpt-footer">
              <div className="rpt-footer-line" />
              <div className="rpt-footer-content">
                <span className="rpt-footer-name">와와학습코칭센터 알파시티점</span>
                <span className="rpt-footer-tel">0507-1349-2705</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
