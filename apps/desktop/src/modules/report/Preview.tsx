import { useState } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';

export default function Preview() {
  const { students, reports } = useFilteredData();
  const { currentYearMonth } = useReportStore();
  const { addToast } = useToastStore();
  const [selectedReportId, setSelectedReportId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedReport = reports.find(r => r.id === selectedReportId);

  const generatePDF = async () => {
    if (!selectedReport) return;
    setIsGenerating(true);

    const dateStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    const student = students.find(s => s.id === selectedReport.studentId);

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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">리포트 미리보기</h1>
        <p className="page-description">생성된 리포트를 검토하고 PDF로 내보냅니다</p>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', padding: '0' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-light)', position: 'sticky', top: 0, zIndex: 10 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>학생 목록 ({students.length}명)</h3>
          </div>
          {students.map(s => {
            const report = reports.find(r => r.studentId === s.id);
            const isSelected = selectedReportId === report?.id;
            const isPartial = report && report.scores.length > 0 && report.scores.length < s.subjects.length;
            const isComplete = report && report.scores.length >= s.subjects.length;

            return (
              <div
                key={s.id}
                onClick={() => report ? setSelectedReportId(report.id) : null}
                style={{
                  padding: '16px',
                  cursor: report ? 'pointer' : 'default',
                  background: isSelected ? 'var(--primary-light)' : 'transparent',
                  borderBottom: '1px solid var(--border-light)',
                  opacity: report ? 1 : 0.6,
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
          {selectedReport ? (
            <>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{selectedReport.studentName} 리포트 미리보기</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={() => window.print()}>
                    <span className="material-symbols-outlined">print</span>인쇄
                  </button>
                  <button className="btn btn-primary" onClick={generatePDF} disabled={isGenerating}>
                    <span className="material-symbols-outlined">{isGenerating ? 'hourglass_top' : 'picture_as_pdf'}</span>
                    {isGenerating ? '생성 중...' : 'PDF 다운로드 (Typst)'}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, padding: '40px', background: '#f1f5f9', overflowY: 'auto' }}>
                <div className="report-paper" style={{
                  background: 'white',
                  width: '100%',
                  maxWidth: '800px',
                  margin: '0 auto',
                  padding: '60px 50px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  minHeight: '1000px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>월간 학습 성과 리포트</h1>
                    <div style={{ fontSize: '18px', color: 'var(--text-muted)' }}>{currentYearMonth} 학습 리포트</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '50px', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', marginBottom: '10px' }}>
                        <span style={{ width: '80px', color: 'var(--text-muted)' }}>학생성명</span>
                        <span style={{ fontWeight: 700 }}>{selectedReport.studentName}</span>
                      </div>
                      <div style={{ display: 'flex' }}>
                        <span style={{ width: '80px', color: 'var(--text-muted)' }}>학년</span>
                        <span style={{ fontWeight: 700 }}>{students.find(s => s.id === selectedReport.studentId)?.grade || '-'}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                        <span style={{ width: '100px', color: 'var(--text-muted)', textAlign: 'left' }}>리포트 발행일</span>
                        <span style={{ fontWeight: 700 }}>{new Date().toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ width: '100px', color: 'var(--text-muted)', textAlign: 'left' }}>학원명</span>
                        <span style={{ fontWeight: 700 }}>WAWA 수학학원</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>monitoring</span>
                      과목별 상세 성적
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ padding: '12px 15px', textAlign: 'left', border: '1px solid #e2e8f0', width: '20%' }}>과목</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center', border: '1px solid #e2e8f0', width: '15%' }}>점수</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center', border: '1px solid #e2e8f0', width: '15%' }}>난이도</th>
                          <th style={{ padding: '12px 15px', textAlign: 'left', border: '1px solid #e2e8f0' }}>강사 의견</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReport.scores.map(s => (
                          <tr key={s.subject}>
                            <td style={{ padding: '12px 15px', border: '1px solid #e2e8f0', fontWeight: 600 }}>{s.subject}</td>
                            <td style={{ padding: '12px 15px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{s.score}점</td>
                            <td style={{ padding: '12px 15px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                              <span className={`badge badge-${(s.difficulty || 'C').toLowerCase()}`} style={{ minWidth: '30px' }}>{s.difficulty || 'C'}</span>
                            </td>
                            <td style={{ padding: '12px 15px', border: '1px solid #e2e8f0', fontSize: '13px', lineHeight: '1.5' }}>{s.comment}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>edit_note</span>
                      종합 평가 및 향후 계획
                    </h3>
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '24px', lineHeight: '1.8', minHeight: '150px' }}>
                      {selectedReport.totalComment || '이번 달 성적과 학습 태도를 바탕으로 개별 맞춤 클리닉을 진행할 예정입니다. 특히 부족한 단원에 대한 심화 학습과 오답 노트를 통한 꼼꼼한 피드백에 집중하겠습니다.'}
                    </div>
                  </div>

                  <div style={{ marginTop: '100px', textAlign: 'center', paddingTop: '40px', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '20px', fontWeight: 800 }}>WAWA 수학학원 원장 귀하</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ margin: 'auto' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#cbd5e1', marginBottom: '16px' }}>description</span>
              <div className="empty-state-title">리포트를 선택해주세요</div>
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
      `}</style>
    </div>
  );
}
