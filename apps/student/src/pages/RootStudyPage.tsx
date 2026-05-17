import { useState } from 'react';
import './RootStudyPage.css';

type Morpheme =
  | { kind: 'prefix' | 'root' | 'suffix'; text: string; gloss: string }
  | { kind: 'joiner'; text: string };

type DerivedWord = {
  id: string;
  english: string;
  korean: string;
  blocks: Morpheme[];
  decompose: string;
  example: { en: string; ko: string };
};

const ROOT = {
  morpheme: 'spec',
  meaningKo: '보다 · 살피다',
  meaningEn: 'to look, to see, to examine',
  origin: 'Latin specere',
  family: ['spec-', 'spect-', 'spic-'],
  level: 'Tier 1',
  box: 3,
  boxTotal: 5,
};

const WORDS: DerivedWord[] = [
  {
    id: 'inspect',
    english: 'inspect',
    korean: '안을 들여다보다 · 점검하다',
    blocks: [
      { kind: 'prefix', text: 'in-', gloss: '안으로' },
      { kind: 'root', text: 'spec', gloss: '보다' },
      { kind: 'suffix', text: 't', gloss: '동사화' },
    ],
    decompose: 'in (안으로) + spec (보다) → 안쪽을 들여다보다',
    example: {
      en: 'The mechanic will inspect the engine for any signs of wear.',
      ko: '정비공이 마모 흔적이 있는지 엔진을 점검할 것이다.',
    },
  },
  {
    id: 'spectator',
    english: 'spectator',
    korean: '구경꾼 · 관중',
    blocks: [
      { kind: 'root', text: 'spect', gloss: '보다' },
      { kind: 'suffix', text: '-ator', gloss: '~하는 사람' },
    ],
    decompose: 'spect (보다) + -ator (사람) → 보는 사람',
    example: {
      en: 'Every spectator rose to their feet as the final whistle blew.',
      ko: '종료 휘슬이 울리자 모든 관중이 자리에서 일어섰다.',
    },
  },
  {
    id: 'perspective',
    english: 'perspective',
    korean: '관점 · 시각',
    blocks: [
      { kind: 'prefix', text: 'per-', gloss: '~을 통해' },
      { kind: 'root', text: 'spect', gloss: '보다' },
      { kind: 'suffix', text: '-ive', gloss: '명사화' },
    ],
    decompose: 'per (관통하여) + spect (보다) → 무언가를 꿰뚫어 보는 방식',
    example: {
      en: 'From a historian’s perspective, the treaty was a turning point.',
      ko: '역사가의 관점에서 그 조약은 전환점이었다.',
    },
  },
  {
    id: 'suspect',
    english: 'suspect',
    korean: '의심하다 · 용의자',
    blocks: [
      { kind: 'prefix', text: 'sus-', gloss: '아래에서' },
      { kind: 'root', text: 'spec', gloss: '보다' },
      { kind: 'suffix', text: 't', gloss: '동사화' },
    ],
    decompose: 'sus (밑에서) + spec (보다) → 몰래 훔쳐보다 = 의심하다',
    example: {
      en: 'Police suspect the fire was started deliberately.',
      ko: '경찰은 그 화재가 의도적으로 시작되었다고 의심한다.',
    },
  },
  {
    id: 'conspicuous',
    english: 'conspicuous',
    korean: '눈에 띄는 · 두드러진',
    blocks: [
      { kind: 'prefix', text: 'con-', gloss: '완전히' },
      { kind: 'root', text: 'spic', gloss: '보다' },
      { kind: 'suffix', text: '-uous', gloss: '형용사화' },
    ],
    decompose: 'con (완전히) + spic (보이는) → 누구의 눈에든 띄는',
    example: {
      en: 'Her red coat made her conspicuous in the gray crowd.',
      ko: '빨간 코트가 회색 인파 속에서 그녀를 눈에 띄게 만들었다.',
    },
  },
];

export default function RootStudyPage() {
  const [openId, setOpenId] = useState<string | null>('inspect');

  return (
    <div className="rs-root">
      <div className="rs-inner">
        <div className="rs-topbar">
          <button type="button" className="rs-back" onClick={() => history.back()}>
            어근 목록
          </button>
          <span className="rs-crumb">
            ROOT STUDY · <b>{ROOT.level}</b> · 23 / 100
          </span>
        </div>

        <header className="rs-masthead">
          <div className="rs-masthead-eyebrow">
            <span>Root No. 17 · Latin</span>
          </div>
          <h1 className="rs-masthead-display">
            spec<em>·</em>
          </h1>
          <div className="rs-masthead-meta">
            <div className="rs-meta-cell">
              <span className="k">Korean</span>
              <span className="v">{ROOT.meaningKo}</span>
            </div>
            <div className="rs-meta-cell">
              <span className="k">English</span>
              <span className="v it">{ROOT.meaningEn}</span>
            </div>
            <div className="rs-meta-cell">
              <span className="k">Etymology</span>
              <span className="v it">{ROOT.origin}</span>
            </div>
            <div className="rs-meta-cell">
              <span className="k">Variants</span>
              <span className="v">{ROOT.family.join(' · ')}</span>
            </div>
          </div>
        </header>

        <div className="rs-section-head">
          <h2>
            이 어근에서 자란 <em>다섯 단어</em>
          </h2>
          <span className="count">5 / 12 unlocked</span>
        </div>

        <div className="rs-derived">
          {WORDS.map((w) => {
            const open = openId === w.id;
            return (
              <article
                key={w.id}
                className={`rs-word ${open ? 'open' : ''}`}
                onClick={() => setOpenId(open ? null : w.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpenId(open ? null : w.id);
                  }
                }}
              >
                <div className="rs-blocks">
                  {w.blocks.map((b, i) => (
                    <span key={i} className={`rs-block ${b.kind}`}>
                      {b.kind !== 'joiner' && (
                        <span className="gloss">{b.gloss}</span>
                      )}
                      <span className="glyph">{b.text}</span>
                    </span>
                  ))}
                </div>

                <div className="rs-word-caption">
                  <span className="rs-word-ko">{w.korean}</span>
                  <button
                    type="button"
                    className="rs-word-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(open ? null : w.id);
                    }}
                  >
                    {open ? '접기 –' : '예문 보기 +'}
                  </button>
                </div>

                <div className="rs-word-detail">
                  <div className="inner">
                    <p className="rs-decompose">
                      <b>{w.english}</b> = {w.decompose}
                    </p>
                    <div className="rs-example">
                      <span className="en">"{w.example.en}"</span>
                      <span className="ko">{w.example.ko}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="rs-footer">
          <div className="rs-progress">
            <div className="rs-progress-label">
              <span>이 어근의 진도</span>
              <b>Box {ROOT.box} / {ROOT.boxTotal}</b>
            </div>
            <div className="rs-progress-dots">
              {Array.from({ length: ROOT.boxTotal }).map((_, i) => {
                const idx = i + 1;
                const cls =
                  idx < ROOT.box ? 'on' : idx === ROOT.box ? 'on current' : '';
                return <span key={i} className={`dot ${cls}`} />;
              })}
            </div>
          </div>
          <div className="rs-cta-group">
            <button type="button" className="rs-cta secondary">
              다음 어근
            </button>
            <button type="button" className="rs-cta primary">
              추론 퀴즈
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
