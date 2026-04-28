import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Session, ProofListItem, AssignmentListItem, ExamListItem } from '../api';
import { useAuthStore } from '../store';
import { useVisiblePolling } from '../lib/useVisiblePolling';
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

  // 활성 시험/라이브 세션 단일 폴링으로 통합 (5초마다 동시 조회, visibility-aware)
  const checkActive = useCallback(async () => {
    try {
      const [active, live] = await Promise.all([
        api.getActiveExamAttempt().catch(() => null),
        api.getActiveLiveSession().catch(() => null),
      ]);
      if (active && ['running', 'paused'].includes(active.status)) {
        navigate('/exam-timer', { replace: true });
        return;
      }
      if (live?.session) {
        navigate(`/live/${live.session.id}`, { replace: true });
        return;
      }
    } catch { /* ignore */ }
    finally { setExamChecking(false); }
  }, [navigate]);

  // 최초 1회 즉시 실행 (visibility hook은 hidden 상태에서 첫 실행도 건너뛰므로)
  useEffect(() => { checkActive(); }, [checkActive]);

  useVisiblePolling(checkActive, 5000);

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

  // 가장 급한 학습: 영단어 → 증명 → 과제 순
  const goWordGacha = () => { window.location.href = '/word-gacha/'; };
  const primaryAction = (() => {
    if (pendingAssignments.some((a) => a.status === 'needs_resubmit')) {
      const urgent = pendingAssignments.find((a) => a.status === 'needs_resubmit')!;
      return { label: '재제출 과제 확인', go: () => navigate(`/assignments/${urgent.target_id}`) };
    }
    if (proofs.length > 0 && (session?.proofs_done ?? 0) < (session?.proofs_target ?? 5)) {
      return { label: '증명 풀러가기', go: () => navigate(`/proof/${proofs[0].id}/ordering`) };
    }
    if (pendingAssignments.length > 0) {
      return { label: '과제 확인하기', go: () => navigate(`/assignments/${pendingAssignments[0].target_id}`) };
    }
    return { label: '영단어 하러 가기', go: goWordGacha };
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
          onClick={goWordGacha}
        >
          <div className="hp-tile-head">
            <span className="hp-tile-dot" aria-hidden="true" />
            <span className="hp-tile-label">영단어</span>
          </div>
          <div className="hp-tile-value">
            <span className="hp-tile-value-sub">하러 가기 →</span>
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
          data-empty={exams.length === 0}
          onClick={() => {
            if (exams.length === 0) {
              alert('배정된 시험이 없어요.\n선생님께 문의해주세요.');
              return;
            }
            const first = exams[0];
            const ready = first.questionCount > 0;
            const done = first.attemptStatus === 'submitted' || first.attemptStatus === 'expired';
            if (ready && !done) navigate(`/exam/${first.assignmentId}`);
            else if (done) alert('이미 응시한 시험입니다.');
            else alert('시험지가 아직 준비되지 않았어요.\n선생님께 문의해주세요.');
          }}
        >
          <div className="hp-tile-head">
            <span className="hp-tile-dot" aria-hidden="true" />
            <span className="hp-tile-label">시험</span>
          </div>
          <div className="hp-tile-value">
            {exams.length > 0 ? (
              <span className="hp-tile-value-num">{exams.length}</span>
            ) : (
              <span className="hp-tile-value-sub">선생님께 문의</span>
            )}
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
