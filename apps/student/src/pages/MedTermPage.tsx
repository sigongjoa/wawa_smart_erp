import { useEffect, useState, useCallback } from 'react';
import { medtermApi, MedTermCard, MedTermAnswerResult, MedTermDetail } from '../api';
import './MedTermPage.css';

type CardState = 'idle' | 'submitting' | 'graded';

interface FeedbackUI {
  correct: boolean;
  box_before: number;
  box_after: number;
  answer: unknown;
  explanation: string;
}

export default function MedTermPage() {
  const [cards, setCards] = useState<MedTermCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [response, setResponse] = useState<string>('');
  const [decomposeSlots, setDecomposeSlots] = useState<string[]>(['', '', '', '', '']);
  const [state, setState] = useState<CardState>('idle');
  const [feedback, setFeedback] = useState<FeedbackUI | null>(null);
  const [termDetail, setTermDetail] = useState<MedTermDetail | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await medtermApi.today(20);
      setCards(result.items);
      setActiveIdx(0);
      resetInputs();
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const card = cards[activeIdx];

  // decompose 모드일 때 정답 parts 슬롯 수 알려주려고 term detail 호출
  useEffect(() => {
    setTermDetail(null);
    if (card && card.study_mode === 'decompose') {
      medtermApi.term(card.term_id).then(setTermDetail).catch(() => {});
    }
  }, [card?.id]);

  function resetInputs() {
    setResponse('');
    setDecomposeSlots(['', '', '', '', '']);
    setState('idle');
    setFeedback(null);
  }

  async function submit() {
    if (!card) return;
    setState('submitting');
    let payload: unknown;
    if (card.study_mode === 'decompose') {
      const parts = decomposeSlots
        .map((v) => v.trim())
        .filter(Boolean)
        .map((value) => ({ value }));
      payload = parts;
    } else {
      payload = response.trim();
    }

    try {
      const result: MedTermAnswerResult = await medtermApi.answer(card.id, payload);
      setFeedback({
        correct: result.correct,
        box_before: result.box_before,
        box_after: result.box_after,
        answer: result.answer,
        explanation: result.explanation,
      });
      setState('graded');
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출 실패');
      setState('idle');
    }
  }

  function next() {
    if (activeIdx < cards.length - 1) {
      setActiveIdx((i) => i + 1);
      resetInputs();
    } else {
      // 모두 풀었으니 새로 로드 (도래 카드 다시 가져오기)
      loadCards();
    }
  }

  if (loading) {
    return <div className="medterm-page" data-testid="medterm-loading">불러오는 중...</div>;
  }

  if (error && cards.length === 0) {
    return (
      <div className="medterm-page">
        <div className="medterm-error" data-testid="medterm-error">{error}</div>
        <button onClick={loadCards} className="medterm-retry">다시 시도</button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="medterm-page" data-testid="medterm-empty">
        <h2>의학용어 학습</h2>
        <p>오늘 학습할 카드가 없습니다 🎉</p>
        <p className="medterm-hint">강사가 챕터를 할당하면 여기에 카드가 표시됩니다.</p>
      </div>
    );
  }

  const expectedSlots = termDetail ? termDetail.parts.length : 5;

  return (
    <div className="medterm-page">
      <header className="medterm-header" data-testid="medterm-header">
        <h2>의학용어 학습</h2>
        <span className="medterm-progress">{activeIdx + 1} / {cards.length}</span>
      </header>

      <article className="medterm-card" data-testid="medterm-card" data-mode={card.study_mode}>
        <div className="medterm-mode-badge">
          {modeLabel(card.study_mode)} · 박스 {card.box}
        </div>

        {card.study_mode === 'meaning' && (
          <>
            <div className="medterm-term" data-testid="medterm-term-text">{card.term}</div>
            <div className="medterm-prompt">한국어 의미를 입력하세요.</div>
            <input
              type="text"
              className="medterm-input"
              data-testid="medterm-input"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              disabled={state !== 'idle'}
              placeholder="예: 심장학"
              autoFocus
            />
          </>
        )}

        {card.study_mode === 'decompose' && (
          <>
            <div className="medterm-term" data-testid="medterm-term-text">{card.term}</div>
            <div className="medterm-prompt">
              단어를 요소로 분리하세요 ({expectedSlots}개 슬롯)
            </div>
            <div className="medterm-decompose-slots">
              {Array.from({ length: expectedSlots }).map((_, i) => (
                <input
                  key={i}
                  type="text"
                  className="medterm-slot"
                  data-testid={`medterm-slot-${i}`}
                  value={decomposeSlots[i] || ''}
                  onChange={(e) => {
                    const next = [...decomposeSlots];
                    next[i] = e.target.value;
                    setDecomposeSlots(next);
                  }}
                  disabled={state !== 'idle'}
                  placeholder={String(i + 1)}
                />
              ))}
            </div>
            <div className="medterm-hint">p=접두사, r=어근, cv=결합모음, s=접미사</div>
          </>
        )}

        {card.study_mode === 'compose' && (
          <>
            <div className="medterm-prompt">정의에 맞는 의학용어를 적으세요.</div>
            <div className="medterm-meaning">{card.meaning_long || card.meaning_ko}</div>
            <input
              type="text"
              className="medterm-input"
              data-testid="medterm-input"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              disabled={state !== 'idle'}
              placeholder="예: cardiology"
              autoFocus
            />
          </>
        )}

        {card.study_mode === 'plural' && (
          <>
            <div className="medterm-prompt">복수형을 입력하세요.</div>
            <div className="medterm-term" data-testid="medterm-term-text">{card.term}</div>
            <input
              type="text"
              className="medterm-input"
              data-testid="medterm-input"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              disabled={state !== 'idle'}
              placeholder="예: vertebrae"
              autoFocus
            />
          </>
        )}

        {feedback && (
          <div
            className={`medterm-feedback ${feedback.correct ? 'correct' : 'wrong'}`}
            data-testid="medterm-feedback"
            data-correct={feedback.correct}
          >
            <strong>{feedback.correct ? '✅ 정답' : '❌ 오답'}</strong>
            <div className="medterm-feedback-line">
              박스: {feedback.box_before} → <b>{feedback.box_after}</b>
            </div>
            <div className="medterm-feedback-answer">
              정답: <code>{formatAnswer(feedback.answer)}</code>
            </div>
            {feedback.explanation && (
              <div className="medterm-feedback-explain">{feedback.explanation}</div>
            )}
          </div>
        )}

        <div className="medterm-actions">
          {state === 'idle' && (
            <button
              className="medterm-submit"
              data-testid="medterm-submit"
              onClick={submit}
            >
              제출
            </button>
          )}
          {state === 'graded' && (
            <button
              className="medterm-next"
              data-testid="medterm-next"
              onClick={next}
            >
              {activeIdx < cards.length - 1 ? '다음 카드' : '완료'}
            </button>
          )}
        </div>
      </article>
    </div>
  );
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'meaning': return '의미';
    case 'decompose': return '단어 분해';
    case 'compose': return '단어 만들기';
    case 'plural': return '복수형';
    case 'figure': return '그림 라벨링';
    default: return mode;
  }
}

function formatAnswer(a: unknown): string {
  if (typeof a === 'string') return a;
  if (Array.isArray(a)) {
    return a.map((p: any) => p.value || String(p)).join(' / ');
  }
  return JSON.stringify(a);
}
