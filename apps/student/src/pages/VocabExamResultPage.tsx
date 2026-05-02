import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, VocabExamDetail } from '../api';
import './VocabExamPage.css';

export default function VocabExamResultPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<VocabExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    api.getVocabExam(jobId)
      .then(setExam)
      .catch((e) => setError(e.message ?? '결과를 불러올 수 없어요'));
  }, [jobId]);

  if (error) return (
    <div className="vexam-shell">
      <div className="vexam-error">{error}</div>
      <button className="vexam-btn" onClick={() => navigate('/me')}>홈으로</button>
    </div>
  );
  if (!exam) return <div className="vexam-shell"><div className="vexam-loading">결과 불러오는 중…</div></div>;

  const correct = exam.autoCorrect ?? 0;
  const total = exam.autoTotal ?? exam.total ?? 0;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const breakdown = exam.breakdown ?? [];

  return (
    <div className="vexam-shell">
      <div className="vresult-card">
        <div className="vresult-score">
          <span className="vresult-num">{correct}</span>
          <span className="vresult-slash">/ {total}</span>
        </div>
        <div className="vresult-pct">{pct}점</div>
        <div className="vresult-msg">
          {pct >= 90 ? '훌륭해요'
            : pct >= 70 ? '잘했어요'
            : pct >= 50 ? '거의 다 왔어요'
            : '다시 외우면 더 잘할 수 있어요'}
        </div>
      </div>

      <div className="vresult-list">
        {breakdown.map((q, i) => (
          <div key={q.wordId} className={`vresult-item ${q.correct ? 'vresult-correct' : 'vresult-wrong'}`}>
            <div className="vresult-no">{i + 1}</div>
            <div className="vresult-body">
              <div className="vresult-prompt">{q.prompt}</div>
              <div className="vresult-answer">
                정답: <strong>{q.choices[q.correctIndex] ?? '—'}</strong>
                {q.selectedIndex !== null && q.selectedIndex !== q.correctIndex && (
                  <> · 내 답: <span className="vresult-mine">{q.choices[q.selectedIndex] ?? '—'}</span></>
                )}
                {q.selectedIndex === null && <> · <span className="vresult-mine">미답</span></>}
              </div>
            </div>
            <div className="vresult-mark">{q.correct ? '○' : '✕'}</div>
          </div>
        ))}
      </div>

      <div className="vresult-actions">
        <button className="vexam-btn vexam-btn-ghost" onClick={() => navigate('/me')}>홈으로</button>
        <button className="vexam-btn vexam-btn-primary" onClick={() => navigate('/me')}>완료</button>
      </div>
    </div>
  );
}
