import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { askAI } from '@/lib/askAI/client';
import type { AskAIResult, Step } from '@/lib/askAI/types';
import { Points2DChart } from '@/components/Points2DChart';
import './AskAIPage.css';

// KaTeX auto-render (전역 — index.html에서 katex.min.css 로드됨)
declare global {
  interface Window {
    renderMathInElement?: (el: HTMLElement, opts: any) => void;
    katex?: any;
  }
}

const isInteractive = (step: Step) =>
  step.kind === 'explain' || step.kind === 'checkpoint' ||
  step.kind === 'ocr_confirm' || step.kind === 'annotated_photo';

export default function AskAIPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [unit] = useState('확통 III-1 표본분포');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskAIResult | null>(null);
  const [originalQuestion, setOriginalQuestion] = useState('');
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  // KaTeX render — 응답 도착 시 / step expand 시
  useEffect(() => {
    if (!result || !mainRef.current) return;
    const tryRender = () => {
      if (window.renderMathInElement) {
        window.renderMathInElement(mainRef.current!, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
          ],
          throwOnError: false,
        });
      } else {
        setTimeout(tryRender, 100);
      }
    };
    tryRender();
  }, [result, doneSteps, expandedSteps]);

  // KaTeX auto-render script load — katex 먼저, 로드 완료 후 auto-render
  useEffect(() => {
    if (window.renderMathInElement) return;
    const k = document.createElement('script');
    k.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
    k.crossOrigin = 'anonymous';
    k.onload = () => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
      s.crossOrigin = 'anonymous';
      document.body.appendChild(s);
    };
    document.body.appendChild(k);
  }, []);

  // sheet body scroll lock
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sheetOpen]);

  // ESC to close sheet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sheetOpen) setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  const submit = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    setOriginalQuestion(text);
    try {
      const r = await askAI.ask({ message: text.trim(), unit_id: unit });
      setResult(r);
      setDoneSteps(new Set());
      setExpandedSteps(new Set());
      setMessage('');
      if (composerRef.current) composerRef.current.value = '';
      if (sendRef.current) {
        sendRef.current.disabled = true;
        sendRef.current.setAttribute('aria-disabled', 'true');
      }
    } catch (e: any) {
      setError(e.message || '오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  }, [loading, unit]);

  const advance = useCallback((idx: number) => {
    setDoneSteps((prev) => new Set([...prev, idx]));
    // 자동 다음 step locked 해제는 stepLocked 로직으로 자연 처리
    // 다음 step scroll
    setTimeout(() => {
      const nextEl = mainRef.current?.querySelector(`[data-step="${idx + 2}"]`);
      nextEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const toggleDoneStep = useCallback((idx: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const stepLocked = (i: number, steps: Step[]): boolean => {
    if (i === 0) return false;
    const prevInteractive = steps.slice(0, i).map((s, idx) => ({ s, idx }))
      .filter(({ s }) => isInteractive(s));
    if (prevInteractive.length === 0) return false;
    const last = prevInteractive[prevInteractive.length - 1];
    return !doneSteps.has(last.idx);
  };

  // composer auto-grow + send enable
  const onComposerInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    const empty = ta.value.trim().length === 0;
    if (sendRef.current) {
      sendRef.current.disabled = empty;
      sendRef.current.setAttribute('aria-disabled', String(empty));
    }
  }, []);

  // sheet swipe-down to close
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    let sy = 0;
    const onStart = (e: TouchEvent) => { sy = e.touches[0].clientY; };
    const onMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - sy;
      if (dy > 80) setSheetOpen(false);
    };
    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: true });
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
    };
  }, [sheetOpen]);

  const totalInteractive = result?.response.steps.filter(isInteractive).length ?? 0;
  const doneInteractive = result
    ? Array.from(doneSteps).filter((i) => isInteractive(result.response.steps[i])).length
    : 0;

  return (
    <div className="ask-page">
      <a className="skip-link" href="#main">본문으로 건너뛰기</a>

      <div className="ask-viewport">

        <header className="app">
          <button
            className="icon-btn"
            aria-label="뒤로"
            onClick={() => navigate(-1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="title">
            <span className="ctx">
              <span className="swatch" aria-hidden="true">증</span>
              {unit}
            </span>
            {result && totalInteractive > 0 && (
              <div className="progress" aria-label={`단계 진행 ${doneInteractive} / ${totalInteractive}`}>
                {result.response.steps.filter(isInteractive).map((_, i) => {
                  const interactiveStepIdx = result.response.steps
                    .map((s, idx) => isInteractive(s) ? idx : -1)
                    .filter((idx) => idx !== -1)[i];
                  const cls = doneSteps.has(interactiveStepIdx) ? 'done'
                    : i === doneInteractive ? 'now' : '';
                  return <i key={i} className={cls} />;
                })}
              </div>
            )}
          </div>
        </header>

        <main id="main" ref={mainRef}>
          {!result && !loading && (
            <article className="question">
              <div className="meta"><b>새 질문</b></div>
              <p>아래에 모르는 거 적어봐. KaTeX 수식도 $...$ 로 바로 됨.</p>
            </article>
          )}

          {loading && (
            <div className="ask-loading">생각 중…</div>
          )}

          {error && (
            <article className="question" style={{ borderColor: 'rgba(230,40,41,0.20)', background: 'rgba(230,40,41,0.06)' }}>
              <div className="meta"><b style={{ color: '#E62829' }}>오류</b></div>
              <p>{error}</p>
            </article>
          )}

          {result && (
            <>
              <article className="question">
                <div className="meta"><b>나</b><span className="when">방금</span></div>
                <p>{originalQuestion}</p>
              </article>

              {result.response.steps.map((step, i) => {
                const locked = stepLocked(i, result.response.steps);
                const done = doneSteps.has(i);
                const expanded = expandedSteps.has(i);

                if (step.kind === 'inline_cite') {
                  return (
                    <div key={i} className="inline-cite">
                      <span className="src">{step.src}{step.page ? ` · p.${step.page}` : ''}</span>
                      {step.quote}
                    </div>
                  );
                }

                if (step.kind === 'figure') {
                  const spec = (step as any).spec;
                  if (spec?.type === 'points-2d') {
                    return (
                      <div key={i} className="figure">
                        <Points2DChart spec={spec} caption={(step as any).caption} />
                      </div>
                    );
                  }
                  // 다른 figure type (function-plot/jsxgraph/cetz) 미구현 — 캡션만
                  return (
                    <div key={i} className="figure">
                      <div className="caption">
                        <b>그림</b> {(step as any).caption ?? ''}
                      </div>
                    </div>
                  );
                }

                const interactiveOrder = result.response.steps.slice(0, i + 1)
                  .filter(isInteractive).length;

                return (
                  <article
                    key={i}
                    className={`step${done ? ' done' : ''}${locked ? ' locked' : ''}${expanded ? ' expanded' : ''}`}
                    data-step={interactiveOrder}
                    onClick={done ? () => toggleDoneStep(i) : undefined}
                  >
                    <div className="num"><span>{interactiveOrder}</span></div>
                    {step.kind === 'explain' && (
                      <>
                        {(step as any).step_tag && <span className="step-tag">{(step as any).step_tag}</span>}
                        <h2>{step.title}</h2>
                        {!done && !locked && (
                          <div className="body">
                            {step.body_md.split('\n\n').map((para, j) => (
                              <p key={j}>{para}</p>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {step.kind === 'checkpoint' && (
                      <>
                        <h2>{step.question}</h2>
                        {!done && !locked && (
                          <div className="ck">
                            <span className="q">여기까지 OK?</span>
                            <div className="row">
                              <button className="yes" onClick={(e) => { e.stopPropagation(); advance(i); }}>
                                응, 다음
                              </button>
                            </div>
                            <button
                              type="button"
                              className="link-btn"
                              onClick={(e) => { e.stopPropagation(); advance(i); }}
                              aria-label="다시 설명 요청"
                            >
                              다시 설명해줘
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {step.kind === 'ocr_confirm' && (
                      <>
                        <h2>사진에서 읽은 내용 확인</h2>
                        {!done && !locked && (
                          <div className="body">
                            <p>{step.parsed_latex}</p>
                            <div className="ck">
                              <div className="row">
                                <button className="yes" onClick={(e) => { e.stopPropagation(); advance(i); }}>맞아</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {step.kind === 'annotated_photo' && (
                      <>
                        <h2>빨간펜 채점 결과</h2>
                        {!done && !locked && (
                          <div className="ck">
                            <div className="row">
                              <button className="yes" onClick={(e) => { e.stopPropagation(); advance(i); }}>다음</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </>
          )}
        </main>

        {/* floating citations pill */}
        {result && result.response.references.length > 0 && (
          <button
            className="cite-pill"
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
          >
            <span className="ico" aria-hidden="true">📚</span>
            인용된 자료
            <span className="num" aria-label={`${result.response.references.length}개`}>
              {result.response.references.length}
            </span>
          </button>
        )}

        {/* composer */}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            const text = composerRef.current?.value || '';
            if (text.trim()) submit(text);
          }}
        >
          <button type="button" className="ico-btn" aria-label="사진 첨부 (준비 중)" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <textarea
            id="ta-mobilechat"
            ref={composerRef}
            aria-label={result ? '이어서 질문하기' : '질문 적기'}
            placeholder={result ? '더 물어볼 거 있어?' : '예: 표본평균 분산이 왜 σ²/n 인가요?'}
            rows={1}
            onInput={onComposerInput}
            onChange={(e) => setMessage(e.target.value)}
            value={message}
          />
          <button
            ref={sendRef}
            type="submit"
            className="send"
            aria-label="보내기"
            disabled
            aria-disabled="true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>

      {/* bottom sheet — citations */}
      <div
        className={`sheet-backdrop${sheetOpen ? ' open' : ''}`}
        onClick={() => setSheetOpen(false)}
        aria-hidden={!sheetOpen}
      />
      <aside
        ref={sheetRef}
        className={`sheet${sheetOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheetTitle"
        aria-hidden={!sheetOpen}
      >
        <div className="grab" aria-hidden="true" />
        <header className="sheet-head">
          <h2 id="sheetTitle">인용된 자료</h2>
          <span className="ct">{result?.response.references.length ?? 0}개</span>
          <button
            type="button"
            className="close"
            onClick={() => setSheetOpen(false)}
            aria-label="닫기"
          >
            닫기
          </button>
        </header>
        <div className="scroll">
          {result?.response.references.map((r, i) => (
            <article key={i} className="cite-card">
              <div className="src-tag">학원 단원지</div>
              <h3>{r.unit}</h3>
              {r.page && <div className="ref">p.{r.page}</div>}
              <div className="preview">"{r.quote}"</div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
