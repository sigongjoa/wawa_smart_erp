import { wawaLogoBase64 } from '../../../assets/wawaLogo';
import { getSubjectColor } from '../../../constants/common';
import type { MonthlyReport, Student } from '../../../types';

interface ReportCardProps {
  report: MonthlyReport;
  student: Student;
  currentYearMonth: string;
  historicalReports?: MonthlyReport[];
}

const generateMonthLabels = (currentYearMonth: string): string[] => {
  const [year, month] = currentYearMonth.split('-').map(Number);
  const labels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m <= 0) { m += 12; y -= 1; }
    labels.push(`${m}월`);
  }
  return labels;
};

const getHistoricalScores = (
  subject: string,
  currentYearMonth: string,
  studentId: string,
  historicalReports: MonthlyReport[]
): number[] => {
  const [year, month] = currentYearMonth.split('-').map(Number);
  const scores: number[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m <= 0) { m += 12; y -= 1; }
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    const report = historicalReports.find(r => r.studentId === studentId && r.yearMonth === ym);
    scores.push(report?.scores.find(s => s.subject === subject)?.score ?? 0);
  }
  return scores;
};

const generateChartPoints = (scores: number[]): string => {
  const xStep = 280 / 5;
  return scores.map((score, i) => `${10 + i * xStep},${80 - (score / 100) * 60}`).join(' ');
};

export default function ReportCard({ report, student, currentYearMonth, historicalReports = [] }: ReportCardProps) {
  const [year, month] = currentYearMonth.split('-');
  const monthLabels = generateMonthLabels(currentYearMonth);
  const subjects = Array.from(new Set(report.scores.map(s => s.subject)));

  return (
    <div style={{
      background: 'white',
      width: '800px',
      padding: '40px',
      fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingBottom: '20px', borderBottom: '2px solid #e2e8f0' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
            {student.name} 학생 월별 평가서
          </h1>
          <div style={{ fontSize: '14px', color: '#64748B' }}>
            리포트 기간: {year}년 {parseInt(month)}월
          </div>
        </div>
        <img src={wawaLogoBase64} alt="WAWA" style={{ height: '56px', width: 'auto', borderRadius: '4px' }} />
      </div>

      {/* 성적 변화 추이 차트 */}
      {subjects.length > 0 && historicalReports.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
            <span style={{ color: '#FF6B00' }}>📈</span> 전 과목 성적 변화 추이 (최근 6개월)
          </h3>
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '16px', marginBottom: '16px' }}>
              {subjects.map(subject => (
                <div key={subject} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getSubjectColor(subject) }} />
                  <span style={{ fontSize: '12px', color: '#64748B' }}>{subject}</span>
                </div>
              ))}
            </div>
            <div style={{ position: 'relative', height: '160px', width: '100%' }}>
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                <line x1="0" y1="20" x2="300" y2="20" stroke="#E5E7EB" strokeDasharray="4" />
                <line x1="0" y1="50" x2="300" y2="50" stroke="#E5E7EB" strokeDasharray="4" />
                <line x1="0" y1="80" x2="300" y2="80" stroke="#E5E7EB" strokeDasharray="4" />
                {subjects.map(subject => {
                  const scores = getHistoricalScores(subject, currentYearMonth, student.id, historicalReports);
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

      {/* 성취도 바 */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
          <span style={{ color: '#FF6B00' }}>📊</span> {monthLabels[5]} 주요 과목 학업 성취도
        </h3>
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {report.scores.map((score, idx) => (
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
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 코멘트 */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
          <span style={{ color: '#FF6B00' }}>💬</span> 과목별 선생님 코멘트
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {report.scores.map((s, idx) => (
            <div key={`${s.subject}-${idx}`} style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${getSubjectColor(s.subject)}`,
              borderRadius: '8px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{
                  backgroundColor: `${getSubjectColor(s.subject)}20`,
                  color: getSubjectColor(s.subject),
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>{s.subject}</span>
                <span style={{ fontWeight: 700, color: getSubjectColor(s.subject) }}>{s.score}점</span>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                {s.comment || '코멘트가 없습니다.'}
              </p>
              {s.teacherName && (
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '8px' }}>- {s.teacherName} 선생님</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 종합 평가 */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
          <span style={{ color: '#FF6B00' }}>📝</span> 종합 평가 및 향후 계획
        </h3>
        <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: '12px', padding: '20px', lineHeight: '1.8' }}>
          {report.totalComment || (
            <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>종합 평가가 입력되지 않았습니다.</span>
          )}
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ marginTop: '40px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748B' }}>
          와와학습코칭학원 | 상담문의: 053-214-2705
        </div>
      </div>
    </div>
  );
}
