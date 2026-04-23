import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type ExamAttemptDetail } from '../api';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

export default function ExamResultPage() {
  const { attemptId = '' } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ExamAttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'wrong'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getExamAttemptDetail(attemptId);
      setDetail(d);
      setError(null);
    } catch (e: any) {
      setError(e?.message || '불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    document.title = '시험 결과 · WAWA';
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="exam-result-page">
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>응시 결과를 불러오고 있어요</span>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="exam-result-page">
        <div className="exam-result-error">
          <p>{error || '결과가 없어요'}</p>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>← 돌아가기</button>
        </div>
      </div>
    );
  }

  const total = detail.total ?? detail.breakdown.length;
  const correct = detail.correct ?? detail.breakdown.filter(b => b.correct).length;
  const wrong = total - correct;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const shownBreakdown = filter === 'wrong'
    ? detail.breakdown.filter(b => !b.correct)
    : detail.breakdown;

  return (
    <div className="exam-result-page">
      {/* 헤더 — 뒤로가기 + 학생/시험지 정보 */}
      <div className="exam-result-topbar">
        <button type="button" className="exam-result-back" onClick={() => navigate(-1)}>
          ← 돌아가기
        </button>
      </div>

      <header className="exam-result-header">
        <div>
          <div className="exam-result-student">{detail.studentName}</div>
          <h1 className="exam-result-title">{detail.paperTitle || '시험 응시 결과'}</h1>
        </div>
        <div className="exam-result-meta">
          <span>응시 시작 · {fmtDate(detail.startedAt)}</span>
          <span>제출 · {fmtDate(detail.endedAt)}</span>
          <span>소요 · {fmtDuration(detail.startedAt, detail.endedAt)}</span>
          {detail.status === 'expired' && <span className="exam-result-chip exam-result-chip--expired">시간 초과</span>}
          {detail.status === 'voided' && <span className="exam-result-chip exam-result-chip--expired">무효</span>}
        </div>
      </header>

      {/* 점수 요약 */}
      <section className="exam-result-summary">
        <div className="exam-result-score-card">
          <div className="exam-result-score-main">
            <span className="exam-result-score-correct">{correct}</span>
            <span className="exam-result-score-sep">/</span>
            <span className="exam-result-score-total">{total}</span>
          </div>
          <div className={`exam-result-score-pct exam-result-score-pct--${pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low'}`}>
            {pct}%
          </div>
        </div>
        <div className="exam-result-stats">
          <div className="exam-result-stat">
            <span className="exam-result-stat-value" style={{ color: 'var(--success)' }}>{correct}</span>
            <span className="exam-result-stat-label">정답</span>
          </div>
          <div className="exam-result-stat">
            <span className="exam-result-stat-value" style={{ color: 'var(--danger)' }}>{wrong}</span>
            <span className="exam-result-stat-label">오답</span>
          </div>
          <div className="exam-result-stat">
            <span className="exam-result-stat-value">{detail.score?.toFixed(1) ?? '—'}</span>
            <span className="exam-result-stat-label">점수</span>
          </div>
        </div>
      </section>

      {/* 문항 필터 */}
      <div className="exam-result-filters">
        <button
          type="button"
          className={`exam-result-filter ${filter === 'all' ? 'exam-result-filter--active' : ''}`}
          onClick={() => setFilter('all')}
        >전체 <span className="exam-result-filter-count">{total}</span></button>
        <button
          type="button"
          className={`exam-result-filter ${filter === 'wrong' ? 'exam-result-filter--active' : ''}`}
          onClick={() => setFilter('wrong')}
          disabled={wrong === 0}
        >오답만 <span className="exam-result-filter-count">{wrong}</span></button>
      </div>

      {/* 문항 리스트 */}
      <ol className="exam-result-list">
        {shownBreakdown.map(q => (
          <li
            key={q.questionNo}
            className={`exam-result-item ${q.correct ? 'exam-result-item--correct' : 'exam-result-item--wrong'}`}
          >
            <div className="exam-result-item-head">
              <span className="exam-result-qno">Q{q.questionNo}</span>
              <span className={`exam-result-mark ${q.correct ? 'exam-result-mark--correct' : 'exam-result-mark--wrong'}`}>
                {q.correct ? '정답' : '오답'}
              </span>
              {q.points > 0 && <span className="exam-result-points">{q.points}점</span>}
            </div>
            <p className="exam-result-prompt">{q.prompt}</p>
            <ul className="exam-result-choices">
              {q.choices.map((c, i) => {
                const n = i + 1;
                const isCorrect = q.correctChoice === n;
                const isSelected = q.selectedChoice === n;
                return (
                  <li
                    key={n}
                    className={[
                      'exam-result-choice',
                      isCorrect ? 'exam-result-choice--correct' : '',
                      isSelected && !isCorrect ? 'exam-result-choice--wrong' : '',
                      isSelected ? 'exam-result-choice--selected' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="exam-result-choice-num">{n}</span>
                    <span className="exam-result-choice-text">{c}</span>
                    {isCorrect && <span className="exam-result-choice-badge exam-result-choice-badge--correct">정답</span>}
                    {isSelected && !isCorrect && <span className="exam-result-choice-badge exam-result-choice-badge--wrong">학생 선택</span>}
                    {isSelected && isCorrect && <span className="exam-result-choice-badge exam-result-choice-badge--ok">학생 선택</span>}
                  </li>
                );
              })}
            </ul>
            {q.selectedChoice === null && (
              <div className="exam-result-no-answer">미응답</div>
            )}
          </li>
        ))}
      </ol>

      {shownBreakdown.length === 0 && filter === 'wrong' && (
        <div className="exam-result-empty">
          <strong>모두 정답이에요 🎉</strong>
        </div>
      )}
    </div>
  );
}
