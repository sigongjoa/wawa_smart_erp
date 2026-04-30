import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { medtermApi, MedTermCard, MedTermAnswerResult, MedTermDetail, MedTermFigureLabel } from '../api';
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
  const navigate = useNavigate();
  const [cards, setCards] = useState<MedTermCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [response, setResponse] = useState<string>('');
  const [decomposeSlots, setDecomposeSlots] = useState<string[]>(['', '', '', '', '']);
  const [state, setState] = useState<CardState>('idle');
  const [feedback, setFeedback] = useState<FeedbackUI | null>(null);
  const [termDetail, setTermDetail] = useState<MedTermDetail | null>(null);
  // figure 모드 상태
  const [figureClick, setFigureClick] = useState<{ x: number; y: number } | null>(null);
  const [figureLabels, setFigureLabels] = useState<MedTermFigureLabel[]>([]);

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
    setFigureClick(null);
  }

  // figure 모드일 때 그림 라벨 fetch (term 의 part 가 어느 figure 에 등장하는지)
  // 단순화: chapter 의 모든 figure 에서 term 와 매칭되는 라벨 검색
  useEffect(() => {
    setFigureLabels([]);
    if (card?.study_mode !== 'figure') return;
    // chapter_id 모르므로 모든 figure 가져오는 대신 term 의 첫 번째 매칭 figure 만
    // (간단화 — 실제로는 백엔드에서 figure_id 노출 필요. 여기서는 'fig-ch01-1-3' 가정)
    const chapterId = 'med-basic-ch01';  // TODO: card 에 chapter_id 노출 필요
    medtermApi.figures(chapterId).then((r) => {
      // 가장 큰 anatomy 그림 우선
      const anatomy = r.items.find((f) => f.fig_type === 'anatomy' && f.has_image);
      const fig = anatomy || r.items.find((f) => f.has_image);
      if (fig) {
        medtermApi.figureLabels(fig.id).then((lr) => setFigureLabels(lr.items));
      }
    }).catch(() => {});
  }, [card?.id]);

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
    } else if (card.study_mode === 'figure') {
      if (!figureClick) {
        setError('그림 위를 클릭하여 위치를 지정하세요');
        setState('idle');
        return;
      }
      payload = { x: figureClick.x, y: figureClick.y };
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
        <div className="medterm-header-actions">
          <button
            className="medterm-exam-link"
            onClick={() => navigate('/medterm/exams')}
            data-testid="medterm-exams-link"
          >
            단원평가
          </button>
          <span className="medterm-progress">{activeIdx + 1} / {cards.length}</span>
        </div>
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

        {card.study_mode === 'figure' && (
          <>
            <div className="medterm-prompt">
              <b>{card.term}</b> 에 해당하는 위치를 그림에서 클릭하세요.
            </div>
            <div className="medterm-figure-wrap" data-testid="medterm-figure-wrap">
              {figureLabels.length > 0 && (
                <FigureClickArea
                  src={medtermApi.figureImageUrl(figureLabels[0].figure_id)}
                  click={figureClick}
                  setClick={setFigureClick}
                  disabled={state !== 'idle'}
                  showAnswer={state === 'graded' && feedback ? (feedback.answer as { x: number; y: number }) : null}
                />
              )}
              {figureLabels.length === 0 && (
                <div className="medterm-hint">그림을 불러오는 중...</div>
              )}
            </div>
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

interface FigureClickAreaProps {
  src: string;
  click: { x: number; y: number } | null;
  setClick: (c: { x: number; y: number }) => void;
  disabled: boolean;
  showAnswer: { x: number; y: number } | null;
}

function FigureClickArea({ src, click, setClick, disabled, showAnswer }: FigureClickAreaProps) {
  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setClick({ x, y });
  }
  return (
    <div
      className="medterm-figure-click-area"
      onClick={onClick}
      data-testid="medterm-figure-click-area"
      style={{ cursor: disabled ? 'default' : 'crosshair' }}
    >
      <img src={src} alt="figure" draggable={false} />
      {click && (
        <div
          className="medterm-figure-marker user"
          style={{ left: `${click.x * 100}%`, top: `${click.y * 100}%` }}
          data-testid="medterm-figure-user-marker"
        >●</div>
      )}
      {showAnswer && (
        <div
          className="medterm-figure-marker answer"
          style={{ left: `${showAnswer.x * 100}%`, top: `${showAnswer.y * 100}%` }}
          data-testid="medterm-figure-answer-marker"
        >★</div>
      )}
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
