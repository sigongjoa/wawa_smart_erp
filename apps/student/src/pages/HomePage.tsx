import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Session, ProofListItem, AssignmentListItem, ExamListItem } from '../api';
import { useAuthStore } from '../store';

export default function HomePage() {
  const navigate = useNavigate();
  const auth = useAuthStore((s) => s.auth);
  const logout = useAuthStore((s) => s.logout);
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

  // 활성 시험 attempt 폴링 → 자동 진입
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
      } catch {
        // 무시 (네트워크 일시 오류)
      } finally {
        if (!cancelled) setExamChecking(false);
      }
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [navigate]);

  // 활성 라이브 세션 폴링 → 자동 진입
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await api.getActiveLiveSession();
        if (cancelled) return;
        if (res?.session) {
          navigate(`/live/${res.session.id}`, { replace: true });
        }
      } catch { /* ignore */ }
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [navigate]);

  if (loading || examChecking) return <div className="page-center"><div className="loading">불러오는 중...</div></div>;

  const totalDone = (session?.cards_drawn || 0) + (session?.proofs_done || 0);
  const totalTarget = (session?.cards_target || 10) + (session?.proofs_target || 5);
  const progress = totalTarget > 0 ? Math.min(100, Math.round((totalDone / totalTarget) * 100)) : 0;

  const difficultyStars = (d: number) => '★'.repeat(d) + '☆'.repeat(5 - d);

  return (
    <div className="home-page">
      <header className="home-header">
        <div>
          <h1>안녕, {auth?.student.name}!</h1>
          <p className="home-grade">{auth?.student.grade}</p>
        </div>
        <button className="btn-ghost" onClick={() => { logout(); navigate('/login'); }}>로그아웃</button>
      </header>

      {/* 오늘의 학습 진도 */}
      <div className="home-progress-card">
        <div className="home-progress-header">
          <span>오늘의 학습</span>
          <span>{totalDone}/{totalTarget} 완료</span>
        </div>
        <div className="home-progress-bar">
          <div className="home-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="home-progress-pct">{progress}%</span>
      </div>

      {/* 영어 시험 카드 */}
      {exams.length > 0 && (
        <div className="exam-cards" style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
          {exams.map(ex => {
            const ready = ex.questionCount > 0;
            const inProgress = ex.attemptStatus === 'running' || ex.attemptStatus === 'paused';
            const finished = ex.attemptStatus === 'submitted' || ex.attemptStatus === 'expired';
            return (
              <button
                key={ex.assignmentId}
                className="home-mode-card"
                onClick={() => ready && !finished && navigate(`/exam/${ex.assignmentId}`)}
                disabled={!ready || finished}
                style={{
                  textAlign: 'left',
                  background: finished ? '#f0f4f8' : (inProgress ? '#fff7e6' : '#eef0f8'),
                  border: `2px solid ${finished ? '#cbd5e0' : (inProgress ? '#d69e2e' : '#2d3a8c')}`,
                  padding: 14,
                  borderRadius: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: finished ? '#94a3b8' : (inProgress ? '#d69e2e' : '#2d3a8c'),
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#1a202c', marginBottom: 2 }}>{ex.title}</div>
                    <div style={{ fontSize: 12, color: '#4a5568' }}>
                      영어 · {ex.questionCount}문항 · {ex.durationMinutes}분
                      {ex.examDate && ` · ${ex.examDate}`}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: finished ? '#4a5568' : (inProgress ? '#92400e' : '#2d3a8c'),
                  }}>
                    {finished ? '완료' : (inProgress ? '이어서 풀기' : (ready ? '시작 →' : '준비중'))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 모드 선택 */}
      <div className="home-modes">
        <button className="home-mode-card" onClick={() => navigate('/gacha')}>
          <span className="home-mode-label">카드</span>
          <span className="home-mode-count">{session?.cards_drawn || 0}/{session?.cards_target || 10}장</span>
        </button>

        <div className="home-mode-card home-mode-card--proof">
          <span className="home-mode-label">증명 연습</span>
          <span className="home-mode-count">{session?.proofs_done || 0}/{session?.proofs_target || 5}개</span>
        </div>

        <button className="home-mode-card" onClick={() => { window.location.href = '/word-gacha/'; }}>
          <span className="home-mode-label">영단어</span>
          <span className="home-mode-count">단어 / 문법 / 교재 / 수행평가</span>
        </button>
      </div>

      {/* 과제 위젯 */}
      {(() => {
        const pending = assignments.filter(a => a.status !== 'completed');
        const urgent = pending.filter(a => a.status === 'needs_resubmit' || a.status === 'assigned');
        if (pending.length === 0) return null;
        return (
          <div className="home-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>과제</h2>
              <button className="btn-ghost" onClick={() => navigate('/assignments')} style={{ fontSize: 13 }}>
                모두 보기 ({pending.length})
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.slice(0, 3).map(a => {
                const needsAction = a.status === 'needs_resubmit' || a.status === 'assigned';
                const statusBg = a.status === 'needs_resubmit' ? '#dc2626' :
                                 a.status === 'assigned' ? '#f59e0b' :
                                 a.status === 'submitted' ? '#2563eb' : '#7c3aed';
                const statusLabel = a.status === 'needs_resubmit' ? '재제출' :
                                    a.status === 'assigned' ? '미제출' :
                                    a.status === 'submitted' ? '검토 대기' : '검토 중';
                return (
                  <button
                    key={a.target_id}
                    onClick={() => navigate(`/assignments/${a.target_id}`)}
                    style={{
                      textAlign: 'left', padding: 12, borderRadius: 10,
                      background: needsAction ? '#fffbeb' : '#fff',
                      border: needsAction ? '1px solid #fbbf24' : '1px solid #e5e7eb',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ background: statusBg, color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>
                        {statusLabel}
                      </span>
                      <strong style={{ fontSize: 14 }}>{a.title}</strong>
                    </div>
                    {a.due_at && (
                      <div style={{ fontSize: 12, color: '#666' }}>
                        마감 {new Date(a.due_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </button>
                );
              })}
              {urgent.length > 3 && (
                <button className="btn-ghost" onClick={() => navigate('/assignments')} style={{ fontSize: 13 }}>
                  + {pending.length - 3}개 더 보기
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* 배정된 증명 목록 */}
      {proofs.length > 0 && (
        <div className="home-section">
          <h2>배정된 증명</h2>
          <div className="home-proof-list">
            {proofs.map(p => (
              <div key={p.id} className="home-proof-item">
                <div className="home-proof-info">
                  <span className="home-proof-title">{p.title}</span>
                  <span className="home-proof-meta">
                    {p.grade} · {difficultyStars(p.difficulty)} · {p.step_count}단계
                  </span>
                  {p.best_score !== null && (
                    <span className={`home-proof-score ${p.best_score >= 70 ? 'good' : 'low'}`}>
                      최고 {p.best_score}점
                    </span>
                  )}
                </div>
                <div className="home-proof-actions">
                  <button className="btn-sm btn-primary" onClick={() => navigate(`/proof/${p.id}/ordering`)}>
                    순서배치
                  </button>
                  <button className="btn-sm btn-secondary" onClick={() => navigate(`/proof/${p.id}/fillblank`)}>
                    빈칸채우기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
