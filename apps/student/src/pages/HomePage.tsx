import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Session, ProofListItem, AssignmentListItem, ExamListItem } from '../api';
import { useAuthStore } from '../store';
import './HomePage.css';

type TileType = 'water' | 'grass' | 'electric' | 'ground' | 'psychic' | 'dragon';

interface TileSpec {
  type: TileType;
  typeLabel: string;   // WATER, GRASS — mono 9px 라벨
  label: string;       // 카드, 증명 — 20px Black 한글
  num: number;
  total?: number;
  onClick?: () => void;
  disabled?: boolean;
}

export default function HomePage() {
  const navigate = useNavigate();
  const auth = useAuthStore((s) => s.auth);
  const [session, setSession] = useState<Session | null>(null);
  const [proofs, setProofs] = useState<ProofListItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [examChecking, setExamChecking] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSession().catch(() => null),
      api.getProofs().catch(() => []),
      api.getAssignments().catch(() => []),
      api.listExams().catch(() => []),
    ]).then(([sess, prfs, asns, exs]) => {
      setSession(sess);
      setProofs(prfs || []);
      setAssignments(asns || []);
      setExams(exs || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const active = await api.getActiveExamAttempt();
        if (cancelled) return;
        if (active && ['running', 'paused'].includes(active.status)) {
          navigate('/exam-timer', { replace: true });
          return;
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setExamChecking(false); }
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await api.getActiveLiveSession();
        if (cancelled) return;
        if (res?.session) navigate(`/live/${res.session.id}`, { replace: true });
      } catch { /* ignore */ }
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [navigate]);

  const pendingAssignments = useMemo(
    () => assignments.filter((a) => a.status !== 'completed'),
    [assignments]
  );

  const weekCells = useMemo(() => buildWeekStrip(session), [session]);

  if (loading || examChecking) {
    return (
      <div className="hp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="hp-footer" style={{ padding: 40 }}>LOADING…</div>
      </div>
    );
  }

  const studentName = auth?.student.name || '학생';
  const grade = auth?.student.grade;
  const gradeLabel = grade && grade !== '미지정' ? grade : 'TRAINEE';

  const totalDone = (session?.cards_drawn || 0) + (session?.proofs_done || 0);
  const totalTarget = (session?.cards_target || 10) + (session?.proofs_target || 5);
  const progressPct = totalTarget > 0 ? Math.min(100, Math.round((totalDone / totalTarget) * 100)) : 0;

  const tiles: TileSpec[] = [
    {
      type: 'water',
      typeLabel: 'WATER',
      label: '단어',
      num: session?.cards_drawn ?? 0,
      total: session?.cards_target ?? 10,
      onClick: () => navigate('/gacha'),
    },
    {
      type: 'grass',
      typeLabel: 'GRASS',
      label: '증명',
      num: session?.proofs_done ?? 0,
      total: session?.proofs_target ?? 5,
      disabled: proofs.length === 0,
      onClick: proofs.length > 0 ? () => navigate(`/proof/${proofs[0].id}/ordering`) : undefined,
    },
    {
      type: 'electric',
      typeLabel: 'PAPER',
      label: '과제',
      num: pendingAssignments.length,
      onClick: () => navigate('/assignments'),
    },
    {
      type: 'ground',
      typeLabel: 'EXAM',
      label: '시험',
      num: exams.length,
      disabled: exams.length === 0,
      onClick: exams.length > 0 ? () => {
        const first = exams[0];
        const ready = first.questionCount > 0;
        const done = first.attemptStatus === 'submitted' || first.attemptStatus === 'expired';
        if (ready && !done) navigate(`/exam/${first.assignmentId}`);
      } : undefined,
    },
  ];

  const difficultyBar = (d: number) => {
    const filled = Math.max(0, Math.min(5, d));
    return '█'.repeat(filled) + '░'.repeat(5 - filled);
  };

  return (
    <div className="hp">
      {/* ── Trainer Card ─────────────────────────── */}
      <header className="hp-trainer">
        <div className="hp-trainer-row">
          <div>
            <span className="hp-trainer-label">TRAINER</span>
            <h1 className="hp-trainer-name">{studentName}</h1>
          </div>
          <span className="hp-trainer-grade">{gradeLabel}</span>
        </div>
      </header>

      {/* ── Today's Quest ────────────────────────── */}
      <section className="hp-quest">
        <div className="hp-quest-head">
          <span className="hp-quest-title">오늘의 퀘스트</span>
          <div className="hp-week" aria-label="이번 주 진행">
            {weekCells.map((state, i) => (
              <span key={i} className="hp-week-cell" data-state={state} />
            ))}
          </div>
        </div>
        <div className="hp-quest-body">
          <div className="hp-quest-score" aria-label={`${totalDone} of ${totalTarget} complete`}>
            <span>{totalDone}</span>
            <span className="hp-quest-score-sep">/</span>
            <span className="hp-quest-score-target">{totalTarget}</span>
          </div>
          <span className="hp-quest-pct">{progressPct}%</span>
        </div>
      </section>

      {/* ── Ranger Menu 2×2 ──────────────────────── */}
      <section className="hp-menu" aria-label="학습 메뉴">
        {tiles.map((t) => (
          <button
            key={t.typeLabel}
            type="button"
            className={`hp-tile hp-tile--${t.type}`}
            onClick={t.onClick}
            disabled={t.disabled || !t.onClick}
          >
            <span className="hp-tile-type">{t.typeLabel}</span>
            <span className="hp-tile-label">{t.label}</span>
            <div className="hp-tile-value">
              <span className="hp-tile-value-num">{t.num}</span>
              {typeof t.total === 'number' && (
                <span className="hp-tile-value-sub">/ {t.total}</span>
              )}
            </div>
          </button>
        ))}
      </section>

      {/* ── 과제 (있을 때만) ──────────────────────── */}
      {pendingAssignments.length > 0 && (
        <section className="hp-section">
          <header className="hp-section-head">
            <h2 className="hp-section-title">과제</h2>
            <button
              type="button"
              className="hp-section-link"
              onClick={() => navigate('/assignments')}
            >
              ALL {pendingAssignments.length}
            </button>
          </header>
          {pendingAssignments.slice(0, 3).map((a) => (
            <AssignmentRow
              key={a.target_id}
              a={a}
              onClick={() => navigate(`/assignments/${a.target_id}`)}
            />
          ))}
        </section>
      )}

      {/* ── 배정된 증명 ───────────────────────────── */}
      {proofs.length > 0 && (
        <section className="hp-section">
          <header className="hp-section-head">
            <h2 className="hp-section-title">증명</h2>
            <span className="hp-section-meta">{proofs.length}개 배정</span>
          </header>
          {proofs.slice(0, 3).map((p) => (
            <div key={p.id} className="hp-row" style={{ cursor: 'default' }}>
              <span className="hp-row-bar hp-row-bar--grass" />
              <div className="hp-row-body">
                <span className="hp-row-title">{p.title}</span>
                <span className="hp-row-meta">
                  {p.grade} · {difficultyBar(p.difficulty)} · {p.step_count}단계
                  {p.best_score !== null && ` · BEST ${p.best_score}`}
                </span>
              </div>
              <div className="hp-proof-actions">
                <button
                  type="button"
                  className="hp-proof-btn hp-proof-btn--solid"
                  onClick={() => navigate(`/proof/${p.id}/ordering`)}
                >
                  ORDER
                </button>
                <button
                  type="button"
                  className="hp-proof-btn"
                  onClick={() => navigate(`/proof/${p.id}/fillblank`)}
                >
                  BLANK
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Footer ────────────────────────────────── */}
      <footer className="hp-footer">와와 학원 · LEARN</footer>
    </div>
  );
}

/* ─ 과제 행 (상태별 bar 색 + 배지) ─────────────────────── */
function AssignmentRow({ a, onClick }: { a: AssignmentListItem; onClick: () => void }) {
  const { barClass, statusClass, statusLabel } = (() => {
    switch (a.status) {
      case 'needs_resubmit':
        return { barClass: 'hp-row-bar--danger', statusClass: 'hp-row-status--danger', statusLabel: 'RESUBMIT' };
      case 'assigned':
        return { barClass: 'hp-row-bar--electric', statusClass: 'hp-row-status--warning', statusLabel: 'TODO' };
      case 'submitted':
        return { barClass: 'hp-row-bar--water', statusClass: 'hp-row-status--water', statusLabel: 'REVIEW' };
      default:
        return { barClass: 'hp-row-bar--dragon', statusClass: 'hp-row-status--dragon', statusLabel: 'PENDING' };
    }
  })();

  const dueLabel = a.due_at
    ? new Date(a.due_at).toLocaleString('ko-KR', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <button type="button" className="hp-row" onClick={onClick}>
      <span className={`hp-row-bar ${barClass}`} />
      <div className="hp-row-body">
        <span className="hp-row-title">{a.title}</span>
        {dueLabel && <span className="hp-row-meta">DUE · {dueLabel}</span>}
      </div>
      <span className={`hp-row-status ${statusClass}`}>{statusLabel}</span>
    </button>
  );
}

/* ─ 이번주 7일 셀 상태 (mon..sun) ───────────────────────── */
type WeekState = 'idle' | 'done' | 'today';
function buildWeekStrip(session: Session | null): WeekState[] {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const monIdx = (day + 6) % 7; // 0=Mon..6=Sun
  const hasProgress = !!session && ((session.cards_drawn ?? 0) > 0 || (session.proofs_done ?? 0) > 0);

  const out: WeekState[] = [];
  for (let i = 0; i < 7; i++) {
    if (i < monIdx) out.push('done');           // 단순 표현: 주 초반 셀은 done 으로 채움 (진척감)
    else if (i === monIdx) out.push(hasProgress ? 'today' : 'today');
    else out.push('idle');
  }
  // 오늘이 월요일이라 done 이 없으면 전부 비어보이니 최소 오늘은 today 유지됨 (위 로직으로 보장)
  return out;
}
