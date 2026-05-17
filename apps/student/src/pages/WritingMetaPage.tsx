import { Fragment, useState } from 'react';
import './WritingMetaPage.css';

/* ── Section 1: Thesis ───────────────────────────────────── */
type Thesis = {
  letter: 'a' | 'b' | 'c';
  text: string;
  correct?: boolean;
  verdict: string;
};

const THESES: Thesis[] = [
  {
    letter: 'a',
    text: '정부가 환경 문제 해결을 주도해야 한다.',
    verdict:
      '본문의 도입에선 정부 역할을 인정하지만, 글 전체는 "individuals also have important roles"를 강조한다. 이 선택지는 *반대 입장*에 가깝다.',
  },
  {
    letter: 'b',
    text: '개인의 작은 행동이 환경 보호를 만든다.',
    correct: true,
    verdict:
      '정확. thesis statement "individuals also have important roles" + 세 가지 근거(에너지·소비·교육) + 결론 "small action can make a difference"의 흐름이 일관된다.',
  },
  {
    letter: 'c',
    text: '교육이 환경 문제 해결의 가장 중요한 열쇠다.',
    verdict:
      '교육은 *세 가지 근거 중 하나*일 뿐이다. 한 가지를 thesis로 올리면 다른 두 근거(에너지·소비)가 떠 있게 된다.',
  },
];

/* ── Section 2: Key vocab (linked to root system) ────────── */
type Vocab = {
  word: string;
  ipa: string;
  ko: string;
  blocks: { type: 'prefix' | 'root' | 'suffix'; text: string }[];
  added?: boolean;
};

const VOCABS: Vocab[] = [
  { word: 'individual', ipa: '/ˌɪn.dɪˈvɪdʒ.u.əl/', ko: '개인의 · 한 사람의',
    blocks: [{ type: 'prefix', text: 'in-' }, { type: 'root', text: 'divid' }, { type: 'suffix', text: '-ual' }],
    added: true },
  { word: 'consumption', ipa: '/kənˈsʌmp.ʃən/', ko: '소비 · 섭취',
    blocks: [{ type: 'prefix', text: 'con-' }, { type: 'root', text: 'sumpt' }, { type: 'suffix', text: '-ion' }] },
  { word: 'excessive', ipa: '/ɪkˈses.ɪv/', ko: '지나친 · 과도한',
    blocks: [{ type: 'prefix', text: 'ex-' }, { type: 'root', text: 'cess' }, { type: 'suffix', text: '-ive' }] },
  { word: 'responsible', ipa: '/rɪˈspɒn.sə.bəl/', ko: '책임 있는',
    blocks: [{ type: 'prefix', text: 're-' }, { type: 'root', text: 'spons' }, { type: 'suffix', text: '-ible' }] },
  { word: 'essential', ipa: '/ɪˈsen.ʃəl/', ko: '필수적인 · 본질적인',
    blocks: [{ type: 'root', text: 'ess' }, { type: 'suffix', text: '-ential' }] },
  { word: 'pollution', ipa: '/pəˈluː.ʃən/', ko: '오염 · 공해',
    blocks: [{ type: 'root', text: 'pollut' }, { type: 'suffix', text: '-ion' }] },
  { word: 'generation', ipa: '/ˌdʒen.əˈreɪ.ʃən/', ko: '세대 · 발생',
    blocks: [{ type: 'root', text: 'gener' }, { type: 'suffix', text: '-ation' }] },
];

/* ── Section 3: Logical structure ────────────────────────── */
type StructLabel = 'hook' | 'claim' | 'evidence' | 'counter' | 'conclusion';

const LABEL_LIST: { key: StructLabel; ko: string }[] = [
  { key: 'hook', ko: 'HOOK / 도입' },
  { key: 'claim', ko: 'CLAIM / 주장' },
  { key: 'evidence', ko: 'EVIDENCE / 근거' },
  { key: 'counter', ko: 'COUNTER / 반박' },
  { key: 'conclusion', ko: 'CONCLUSION' },
];

const PARAS: { num: string; excerpt: string; answer: StructLabel }[] = [
  { num: '01', excerpt: '"Climate change is one of the most serious problems… individuals also have important roles."', answer: 'claim' },
  { num: '02', excerpt: '"First, we can reduce our energy use… turning off the lights… using public transportation…"', answer: 'evidence' },
  { num: '03', excerpt: '"Second, we should change our consumption habit… Buying eco-friendly products…"', answer: 'evidence' },
  { num: '04', excerpt: '"Finally, education is essential. If we teach children about environment from a young age…"', answer: 'evidence' },
  { num: '05', excerpt: '"In conclusion, although the government has the biggest power, every individual\'s small action can make a difference."', answer: 'conclusion' },
];

export default function WritingMetaPage() {
  const [thesisPick, setThesisPick] = useState<Thesis['letter'] | null>('b');
  const [vocabAdded, setVocabAdded] = useState<Set<string>>(
    new Set(['individual', 'consumption']),
  );
  const [labels, setLabels] = useState<Record<string, StructLabel | null>>({
    '01': 'claim',
    '02': 'evidence',
    '03': null,
    '04': null,
    '05': null,
  });

  const usedLabels = new Set(Object.values(labels).filter(Boolean) as StructLabel[]);

  const toggleVocab = (w: string) => {
    const next = new Set(vocabAdded);
    if (next.has(w)) next.delete(w);
    else next.add(w);
    setVocabAdded(next);
  };

  return (
    <div className="wmp-root">
      <div className="wmp-topbar">
        <span className="pass">Pass <b>3</b> / 3 · Meta Practice</span>
        <span className="score">자기 글로 배우기 · 진행도 42%</span>
      </div>

      <div className="wmp-inner">
        <header className="wmp-hero">
          <span className="eyebrow">From your own essay · Climate change</span>
          <h1>
            네 글이 곧 <em>너의 교재</em>.
          </h1>
          <p className="sub">
            방금 다듬은 에세이를 토대로 세 가지 메타 학습을 해볼 거야 — 글의 요지를 다시
            확인하고, 그 안에 어떤 어휘와 어근이 살고 있는지 살펴보고, 문단들이 어떻게
            논리적으로 자리 잡았는지 라벨링해보자.
          </p>
        </header>

        {/* ═══ Section 1: Thesis ═══════════════════════════ */}
        <section className="wmp-section">
          <div className="wmp-section-head">
            <span className="head-row">
              <span className="no">01</span>
              <span className="text">
                <h2>
                  네 글의 <em>진짜 요지</em>는 어느 것?
                </h2>
                <span className="why">
                  글을 끝까지 쓰고도 thesis를 한 줄로 못 짚는 경우가 많다. 본문의 흐름과
                  정렬되는 단 하나를 골라보자.
                </span>
              </span>
            </span>
            <span className="progress">1 / 1 · {thesisPick ? '응답됨' : '대기'}</span>
          </div>

          <div className="wmp-thesis-choices">
            {THESES.map((t) => {
              const picked = thesisPick === t.letter;
              const showVerdict = picked;
              const cls = !picked ? '' : t.correct ? 'correct' : 'wrong';
              return (
                <button
                  key={t.letter}
                  type="button"
                  className={`wmp-thesis-choice ${cls} ${picked ? 'selected' : ''}`}
                  onClick={() => setThesisPick(t.letter)}
                >
                  <span className="letter">{t.letter}</span>
                  <span className="body">{t.text}</span>
                  {showVerdict && (
                    <span className="verdict">
                      {t.correct ? '✓ ' : '× '}
                      {t.verdict}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ═══ Section 2: Key vocab ═══════════════════════ */}
        <section className="wmp-section">
          <div className="wmp-section-head">
            <span className="head-row">
              <span className="no">02</span>
              <span className="text">
                <h2>
                  글 속의 <em>핵심 어휘 일곱 개</em>
                </h2>
                <span className="why">
                  AI가 추출한 어휘는 어근까지 분해되어 있어. "추가" 버튼을 누르면 내 단어장에 들어가고
                  각 어근의 학습 상태와 자동 연결돼.
                </span>
              </span>
            </span>
            <span className="progress">{vocabAdded.size} / {VOCABS.length} 추가</span>
          </div>

          <div className="wmp-vocab-grid">
            {VOCABS.map((v) => (
              <article
                key={v.word}
                className={`wmp-vocab ${vocabAdded.has(v.word) ? 'added' : ''}`}
              >
                <div className="word">{v.word}</div>
                <div className="ipa">{v.ipa}</div>
                <div className="ko">{v.ko}</div>
                <div className="breakdown">
                  {v.blocks.map((b, i) => (
                    <Fragment key={i}>
                      {i > 0 && <span className="plus">·</span>}
                      <span className={`m ${b.type}`}>{b.text}</span>
                    </Fragment>
                  ))}
                </div>
                <div className="add">
                  <small>tier {Math.ceil(Math.random() * 2) + 1} · 신규</small>
                  <button type="button" onClick={() => toggleVocab(v.word)}>
                    {vocabAdded.has(v.word) ? '내 단어장' : '내 단어장에 추가'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ═══ Section 3: Structure ═══════════════════════ */}
        <section className="wmp-section">
          <div className="wmp-section-head">
            <span className="head-row">
              <span className="no">03</span>
              <span className="text">
                <h2>
                  각 문단의 <em>역할</em>은 무엇이었지?
                </h2>
                <span className="why">
                  좋은 글은 문단마다 분명한 *역할*을 갖는다. 아래 라벨을 각 문단으로 끌어
                  놓고, 흐름이 자연스러운지 확인해보자.
                </span>
              </span>
            </span>
            <span className="progress">
              {Object.values(labels).filter(Boolean).length} / {PARAS.length}
            </span>
          </div>

          <div className="wmp-structure">
            {PARAS.map((p) => {
              const label = labels[p.num];
              return (
                <div key={p.num} className="wmp-para">
                  <span className="num">{p.num}</span>
                  <span className="text">
                    <b>P{Number(p.num)}.</b> {p.excerpt}
                  </span>
                  <span
                    className={`drop ${label ? `set ${label}` : ''}`}
                    onClick={() => {
                      // mockup: clicking a filled drop removes its label
                      if (label) {
                        setLabels({ ...labels, [p.num]: null });
                      }
                    }}
                  >
                    {label
                      ? LABEL_LIST.find((l) => l.key === label)?.ko
                      : '라벨 놓기'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="wmp-label-tray">
            <span className="hint">Drag labels →</span>
            {LABEL_LIST.map((l) => (
              <span
                key={l.key}
                className={`wmp-label ${l.key} ${usedLabels.has(l.key) ? '' : ''}`}
                onClick={() => {
                  // mockup: clicking a label drops it into next empty paragraph
                  const empty = PARAS.find((p) => labels[p.num] === null);
                  if (empty) setLabels({ ...labels, [empty.num]: l.key });
                }}
              >
                {l.ko}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="wmp-dock">
        <button className="wmp-dock-btn">건너뛰기</button>
        <button className="wmp-dock-btn">다른 글 쓰기</button>
        <button className="wmp-dock-btn primary">워크북 PDF 저장</button>
      </div>
    </div>
  );
}
