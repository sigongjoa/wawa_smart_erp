import { useCallback, useEffect, useRef, useState } from 'react';
import { api, Student, ReportEntry, ReportType } from '../api';
import { toast } from '../components/Toast';
import { useAuthStore } from '../store';

// Debounce hook
function useDebounce(fn: (...args: any[]) => void, delay: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  return useCallback((...args: any[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]);
}

// 저장 상태 타입
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// 개별 셀 저장 상태 관리
function useCellStatus() {
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  const set = (key: string, status: SaveStatus) => {
    setStatuses((prev) => ({ ...prev, [key]: status }));
    if (status === 'saved') {
      if (timers.current[key]) clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [key]: 'idle' }));
        delete timers.current[key];
      }, 1500);
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

// 리포트 유형 라벨
const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  monthly: '월말평가',
  midterm: '중간고사',
  final: '기말고사',
};

// 학기 문자열 → 사람이 읽기 쉬운 형태 (2026-1 → "2026년 1학기")
function formatTerm(term: string | null): string {
  if (!term) return '';
  const [year, half] = term.split('-');
  return `${year}년 ${half}학기`;
}

export default function ReportPage() {
  const user = useAuthStore((s) => s.user);
  const academyName = user?.academyName || 'WAWA';
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [activeMonth, setActiveMonth] = useState('');
  const [activeTerm, setActiveTerm] = useState('');
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

  // 초기 로드: 월말 설정 + 정기고사 설정 + 학생 목록을 병렬로
  useEffect(() => {
    Promise.all([
      api.getActiveMonth().catch(() => null),
      api.getActiveExamReview().catch(() => null),
      api.getStudents().catch(() => []),
    ]).then(([monthSettings, reviewSettings, studentList]) => {
      const month = monthSettings?.activeExamMonth ?? '';
      const term = reviewSettings?.activeTerm ?? '';
      const reviewType = reviewSettings?.activeExamType ?? null;
      if (month) setActiveMonth(month);
      if (term) setActiveTerm(term);
      setStudents(studentList || []);

      // 초기 탭 결정: 정기고사 설정이 있으면 그걸로, 아니면 월말
      if (reviewType && term) {
        setReportType(reviewType);
      }
      setLoading(false);
    });
  }, []);

  // 리포트 유형/월/학기 변경 시 재로드
  useEffect(() => {
    if (reportType === 'monthly') {
      if (activeMonth) {
        loadReports({ reportType: 'monthly', yearMonth: activeMonth });
        loadSendStatus({ reportType: 'monthly', yearMonth: activeMonth });
      } else {
        setReports([]);
        setSendStatus({});
      }
    } else {
      if (activeTerm) {
        loadReports({ reportType, term: activeTerm });
        loadSendStatus({ reportType, term: activeTerm });
      } else {
        setReports([]);
        setSendStatus({});
      }
    }
  }, [reportType, activeMonth, activeTerm]);

  const loadReports = async (params: { reportType: ReportType; yearMonth?: string; term?: string }) => {
    try {
      const data = await api.getReport(params);
      setReports(data || []);
    } catch {
      setReports([]);
    }
  };

  const loadSendStatus = async (params: { reportType: ReportType; yearMonth?: string; term?: string }) => {
    try {
      const data = await api.getSendStatus(params);
      setSendStatus(data || {});
    } catch {
      setSendStatus({});
    }
  };

  // 현재 활성 주기 키 ("2026-04" 또는 "2026-1")
  const activePeriodKey = reportType === 'monthly' ? activeMonth : activeTerm;
  const periodLabel = reportType === 'monthly' ? activeMonth : formatTerm(activeTerm);
  const isExamReview = reportType !== 'monthly';

  const examContextForAI = isExamReview && activeTerm
    ? { reportType: reportType as 'midterm' | 'final', term: activeTerm }
    : undefined;

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
      if (reportType === 'monthly' && activeMonth) {
        loadReports({ reportType: 'monthly', yearMonth: activeMonth });
      } else if (reportType !== 'monthly' && activeTerm) {
        loadReports({ reportType, term: activeTerm });
      }
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
      if (reportType === 'monthly' && activeMonth) {
        loadReports({ reportType: 'monthly', yearMonth: activeMonth });
      } else if (reportType !== 'monthly' && activeTerm) {
        loadReports({ reportType, term: activeTerm });
      }
    } catch {
      cellStatus.set(key, 'error');
    }
  }, [reportType, activeMonth, activeTerm]);

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
        try {
          const a = document.createElement('a');
          a.href = url;
          const typeLabel = REPORT_TYPE_LABEL[reportType];
          a.download = `${typeLabel}리포트-${currentStudent?.name || selectedStudent}-${activePeriodKey}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }, 'image/jpeg', 0.95);
    } catch (err) {
      toast.error('다운로드 실패: ' + (err as Error).message);
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
      const uploadParams: Parameters<typeof api.uploadReportImage>[0] = {
        imageBase64: dataUrl,
        studentId: selectedStudent,
        studentName: currentStudent.name,
        reportType,
      };
      if (reportType === 'monthly') {
        uploadParams.yearMonth = activeMonth;
      } else {
        uploadParams.term = activeTerm;
      }
      const res = await api.uploadReportImage(uploadParams);

      const typeLabel = REPORT_TYPE_LABEL[reportType];
      const headerLine = reportType === 'monthly'
        ? `${activeMonth} ${typeLabel} 리포트`
        : `${formatTerm(activeTerm)} ${typeLabel} 리포트`;
      const bodyLine = reportType === 'monthly'
        ? `${activeMonth.split('-')[1]?.replace(/^0/, '') || ''}월 월말평가 리포트를 보내드립니다.`
        : `${formatTerm(activeTerm)} ${typeLabel} 리포트를 보내드립니다.`;
      const message = `[${academyName}] ${headerLine}\n\n안녕하세요, ${currentStudent.name} 학생 학부모님.\n${bodyLine}\n\n리포트 보기:\n${res.shareUrl}`;
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
      toast.error('공유 실패: ' + (err as Error).message);
      setTimeout(() => setShareResult(''), 3000);
    } finally {
      setSharing(false);
    }
  };

  const currentStudent = students.find((s) => s.id === selectedStudent);
  const studentReport = reports.find((r) => r.studentId === selectedStudent);

  // 학생 선택 시 점수 추이 로드
  useEffect(() => {
    commentRefs.current = {};
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
        yearMonth: reportType === 'monthly' ? activeMonth : activeTerm,
        existingComment: existingComment || undefined,
        examContext: examContextForAI,
      });
      const textarea = commentRefs.current[examId];
      if (textarea) {
        textarea.value = res.comment;
        autoResize(textarea);
        debouncedSaveComment(selectedStudent, examId, res.comment, score);
      }
    } catch (err) {
      toast.error('AI 생성 실패: ' + (err as Error).message);
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
        yearMonth: reportType === 'monthly' ? activeMonth : activeTerm,
        scores: studentReport.scores.map((g) => ({
          subject: g.subject,
          score: g.score,
          comment: commentRefs.current[g.examId]?.value || g.comment || undefined,
        })),
        examContext: examContextForAI,
      });
      setTotalComment((prev) => ({ ...prev, [selectedStudent]: res.summary }));
    } catch (err) {
      toast.error('AI 총평 생성 실패: ' + (err as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  };

  // 저장 상태 표시 스타일
  const statusStyle = (key: string): React.CSSProperties => {
    const s = cellStatus.statuses[key];
    if (s === 'saving') return { borderColor: 'var(--info)', outline: '1px solid var(--info)' };
    if (s === 'saved') return { borderColor: 'var(--success)', outline: '1px solid var(--success)' };
    if (s === 'error') return { borderColor: 'var(--danger)', outline: '1px solid var(--danger)' };
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
    <div className="report-page">
      <div className="report-page-header">
        <h2 className="page-title">{REPORT_TYPE_LABEL[reportType]} 리포트</h2>
        <div className="report-type-tabs" role="tablist" aria-label="리포트 유형">
          {(['monthly', 'midterm', 'final'] as ReportType[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={reportType === t}
              className={`report-type-tab ${reportType === t ? 'report-type-tab--active' : ''}`}
              onClick={() => setReportType(t)}
            >
              {REPORT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="report-month-badge">
          {periodLabel || '미설정'}
        </div>
        <div className="report-progress">
          <span className="report-progress-label">전송 현황</span>
          <span className="report-progress-value">{sentCount}/{students.length}</span>
          <div className="report-progress-bar" role="progressbar" aria-valuenow={sentCount} aria-valuemin={0} aria-valuemax={students.length} aria-label="전송 진행률">
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
          {/* ════ 모바일: 학생 드롭다운 셀렉터 ════ */}
          <div className="report-mobile-selector">
            <label htmlFor="student-select" className="report-mobile-selector-label">학생 선택</label>
            <select
              id="student-select"
              className="report-mobile-select"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
            >
              <option value="">학생을 선택하세요</option>
              {students.map((s) => {
                const isSent = !!sendStatus[s.id];
                const { total, entered } = getStudentScoreStatus(s.id);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} {total > 0 ? `(${entered}/${total})` : ''} {isSent ? '✓' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* ════ 데스크탑: 학생 전송 현황 테이블 ════ */}
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
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedStudent(student.id); } }}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
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
                  <div>학생을 선택하세요</div>
                </div>
              ) : (
                <>
                  {/* ── 헤더 ── */}
                  <div className="rpt-header">
                    <div className="rpt-header-left">
                      <div className="rpt-logo">W</div>
                      <div>
                        <div className="rpt-academy">{academyName}</div>
                      </div>
                    </div>
                    <div className="rpt-header-right">
                      {reportType === 'monthly' ? (
                        <>
                          <div className="rpt-month">{activeMonth?.split('-')[1]?.replace(/^0/, '')}월</div>
                          <div className="rpt-year">{activeMonth?.split('-')[0]}</div>
                        </>
                      ) : (
                        <>
                          <div className="rpt-month">{activeTerm?.split('-')[1]}학기</div>
                          <div className="rpt-year">{activeTerm?.split('-')[0]}</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="rpt-title-bar">
                    <span className="rpt-title">{REPORT_TYPE_LABEL[reportType]} 리포트</span>
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
                        <div className="rpt-section-label">
                          {reportType === 'monthly'
                            ? `${activeMonth?.split('-')[1]?.replace(/^0/, '')}월 성적`
                            : `${REPORT_TYPE_LABEL[reportType]} 성적`}
                        </div>
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
                      이 학생의 {periodLabel} {REPORT_TYPE_LABEL[reportType]} 성적 데이터가 없습니다
                    </p>
                  )}

                  {/* ── 푸터 ── */}
                  <div className="rpt-footer">
                    <div className="rpt-footer-line" />
                    <div className="rpt-footer-content">
                      <span className="rpt-footer-name">{academyName}</span>
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
