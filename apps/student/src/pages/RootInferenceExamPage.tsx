import { useState, useEffect } from 'react';
import './RootInferenceExamPage.css';

type Choice = {
  letter: 'a' | 'b' | 'c' | 'd';
  korean: string;
  rationale: string;
  correct?: boolean;
};

const QUESTION = {
  index: 3,
  total: 10,
  hintPrefix: 'pro',
  hiddenTail: 'spectus',
  word: 'prospectus',
  pronounce: '/prəˈspɛktəs/',
  root: 'spec',
  rootMeaning: '보다 · 살피다',
  rootEnglish: 'to look forward',
  knownExamples: [
    { en: 'inspect', ko: '점검하다' },
    { en: 'spectator', ko: '관중' },
    { en: 'perspective', ko: '관점' },
  ],
};

const CHOICES: Choice[] = [
  {
    letter: 'a',
    korean: '사전 안내서 · 모집 요강',
    rationale: 'pro(앞으로) + spec(보다) → 앞을 내다보는 글',
    correct: true,
  },
  { letter: 'b', korean: '과거 회상록', rationale: '과거 = retro·re-' },
  { letter: 'c', korean: '진단 보고서', rationale: '진단 = diagnos-' },
  { letter: 'd', korean: '추모 기록', rationale: '추모 = memor·commemor-' },
];

export default function RootInferenceExamPage() {
  const [selected, setSelected] = useState<Choice['letter'] | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(45);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const ringTotal = 45;
  const ringRadius = 11;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringFill = (secondsLeft / ringTotal) * ringCirc;

  return (
    <div className="ri-root">
      <div className="ri-inner">
        <div className="ri-hud">
          <button type="button" className="ri-exit" onClick={() => history.back()}>
            나가기
          </button>
          <div className="ri-progress">
            {Array.from({ length: QUESTION.total }).map((_, i) => {
              const idx = i + 1;
              const cls =
                idx < QUESTION.index ? 'done' : idx === QUESTION.index ? 'current' : '';
              return <span key={i} className={`pip ${cls}`} />;
            })}
          </div>
          <div className="ri-timer">
            <span className="ri-timer-ring">
              <svg viewBox="0 0 28 28">
                <circle className="track" cx="14" cy="14" r={ringRadius} />
                <circle
                  className="fill"
                  cx="14"
                  cy="14"
                  r={ringRadius}
                  strokeDasharray={`${ringFill} ${ringCirc}`}
                />
              </svg>
            </span>
            <span>0:{String(Math.max(0, secondsLeft)).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="ri-eyebrow">
          <span>Inference Quiz · {QUESTION.index} of {QUESTION.total}</span>
        </div>

        <section className="ri-stage">
          <span className="ri-stage-label">
            처음 보는 단어입니다. 어근을 단서로 <b>의미를 추론</b>해 보세요.
          </span>
          <h1 className="ri-word" aria-label={QUESTION.word}>
            <span className="hint">{QUESTION.hintPrefix}</span>
            <span className="veil">
              {QUESTION.hiddenTail.split('').map((c, i) => (
                <span key={i} className="ch">{c}</span>
              ))}
            </span>
          </h1>
          <span className="ri-pronounce">{QUESTION.pronounce}</span>
        </section>

        <aside className="ri-hint-card">
          <div className="ri-hint-head">
            <span className="label">단어 속 어근</span>
            <span className="root">
              {QUESTION.root}<small>·</small>
            </span>
          </div>
          <div className="ri-hint-meaning">
            {QUESTION.rootMeaning} <span style={{ color: 'var(--ri-ink-soft)', fontWeight: 400, marginLeft: 6, fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif' }}>
              — {QUESTION.rootEnglish}
            </span>
          </div>
          <div className="ri-hint-examples">
            {QUESTION.knownExamples.map((e) => (
              <span key={e.en} className="ex">
                {e.en}<small>{e.ko}</small>
              </span>
            ))}
          </div>
        </aside>

        <div className="ri-choices">
          {CHOICES.map((c) => (
            <button
              key={c.letter}
              type="button"
              data-letter={c.letter}
              className={`ri-choice ${selected === c.letter ? 'selected' : ''}`}
              onClick={() => setSelected(c.letter)}
            >
              {c.korean}
              <small className="micro">→ {c.rationale}</small>
            </button>
          ))}
        </div>

        <footer className="ri-footer">
          <button type="button" className="ri-skip">
            확신 없음
            <small>Skip · 점수 없음</small>
          </button>
          <button type="button" className="ri-submit" disabled={selected === null}>
            {selected ? `${selected.toUpperCase()} 선택 확정` : '답 선택 후 진행'}
          </button>
        </footer>
      </div>
    </div>
  );
}
