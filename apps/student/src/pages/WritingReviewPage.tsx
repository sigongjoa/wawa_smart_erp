import { useState } from 'react';
import './WritingReviewPage.css';

type Category = 'grammar' | 'word' | 'logic' | 'clarity';
type Change = {
  id: number;
  cat: Category;
  before: string;
  after: string;
  reason: string;
  paragraph: number;
};

const CHANGES: Change[] = [
  {
    id: 1,
    cat: 'word',
    before: 'There are three ways we can do.',
    after: 'There are three things we can do.',
    reason: '"way"는 방법 자체를 지칭. 행동의 *대상*은 "things". 한국어 "세 가지 방법이 있다"의 직역으로 자주 발생.',
    paragraph: 1,
  },
  {
    id: 2,
    cat: 'grammar',
    before: "turning off the light when we don't use",
    after: "turning off the lights when we are not using them",
    reason: '복수형 + 진행형 + 목적어 they. 가산명사의 일반 지칭은 복수, 동작의 지속성은 진행형.',
    paragraph: 2,
  },
  {
    id: 3,
    cat: 'grammar',
    before: 'instead of car',
    after: 'instead of a car',
    reason: '가산명사 단수 앞 부정관사 필수. 영어 가산성은 한국어에 없는 개념이라 자주 누락.',
    paragraph: 2,
  },
  {
    id: 4,
    cat: 'logic',
    before: "Many companies sell products with too much plastic, and consumers should refuse them.",
    after: '인과/대조 연결어 필요 — "Although companies… , consumers can pressure them by refusing to buy."',
    reason: '두 절의 관계 모호. 양보(Although)로 명시하면 thesis와의 정렬이 분명해짐.',
    paragraph: 3,
  },
  {
    id: 5,
    cat: 'grammar',
    before: 'from young age',
    after: 'from a young age',
    reason: '관용 표현. "at an early age" 도 가능. 부정관사 누락이 가장 잦은 한국 학생 패턴.',
    paragraph: 4,
  },
  {
    id: 6,
    cat: 'grammar',
    before: 'can make difference',
    after: 'can make a difference',
    reason: '"a difference" 가 정형 표현. 부정관사 없으면 비문.',
    paragraph: 5,
  },
];

const CAT_LABEL: Record<Category, string> = {
  grammar: 'GRAMMAR',
  word: 'WORD CHOICE',
  logic: 'LOGIC',
  clarity: 'CLARITY',
};

export default function WritingReviewPage() {
  const [activeId, setActiveId] = useState<number | null>(2);
  const [filter, setFilter] = useState<Set<Category>>(
    new Set<Category>(['grammar', 'word', 'logic', 'clarity']),
  );

  const counts = {
    grammar: CHANGES.filter((c) => c.cat === 'grammar').length,
    word: CHANGES.filter((c) => c.cat === 'word').length,
    logic: CHANGES.filter((c) => c.cat === 'logic').length,
    clarity: 0,
  };

  const Mark = ({ change, children }: { change: Change; children: React.ReactNode }) => (
    <>
      <span
        className={`wrv-mark ${change.cat}`}
        onClick={() => setActiveId(activeId === change.id ? null : change.id)}
      >
        {children}
        <sup>{change.id}</sup>
      </span>
      {activeId === change.id && (
        <span className={`wrv-popup ${change.cat}`}>
          <span className="head">
            <span className="cat">{CAT_LABEL[change.cat]} · NO. {change.id}</span>
            <button className="act" onClick={() => setActiveId(null)}>닫기</button>
          </span>
          <span className="diff">
            <span className="before">{change.before}</span>
            <span className="after">{change.after}</span>
          </span>
          <p className="reason">
            <b>왜?</b> {change.reason}
          </p>
          <span className="actions">
            <button className="act accept">제안 수락</button>
            <button className="act">건너뛰기</button>
            <button className="act">단어장에 어휘 추가</button>
          </span>
        </span>
      )}
    </>
  );

  return (
    <div className="wrv-root">
      <div className="wrv-topbar">
        <span className="pass">Pass <b>2</b> / 3 · AI Review</span>
        <span className="ai-tag">Gemini 1.5 · 12s</span>
      </div>

      <header className="wrv-summary">
        <div>
          <h1>
            네 글에 <em>여섯 군데</em>가 다듬을 만해.
          </h1>
          <p className="sub">
            전체 흐름은 명확하고 thesis가 잘 잡혀 있어. 다만 관사·복수형 처리와 한 곳의
            논리 연결이 아쉬워. 하나씩 살펴보고 수락 또는 무시할 수 있어.
          </p>
        </div>
        <div className="wrv-scores">
          <div className="wrv-score bad">
            <span className="k">Grammar</span>
            <span className="v">{counts.grammar}</span>
          </div>
          <div className="wrv-score warn">
            <span className="k">Word</span>
            <span className="v">{counts.word}</span>
          </div>
          <div className="wrv-score info">
            <span className="k">Logic</span>
            <span className="v">{counts.logic}</span>
          </div>
          <div className="wrv-score good">
            <span className="k">Score</span>
            <span className="v">82</span>
          </div>
        </div>
      </header>

      <div className="wrv-layout">
        <main className="wrv-paper">
          <div className="wrv-paper-head">
            <span className="wrv-paper-title">김지원 — Climate change is one…</span>
            <span className="wrv-paper-meta">253 WORDS · REVIEWED</span>
          </div>

          <article className="wrv-essay">
            <p>
              Climate change is one of the most serious problems that we are facing today.
              Many people think that the government must solve this problem. However, I
              believe that individuals also have important roles.{' '}
              <Mark change={CHANGES[0]}>There are three ways we can do.</Mark>
            </p>
            <p>
              First, we can reduce our energy use. For example,{' '}
              <Mark change={CHANGES[1]}>
                turning off the light when we don't use
              </Mark>{' '}
              can save much energy. Also, using public transportation{' '}
              <Mark change={CHANGES[2]}>instead of car</Mark> helps reducing the air pollution.
            </p>
            <p>
              Second, we should change our consumption habit. Buying eco-friendly products
              and avoiding excessive plastic packaging is important.{' '}
              <Mark change={CHANGES[3]}>
                Many companies sell products with too much plastic, and consumers should refuse them.
              </Mark>
            </p>
            <p>
              Finally, education is essential. If we teach children about environment{' '}
              <Mark change={CHANGES[4]}>from young age</Mark>, they will grow up as
              responsible citizens. Schools should include environmental education in their
              regular curriculum.
            </p>
            <p>
              In conclusion, although the government has the biggest power, every individual's
              small action <Mark change={CHANGES[5]}>can make difference</Mark>. Together, we
              can protect our planet for the next generation.
            </p>
          </article>
        </main>

        <aside className="wrv-sidebar">
          <div className="wrv-side-card">
            <h3>
              수정 제안 <span className="count">{CHANGES.length} / {CHANGES.length}</span>
            </h3>
            <div className="wrv-filters">
              {(['grammar', 'word', 'logic', 'clarity'] as Category[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`wrv-chip ${c} ${filter.has(c) ? 'on' : ''}`}
                  onClick={() => {
                    const next = new Set(filter);
                    if (next.has(c)) next.delete(c);
                    else next.add(c);
                    setFilter(next);
                  }}
                >
                  {CAT_LABEL[c]}
                </button>
              ))}
            </div>
            {CHANGES.filter((c) => filter.has(c.cat)).map((c) => (
              <div
                key={c.id}
                className="wrv-change"
                onClick={() => setActiveId(c.id)}
              >
                <span className={`pin ${c.cat}`}>#{c.id}</span>
                <div className="body">
                  <span className="before">{c.before.slice(0, 40)}{c.before.length > 40 ? '…' : ''}</span>
                  <span className="after">→ {c.after.slice(0, 32)}{c.after.length > 32 ? '…' : ''}</span>
                  <span className="reason">P{c.paragraph} · {c.reason.slice(0, 36)}…</span>
                </div>
              </div>
            ))}
          </div>

          <div className="wrv-side-card">
            <h3>AI 총평</h3>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--wrv-ink-soft)', margin: 0 }}>
              <b style={{ color: 'var(--wrv-clarity)', fontFamily: 'Fraunces, serif', fontStyle: 'italic' }}>좋은 점:</b>{' '}
              thesis ("individuals have important roles") 위치가 명확하고 결론의 call-to-action도 잘 작동해.
              <br /><br />
              <b style={{ color: 'var(--wrv-grammar)', fontFamily: 'Fraunces, serif', fontStyle: 'italic' }}>다듬을 점:</b>{' '}
              한국어 사고를 그대로 영어로 옮긴 흔적 (관사 누락, 가산성, "way" 오용)이 반복돼. 패턴을 인식하면 다음 글에서 줄어들 거야.
            </p>
          </div>
        </aside>
      </div>

      <div className="wrv-dock">
        <button className="wrv-dock-btn">초안으로</button>
        <button className="wrv-dock-btn">전체 수락</button>
        <button className="wrv-dock-btn primary">최종 확정 · 메타 학습</button>
      </div>
    </div>
  );
}
