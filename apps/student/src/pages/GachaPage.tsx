import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Card, getCardImageUrl } from '../api';
import KaTeX from '../components/KaTeX';
import './GachaPage.css';

type Phase = 'loading' | 'question' | 'answer' | 'feedback' | 'done';
type HistoryMark = 'correct' | 'wrong' | null;

const TOTAL = 10;

export default function GachaPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [card, setCard] = useState<Card | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState<{ box_before: number; box_after: number } | null>(null);
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState<HistoryMark[]>([]);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null);
  const flashTimer = useRef<number | null>(null);

  const loadCard = useCallback(async () => {
    setPhase('loading');
    setUserAnswer('');
    setError('');
    setFlash(null);
    try {
      const c = await api.getRandomCard();
      setCard(c);
      setPhase('question');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('카드가 없습니다')) {
        setPhase('done');
      } else {
        setError(msg);
        setPhase('done');
      }
    }
  }, []);

  useEffect(() => { loadCard(); }, [loadCard]);
  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  const handleShowAnswer = () => {
    setPhase('answer');
  };

  const handleSubmitAnswer = () => {
    if (!card) return;
    const correct = checkAnswer(userAnswer.trim(), card.answer);
    setIsCorrect(correct);
    // 220ms 색 플래시 → 이후 feedback 단계 전환
    setFlash(correct ? 'correct' : 'wrong');
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      submitFeedback(correct);
    }, 220);
  };

  const submitFeedback = async (correct: boolean) => {
    if (!card) return;
    try {
      const result = await api.submitCardFeedback(card.id, correct ? 'success' : 'fail');
      setFeedback({ box_before: result.box_before, box_after: result.box_after });
      setCount((c) => c + 1);
      setHistory((h) => [...h, correct ? 'correct' : 'wrong']);
      setPhase('feedback');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleNext = () => {
    if (count >= TOTAL) {
      setPhase('done');
    } else {
      loadCard();
    }
  };

  const progressCells = useMemo(() => {
    const cells: Array<'done' | 'correct' | 'wrong' | 'current' | 'idle'> = [];
    for (let i = 0; i < TOTAL; i++) {
      if (i < history.length) {
        cells.push(history[i] === 'correct' ? 'correct' : 'wrong');
      } else if (i === history.length && phase !== 'done') {
        cells.push('current');
      } else {
        cells.push('idle');
      }
    }
    return cells;
  }, [history, phase]);

  const correctCount = history.filter((h) => h === 'correct').length;

  return (
    <div className="gp">
      <header className="gp-head">
        <button type="button" className="gp-back" onClick={() => navigate('/')}>
          <span className="gp-back-arrow" aria-hidden="true">←</span>
          HOME
        </button>
        <div className="gp-progress" role="progressbar" aria-valuenow={count} aria-valuemax={TOTAL}>
          {progressCells.map((s, i) => (
            <span key={i} className="gp-progress-cell" data-state={s === 'idle' ? undefined : s} />
          ))}
        </div>
        <span className="gp-score">{count}/{TOTAL}</span>
      </header>

      {phase === 'loading' && (
        <div className="gp-loading">LOADING CARD…</div>
      )}

      {(phase === 'question' || phase === 'answer') && card && (
        <div className="gp-stage">
          <div className="gp-box">
            <span className="gp-box-num">BOX <strong>{card.box}</strong></span>
            <span>CORRECT {correctCount}</span>
          </div>

          <div className="gp-card" data-flash={flash || undefined}>
            {card.type === 'image' && card.question_image ? (
              <img src={getCardImageUrl(card.question_image)} alt="" className="gp-card-img" />
            ) : (
              <div className="gp-card-text">
                <KaTeX content={card.question || ''} />
              </div>
            )}
          </div>

          {phase === 'question' && (
            <div className="gp-answer">
              <input
                type="text"
                className="gp-answer-input"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && userAnswer.trim() && handleSubmitAnswer()}
                placeholder="정답 입력"
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              <div className="gp-answer-row">
                <button
                  type="button"
                  className="gp-btn"
                  onClick={handleSubmitAnswer}
                  disabled={!userAnswer.trim()}
                >
                  확인
                </button>
                <button
                  type="button"
                  className="gp-btn gp-btn--ghost"
                  onClick={handleShowAnswer}
                >
                  모름
                </button>
              </div>
            </div>
          )}

          {phase === 'answer' && (
            <>
              <div className="gp-reveal">
                <span className="gp-reveal-label">ANSWER</span>
                <div className="gp-reveal-answer">
                  <KaTeX content={card.answer} />
                </div>
              </div>
              <div className="gp-self">
                <span className="gp-self-prompt">맞았나요?</span>
                <div className="gp-self-row">
                  <button type="button" className="gp-btn gp-btn--grass" onClick={() => submitFeedback(true)}>
                    맞았어요 · O
                  </button>
                  <button type="button" className="gp-btn gp-btn--danger" onClick={() => submitFeedback(false)}>
                    틀렸어요 · X
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'feedback' && card && feedback && (
        <div className="gp-stage">
          <div className={`gp-fb gp-fb--${isCorrect ? 'correct' : 'wrong'}`}>
            <span className="gp-fb-mark" aria-hidden="true">{isCorrect ? 'O' : 'X'}</span>
            <span className="gp-fb-text">{isCorrect ? '정답' : '오답'}</span>
            <span className="gp-fb-box">
              BOX {feedback.box_before}
              {feedback.box_after > feedback.box_before ? ' ↑ ' : feedback.box_after < feedback.box_before ? ' ↓ ' : ' · '}
              {feedback.box_after}
            </span>
          </div>

          <div className="gp-mini-q">
            <KaTeX content={card.question || ''} />
          </div>

          <div className="gp-reveal">
            <span className="gp-reveal-label">ANSWER</span>
            <div className="gp-reveal-answer">
              <KaTeX content={card.answer} />
            </div>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="gp-done">
          <span className="gp-done-kicker">{error ? 'ERROR' : count >= TOTAL ? 'SESSION COMPLETE' : 'NO CARDS'}</span>
          <h2 className="gp-done-title">
            {error ? '잠시 문제가 있어요' : count >= TOTAL ? '오늘치 끝' : '카드가 없어요'}
          </h2>
          {count > 0 && (
            <>
              <div className="gp-done-score">
                {correctCount}<span style={{ color: 'var(--ink-20)' }}>/</span>
                <span style={{ color: 'var(--ink-40)' }}>{count}</span>
              </div>
              <span className="gp-done-meta">{count}장 학습 · 정답 {correctCount}</span>
            </>
          )}
          {error && <div className="gp-done-error">{error}</div>}
        </div>
      )}

      {/* 하단 고정 Next / 완료 바 */}
      {phase === 'feedback' && (
        <button type="button" className="gp-next" onClick={handleNext}>
          {count >= TOTAL ? 'FINISH' : 'NEXT'}
          <span className="gp-next-arrow" aria-hidden="true">→</span>
        </button>
      )}
      {phase === 'done' && (
        <button type="button" className="gp-next" onClick={() => navigate('/')}>
          HOME <span className="gp-next-arrow" aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

// ── 답안 비교 ──

function checkAnswer(submitted: string, expected: string): boolean {
  const a = normalize(submitted);
  const b = normalize(expected);
  if (a === b) return true;

  const fa = parseFraction(a);
  const fb = parseFraction(b);
  if (fa && fb) return fa[0] * fb[1] === fa[1] * fb[0];

  return false;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
    .replace(/\\/g, '').replace(/[{}]/g, '')
    .replace(/\^/g, '').replace(/_/g, '');
}

function parseFraction(s: string): [number, number] | null {
  const m = s.match(/^(-?\d+)\/(-?\d+)$/);
  if (!m) return null;
  const num = parseInt(m[1]);
  const den = parseInt(m[2]);
  if (den === 0) return null;
  return [num, den];
}
