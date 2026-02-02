import { useState, useEffect } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';

// 과목별 색상 정의
const SUBJECT_COLORS: Record<string, string> = {
  '국어': '#FF6B00',
  '영어': '#3B82F6',
  '수학': '#10B981',
  '과학': '#8B5CF6',
  '사회': '#EC4899',
  '역사': '#F59E0B',
  '물리': '#06B6D4',
  '화학': '#84CC16',
  '생물': '#22C55E',
  '지구과학': '#6366F1',
};

const getSubjectColor = (subject: string): string => {
  return SUBJECT_COLORS[subject] || '#6B7280';
};

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

export default function Preview() {
  const { students, reports } = useFilteredData();
  const { currentYearMonth, fetchAllData, isLoading, appSettings, currentUser } = useReportStore();
  const { addToast } = useToastStore();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // AppShell에서 이미 fetchAllData 호출하므로 여기서는 중복 호출하지 않음
  // 디버깅 로그
  useEffect(() => {
    console.log('[Preview] State:', {
      studentsCount: students.length,
      reportsCount: reports.length,
      currentYearMonth,
      hasApiKey: !!appSettings.notionApiKey,
      hasScoresDb: !!appSettings.notionScoresDb,
      isLoggedIn: !!currentUser,
      isLoading,
    });
  }, [students, reports, currentYearMonth, appSettings, currentUser, isLoading]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const selectedReport = reports.find(r => r.studentId === selectedStudentId);

  const monthLabels = generateMonthLabels(currentYearMonth);

  // 과목별 6개월 점수 데이터
  const getHistoricalScores = (subject: string): number[] => {
    if (!selectedStudentId) return [0, 0, 0, 0, 0, 0];
    const studentReports = reports.filter(r => r.studentId === selectedStudentId);
    const scores: number[] = [];

    const [year, month] = currentYearMonth.split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      const report = studentReports.find(r => r.yearMonth === ym);
      const score = report?.scores.find(s => s.subject === subject)?.score;
      scores.push(score ?? 0);
    }
    return scores;
  };

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

  const generatePDF = async () => {
    if (!selectedReport || !selectedStudent) return;
    setIsGenerating(true);

    const dateStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    const student = selectedStudent;

    const source = `
#set page(paper: "a4", margin: (x: 2cm, y: 2.5cm))
#set text(font: "Noto Sans KR", size: 10pt)
#set heading(numbering: "1.")

#align(center)[
  #text(size: 24pt, weight: "bold")[월간 학습 성과 리포트]
  #v(5mm)
  #text(size: 14pt)[${currentYearMonth}]
]

#v(1cm)

#grid(
  columns: (1fr, 1fr),
  gutter: 1cm,
  [
    #set text(weight: "bold")
    학생명: ${selectedReport.studentName} \
    학년: ${student?.grade || '-'} \
  ],
  [
    #set text(weight: "bold")
    성적 산출일: ${dateStr} \
    교육기관: WAWA 수학학원 \
  ]
)

#v(1cm)

== 과목별 상세 성적

#table(
  columns: (1fr, 60pt, 60pt, 2fr),
  inset: 10pt,
  align: (left, center, center, left),
  fill: (x, y) => if y == 0 { gray.lighten(80%) } else { white },
  [*과목*], [*점수*], [*난이도*], [*강사 의견*],
  ${selectedReport.scores.map(s => `[${s.subject}], [${s.score}점], [${s.difficulty || 'C'}], [${s.comment || '-'}]`).join(',\n  ')}
)

#v(1cm)

== 종합 평가 및 향후 계획

#rect(
  width: 100%,
  inset: 15pt,
  stroke: 0.5pt + gray,
  radius: 4pt,
  [
    ${selectedReport.totalComment || '이번 달은 전반적으로 성실하게 학습에 임하였습니다. 오답 분석을 통해 부족한 부분을 보완하고 다음 단계로 넘어갈 예정입니다.'}
  ]
)

#v(auto)
#align(right)[
  #text(size: 12pt, weight: "bold")[WAWA 수학학원 원장 귀하]
]
    `;

    const outputPath = `/tmp/report_${selectedReport.studentName}_${currentYearMonth}.pdf`;
    const result = await window.wawaAPI.typstCompile({ source, outputPath });

    setIsGenerating(false);
    if (result.success) {
      addToast(`PDF가 생성되었습니다: ${result.outputPath}`, 'success');
    } else {
      addToast(`성공하지 못했습니다: ${result.message}`, 'error');
    }
  };

  // 고유 과목 목록
  const subjects = Array.from(new Set(selectedReport?.scores.map(s => s.subject) || []));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">리포트 미리보기</h1>
            <p className="page-description">생성된 리포트를 검토하고 PDF로 내보냅니다 ({currentYearMonth})</p>
          </div>
          <button className="btn btn-secondary" onClick={() => fetchAllData()} disabled={isLoading}>
            <span className={`material-symbols-outlined ${isLoading ? 'spin' : ''}`}>refresh</span>
            새로고침
          </button>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', padding: '0' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-light)', position: 'sticky', top: 0, zIndex: 10 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>학생 목록 ({students.length}명)</h3>
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
                {!appSettings.notionApiKey ? 'Notion API 키를 설정해주세요' :
                  !appSettings.notionStudentsDb ? '학생 DB ID를 설정해주세요' :
                    '설정을 확인하거나 새로고침을 시도해주세요'}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => window.location.hash = '#/report/settings'}>
                설정으로 이동
              </button>
            </div>
          ) : students.map(s => {
            const report = reports.find(r => r.studentId === s.id);
            const isSelected = selectedStudentId === s.id;
            const isPartial = report && report.scores.length > 0 && report.scores.length < s.subjects.length;
            const isComplete = report && report.scores.length >= s.subjects.length;

            return (
              <div
                key={s.id}
                onClick={() => setSelectedStudentId(s.id)}
                style={{
                  padding: '16px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--primary-light)' : 'transparent',
                  borderBottom: '1px solid var(--border-light)',
                  transition: 'all 0.2s',
                  borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent'
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
                  <button className="btn btn-primary" onClick={generatePDF} disabled={isGenerating}>
                    <span className="material-symbols-outlined">{isGenerating ? 'hourglass_top' : 'picture_as_pdf'}</span>
                    {isGenerating ? '생성 중...' : 'PDF 다운로드'}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, padding: '40px', background: '#f1f5f9', overflowY: 'auto' }}>
                <div className="report-paper" style={{
                  background: 'white',
                  width: '100%',
                  maxWidth: '800px',
                  margin: '0 auto',
                  padding: '40px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  borderRadius: '12px'
                }}>
                  {/* 헤더 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingBottom: '20px', borderBottom: '2px solid #e2e8f0' }}>
                    <div>
                      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
                        {selectedStudent.name} 학생 월별 평가서
                      </h1>
                      <div style={{ fontSize: '14px', color: '#64748B' }}>
                        리포트 기간: {currentYearMonth.replace('-', '년 ')}월
                      </div>
                    </div>
                    <div style={{
                      backgroundColor: '#FF6B00',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '14px'
                    }}>
                      {appSettings.academyName || 'WAWA 학원'}
                    </div>
                  </div>

                  {/* 성적 변화 추이 차트 */}
                  {subjects.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#FF6B00' }}>📈</span>
                        전 과목 성적 변화 추이 (최근 6개월)
                      </h3>
                      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
                        {/* 범례 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '16px', marginBottom: '16px' }}>
                          {subjects.map((subject) => (
                            <div key={subject} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getSubjectColor(subject) }} />
                              <span style={{ fontSize: '12px', color: '#64748B' }}>{subject}</span>
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
                    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {selectedReport.scores.map((score, idx) => (
                        <div key={`${score.subject}-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{score.subject}</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: getSubjectColor(score.subject) }}>{score.score}점</span>
                          </div>
                          <div style={{ width: '100%', backgroundColor: '#E2E8F0', height: '12px', borderRadius: '9999px', overflow: 'hidden' }}>
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
                          border: '1px solid #e2e8f0',
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
                              <span className={`badge badge-${(s.difficulty || 'C').toLowerCase()}`}>{s.difficulty || 'C'}</span>
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
                    <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: '12px', padding: '20px', lineHeight: '1.8' }}>
                      {selectedReport.totalComment || (
                        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                          종합 평가가 아직 입력되지 않았습니다. 성적 입력 페이지에서 종합 평가를 작성해주세요.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 푸터 */}
                  <div style={{ marginTop: '40px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748B' }}>
                      {appSettings.academyName || 'WAWA 학원'} | {new Date().toLocaleDateString()}
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
  );
}
