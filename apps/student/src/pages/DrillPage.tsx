import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { Sparkle, PencilSimple, Diamond, X as XIcon, SmileyWink, Smiley, SmileyNervous, SmileyBlank, Plant, Confetti, type Icon } from '@phosphor-icons/react';
import { askAI } from '@/lib/askAI/client';
import type { Rating } from '@/lib/askAI/types';
import './DrillPage.css';

interface DrillCard {
  id: string;
  source: 'askai_failed_checkpoint' | 'exam_wrong' | 'homework_deduction' | 'unit_xmark';
  source_ref: string;
  unit: string;
  problem_md: string;
  answer_md: string;
  context_note?: string;
  ai_cite?: string;
  created_at: string;
}

const SOURCE_LABEL: Record<DrillCard['source'], { label: string; type: 'grass' | 'ground' | 'electric' | 'water'; Ico: Icon }> = {
  askai_failed_checkpoint: { label: 'AskAI 막힌 단계', type: 'grass', Ico: Sparkle },
  exam_wrong:              { label: '시험 오답',       type: 'ground', Ico: PencilSimple },
  homework_deduction:      { label: '숙제 감점',       type: 'electric', Ico: Diamond },
  unit_xmark:              { label: '단원지 X',        type: 'water', Ico: XIcon },
};

const RATE_LABELS: Record<Rating, { Face: Icon; label: string; next: string; cls: string }> = {
  easy:  { Face: SmileyWink,    label: '쉬움',   next: '7일 후',  cls: 'easy' },
  ok:    { Face: Smiley,        label: '적당',   next: '3일 후',  cls: 'ok' },
  hard:  { Face: SmileyNervous, label: '어려움', next: '1일 후',  cls: 'hard' },
  dunno: { Face: SmileyBlank,   label: '모름',   next: '→ 다시 배우기', cls: 'dunno' },
};

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000 / 60 / 60 / 24;
  if (d < 1) return '오늘';
  if (d < 2) return '어제';
  return `${Math.floor(d)}일 전`;
}

export default function DrillPage() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<DrillCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState(false);

  useEffect(() => {
    askAI.drillToday()
      .then((res) => {
        setCards((res.cards as DrillCard[]) ?? []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || '카드를 가져오지 못했어요');
        setLoading(false);
      });
  }, []);

  const total = cards.length;
  const card = cards[currentIdx];

  const showAnswer = useCallback(() => setRevealed(true), []);

  const rate = useCallback(async (level: Rating) => {
    if (!card || rating) return;
    setRating(true);
    try {
      await askAI.drillRate(card.id, level);
      // 모름 → AskAI 재진입 (UC-14)
      if (level === 'dunno') {
        sessionStorage.setItem('askai-prefill', card.problem_md);
        navigate('/ask-ai');
        return;
      }
      // 다음 카드로
      if (currentIdx + 1 < total) {
        setCurrentIdx(currentIdx + 1);
        setRevealed(false);
      } else {
        // 다 끝
        setCurrentIdx(total); // = total → done state
      }
    } catch (e: any) {
      setError(e.message || '평가 저장 실패');
    } finally {
      setRating(false);
    }
  }, [card, rating, currentIdx, total, navigate]);

  // 키보드 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || rating) return;
      if (e.key === ' ' && !revealed) { e.preventDefault(); showAnswer(); }
      if (revealed) {
        if (e.key === '1') rate('easy');
        if (e.key === '2') rate('ok');
        if (e.key === '3') rate('hard');
        if (e.key === '4') rate('dunno');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, rating, revealed, showAnswer, rate]);

  const progressDots = Array.from({ length: total || 5 }, (_, i) => {
    const state = i < currentIdx ? 'done' : i === currentIdx ? 'now' : 'todo';
    return state;
  });

  return (
    <div className="dr-page">
      <header className="dr-header">
        <button className="dr-icon-btn" onClick={() => navigate(-1)} aria-label="뒤로">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1>오늘 복습 <span className="num">{Math.min(currentIdx + 1, total)} / {total || 0}</span></h1>
        <div className="dr-icon-btn" aria-hidden="true" />
        {total > 0 && (
          <div className="dr-progress" role="progressbar" aria-valuenow={currentIdx + 1} aria-valuemax={total}>
            {progressDots.map((s, i) => (
              <i key={i} className={s} />
            ))}
          </div>
        )}
      </header>

      {!loading && total > 0 && (
        <div className="dr-streak" role="status">
          <span className="flame" aria-hidden="true"><Flame size={16} /></span>
          <span>오늘 복습 시작</span>
          <span className="dim">남은 {Math.max(0, total - currentIdx)}장</span>
        </div>
      )}

      <main className="dr-main" id="drill-main">
        {loading && <div className="dr-loading">불러오는 중…</div>}

        {error && <div className="dr-error" role="alert">{error}</div>}

        {!loading && !error && total === 0 && (
          <div className="dr-empty">
            <div className="emoji" aria-hidden="true"><Plant size={48} weight="duotone" /></div>
            <h2>오늘 복습할 카드가 없어요</h2>
            <p>AskAI에서 막혔던 단계, 시험 오답, 숙제 감점이<br/>자동으로 카드가 됩니다. 내일 또 보자!</p>
            <button className="dr-empty-cta" onClick={() => navigate('/ask-ai')}>
              지금 묻기 →
            </button>
          </div>
        )}

        {!loading && !error && currentIdx >= total && total > 0 && (
          <div className="dr-done">
            <div className="emoji" aria-hidden="true"><Confetti size={48} weight="duotone" /></div>
            <h2>오늘 복습 끝!</h2>
            <p>{total}장 모두 마쳤어요. 내일 또 만나자.</p>
            <button className="dr-empty-cta" onClick={() => navigate('/')}>
              홈으로 →
            </button>
          </div>
        )}

        {!loading && card && currentIdx < total && (
          <div className="dr-card-wrap">
            <article
              className="dr-card"
              data-source={card.source}
              data-type={SOURCE_LABEL[card.source].type}
              aria-labelledby="drill-problem"
            >
              <header className="dr-source">
                <span className="ico" aria-hidden="true">{(() => { const I = SOURCE_LABEL[card.source].Ico; return <I size={14} weight="fill" />; })()}</span>
                {SOURCE_LABEL[card.source].label}
                <span className="when">{timeAgo(card.created_at)}</span>
              </header>
              <div className="dr-unit">{card.unit}</div>

              {card.context_note && (
                <div className="dr-note">{card.context_note}</div>
              )}

              <div className="dr-problem" id="drill-problem">
                {card.problem_md.split('\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {!revealed ? (
                <button className="dr-reveal" onClick={showAnswer}>
                  답 보기 <kbd>Space</kbd>
                </button>
              ) : (
                <section className="dr-answer">
                  <div className="dr-answer-label">정답 풀이</div>
                  {card.answer_md.split('\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                  {card.ai_cite && (
                    <div className="dr-ai-cite">
                      <span className="src">AskAI · {timeAgo(card.created_at)}</span>
                      {card.ai_cite}
                    </div>
                  )}
                </section>
              )}
            </article>
          </div>
        )}
      </main>

      {!loading && card && currentIdx < total && revealed && (
        <footer className="dr-rate" role="region" aria-label="자가평가">
          <div className="q">얼마나 잘 풀었어?</div>
          <div className="row">
            {(Object.keys(RATE_LABELS) as Rating[]).map((level) => {
              const r = RATE_LABELS[level];
              const Face = r.Face;
              return (
                <button
                  key={level}
                  className={`dr-rate-btn ${r.cls}`}
                  onClick={() => rate(level)}
                  disabled={rating}
                  aria-label={`${r.label} — ${r.next}`}
                >
                  <span className="face" aria-hidden="true"><Face size={28} weight="duotone" /></span>
                  <span className="label">{r.label}</span>
                  <span className="next">{r.next}</span>
                </button>
              );
            })}
          </div>
        </footer>
      )}
    </div>
  );
}
