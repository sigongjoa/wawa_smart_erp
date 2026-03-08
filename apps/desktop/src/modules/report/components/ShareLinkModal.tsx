import { useState, useEffect, useRef } from 'react';
import type { MonthlyReport, Student } from '../../../types';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { useToastStore } from '../../../stores/toastStore';
import { useReportStore } from '../../../stores/reportStore';
import ReportCard from './ReportCard';

interface ShareLinkModalProps {
  report: MonthlyReport;
  student: Student;
  onClose: () => void;
}

function buildTemplate(student: Student, report: MonthlyReport, url: string): string {
  const [year, month] = report.yearMonth.split('-');
  const scoreLines = report.scores.map(s => `• ${s.subject}: ${s.score}점`).join('\n');
  const avg = report.scores.length > 0
    ? Math.round(report.scores.reduce((sum, s) => sum + s.score, 0) / report.scores.length)
    : 0;

  return [
    `[와와학원] ${year}년 ${parseInt(month)}월 월말평가 결과`,
    ``,
    `안녕하세요 😊`,
    `${student.name} 학생의 이번 달 평가 결과를 안내드립니다.`,
    ``,
    `📚 과목별 성적`,
    scoreLines,
    ``,
    `📊 평균: ${avg}점`,
    report.totalComment ? `\n💬 총평\n${report.totalComment}` : '',
    ``,
    `📎 리포트 이미지`,
    url,
  ].join('\n').trim();
}

export default function ShareLinkModal({ report, student, onClose }: ShareLinkModalProps) {
  const { addToast } = useToastStore();
  const { currentYearMonth, reports } = useReportStore();
  const cardRef = useRef<HTMLDivElement>(null);

  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'capturing' | 'uploading' | 'done' | 'error'>('capturing');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const template = imageUrl ? buildTemplate(student, report, imageUrl) : '';

  useEffect(() => {
    // DOM 렌더링 후 캡처
    const timer = setTimeout(async () => {
      try {
        if (!cardRef.current) throw new Error('카드 렌더링 실패');

        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(cardRef.current, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
        });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

        setStatus('uploading');
        const url = await uploadToCloudinary(dataUrl);
        setImageUrl(url);
        setStatus('done');
      } catch (e: any) {
        setErrorMsg(e.message || '오류 발생');
        setStatus('error');
      }
    }, 300); // 300ms: DOM이 완전히 렌더링되길 기다림

    return () => clearTimeout(timer);
  }, []);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      addToast('복사 완료! 카카오톡에 붙여넣기 하세요.', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast('복사 실패. 직접 선택해서 복사해주세요.', 'error');
    }
  };

  const copyUrlOnly = async () => {
    await navigator.clipboard.writeText(imageUrl);
    addToast('이미지 URL 복사됐습니다.', 'success');
  };

  return (
    <>
      {/* 오프스크린 리포트 카드 (캡처용) */}
      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', zIndex: -1 }}>
        <div ref={cardRef}>
          <ReportCard
            report={report}
            student={student}
            currentYearMonth={currentYearMonth}
            historicalReports={reports}
          />
        </div>
      </div>

      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content"
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '520px', width: '100%' }}
        >
          <div className="modal-header">
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📎</span>
              링크 공유 — {student.name}
            </h3>
            <button className="modal-close" onClick={onClose}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {status === 'capturing' && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📸</div>
                <p>리포트 이미지 캡처 중...</p>
              </div>
            )}

            {status === 'uploading' && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>☁️</div>
                <p>Cloudinary 업로드 중...</p>
              </div>
            )}

            {status === 'error' && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--danger)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
                <p>{errorMsg}</p>
              </div>
            )}

            {status === 'done' && (
              <>
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={imageUrl}
                    alt="리포트"
                    style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    카카오톡 전송 템플릿
                  </p>
                  <textarea
                    readOnly
                    rows={11}
                    value={template}
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      background: '#fffde7',
                      border: '1px solid #f9a825',
                      borderRadius: '8px',
                      padding: '10px',
                      resize: 'none',
                      boxSizing: 'border-box',
                      lineHeight: 1.6,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    readOnly
                    value={imageUrl}
                    style={{
                      flex: 1,
                      fontSize: '12px',
                      padding: '6px 10px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  />
                  <button className="btn btn-secondary btn-sm" onClick={copyUrlOnly}>URL만</button>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>닫기</button>
            {status === 'done' && (
              <button
                className="btn btn-primary"
                onClick={copyAll}
                style={{ background: '#FEE500', color: '#3C1E1E', fontWeight: 700 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>content_copy</span>
                {copied ? '✅ 복사됨!' : '전체 복사 → 카카오톡 붙여넣기'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
