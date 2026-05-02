import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { toast } from '../components/Toast';
import { errorMessage } from '../utils/errors';
import { MS_PER_DAY } from '../constants/timing';

type Summary = Awaited<ReturnType<typeof api.getHomeroomSummary>>;
type FollowUp = Summary['follow_ups_due'][number];

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / MS_PER_DAY);
}

export default function HomeroomFollowUpsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getHomeroomSummary()
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch((err) => {
        if (!cancelled) toast.error('담임 요약 로드 실패: ' + errorMessage(err, ''));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { overdue, today, upcoming } = useMemo(() => {
    const all = summary?.follow_ups_due ?? [];
    const overdue: FollowUp[] = [];
    const today: FollowUp[] = [];
    const upcoming: FollowUp[] = [];
    for (const f of all) {
      const d = daysUntil(f.follow_up_due);
      if (d < 0) overdue.push(f);
      else if (d === 0) today.push(f);
      else upcoming.push(f);
    }
    const byDate = (a: FollowUp, b: FollowUp) =>
      a.follow_up_due < b.follow_up_due ? -1 : 1;
    return {
      overdue: overdue.sort(byDate),
      today: today.sort(byDate),
      upcoming: upcoming.sort(byDate),
    };
  }, [summary]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>후속 상담</h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
          상담 시 예약한 후속 일정을 기한별로 관리합니다.
        </p>
      </div>

      {loading ? (
        <p className="no-data" role="status" aria-live="polite">불러오는 중...</p>
      ) : !summary ? (
        <p className="no-data">데이터를 불러오지 못했습니다.</p>
      ) : summary.follow_ups_due.length === 0 ? (
        <p className="no-data">예정된 후속 상담이 없습니다.</p>
      ) : (
        <>
          <Bucket
            title="기한 경과"
            color="var(--danger)"
            items={overdue}
            badge={(f) => `${-daysUntil(f.follow_up_due)}일 지남`}
          />
          <Bucket
            title="오늘"
            color="var(--warning)"
            items={today}
            badge={() => '오늘'}
          />
          <Bucket
            title="예정 (7일 내)"
            color="var(--info)"
            items={upcoming}
            badge={(f) => `D-${daysUntil(f.follow_up_due)}`}
          />
        </>
      )}
    </div>
  );
}

function Bucket({
  title,
  color,
  items,
  badge,
}: {
  title: string;
  color: string;
  items: FollowUp[];
  badge: (f: FollowUp) => string;
}) {
  if (items.length === 0) return null;
  return (
    <section
      className="dashboard-section"
      style={{ padding: 12, marginBottom: 16, borderLeft: `4px solid ${color}` }}
    >
      <h3 style={{ margin: '0 0 8px' }}>
        {title} <span style={{ color: 'var(--text-tertiary)' }}>({items.length})</span>
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((f) => (
          <li
            key={f.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span
              className="badge"
              style={{ borderColor: color, color, minWidth: 72, textAlign: 'center' }}
            >
              {badge(f)}
            </span>
            <strong style={{ minWidth: 90 }}>{f.follow_up_due}</strong>
            <Link to={`/student/${f.student_id}`} style={{ minWidth: 80 }}>
              {f.student_name}
            </Link>
            <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{f.follow_up}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
