import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Session, ProofListItem, AssignmentListItem, ExamListItem } from '../api';
import { useAuthStore } from '../store';
import './HomePage.css';

const DAY_LABEL = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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

  const todayLabel = useMemo(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}.${dd} · ${DAY_LABEL[d.getDay()]}`;
  }, []);

  if (loading || examChecking) {
    return (
      <div className="hp">
        <div className="hp-loading">LOADING…</div>
      </div>
    );
  }

  const studentName = auth?.student.name || '학생';
  const totalDone = (session?.cards_drawn || 0) + (session?.proofs_done || 0);
  const totalTarget = (session?.cards_target || 10) + (session?.proofs_target || 5);
  const progressPct = totalTarget > 0 ? Math.min(100, Math.round((totalDone / totalTarget) * 100)) : 0;

  const listItems: Array<{
    key: string;
    typeClass: string;
    label: string;
    value: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }> = [
    {
      key: 'words',
      typeClass: 'water',
      label: '단어',
      value: (<><strong>{session?.cards_drawn ?? 0}</strong> / {session?.cards_target ?? 10}</>),
      onClick: () => navigate('/gacha'),
    },
    {
      key: 'proof',
      typeClass: 'grass',
      label: '증명',
      value: (<><strong>{session?.proofs_done ?? 0}</strong> / {session?.proofs_target ?? 5}</>),
      disabled: proofs.length === 0,
      onClick: proofs.length > 0 ? () => navigate(`/proof/${proofs[0].id}/ordering`) : undefined,
    },
    {
      key: 'assignments',
      typeClass: 'electric',
      label: '과제',
      value: (<strong>{pendingAssignments.length}</strong>),
      onClick: () => navigate('/assignments'),
    },
    {
      key: 'exams',
      typeClass: 'ground',
      label: '시험',
      value: (<strong>{exams.length}</strong>),
      disabled: exams.length === 0,
      onClick: exams.length > 0 ? () => {
        const first = exams[0];
        const ready = first.questionCount > 0;
        const done = first.attemptStatus === 'submitted' || first.attemptStatus === 'expired';
        if (ready && !done) navigate(`/exam/${first.assignmentId}`);
      } : undefined,
    },
  ];

  return (
    <div className="hp" style={{ ['--hp-pct' as string]: `${progressPct}%` }}>
      {/* ── 상단 날짜 marker ───────────────────────── */}
      <div className="hp-meta">TODAY · {todayLabel}</div>

      {/* ── Hero 이름 ──────────────────────────────── */}
      <h1 className="hp-hero hp-hero-name">
        {studentName}<em>.</em>
      </h1>

      {/* ── Today block (거대 숫자) ────────────────── */}
      <section className="hp-section">
        <h2 className="hp-section-label">오늘의 학습</h2>
        <div className="hp-today">
          <div className="hp-today-num" aria-label={`${totalDone} of ${totalTarget}`}>
            {totalDone}
          </div>
          <div className="hp-today-of">
            of <strong>{totalTarget}</strong>
          </div>
          <div className="hp-today-line" aria-hidden="true" />
          <div className="hp-today-pct">
            <span>진행률</span>
            <span>{progressPct}%</span>
          </div>
        </div>
      </section>

      {/* ── 할 일 리스트 ───────────────────────────── */}
      <section className="hp-section">
        <h2 className="hp-section-label">할 일</h2>
        <div className="hp-list">
          {listItems.map((it) => (
            <button
              key={it.key}
              type="button"
              className={`hp-item hp-item--${it.typeClass}`}
              onClick={it.onClick}
              disabled={it.disabled || !it.onClick}
            >
              <span className="hp-item-left">
                <span className="hp-item-dot" aria-hidden="true" />
                <span className="hp-item-label">{it.label}</span>
              </span>
              <span className="hp-item-value">{it.value}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── 과제 ───────────────────────────────────── */}
      {pendingAssignments.length > 0 && (
        <section className="hp-section">
          <div className="hp-section-head">
            <h2 className="hp-section-label">과제 · {pendingAssignments.length}</h2>
            <button
              type="button"
              className="hp-section-all"
              onClick={() => navigate('/assignments')}
            >
              모두 보기 →
            </button>
          </div>
          <div className="hp-tasks">
            {pendingAssignments.slice(0, 3).map((a) => (
              <TaskBlock
                key={a.target_id}
                a={a}
                onClick={() => navigate(`/assignments/${a.target_id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 증명 ───────────────────────────────────── */}
      {proofs.length > 0 && (
        <section className="hp-section">
          <h2 className="hp-section-label">증명 · {proofs.length}</h2>
          <div className="hp-tasks">
            {proofs.slice(0, 3).map((p) => (
              <div key={p.id} className="hp-proof">
                <div className="hp-proof-title">{p.title}</div>
                <div className="hp-proof-meta">
                  <span>{p.grade}</span>
                  <span>난이도 {p.difficulty}</span>
                  <span>{p.step_count}단계</span>
                  {p.best_score !== null && <span>최고 {p.best_score}</span>}
                </div>
                <div className="hp-proof-actions">
                  <button
                    type="button"
                    className="hp-proof-btn"
                    onClick={() => navigate(`/proof/${p.id}/ordering`)}
                  >
                    순서 배치
                  </button>
                  <button
                    type="button"
                    className="hp-proof-btn"
                    onClick={() => navigate(`/proof/${p.id}/fillblank`)}
                  >
                    빈칸 채우기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="hp-footer">와와 · LEARN</footer>
    </div>
  );
}

function TaskBlock({ a, onClick }: { a: AssignmentListItem; onClick: () => void }) {
  const statusLabel = (() => {
    switch (a.status) {
      case 'needs_resubmit': return '재제출';
      case 'assigned':       return '미제출';
      case 'submitted':      return '검토 대기';
      case 'reviewed':       return '검토 중';
      default:               return '';
    }
  })();

  const dueLabel = a.due_at
    ? new Date(a.due_at).toLocaleString('ko-KR', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  const isUrgent = a.status === 'needs_resubmit';

  return (
    <button type="button" className="hp-task" onClick={onClick}>
      <div className="hp-task-head">
        <span className="hp-task-status-dot" data-s={a.status} aria-hidden="true" />
        <span className="hp-task-status-label">{statusLabel}</span>
      </div>
      <div className="hp-task-title">{a.title}</div>
      {dueLabel && (
        <div className={`hp-task-due${isUrgent ? ' hp-task-due--urgent' : ''}`}>
          <strong>DUE</strong> · {dueLabel}
        </div>
      )}
    </button>
  );
}
