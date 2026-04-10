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

// html2canvas 캡처 헬퍼
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

// 전송 상태 타입
type SendInfo = { shareUrl: string; sentBy: string; sentAt: string };

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
  const [sendStatus, setSendStatus] = useState<Record<string, SendInfo>>({});
  const reportRef = useRef<HTMLDivElement>(null);
  const commentRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const cellStatus = useCellStatus();

  useEffect(() => {
    Promise.all([
      api.getActiveMonth().catch(() => null),
      api.getStudents().catch(() => []),
    ]).then(([settings, studentList]) => {
      const month = settings?.activeExamMonth ?? null;
      if (month) {
        setActiveMonth(month);
        loadReports(month);
        loadSendStatus(month);
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

  const loadSendStatus = async (ym: string) => {
    try {
      const data = await api.getSendStatus(ym);
      setSendStatus(data || {});
    } catch {
      setSendStatus({});
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
      // 차트 실시간 갱신
      if (activeMonth) loadReports(activeMonth);
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
      if (activeMonth) loadReports(activeMonth);
    } catch {
      cellStatus.set(key, 'error');
    }
  }, [activeMonth]);

  const debouncedSaveComment = useDebounce(saveComment, 500);

  const captureWithMode = async (): Promise<HTMLCanvasElement> => {
    setCaptureMode(true);
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
        studentId: selectedStudent,
        studentName: currentStudent.name,
        yearMonth: activeMonth,
      });
      const monthNum = activeMonth.split('-')[1]?.replace(/^0/, '') || '';
      const message = `[와와학습코칭센터] ${activeMonth} 월말평가 리포트\n\n안녕하세요, ${currentStudent.name} 학생 학부모님.\n${monthNum}월 월말평가 리포트를 보내드립니다.\n\n리포트 보기:\n${res.shareUrl}`;
      await navigator.clipboard.writeText(message);
      setShareResult('copied');
      // 전송 상태 즉시 업데이트
      setSendStatus((prev) => ({
        ...prev,
        [selectedStudent]: {
          shareUrl: res.shareUrl,
          sentBy: '',
          sentAt: new Date().toISOString(),
        },
      }));
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

  // ── 테이블용 데이터 계산 ──
  const getStudentScoreStatus = (studentId: string) => {
    const report = reports.find((r) => r.studentId === studentId);
    if (!report || !report.scores?.length) return { total: 0, entered: 0 };
    const entered = report.scores.filter((s) => s.score > 0).length;
    return { total: report.scores.length, entered };
  };

  const sentCount = students.filter((s) => sendStatus[s.id]).length;

  return (
    <div>
      <div className="report-page-header">
        <h2 className="page-title">월말평가 리포트</h2>
        <div className="report-month-badge">
          {activeMonth || '미설정'}
        </div>
        <div className="report-progress">
          <span className="report-progress-label">전송 현황</span>
          <span className="report-progress-value">{sentCount}/{students.length}</span>
          <div className="report-progress-bar">
            <div
              className="report-progress-fill"
              style={{ width: students.length ? `${(sentCount / students.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>리포트 로딩 중...</span>
        </div>
      ) : (
        <div className="report-split">
          {/* ════ 좌측: 학생 전송 현황 테이블 ════ */}
          <div className="report-left">
            <table className="send-table">
              <thead>
                <tr>
                  <th className="send-th-num">#</th>
                  <th className="send-th-name">이름</th>
                  <th className="send-th-score">성적</th>
                  <th className="send-th-status">전송</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  const { total, entered } = getStudentScoreStatus(student.id);
                  const isSent = !!sendStatus[student.id];
                  const isSelected = selectedStudent === student.id;
                  const isComplete = total > 0 && entered === total;

                  return (
                    <tr
                      key={student.id}
                      className={`send-row ${isSelected ? 'send-row--active' : ''}`}
                      onClick={() => setSelectedStudent(student.id)}
                    >
                      <td className="send-cell-num">{idx + 1}</td>
                      <td className="send-cell-name">
                        {student.name}
                      </td>
                      <td className="send-cell-score">
                        {total > 0 ? (
                          <span className={`score-pill ${isComplete ? 'score-pill--done' : 'score-pill--partial'}`}>
                            {entered}/{total}
                          </span>
                        ) : (
                          <span className="score-pill score-pill--empty">-</span>
                        )}
                      </td>
                      <td className="send-cell-status">
                        {isSent ? (
                          <span className="send-badge send-badge--sent">전송됨</span>
                        ) : (
                          <span className="send-badge send-badge--pending">미전송</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {students.length === 0 && (
              <div className="send-table-empty">등록된 학생이 없습니다</div>
            )}
          </div>

          {/* ════ 우측: 리포트 미리보기 + 액션 ════ */}
          <div className="report-right">
            {selectedStudent && currentStudent && (
              <div className="report-actions">
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
                  {sharing ? '업로드 중...' : shareResult === 'copied' ? '복사 완료!' : '카카오톡 공유'}
                </button>
                {sendStatus[selectedStudent] && (
                  <span className="report-sent-time">
                    {new Date(sendStatus[selectedStudent].sentAt).toLocaleDateString('ko-KR')} 전송됨
                  </span>
                )}
              </div>
            )}

            {/* Report Preview — 이 영역이 PNG로 캡처됨 */}
            <div className="report-paper" ref={reportRef} id="report-paper">
              {!selectedStudent ? (
                <div className="report-empty">
                  <div className="report-empty-icon">←</div>
                  <div>좌측에서 학생을 선택하세요</div>
                </div>
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
                    // 활성 월 기준으로 직전 월 점수 추출
                    const prevScoreMap: Record<string, number | null> = {};
                    if (scoreHistory && activeMonth) {
                      const activeIdx = scoreHistory.months.indexOf(activeMonth);
                      // 활성 월 이전에 데이터가 있는 월을 찾음
                      let prevIdx = -1;
                      if (activeIdx > 0) {
                        prevIdx = activeIdx - 1;
                      } else if (activeIdx === -1) {
                        // 활성 월이 히스토리에 없으면 전체 마지막이 전월
                        prevIdx = scoreHistory.months.length - 1;
                      }
                      if (prevIdx >= 0) {
                        for (const [subject, scores] of Object.entries(scoreHistory.subjects)) {
                          prevScoreMap[subject] = scores[prevIdx] ?? null;
                        }
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
        </div>
      )}
    </div>
  );
}
