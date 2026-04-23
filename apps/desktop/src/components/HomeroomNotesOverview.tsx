import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

type Overview = Awaited<ReturnType<typeof api.getHomeroomNotesOverview>>;
type StudentRow = Overview['students'][number];

function currentPeriodTag(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodShift(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default function HomeroomNotesOverview() {
  const [period, setPeriod] = useState(currentPeriodTag());
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getHomeroomNotesOverview(period)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err?.message || '조회 실패'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  // 모든 학생에 등장한 과목 합집합
  const subjects = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.students.forEach((s) => s.by_subject.forEach((b) => set.add(b.subject)));
    return Array.from(set).sort();
  }, [data]);

  const concernSorted = useMemo(() => {
    if (!data) return [] as StudentRow[];
    return [...data.students].sort((a, b) => {
      if (b.concern_count !== a.concern_count) return b.concern_count - a.concern_count;
      return b.total_notes - a.total_notes;
    });
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { total: 0, concern: 0, students: 0 };
    return {
      total: data.students.reduce((a, s) => a + s.total_notes, 0),
      concern: data.students.reduce((a, s) => a + s.concern_count, 0),
      students: data.students.length,
    };
  }, [data]);

  return (
    <section className="dashboard-section" style={{ marginTop: 16, padding: 12 }}>
      <div className="section-title-row">
        <h3 style={{ margin: 0 }}>교과 메모 종합 ({period})</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPeriod(periodShift(period, -1))}>◀</button>
          <input
            type="month"
            className="form-input"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ width: 160 }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => setPeriod(periodShift(period, 1))}>▶</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
        <span>총 {totals.students}명 · 메모 {totals.total}건</span>
        {totals.concern > 0 && (
          <span style={{ color: '#dc2626', fontWeight: 600 }}>우려 {totals.concern}건</span>
        )}
      </div>

      {loading ? (
        <p className="no-data">불러오는 중...</p>
      ) : error ? (
        <p className="no-data" style={{ color: '#dc2626' }}>{error}</p>
      ) : !data || data.students.length === 0 ? (
        <p className="no-data">이번 달 교과 메모가 없습니다</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 600, width: '100%' }}>
            <thead>
              <tr>
                <th style={cellHeadSticky}>학생</th>
                {subjects.map((s) => (
                  <th key={s} style={cellHead}>{s}</th>
                ))}
                <th style={{ ...cellHead, color: '#dc2626' }}>우려</th>
                <th style={cellHead}>총</th>
              </tr>
            </thead>
            <tbody>
              {concernSorted.map((s) => {
                const bySubj = new Map(s.by_subject.map((b) => [b.subject, b]));
                return (
                  <tr key={s.id}>
                    <td style={cellSticky}>
                      <Link to={`/student/${s.id}`}>{s.name}</Link>{' '}
                      <span style={{ color: 'var(--text-tertiary)' }}>{s.grade}</span>
                    </td>
                    {subjects.map((subj) => {
                      const b = bySubj.get(subj);
                      if (!b) return <td key={subj} style={cell} />;
                      return (
                        <td
                          key={subj}
                          style={{
                            ...cell,
                            background: b.sentiment_counts.concern > 0 ? 'rgba(220, 38, 38, 0.08)' : undefined,
                          }}
                          title={`긍정 ${b.sentiment_counts.positive} · 보통 ${b.sentiment_counts.neutral} · 우려 ${b.sentiment_counts.concern}`}
                        >
                          <span>{b.count}</span>
                          {b.sentiment_counts.concern > 0 && (
                            <span style={{ color: '#dc2626', marginLeft: 4, fontWeight: 600 }}>
                              ⚠{b.sentiment_counts.concern}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ ...cell, color: s.concern_count > 0 ? '#dc2626' : undefined, fontWeight: 600 }}>
                      {s.concern_count || ''}
                    </td>
                    <td style={{ ...cell, fontWeight: 600 }}>{s.total_notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const cellHeadSticky: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: 'var(--bg-primary)',
  textAlign: 'left',
  padding: '4px 8px',
  borderBottom: '1px solid var(--border)',
  minWidth: 120,
};
const cellHead: React.CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid var(--border)',
  textAlign: 'center',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};
const cellSticky: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: 'var(--bg-primary)',
  padding: '6px 8px',
  borderBottom: '1px solid var(--border)',
};
const cell: React.CSSProperties = {
  padding: '6px 8px',
  textAlign: 'center',
  borderBottom: '1px solid var(--border)',
};
