import { useEffect, useState } from 'react';
import { api, GachaStats } from '../api';

export default function GachaDashboardPage() {
  const [stats, setStats] = useState<GachaStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getGachaStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="gacha-page"><div className="gacha-loading">불러오는 중...</div></div>;
  if (!stats) return <div className="gacha-page"><div className="gacha-empty">데이터를 불러올 수 없습니다.</div></div>;

  const { summary, studentProgress, hardProofs } = stats;

  return (
    <div className="gacha-page">
      <div className="gacha-page-header">
        <h1>학습 현황</h1>
      </div>

      {/* 요약 카드 */}
      <div className="gacha-stats-summary">
        <div className="gacha-stat-card">
          <div className="gacha-stat-value">{summary.students}</div>
          <div className="gacha-stat-label">학생</div>
        </div>
        <div className="gacha-stat-card">
          <div className="gacha-stat-value">{summary.cards}</div>
          <div className="gacha-stat-label">카드</div>
        </div>
        <div className="gacha-stat-card">
          <div className="gacha-stat-value">{summary.proofs}</div>
          <div className="gacha-stat-label">증명</div>
        </div>
        <div className="gacha-stat-card gacha-stat-card--highlight">
          <div className="gacha-stat-value">{summary.activeToday}</div>
          <div className="gacha-stat-label">오늘 활동</div>
        </div>
      </div>

      {/* 학생별 진도 */}
      <div className="gacha-section">
        <h2>학생별 진도</h2>
        {studentProgress.length === 0 ? (
          <div className="gacha-empty">학생 데이터가 없습니다.</div>
        ) : (
          <div className="gacha-table-wrapper">
            <table className="gacha-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>학년</th>
                  <th>카드</th>
                  <th>증명</th>
                  <th>평균 점수</th>
                  <th>최근 활동</th>
                </tr>
              </thead>
              <tbody>
                {studentProgress.map(s => {
                  const daysSince = s.last_activity
                    ? Math.floor((Date.now() - new Date(s.last_activity).getTime()) / 86400000)
                    : null;
                  const isWarning = daysSince !== null && daysSince > 3;
                  return (
                    <tr key={s.id} className={isWarning ? 'gacha-row-warning' : ''}>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.grade || '-'}</td>
                      <td>{s.card_count}장</td>
                      <td>{s.completed_proofs}/{s.assigned_proofs}</td>
                      <td>
                        {s.avg_proof_score !== null
                          ? <span className={s.avg_proof_score >= 70 ? 'gacha-score-good' : 'gacha-score-low'}>{Math.round(s.avg_proof_score)}점</span>
                          : '-'}
                      </td>
                      <td>
                        {daysSince !== null
                          ? daysSince === 0 ? '오늘'
                            : daysSince === 1 ? '어제'
                            : `${daysSince}일 전${daysSince > 3 ? ' ⚠' : ''}`
                          : '없음'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 많이 틀리는 증명 */}
      {hardProofs.length > 0 && (
        <div className="gacha-section">
          <h2>많이 틀리는 증명 TOP {hardProofs.length}</h2>
          <div className="gacha-hard-proofs">
            {hardProofs.map((p, i) => (
              <div key={p.id} className="gacha-hard-proof-item">
                <span className="gacha-hard-proof-rank">{i + 1}</span>
                <div className="gacha-hard-proof-info">
                  <span className="gacha-hard-proof-title">{p.title}</span>
                  <span className="gacha-hard-proof-meta">{p.grade} · {'★'.repeat(p.difficulty)} · {p.attempt_count}회 시도</span>
                </div>
                <span className="gacha-score-low">평균 {Math.round(p.avg_score)}점</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
