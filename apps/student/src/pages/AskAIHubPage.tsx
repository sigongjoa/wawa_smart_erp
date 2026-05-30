import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useAuthStore } from '../store';
import { askAI } from '@/lib/askAI/client';
import type { QuotaSummary } from '@/lib/askAI/types';
import './AskAIHubPage.css';

export default function AskAIHubPage() {
  const navigate = useNavigate();
  const auth = useAuthStore((s) => s.auth);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [drillCount, setDrillCount] = useState<number>(0);

  useEffect(() => {
    askAI.quota().then(setQuota).catch(() => {});
    askAI.drillToday().then((r) => setDrillCount(r.cards?.length ?? 0)).catch(() => setDrillCount(0));
  }, []);

  const studentName = auth?.student.name || '학생';
  const initial = studentName ? studentName.slice(-1) : '와';
  const unit = '확통 III-1 · 표본분포';  // TODO: 학생 _meta에서

  const remaining = quota ? quota.questions.limit - quota.questions.used : 30;
  const limit = quota?.questions.limit ?? 30;
  const pctFill = quota ? Math.round((remaining / limit) * 100) : 100;

  return (
    <div className="ah-page">
      <header className="ah-header">
        <div className="ah-greeting">
          <div className="ah-avatar" aria-hidden="true">{initial}</div>
          <div>
            <h1>안녕, <b>{studentName}</b>!</h1>
          </div>
          <button className="ah-bell" aria-label="알림">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </div>
        <div className="ah-unit-strip" role="status">
          <div className="ah-unit-swatch" aria-hidden="true">증</div>
          <div className="ah-unit-info">
            <div className="ah-unit-name">{unit}</div>
          </div>
        </div>
      </header>

      <main className="ah-main">

        <section className="ah-hero" aria-labelledby="ask-heading">
          <h2 id="ask-heading">모르겠는 거,<br /><em>바로 물어봐</em>.</h2>
          <nav className="ah-hero-actions" aria-label="질문 시작 방법">
            <button type="button" onClick={() => navigate('/ask-ai/photo')}>
              <span className="ah-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </span>
              <span className="ah-label">사진으로 묻기</span>
            </button>
            <button type="button" onClick={() => navigate('/ask-ai/write')}>
              <span className="ah-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </span>
              <span className="ah-label">글로 묻기</span>
            </button>
          </nav>
        </section>

        <div className="ah-quota" role="status" aria-label={`오늘 남은 질문 ${remaining} / ${limit} 회`}>
          <span className="label">오늘 남은 질문</span>
          <div className="bar" aria-hidden="true"><i style={{ width: `${pctFill}%` }} /></div>
          <span className="num">{remaining}<small>/{limit}</small></span>
        </div>

        {drillCount > 0 && (
          <>
            <h2 className="ah-section-label">오늘 복습</h2>
            <button
              className="ah-drill-card"
              type="button"
              onClick={() => navigate('/drill')}
              aria-label={`오늘 복습 ${drillCount}장`}
            >
              <div className="ah-drill-left">
                <div className="big">{drillCount}<span className="dim">장</span></div>
                <div className="sub">막혔던 단계 다시</div>
              </div>
              <div className="ah-drill-right">
                <span className="src-tag" style={{ ['--c' as any]: 'var(--type-grass)' }}>AskAI</span>
                <span className="src-tag" style={{ ['--c' as any]: 'var(--type-ground)' }}>시험</span>
                <span className="src-tag" style={{ ['--c' as any]: 'var(--type-electric)' }}>숙제</span>
                <span className="src-tag" style={{ ['--c' as any]: 'var(--type-water)' }}>단원지</span>
              </div>
            </button>
          </>
        )}

        {/* TODO: 이어할 대화 / 강사 코멘트 / 최근 질문 — 백엔드 엔드포인트 추가 후 활성화 */}

        <div className="ah-tip">
          <span className="ah-tip-ico" aria-hidden="true"><Star size={16} fill="currentColor" /></span>
          <div>
            <b>팁.</b> 모르는 문제는 <b>그림부터</b> 그리고 시작하자. AI가 옆에서 한 줄씩 도와준다.
          </div>
        </div>

      </main>
    </div>
  );
}
