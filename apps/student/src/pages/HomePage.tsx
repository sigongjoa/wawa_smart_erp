import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Session, ProofListItem, AssignmentListItem, ExamListItem } from '../api';
import { useAuthStore } from '../store';
import './HomePage.css';

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
    return `${mm}/${dd}`;
  }, []);

  if (loading || examChecking) {
    return <div className="hp"><div className="hp-loading">불러오는 중...</div></div>;
  }

  const studentName = auth?.student.name || '학생';
  const totalDone = (session?.cards_drawn || 0) + (session?.proofs_done || 0);
  const totalTarget = (session?.cards_target || 10) + (session?.proofs_target || 5);
  const progressPct = totalTarget > 0 ? Math.min(100, Math.round((totalDone / totalTarget) * 100)) : 0;
  const isCompleted = totalDone >= totalTarget;

  // 가장 급한 학습: 진도 이어갈 수 있으면 단어/증명, 아니면 첫 과제
  const primaryAction = (() => {
    if (!isCompleted && (session?.cards_drawn ?? 0) < (session?.cards_target ?? 10)) {
      return { label: '단어 카드 계속하기', go: () => navigate('/gacha') };
    }
    if (!isCompleted && proofs.length > 0) {
      return { label: '증명 풀러가기', go: () => navigate(`/proof/${proofs[0].id}/ordering`) };
    }
    if (pendingAssignments.length > 0) {
      return { label: '과제 확인하기', go: () => navigate(`/assignments/${pendingAssignments[0].target_id}`) };
    }
    return { label: '학습 현황 보기', go: () => navigate('/dex') };
  })();

  return (
    <div className="hp" style={{ ['--hp-pct' as string]: `${progressPct}%` }}>
      {/* 1. 상단 인사 */}
      <header className="hp-greet">
        <div className="hp-greet-hi">
          안녕, <strong>{studentName}</strong>
        </div>
        <span className="hp-greet-date">{todayLabel}</span>
      </header>

      {/* 2. 오늘의 학습 CTA 카드 */}
      <section className="hp-today">
        <div className="hp-today-head">
          <span className="hp-today-label">오늘의 학습</span>
          <span className="hp-today-pct">{progressPct}%</span>
        </div>
        <div className="hp-today-score">
          <span className="hp-today-score-done">{totalDone}</span>
          <span className="hp-today-score-sep">/</span>
          <span className="hp-today-score-total">{totalTarget}</span>
        </div>
        <div className="hp-today-bar" aria-hidden="true">
          <div className="hp-today-bar-fill" />
        </div>
        <button type="button" className="hp-today-cta" onClick={primaryAction.go}>
          {isCompleted ? '오늘치 완료 — 더 하기' : primaryAction.label}
          <span className="hp-today-cta-arrow" aria-hidden="true">→</span>
        </button>
      </section>

      {/* 3. 2×2 타일 (빠른 진입) */}
      <section className="hp-tiles">
        <button
          type="button"
          className="hp-tile hp-tile--water"
          onClick={() => navigate('/gacha')}
        >
          <div className="hp-tile-head">
            <span className="hp-tile-dot" aria-hidden="true" />
            <span className="hp-tile-label">단어</span>
          </div>
          <div className="hp-tile-value">
            <span className="hp-tile-value-num">{session?.cards_drawn ?? 0}</span>
            <span className="hp-tile-value-sub">/ {session?.cards_target ?? 10}</span>
          </div>
        </button>

        <button
          type="button"
          className="hp-tile hp-tile--grass"
          disabled={proofs.length === 0}
          onClick={() => proofs.length > 0 && navigate(`/proof/${proofs[0].id}/ordering`)}
        >
          <div className="hp-tile-head">
            <span className="hp-tile-dot" aria-hidden="true" />
            <span className="hp-tile-label">증명</span>
          </div>
          <div className="hp-tile-value">
            <span className="hp-tile-value-num">{session?.proofs_done ?? 0}</span>
            <span className="hp-tile-value-sub">/ {session?.proofs_target ?? 5}</span>
          </div>
        </button>

        <button
          type="button"
          className="hp-tile hp-tile--electric"
          onClick={() => navigate('/assignments')}
        >
          <div className="hp-tile-head">
            <span className="hp-tile-dot" aria-hidden="true" />
            <span className="hp-tile-label">과제</span>
          </div>
          <div className="hp-tile-value">
            <span className="hp-tile-value-num">{pendingAssignments.length}</span>
          </div>
        </button>

        <button
          type="button"
          className="hp-tile hp-tile--ground"
          disabled={exams.length === 0}
          onClick={() => {
            if (exams.length > 0) {
              const first = exams[0];
              const ready = first.questionCount > 0;
              const done = first.attemptStatus === 'submitted' || first.attemptStatus === 'expired';
              if (ready && !done) navigate(`/exam/${first.assignmentId}`);
            }
          }}
        >
          <div className="hp-tile-head">
            <span className="hp-tile-dot" aria-hidden="true" />
            <span className="hp-tile-label">시험</span>
          </div>
          <div className="hp-tile-value">
            <span className="hp-tile-value-num">{exams.length}</span>
          </div>
        </button>
      </section>

      {/* 4. 과제 섹션 */}
      {pendingAssignments.length > 0 && (
        <section>
          <div className="hp-section-head">
            <h2 className="hp-section-title">
              과제<span>· {pendingAssignments.length}</span>
            </h2>
            <button
              type="button"
              className="hp-section-all"
              onClick={() => navigate('/assignments')}
            >
              전체 →
            </button>
          </div>
          <div className="hp-cards">
            {pendingAssignments.slice(0, 3).map((a) => (
              <TaskCard
                key={a.target_id}
                a={a}
                onClick={() => navigate(`/assignments/${a.target_id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 5. 증명 섹션 */}
      {proofs.length > 0 && (
        <section>
          <div className="hp-section-head">
            <h2 className="hp-section-title">
              증명<span>· {proofs.length}</span>
            </h2>
          </div>
          <div className="hp-cards">
            {proofs.slice(0, 2).map((p) => (
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
                    className="hp-proof-btn hp-proof-btn--primary"
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
    </div>
  );
}

function TaskCard({ a, onClick }: { a: AssignmentListItem; onClick: () => void }) {
  const statusLabel = (() => {
    switch (a.status) {
      case 'needs_resubmit': return '재제출';
      case 'assigned':       return '미제출';
      case 'submitted':      return '검토 대기';
      case 'reviewed':       return '검토 중';
      default:               return '';
    }
  })();

  const isUrgent = a.status === 'needs_resubmit';
  const dDay = (() => {
    if (!a.due_at) return null;
    const diff = new Date(a.due_at).getTime() - Date.now();
    const days = Math.ceil(diff / 86_400_000);
    if (diff < 0) return '기한 지남';
    if (days === 0) return '오늘 마감';
    if (days === 1) return '내일 마감';
    return `${days}일 남음`;
  })();

  return (
    <button
      type="button"
      className="hp-task"
      onClick={onClick}
      data-urgent={isUrgent ? 'true' : undefined}
    >
      <div className="hp-task-body">
        <div className="hp-task-meta">
          <span className="hp-task-dot" data-s={a.status} aria-hidden="true" />
          <span>{statusLabel}</span>
          {dDay && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{dDay}</span>
            </>
          )}
        </div>
        <div className="hp-task-title">{a.title}</div>
        {a.due_at && (
          <div className="hp-task-due">
            <strong>마감</strong>{' '}
            {new Date(a.due_at).toLocaleString('ko-KR', {
              month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </div>
        )}
      </div>
      <span className="hp-task-arrow" aria-hidden="true">→</span>
    </button>
  );
}
