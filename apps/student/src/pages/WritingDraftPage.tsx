import { useState } from 'react';
import './WritingDraftPage.css';

const PROMPT = {
  course: '수행평가 · 환경 단원',
  title: '환경 보호를 위한 개인의 역할',
  description:
    '기후 위기에 직면한 오늘, 개인이 할 수 있는 행동은 무엇인지 자신의 의견을 영어 에세이로 작성하세요.',
  wordGoal: 250,
  timeLimit: '45분',
  guide: [
    '본론에서 구체적인 근거 3가지를 제시할 것',
    '서론에 thesis statement 명시',
    '결론에 행동 촉구(call to action) 포함',
  ],
};

const SAMPLE_DRAFT = `Climate change is one of the most serious problems that we are facing today. Many people think that the government must solve this problem. However, I believe that individuals also have important roles. There are three ways we can do.

First, we can reduce our energy use. For example, turning off the light when we don't use can save much energy. Also, using public transportation instead of car helps reducing the air pollution.

Second, we should change our consumption habit. Buying eco-friendly products and avoiding excessive plastic packaging is important. Many companies sell products with too much plastic, and consumers should refuse them.

Finally, education is essential. If we teach children about environment from young age, they will grow up as responsible citizens. Schools should include environmental education in their regular curriculum.

In conclusion, although the government has the biggest power, every individual's small action can make difference. Together, we can protect our planet for the next `;

export default function WritingDraftPage() {
  const [text, setText] = useState(SAMPLE_DRAFT);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 3).length;
  const goalPct = Math.min(100, Math.round((words / PROMPT.wordGoal) * 100));

  return (
    <div className="wd-root">
      <div className="wd-topbar">
        <span className="pass">Pass <b>1</b> / 3 · Draft</span>
        <span className="save">자동 저장됨 · 14:32</span>
      </div>

      <div className="wd-layout">
        <aside className="wd-prompt">
          <span className="label">{PROMPT.course}</span>
          <h2>
            환경 보호를 위한 <em>개인의 역할</em>
          </h2>
          <p className="desc">{PROMPT.description}</p>
          <div className="guide">
            <b>작성 가이드</b>
            <ul>
              {PROMPT.guide.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="wd-paper">
          <div className="wd-paper-head">
            <span className="wd-paper-title">초안 · 김지원 · 고1-3</span>
            <span className="wd-paper-meta">DRAFT · 14:32 · 32MIN</span>
          </div>
          <textarea
            className="wd-editor"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder="여기에 영어로 작성하세요…"
          />
        </main>

        <aside className="wd-stats">
          <div className="wd-stat">
            <span className="k">Words</span>
            <span className="v">
              {words}<small>/ {PROMPT.wordGoal}</small>
            </span>
            <div className="wd-goal">
              <div className="fill" style={{ width: `${goalPct}%` }} />
            </div>
          </div>
          <div className="wd-stat">
            <span className="k">Sentences</span>
            <span className="v">{sentences}</span>
          </div>
          <div className="wd-stat">
            <span className="k">Elapsed</span>
            <span className="v">32<small>min</small></span>
          </div>
          <div className="wd-stat">
            <span className="k">Limit</span>
            <span className="v">{PROMPT.timeLimit.replace('분', '')}<small>min</small></span>
          </div>
        </aside>
      </div>

      <div className="wd-dock">
        <button className="wd-dock-btn">임시 저장</button>
        <button className="wd-dock-btn">맞춤법만 확인</button>
        <button className="wd-dock-btn primary">AI 첨삭 받기</button>
      </div>
    </div>
  );
}
