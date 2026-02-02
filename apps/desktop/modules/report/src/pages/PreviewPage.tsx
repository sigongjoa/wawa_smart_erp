import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { downloadReportAsPdf } from '../services/pdf';
import { uploadReportToCloudinary, getCloudinaryConfig } from '../services/cloudinary';
import { useState } from 'react';
import type { SubjectScore } from '../types';

// 과목별 색상 정의
const SUBJECT_COLORS: Record<string, string> = {
  '국어': '#FF6B00',
  '영어': '#3B82F6',
  '수학': '#10B981',
  '과학': '#8B5CF6',
  '사회': '#EC4899',
  '역사': '#F59E0B',
};

const getSubjectColor = (subject: string): string => {
  return SUBJECT_COLORS[subject] || '#6B7280';
};

// 최근 6개월 데이터 생성 (더미 또는 실제 데이터)
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

export default function PreviewPage() {
  const navigate = useNavigate();
  const { currentReport, currentUser, appSettings, currentYearMonth, reports, updateReportPdfUrl } = useReportStore();
  const [downloading, setDownloading] = useState(false);

  if (!currentReport) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>미리볼 리포트가 없습니다.</p>
          <button
            onClick={() => navigate(-1)}
            style={{ padding: '10px 20px', backgroundColor: '#FF6B00', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const monthLabels = generateMonthLabels(currentYearMonth);

  // 과목별 6개월 점수 데이터 (현재 리포트 + 이전 리포트들에서 추출)
  const getHistoricalScores = (subject: string): number[] => {
    const studentReports = reports.filter(r => r.studentId === currentReport.studentId);
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
    const xStep = 280 / 5; // 6개 포인트, 5개 간격
    scores.forEach((score, index) => {
      const x = 10 + index * xStep;
      const y = 80 - (score / 100) * 60; // y축 반전 (0-100 -> 80-20)
      points.push(`${x},${y}`);
    });
    return points.join(' ');
  };

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const handleDownload = async () => {
    setDownloading(true);
    setUploadStatus('idle');

    try {
      // 1. PDF 다운로드
      await downloadReportAsPdf('report-content', `${currentReport.studentName}_${currentReport.yearMonth}_리포트.pdf`);

      // 2. Cloudinary 설정이 있으면 자동 업로드
      const cloudinaryConfig = getCloudinaryConfig();
      if (cloudinaryConfig.cloudName && cloudinaryConfig.apiKey && cloudinaryConfig.apiSecret) {
        setUploadStatus('uploading');
        const result = await uploadReportToCloudinary(
          'report-content',
          currentReport.studentName,
          currentReport.yearMonth
        );

        if (result.success && result.url) {
          setUploadStatus('success');
          // Store에 PDF URL 저장
          updateReportPdfUrl(currentReport.id, result.url);
          console.log('[Cloudinary] 업로드 완료:', result.url);
        } else {
          setUploadStatus('error');
          console.error('[Cloudinary] 업로드 실패:', result.error);
        }
      }
    } catch (error) {
      console.error('PDF download error:', error);
      alert('PDF 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  const goBack = () => {
    if (currentUser?.teacher.isAdmin) {
      navigate('/admin');
    } else {
      navigate('/teacher');
    }
  };

  // 고유 과목 목록
  const subjects = currentReport.scores.map(s => s.subject);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8F9FA', padding: '24px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {/* 액션 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <button
            onClick={goBack}
            style={{ padding: '10px 20px', backgroundColor: '#ffffff', color: '#374151', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: '500' }}
          >
            돌아가기
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {uploadStatus === 'success' && (
              <span style={{ color: '#16a34a', fontSize: '13px' }}>업로드 완료</span>
            )}
            {uploadStatus === 'error' && (
              <span style={{ color: '#dc2626', fontSize: '13px' }}>업로드 실패</span>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading || uploadStatus === 'uploading'}
              style={{
                padding: '10px 20px',
                backgroundColor: downloading || uploadStatus === 'uploading' ? '#FEB273' : '#FF6B00',
                color: '#ffffff',
                borderRadius: '8px',
                border: 'none',
                cursor: downloading || uploadStatus === 'uploading' ? 'not-allowed' : 'pointer',
                fontWeight: '600',
              }}
            >
              {downloading ? 'PDF 생성 중...' : uploadStatus === 'uploading' ? '업로드 중...' : 'PDF 다운로드'}
            </button>
          </div>
        </div>

        {/* 리포트 내용 - 모바일 스타일 */}
        <div
          id="report-content"
          style={{
            backgroundColor: '#F8F9FA',
            fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
            maxWidth: '448px',
            margin: '0 auto',
          }}
        >
          {/* 헤더 */}
          <header style={{
            backgroundColor: '#ffffff',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid #E5E7EB',
          }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.025em', margin: 0, color: '#0F172A' }}>
                {currentReport.studentName} 학생 월별 평가서
              </h1>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                리포트 기간: {currentYearMonth.replace('-', '년 ')}월
              </p>
            </div>
            <div style={{
              backgroundColor: '#FF6B00',
              borderRadius: '8px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ color: '#ffffff', fontWeight: '900', fontSize: '12px', lineHeight: '1', textAlign: 'center' }}>
                {appSettings.academyName ? (
                  <span style={{ fontSize: '10px' }}>{appSettings.academyName}</span>
                ) : (
                  <>
                    WAWA<br />
                    <span style={{ fontSize: '8px', fontWeight: 'normal', opacity: 0.9 }}>COACHING CENTER</span>
                  </>
                )}
              </div>
            </div>
          </header>

          <main style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 전 과목 성적 변화 추이 */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ color: '#FF6B00', fontSize: '20px' }}>📈</span>
                <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#0F172A' }}>전 과목 성적 변화 추이 (최근 6개월)</h2>
              </div>
              <div style={{
                backgroundColor: '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
              }}>
                {/* 범례 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px' }}>
                  {subjects.map((subject) => (
                    <div key={subject} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getSubjectColor(subject) }} />
                      <span style={{ fontSize: '10px', color: '#64748B' }}>{subject}</span>
                    </div>
                  ))}
                </div>
                {/* 차트 */}
                <div style={{ position: 'relative', height: '160px', width: '100%' }}>
                  <svg viewBox="0 0 300 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                    {/* 그리드 라인 */}
                    <line x1="0" y1="20" x2="300" y2="20" stroke="#E5E7EB" strokeDasharray="4" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#E5E7EB" strokeDasharray="4" />
                    <line x1="0" y1="80" x2="300" y2="80" stroke="#E5E7EB" strokeDasharray="4" />

                    {/* 과목별 라인 */}
                    {subjects.map((subject) => {
                      const scores = getHistoricalScores(subject);
                      const points = generateChartPoints(scores);
                      const lastScore = scores[scores.length - 1];
                      const lastX = 10 + 5 * (280 / 5);
                      const lastY = 80 - (lastScore / 100) * 60;
                      return (
                        <g key={subject}>
                          <polyline
                            fill="none"
                            stroke={getSubjectColor(subject)}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={points}
                          />
                          <circle cx={lastX} cy={lastY} r="3" fill={getSubjectColor(subject)} />
                        </g>
                      );
                    })}
                  </svg>
                  {/* X축 레이블 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', padding: '0 4px' }}>
                    {monthLabels.map((label, i) => (
                      <span key={i} style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: '500' }}>{label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 이번 달 학업 성취도 */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ color: '#FF6B00', fontSize: '20px' }}>📊</span>
                <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#0F172A' }}>{monthLabels[5]} 주요 과목 학업 성취도</h2>
              </div>
              <div style={{
                backgroundColor: '#ffffff',
                padding: '20px',
                borderRadius: '16px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}>
                {currentReport.scores.map((score) => (
                  <div key={score.subject} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>{score.subject}</span>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: getSubjectColor(score.subject) }}>{score.score}점</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: '#F1F5F9', height: '20px', borderRadius: '9999px', overflow: 'hidden' }}>
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
                {/* 점수 눈금 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9CA3AF', fontWeight: '500', padding: '0 4px' }}>
                  <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
                </div>
              </div>
            </section>

            {/* 과목별 선생님 코멘트 */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: '#FF6B00', fontSize: '20px' }}>💬</span>
                <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#0F172A' }}>과목별 선생님 개별 코멘트</h2>
              </div>

              {currentReport.scores.map((score: SubjectScore) => (
                <div
                  key={score.subject}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                    overflow: 'hidden',
                    borderLeft: `4px solid ${getSubjectColor(score.subject)}`,
                  }}
                >
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{
                        backgroundColor: `${getSubjectColor(score.subject)}15`,
                        color: getSubjectColor(score.subject),
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}>
                        {score.subject}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748B' }}>
                        점수: <span style={{ color: '#0F172A', fontWeight: 'bold' }}>{score.score}점</span>
                      </span>
                    </div>
                    <div style={{
                      backgroundColor: '#F8FAFC',
                      padding: '12px',
                      borderRadius: '12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ color: getSubjectColor(score.subject), fontSize: '14px' }}>💭</span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: getSubjectColor(score.subject),
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          {score.teacherName || '담당'} 선생님 코멘트
                        </span>
                      </div>
                      <p style={{
                        fontSize: '11px',
                        lineHeight: '1.6',
                        color: '#475569',
                        margin: 0,
                      }}>
                        {score.comment || '코멘트가 없습니다.'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* 종합 코멘트 (있는 경우) */}
            {currentReport.totalComment && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ color: '#FF6B00', fontSize: '20px' }}>📝</span>
                  <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#0F172A' }}>종합 코멘트</h2>
                </div>
                <div style={{
                  backgroundColor: '#FFF7ED',
                  borderRadius: '16px',
                  padding: '16px',
                  borderLeft: '4px solid #FF6B00',
                }}>
                  <p style={{ fontSize: '12px', lineHeight: '1.7', color: '#374151', margin: 0 }}>
                    {currentReport.totalComment}
                  </p>
                </div>
              </section>
            )}
          </main>

          {/* 푸터 */}
          <footer style={{
            backgroundColor: '#FF6B00',
            padding: '16px',
            textAlign: 'center',
          }}>
            <p style={{
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 'bold',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}>
              {appSettings.academyName || '와와학습코칭학원'}
              <span style={{ opacity: 0.4 }}>|</span>
              상담문의: 053-214-2705
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
