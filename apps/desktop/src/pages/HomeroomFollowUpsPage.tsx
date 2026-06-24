import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { toast } from '../components/Toast';
import { errorMessage } from '../utils/errors';
import { MS_PER_DAY } from '../constants/timing';
import './HomeroomFollowUpsPage.css';

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
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">후속 상담</h2>
        <p className="page-description">
          상담 시 예약한 후속 일정을 기한별로 관리합니다.
        </p>
      </div>

      {loading ? (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="spinner" />
          불러오는 중...
        </div>
      ) : !summary ? (
        <div className="empty-state">
          <div className="empty-state-title">데이터를 불러오지 못했습니다.</div>
        </div>
      ) : summary.follow_ups_due.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">예정된 후속 상담이 없습니다.</div>
        </div>
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
    <section className="hfu-bucket" style={{ borderLeftColor: color }}>
      <h3 className="hfu-bucket-title">
        {title} <span className="hfu-bucket-count">({items.length})</span>
      </h3>
      <ul className="hfu-list">
        {items.map((f) => (
          <li key={f.id} className="hfu-item">
            <span className="badge hfu-badge" style={{ borderColor: color, color }}>
              {badge(f)}
            </span>
            <strong className="hfu-due">{f.follow_up_due}</strong>
            <Link to={`/student/${f.student_id}`} className="hfu-name">
              {f.student_name}
            </Link>
            <span className="hfu-note">{f.follow_up}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
