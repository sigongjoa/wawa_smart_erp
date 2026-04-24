import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, AssignmentListItem } from '../api';

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

const STATUS_COLOR: Record<string, string> = {
  assigned: '#f59e0b',
  submitted: '#2563eb',
  reviewed: '#7c3aed',
  needs_resubmit: '#dc2626',
  completed: '#16a34a',
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
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>과제</h1>
        <button className="btn-ghost" onClick={() => navigate('/')}>← 홈</button>
      </header>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40, background: '#f9fafb', borderRadius: 8 }}>
          배정된 과제가 없어요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <button
              key={r.target_id}
              onClick={() => navigate(`/assignments/${r.target_id}`)}
              style={{
                textAlign: 'left', padding: 14, borderRadius: 10,
                background: '#fff', border: '1px solid #e5e7eb', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  background: STATUS_COLOR[r.status], color: '#fff',
                  fontSize: 11, padding: '2px 8px', borderRadius: 12,
                }}>
                  {STATUS_LABEL[r.status]}
                </span>
                <span style={{ fontSize: 11, color: '#666', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                  {KIND_LABEL[r.kind] || r.kind}
                </span>
                {isOverdue(r.due_at) && r.status !== 'completed' && (
                  <span style={{ fontSize: 11, color: '#fff', background: '#dc2626', padding: '2px 6px', borderRadius: 4 }}>
                    기한 지남
                  </span>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{r.title}</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {r.due_at && <>마감 {new Date(r.due_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>}
                {r.response_count > 0 && (
                  <span style={{ marginLeft: 8, color: '#2563eb' }}>
                    선생님 회신 {r.response_count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false;
  try { return new Date(dueAt).getTime() < Date.now(); } catch { return false; }
}
