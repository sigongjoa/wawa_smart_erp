import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Session, ProofListItem } from '../api';
import { useAuthStore } from '../store';

export default function HomePage() {
  const navigate = useNavigate();
  const auth = useAuthStore((s) => s.auth);
  const logout = useAuthStore((s) => s.logout);
  const [session, setSession] = useState<Session | null>(null);
  const [proofs, setProofs] = useState<ProofListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSession().catch(() => null),
      api.getProofs().catch(() => []),
    ]).then(([sess, prfs]) => {
      setSession(sess);
      setProofs(prfs || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-center"><div className="loading">불러오는 중...</div></div>;

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

      {/* 모드 선택 */}
      <div className="home-modes">
        <button className="home-mode-card" onClick={() => navigate('/gacha')}>
          <span className="home-mode-icon">🎴</span>
          <span className="home-mode-label">가차 카드</span>
          <span className="home-mode-count">{session?.cards_drawn || 0}/{session?.cards_target || 10}장</span>
        </button>

        <div className="home-mode-card home-mode-card--proof">
          <span className="home-mode-icon">📋</span>
          <span className="home-mode-label">증명 연습</span>
          <span className="home-mode-count">{session?.proofs_done || 0}/{session?.proofs_target || 5}개</span>
        </div>
      </div>

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
