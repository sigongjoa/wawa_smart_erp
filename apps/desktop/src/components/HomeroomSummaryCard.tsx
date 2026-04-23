import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

type Summary = Awaited<ReturnType<typeof api.getHomeroomSummary>>;

export default function HomeroomSummaryCard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getHomeroomSummary()
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data || data.homeroom_count === 0) return null;

  const total = data.this_month_consulted.length + data.this_month_pending.length;
  const rate = total > 0 ? Math.round((data.this_month_consulted.length / total) * 100) : 0;

  return (
    <section
      className="dashboard-section"
      style={{
        borderLeft: '4px solid var(--accent)',
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div className="section-title-row">
        <h3 style={{ margin: 0 }}>담임 요약</h3>
        <Link to="/homeroom" className="btn btn-ghost btn-sm">
          상세 &rarr;
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginTop: 12,
        }}
      >
        <Stat label="담임 학생" value={`${data.homeroom_count}명`} />
        <Stat
          label="이번 달 상담"
          value={`${data.this_month_consulted.length} / ${total}`}
          sub={`${rate}% 완료`}
          warn={rate < 100}
        />
        <Stat
          label="7일 내 후속"
          value={`${data.follow_ups_due.length}건`}
          warn={data.follow_ups_due.length > 0}
        />
        <Stat
          label="14일 내 시험"
          value={`${data.upcoming_exams.length}건`}
          warn={data.upcoming_exams.length > 0}
        />
      </div>

      {data.this_month_pending.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <strong style={{ color: '#b45309' }}>미상담 학생:</strong>{' '}
          {data.this_month_pending.slice(0, 6).map((s, i) => (
            <span key={s.id}>
              <Link to={`/student/${s.id}`}>{s.name}</Link>
              {i < Math.min(data.this_month_pending.length, 6) - 1 ? ', ' : ''}
            </span>
          ))}
          {data.this_month_pending.length > 6 && ` 외 ${data.this_month_pending.length - 6}명`}
        </div>
      )}

      {data.follow_ups_due.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <strong>후속 상담 임박:</strong>{' '}
          {data.follow_ups_due.slice(0, 3).map((f, i) => (
            <span key={f.id}>
              <Link to={`/student/${f.student_id}`}>{f.student_name}</Link> ({f.follow_up_due})
              {i < Math.min(data.follow_ups_due.length, 3) - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--bg-secondary)',
        borderRadius: 6,
        borderTop: `3px solid ${warn ? '#f59e0b' : 'var(--accent)'}`,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 12, color: warn ? '#b45309' : 'var(--text-tertiary)' }}>{sub}</div>
      )}
    </div>
  );
}
