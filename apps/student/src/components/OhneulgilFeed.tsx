import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecommendationStore } from '../store';
import { RecItem } from '../api';
import './OhneulgilFeed.css';

/** 액션 타입 → 한국어 라벨 + 기본 아이콘 (rs-api-contract type enum) */
const TYPE_META: Record<RecItem['type'], { label: string; icon: string }> = {
  gacha_deck:   { label: '단어덱',   icon: '🃏' },
  jingdari_set: { label: '징다리',   icon: '🪜' },
  proof:        { label: '증명',     icon: '📐' },
  assignment:   { label: '과제',     icon: '📋' },
  review:       { label: '복습',     icon: '🔁' },
  exam:         { label: '시험',     icon: '📝' },
};

/** urgency → 한국어 뱃지 라벨 (색은 CSS data-urgency 토큰으로) */
const URGENCY_LABEL: Record<RecItem['urgency'], string> = {
  critical: '급함',
  high:     '오늘',
  medium:   '곧',
  low:      '여유',
};

function metaFor(item: RecItem) {
  const m = TYPE_META[item.type] ?? { label: item.type, icon: '✨' };
  return { label: m.label, icon: item.icon || m.icon };
}

export default function OhneulgilFeed() {
  const navigate = useNavigate();
  const todayActions = useRecommendationStore((s) => s.todayActions);
  const todayLoading = useRecommendationStore((s) => s.todayLoading);
  const coldStart = useRecommendationStore((s) => s.coldStart);
  const act = useRecommendationStore((s) => s.act);

  // 노출된 아이템에 한 번만 'shown' 신호 — id 집합으로 dedupe
  const shownRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const item of todayActions) {
      if (!shownRef.current.has(item.id)) {
        shownRef.current.add(item.id);
        void act(item.id, 'shown');
      }
    }
  }, [todayActions, act]);

  // 스토리 링: 등장한 액션 타입을 순서·중복제거로 (rank 정렬 유지)
  const rings = useMemo(() => {
    const seen = new Set<RecItem['type']>();
    const out: Array<{ type: RecItem['type']; label: string; icon: string }> = [];
    for (const a of todayActions) {
      if (seen.has(a.type)) continue;
      seen.add(a.type);
      const m = metaFor(a);
      out.push({ type: a.type, label: m.label, icon: m.icon });
    }
    return out;
  }, [todayActions]);

  const goAction = (item: RecItem) => {
    void act(item.id, 'clicked');
    navigate(item.target_path);
  };

  const scrollToType = (type: RecItem['type']) => {
    const el = document.getElementById(`og-card-${type}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ── 빈 / 콜드스타트: 가르치고 비우지 않는다 ──
  if (!todayLoading && (todayActions.length === 0 || coldStart)) {
    return (
      <section className="og" aria-label="오늘의 길">
        <header className="og-head">
          <h2 className="og-title">오늘의 길</h2>
        </header>
        <div className="og-cold">
          <div className="og-cold-mark" aria-hidden="true">🧭</div>
          <div className="og-cold-title">오늘의 길을 준비 중</div>
          <p className="og-cold-body">
            아직 너에게 꼭 맞는 길을 못 찾았어.<br />
            관심 단원을 고르면 매일 첫 코스를 깔아줄게.
          </p>
          <button
            type="button"
            className="og-cold-cta"
            onClick={() => navigate('/word-gacha/')}
          >
            관심 단원 고르기 →
          </button>
        </div>
      </section>
    );
  }

  if (todayLoading && todayActions.length === 0) {
    return (
      <section className="og" aria-label="오늘의 길">
        <header className="og-head">
          <h2 className="og-title">오늘의 길</h2>
        </header>
        <div className="og-loading">오늘의 길을 그리는 중…</div>
      </section>
    );
  }

  return (
    <section className="og" aria-label="오늘의 길">
      <header className="og-head">
        <h2 className="og-title">오늘의 길</h2>
        <span className="og-count">{todayActions.length}</span>
      </header>

      {/* ── 스토리 링 strip — 액션 타입 미리보기 ── */}
      {rings.length > 0 && (
        <div className="og-rings" role="list" aria-label="오늘의 학습 종류">
          {rings.map((r) => (
            <button
              key={r.type}
              type="button"
              role="listitem"
              className="og-ring"
              data-type={r.type}
              onClick={() => scrollToType(r.type)}
              aria-label={`${r.label}(으)로 이동`}
            >
              <span className="og-ring-disc" aria-hidden="true">
                <span className="og-ring-emoji">{r.icon}</span>
              </span>
              <span className="og-ring-label">{r.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── 랭킹 액션 카드 ── */}
      <ol className="og-cards">
        {todayActions.map((item) => {
          const m = metaFor(item);
          const isLead = item.rank === 1;
          const boosted = item.status === 'teacher_boosted';
          const fromTeacher =
            item.status === 'teacher_boosted' || item.status === 'teacher_approved';
          return (
            <li
              key={item.id}
              id={`og-card-${item.type}`}
              className="og-card"
              data-urgency={item.urgency}
              data-lead={isLead ? 'true' : undefined}
            >
              {isLead && <span className="og-here">지금 여기</span>}
              <div className="og-card-top">
                <span className="og-card-icon" aria-hidden="true">{m.icon}</span>
                <div className="og-card-headtext">
                  <div className="og-card-tags">
                    <span className="og-tag og-tag--type">{m.label}</span>
                    <span className="og-tag og-tag--urgency" data-urgency={item.urgency}>
                      {URGENCY_LABEL[item.urgency]}
                    </span>
                    {boosted && <span className="og-tag og-tag--boost">쌤 추천</span>}
                  </div>
                  <h3 className="og-card-title">{item.title}</h3>
                </div>
              </div>

              {item.reason && (
                <p className="og-card-reason">
                  <span className="og-card-reason-mark" aria-hidden="true" />
                  {item.reason}
                </p>
              )}

              {fromTeacher && item.teacher_note && (
                <p className="og-card-note">선생님 메모 · {item.teacher_note}</p>
              )}

              <button
                type="button"
                className="og-card-cta"
                onClick={() => goAction(item)}
              >
                {isLead ? '바로 시작' : '풀러 가기'}
                <span className="og-card-cta-arrow" aria-hidden="true">→</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
