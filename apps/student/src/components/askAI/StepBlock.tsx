import React from 'react';
import KaTeX from '../KaTeX';
import type { Step } from '@/lib/askAI/types';
import './StepBlock.css';

interface Props {
  step: Step;
  index: number;
  isLocked?: boolean;
  isDone?: boolean;
}

export function StepBlock({ step, index, isLocked = false, isDone = false }: Props) {
  if (step.kind === 'inline_cite') {
    return (
      <aside className={`askai-inline-cite askai-cite-${step.variant}`}>
        <span className="src">{step.src}{step.page ? ` · p.${step.page}` : ''}</span>
        <p>{step.quote}</p>
      </aside>
    );
  }

  if (step.kind === 'figure') {
    return (
      <div className="askai-figure">
        <FigureRenderer spec={step.spec} />
        {step.caption && <div className="caption">{step.caption}</div>}
      </div>
    );
  }

  // explain / checkpoint / ocr / annotated 모두 numbered step
  return (
    <article
      className={`askai-step ${isDone ? 'is-done' : ''} ${isLocked ? 'is-locked' : ''}`}
      data-kind={step.kind}
      aria-labelledby={`step-${index}-title`}
    >
      <div className="step-num" aria-hidden="true">{index + 1}</div>
      <div className="step-body">
        {step.kind === 'explain' && (
          <>
            <h2 id={`step-${index}-title`}>{step.title}</h2>
            <div className="body-md">
              <RenderMarkdownWithKaTeX text={step.body_md} />
            </div>
          </>
        )}
        {step.kind === 'checkpoint' && (
          <h2 id={`step-${index}-title`} className="checkpoint-q">
            <span aria-hidden="true">✦ </span>{step.question}
          </h2>
        )}
        {step.kind === 'ocr_confirm' && (
          <>
            <h2 id={`step-${index}-title`}>사진에서 읽은 내용 — 맞아?</h2>
            <div className="ocr-content">
              <KaTeX text={step.parsed_latex} />
            </div>
          </>
        )}
        {step.kind === 'annotated_photo' && (
          <h2 id={`step-${index}-title`}>빨간펜 채점 결과</h2>
        )}
      </div>
    </article>
  );
}

function FigureRenderer({ spec }: { spec: Step extends { spec: infer S } ? S : never }) {
  // function-plot 등 실제 렌더는 다음 turn — 지금은 placeholder
  const t = (spec as any).type;
  return (
    <div className="figure-placeholder">
      <code>{t}</code> figure
    </div>
  );
}

function RenderMarkdownWithKaTeX({ text }: { text: string }) {
  // 간단 inline KaTeX 분리: $...$ 토큰 → KaTeX, 나머지 → 텍스트
  const parts: Array<{ type: 'text' | 'math'; value: string }> = [];
  const re = /\$([^$]+)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    parts.push({ type: 'math', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'math' ? <KaTeX key={i} text={p.value} /> : <span key={i}>{p.value}</span>
      )}
    </>
  );
}
