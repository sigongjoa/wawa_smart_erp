import { useState, useRef, useMemo } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { includesHangul } from '../../utils/hangulUtils';
// html2canvas is dynamically imported in generateJPG()
import { wawaLogoBase64 } from '../../assets/wawaLogo';
import { getSubjectColor } from '../../constants/common';
import ShareLinkModal from './components/ShareLinkModal';


// 최근 6개월 라벨 생성
const generateMonthLabels = (currentYearMonth: string): string[] => {
  const [year, month] = currentYearMonth.split('-').map(Number);
  const labels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    labels.push(`${m}월`);
  }
  return labels;
};

// 최근 6개월 년월 선택지 생성
const generateMonthOptions = (currentYearMonth: string): { label: string; value: string }[] => {
  const [year, month] = currentYearMonth.split('-').map(Number);
  const options: { label: string; value: string }[] = [];
  for (let i = 0; i < 6; i++) {
    let m = month - i;
    let y = year;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    const label = `${y}년 ${m}월`;
    options.push({ label, value: ym });
  }
  return options;
};

export default function Preview() {
  const { students, reports } = useFilteredData();
  const { currentYearMonth, fetchAllData, isLoading, currentUser, selectedPreviewStudentId, setSelectedPreviewStudentId } = useReportStore();
  const { addToast } = useToastStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYearMonth, setSelectedYearMonth] = useState(currentYearMonth);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // AppShell에서 이미 fetchAllData 호출하므로 여기서는 중복 호출하지 않음
  const filteredStudents = students.filter(s =>
    includesHangul(s.name, searchQuery) ||
    s.grade.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedStudent = students.find(s => s.id === selectedPreviewStudentId);
  const selectedReport = reports.find(r => r.studentId === selectedPreviewStudentId);

  const monthLabels = generateMonthLabels(currentYearMonth);

  // 고유 과목 목록
  const subjects = useMemo(
    () => Array.from(new Set(selectedReport?.scores.map(s => s.subject) || [])),
    [selectedReport?.scores]
  );

  // 과목별 6개월 점수 데이터 (메모이제이션)
  const historicalScoresMap = useMemo(() => {
    const map = new Map<string, number[]>();
    if (!selectedPreviewStudentId) return map;
    const studentReports = reports.filter(r => r.studentId === selectedPreviewStudentId);
    const [year, month] = currentYearMonth.split('-').map(Number);

    subjects.forEach(subject => {
      const scores: number[] = [];
      for (let i = 5; i >= 0; i--) {
        let m = month - i;
        let y = year;
        if (m <= 0) { m += 12; y -= 1; }
        const ym = `${y}-${String(m).padStart(2, '0')}`;
        const report = studentReports.find(r => r.yearMonth === ym);
        const score = report?.scores.find(s => s.subject === subject)?.score;
        scores.push(score ?? 0);
      }
      map.set(subject, scores);
    });
    return map;
  }, [selectedPreviewStudentId, reports, currentYearMonth, subjects]);

  const getHistoricalScores = (subject: string): number[] =>
    historicalScoresMap.get(subject) ?? [0, 0, 0, 0, 0, 0];

  // SVG 라인 차트 포인트 생성
  const generateChartPoints = (scores: number[]): string => {
    const points: string[] = [];
    const xStep = 280 / 5;
    scores.forEach((score, index) => {
      const x = 10 + index * xStep;
      const y = 80 - (score / 100) * 60;
      points.push(`${x},${y}`);
    });
    return points.join(' ');
  };

  const generateJPG = async () => {
    if (!selectedReport || !selectedStudent || !reportRef.current) return;
    setIsGenerating(true);

    try {
      const element = reportRef.current;

      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      // JPG로 변환
      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      // 다운로드 링크 생성
      const fileName = `${selectedStudent.name}_월별평가서_${currentYearMonth}.jpg`;
      const link = document.createElement('a');
      link.href = imgData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast(`이미지가 다운로드되었습니다: ${fileName}`, 'success');
    } catch (error) {
      console.error('이미지 생성 오류:', error);
      addToast('이미지 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };


  return (
    <>
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">리포트 미리보기</h1>
            <p className="page-description">생성된 리포트를 검토하고 JPG로 내보냅니다 ({selectedYearMonth})</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              className="search-input"
              style={{ width: '150px', height: '40px', padding: '8px 12px' }}
              value={selectedYearMonth}
              onChange={(e) => {
                const newMonth = e.target.value;
                setSelectedYearMonth(newMonth);
                fetchAllData(newMonth);
              }}
            >
              {generateMonthOptions(currentYearMonth).map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={() => fetchAllData(selectedYearMonth)} disabled={isLoading}>
              <span className={`material-symbols-outlined ${isLoading ? 'spin' : ''}`}>refresh</span>
              새로고침
            </button>
          </div>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', padding: '0' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--background)', position: 'sticky', top: 0, zIndex: 10 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>학생 목록 ({students.length}명)</h3>
            <input
              className="search-input"
              style={{ width: '100%' }}
              placeholder="학생 검색..."
              aria-label="학생 이름 또는 학년 검색"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {isLoading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div className="spin" style={{ display: 'inline-block', marginBottom: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary)' }}>refresh</span>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>데이터 로딩 중...</div>
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}>warning</span>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>학생 데이터가 없습니다</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                설정을 확인하거나 새로고침을 시도해주세요
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => window.location.hash = '#/report/settings'}>
                설정으로 이동
              </button>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              검색 결과가 없습니다
            </div>
          ) : filteredStudents.map(s => {
            const report = reports.find(r => r.studentId === s.id);
            const isSelected = selectedPreviewStudentId === s.id;
            const isPartial = report && report.scores.length > 0 && report.scores.length < s.subjects.length;
            const isComplete = report && report.scores.length >= s.subjects.length;

            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${s.name} (${s.grade}) — ${isComplete ? '리포트 완료' : isPartial ? '입력 중' : '미입력'}`}
                onClick={() => setSelectedPreviewStudentId(s.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedPreviewStudentId(s.id)}
                style={{
                  padding: '16px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--primary-light)' : 'transparent',
                  borderBottom: '1px solid var(--border-light)',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <span className={`badge ${isComplete ? 'badge-success' : isPartial ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                    {isComplete ? '완료' : isPartial ? '진행 중' : '미입력'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{s.grade}</span>
                  <span>{report ? `${report.scores.length}/${s.subjects.length} 과목` : '0 과목'}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selectedStudent && selectedReport ? (
            <>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{selectedStudent.name} 리포트 미리보기</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={() => window.print()}>
                    <span className="material-symbols-outlined">print</span>인쇄
                  </button>
                  <button className="btn btn-primary" onClick={generateJPG} disabled={isGenerating}>
                    <span className="material-symbols-outlined">{isGenerating ? 'hourglass_top' : 'image'}</span>
                    {isGenerating ? '생성 중...' : 'JPG 다운로드'}
                  </button>
                  <button
                    className="btn btn-sm"
                    aria-label="카카오톡 링크 공유"
                    style={{ background: 'var(--kakao-yellow)', color: 'var(--kakao-brown)', fontWeight: 700 }}
                    onClick={() => setShowShare(true)}
                    disabled={isGenerating}
                  >
                    📎 링크 공유
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, padding: '40px', background: '#f1f5f9', overflowY: 'auto' }}>
                <div ref={reportRef} className="report-paper" style={{
                  background: 'white',
                  width: '100%',
                  maxWidth: '800px',
                  margin: '0 auto',
                  padding: '40px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  borderRadius: '12px'
                }}>
                  {/* 헤더 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingBottom: '20px', borderBottom: '2px solid var(--border)' }}>
                    <div>
                      <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {selectedStudent.name} 학생 월별 평가서
                      </h1>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        리포트 기간: {currentYearMonth.replace('-', '년 ')}월
                      </div>
                    </div>
                    <img
                      src={wawaLogoBase64}
                      alt="WAWA 와와학습코칭센터"
                      loading="lazy"
                      style={{
                        height: '56px',
                        width: 'auto',
                        borderRadius: '4px',
                      }}
                    />
                  </div>

                  {/* 성적 변화 추이 차트 */}
                  {subjects.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#FF6B00' }}>📈</span>
                        전 과목 성적 변화 추이 (최근 6개월)
                      </h3>
                      <div style={{ background: 'var(--background)', padding: '20px', borderRadius: '12px' }}>
                        {/* 범례 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '16px', marginBottom: '16px' }}>
                          {subjects.map((subject) => (
                            <div key={subject} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getSubjectColor(subject) }} />
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{subject}</span>
                            </div>
                          ))}
                        </div>
                        {/* 차트 */}
                        <div style={{ position: 'relative', height: '160px', width: '100%' }}>
                          <svg viewBox="0 0 300 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                            <line x1="0" y1="20" x2="300" y2="20" stroke="#E5E7EB" strokeDasharray="4" />
                            <line x1="0" y1="50" x2="300" y2="50" stroke="#E5E7EB" strokeDasharray="4" />
                            <line x1="0" y1="80" x2="300" y2="80" stroke="#E5E7EB" strokeDasharray="4" />
                            {subjects.map((subject) => {
                              const scores = getHistoricalScores(subject);
                              const points = generateChartPoints(scores);
                              const lastScore = scores[scores.length - 1];
                              const lastX = 10 + 5 * (280 / 5);
                              const lastY = 80 - (lastScore / 100) * 60;
                              return (
                                <g key={subject}>
                                  <polyline fill="none" stroke={getSubjectColor(subject)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
                                  <circle cx={lastX} cy={lastY} r="4" fill={getSubjectColor(subject)} />
                                </g>
                              );
                            })}
                          </svg>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', padding: '0 4px' }}>
                            {monthLabels.map((label, i) => (
                              <span key={i} style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 이번 달 학업 성취도 */}
                  <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#FF6B00' }}>📊</span>
                      {monthLabels[5]} 주요 과목 학업 성취도
                    </h3>
                    <div style={{ background: 'var(--background)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {selectedReport.scores.map((score, idx) => (
                        <div key={`${score.subject}-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{score.subject}</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: getSubjectColor(score.subject) }}>{score.score}점</span>
                          </div>
                          <div style={{ width: '100%', backgroundColor: 'var(--border)', height: '12px', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{
                              backgroundColor: getSubjectColor(score.subject),
                              height: '100%',
                              borderRadius: '9999px',
                              width: `${Math.min(score.score, 100)}%`,
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 과목별 상세 성적 테이블 */}
                  <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#FF6B00' }}>💬</span>
                      과목별 선생님 코멘트
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {selectedReport.scores.map((s, idx) => (
                        <div key={`${s.subject}-${idx}`} style={{

                          background: '#ffffff',
                          border: '1px solid var(--border)',
                          borderLeft: `4px solid ${getSubjectColor(s.subject)}`,
                          borderRadius: '8px',
                          padding: '16px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{
                              backgroundColor: `${getSubjectColor(s.subject)}20`,
                              color: getSubjectColor(s.subject),
                              padding: '4px 12px',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: 600
                            }}>
                              {s.subject}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, color: getSubjectColor(s.subject) }}>{s.score}점</span>
                            </div>
                          </div>
                          <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                            {s.comment || '코멘트가 없습니다.'}
                          </p>
                          {s.teacherName && (
                            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '8px' }}>
                              - {s.teacherName} 선생님
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 종합 평가 */}
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#FF6B00' }}>📝</span>
                      종합 평가 및 향후 계획
                    </h3>
                    <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: '12px', padding: '20px', lineHeight: '1.8' }}>
                      {selectedReport.totalComment || (
                        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                          종합 평가가 아직 입력되지 않았습니다. 성적 입력 페이지에서 종합 평가를 작성해주세요.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 푸터 */}
                  <div style={{ marginTop: '40px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      와와학습코칭학원 | 상담문의: 053-214-2705
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : selectedStudent && !selectedReport ? (
            <div className="empty-state" style={{ margin: 'auto', padding: '60px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#cbd5e1', marginBottom: '16px' }}>assignment_late</span>
              <div className="empty-state-title">{selectedStudent.name} 학생의 성적이 없습니다</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                먼저 성적 입력 페이지에서 점수를 입력해주세요.
              </p>
              <button className="btn btn-primary" onClick={() => window.location.hash = '#/report/input'}>
                <span className="material-symbols-outlined">edit_note</span>
                성적 입력하기
              </button>
            </div>
          ) : (
            <div className="empty-state" style={{ margin: 'auto' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#cbd5e1', marginBottom: '16px' }}>description</span>
              <div className="empty-state-title">학생을 선택해주세요</div>
              <p style={{ color: 'var(--text-muted)' }}>왼쪽 목록에서 학생을 선택하면 미리보기가 표시됩니다.</p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .report-paper {
          font-family: 'Inter', 'Noto Sans KR', sans-serif;
        }
        .badge-a { background: #dcfce7; color: #166534; }
        .badge-b { background: #dbeafe; color: #1e40af; }
        .badge-c { background: #fef9c3; color: #854d0e; }
        .badge-d { background: #ffedd5; color: #9a3412; }
        .badge-e { background: #fce7f3; color: #9d174d; }
        .badge-f { background: #fee2e2; color: #991b1b; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
    {showShare && selectedReport && selectedStudent && (
      <ShareLinkModal
        report={selectedReport}
        student={selectedStudent}
        onClose={() => setShowShare(false)}
      />
    )}
    </>
  );
}
