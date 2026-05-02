import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, AssignmentListItem } from '../api';
import './AssignmentsPage.css';

const KIND_LABEL: Record<string, string> = {
  perf_eval: '수행평가',
  exam_paper: '시험지',
  general: '과제',
};

const STATUS_LABEL: Record<string, string> = {
  assigned: '제출하기',
  submitted: '검토 대기 중',
  reviewed: '검토 중',
  needs_resubmit: '재제출 필요',
  completed: '완료',
};

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AssignmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAssignments()
      .then(setRows)
      .catch((e) => setError(e.message || '로딩 실패'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-center">
        <div className="loading">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="asgn-list">
      <header className="asgn-list-header">
        <h1 className="asgn-list-title">과제</h1>
        <button className="btn-ghost" onClick={() => navigate('/')} aria-label="홈으로">← 홈</button>
      </header>

      {error && (
        <div className="asgn-list-error" role="alert">{error}</div>
      )}

      {rows.length === 0 ? (
        <div className="asgn-list-empty">배정된 과제가 없어요.</div>
      ) : (
        <div className="asgn-list-rows">
          {rows.map((r) => {
            const overdue = isOverdue(r.due_at) && r.status !== 'completed';
            return (
              <button
                key={r.target_id}
                className="asgn-row"
                onClick={() => navigate(`/assignments/${r.target_id}`)}
                aria-label={`${r.title} — ${STATUS_LABEL[r.status]}${overdue ? ', 기한 지남' : ''}`}
              >
                <div className="asgn-row-meta">
                  <span className="asgn-status" data-status={r.status}>
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="asgn-kind">{KIND_LABEL[r.kind] || r.kind}</span>
                  {overdue && <span className="asgn-overdue">기한 지남</span>}
                </div>
                <div className="asgn-row-title">{r.title}</div>
                <div className="asgn-row-sub">
                  {r.due_at && <>마감 {new Date(r.due_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>}
                  {r.response_count > 0 && (
                    <span className="asgn-row-response">선생님 회신 {r.response_count}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false;
  try { return new Date(dueAt).getTime() < Date.now(); } catch { return false; }
}
