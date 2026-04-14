import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Card, getCardImageUrl } from '../api';
import KaTeX from '../components/KaTeX';

type Phase = 'loading' | 'question' | 'answer' | 'feedback' | 'done';

export default function GachaPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [card, setCard] = useState<Card | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState<{ box_before: number; box_after: number } | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');

  const loadCard = useCallback(async () => {
    setPhase('loading');
    setUserAnswer('');
    setError('');
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

  const handleShowAnswer = () => {
    setPhase('answer');
  };

  const handleSubmitAnswer = () => {
    if (!card) return;
    const correct = checkAnswer(userAnswer.trim(), card.answer);
    setIsCorrect(correct);
    submitFeedback(correct);
  };

  const submitFeedback = async (correct: boolean) => {
    if (!card) return;
    try {
      const result = await api.submitCardFeedback(card.id, correct ? 'success' : 'fail');
      setFeedback({ box_before: result.box_before, box_after: result.box_after });
      setCount(c => c + 1);
      setPhase('feedback');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleNext = () => {
    if (count >= 10) {
      setPhase('done');
    } else {
      loadCard();
    }
  };

  return (
    <div className="gacha-play-page">
      <header className="play-header">
        <button className="btn-ghost" onClick={() => navigate('/')}>← 홈</button>
        <span className="play-counter">{count}/10</span>
      </header>

      {phase === 'loading' && (
        <div className="play-center"><div className="loading">카드 뽑는 중...</div></div>
      )}

      {phase === 'question' && card && (
        <div className="play-card">
          <div className="play-card-badge">Box {card.box}</div>
          <div className="play-card-question">
            {card.type === 'image' && card.question_image ? (
              <img src={getCardImageUrl(card.question_image)} alt="question" className="play-card-img" />
            ) : (
              <KaTeX content={card.question || ''} className="play-card-text" />
            )}
          </div>

          <div className="play-answer-area">
            <input
              type="text"
              placeholder="정답 입력..."
              value={userAnswer}
              onChange={e => setUserAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmitAnswer()}
              className="play-answer-input"
              autoFocus
            />
            <div className="play-answer-buttons">
              <button className="btn-primary" onClick={handleSubmitAnswer} disabled={!userAnswer.trim()}>
                확인
              </button>
              <button className="btn-ghost" onClick={handleShowAnswer}>
                모르겠어요
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'answer' && card && (
        <div className="play-card">
          <div className="play-card-question">
            {card.type === 'image' && card.question_image ? (
              <img src={getCardImageUrl(card.question_image)} alt="question" className="play-card-img" />
            ) : (
              <KaTeX content={card.question || ''} className="play-card-text" />
            )}
          </div>
          <div className="play-reveal">
            <div className="play-reveal-label">정답</div>
            <KaTeX content={card.answer} className="play-reveal-answer" />
          </div>
          <div className="play-self-check">
            <p>맞았나요?</p>
            <div className="play-self-buttons">
              <button className="btn-success" onClick={() => submitFeedback(true)}>맞았어요 O</button>
              <button className="btn-fail" onClick={() => submitFeedback(false)}>틀렸어요 X</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'feedback' && card && feedback && (
        <div className="play-card">
          <div className={`play-feedback ${isCorrect ? 'play-feedback--correct' : 'play-feedback--wrong'}`}>
            <span className="play-feedback-icon">{isCorrect ? 'O' : 'X'}</span>
            <span className="play-feedback-text">{isCorrect ? '정답!' : '오답'}</span>
          </div>

          <div className="play-card-question-small">
            <KaTeX content={card.question || ''} />
          </div>
          <div className="play-reveal play-reveal--small">
            <KaTeX content={card.answer} className="play-reveal-answer" />
          </div>

          <div className="play-box-change">
            Box {feedback.box_before} → Box {feedback.box_after}
            {feedback.box_after > feedback.box_before ? ' ↑' : feedback.box_after < feedback.box_before ? ' ↓' : ''}
          </div>

          <button className="btn-primary play-next-btn" onClick={handleNext}>
            {count >= 10 ? '완료' : '다음 카드 →'}
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="play-done">
          <div className="play-done-icon">🎉</div>
          <h2>{error ? '오류' : count >= 10 ? '오늘의 카드 완료!' : '카드가 없습니다'}</h2>
          {error && <p className="play-error">{error}</p>}
          <p>{count}장 학습 완료</p>
          <button className="btn-primary" onClick={() => navigate('/')}>홈으로</button>
        </div>
      )}
    </div>
  );
}

// ── 답안 비교 ──

function checkAnswer(submitted: string, expected: string): boolean {
  const a = normalize(submitted);
  const b = normalize(expected);
  if (a === b) return true;

  // 분수 비교: 1/2 == 2/4
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
