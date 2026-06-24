import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { toast } from '../components/Toast';
import { Icon } from '../components/icons/Icon';
import { errorMessage } from '../utils/errors';
import './HomeroomConsultationsPage.css';

type Summary = Awaited<ReturnType<typeof api.getHomeroomSummary>>;
type Calendar = Awaited<ReturnType<typeof api.getHomeroomCalendar>>;
type CalendarConsultation = Calendar['consultations'][number];

const CATEGORY_LABEL: Record<string, string> = {
  monthly: '월 1회',
  pre_exam: '시험 전',
  post_exam: '시험 후',
  ad_hoc: '수시',
};
const CATEGORY_COLOR: Record<string, string> = {
  monthly: 'var(--info)',
  pre_exam: 'var(--warning)',
  post_exam: 'var(--primary)',
  ad_hoc: 'var(--text-tertiary)',
};

function monthShift(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default function HomeroomConsultationsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.getHomeroomSummary(), api.getHomeroomCalendar(month)])
      .then(([sum, cal]) => {
        if (cancelled) return;
        setSummary(sum);
        setCalendar(cal);
      })
      .catch((err) => {
        if (!cancelled) toast.error('상담 요약 로드 실패: ' + errorMessage(err, ''));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const byStudent = useMemo(() => {
    const m = new Map<string, CalendarConsultation[]>();
    if (!calendar) return m;
    for (const c of calendar.consultations) {
      const list = m.get(c.student_id);
      if (list) list.push(c);
      else m.set(c.student_id, [c]);
    }
    // 학생별로 최신순 정렬을 미리 적용 → 렌더 시 sort 호출 제거
    for (const list of m.values()) {
      list.sort((a, b) => (a.consulted_at < b.consulted_at ? 1 : -1));
    }
    return m;
  }, [calendar]);

  const isCurrentMonth = month === new Date().toISOString().slice(0, 7);
  const pending = isCurrentMonth ? summary?.this_month_pending ?? [] : [];

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <h2 className="page-title">학부모 상담</h2>
        <span className="page-description">
          담임 학생의 월 1회 정기 상담 현황
        </span>
        <div className="hc-month-nav" />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setMonth(monthShift(month, -1))}
          aria-label="이전 달"
        >
          <Icon name="ChevronLeft" />
        </button>
        <input
          type="month"
          className="form-input hc-month-input"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="조회 월 선택"
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setMonth(monthShift(month, 1))}
          aria-label="다음 달"
        >
          <Icon name="ChevronRight" />
        </button>
      </div>

      {loading ? (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="spinner" />
          불러오는 중...
        </div>
      ) : summary && summary.homeroom_count === 0 ? (
        <div className="empty-state">
          <div className="empty-state-desc">담임으로 지정된 학생이 없습니다.</div>
        </div>
      ) : (
        <>
          {isCurrentMonth && pending.length > 0 && (
            <section className="section hc-pending">
              <h3 className="section-title">
                이번 달 미상담 ({pending.length} / {summary?.homeroom_count})
              </h3>
              <div className="hc-pending-list">
                {pending.map((s) => (
                  <Link
                    key={s.id}
                    to={`/student/${s.id}`}
                    className="badge badge-neutral hc-pending-link"
                  >
                    {s.name} <span className="hc-pending-grade">{s.grade}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="section">
            <h3 className="section-title">
              {month} 학생별 상담 내역
            </h3>
            {calendar && calendar.students.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-desc">담임 학생이 없습니다.</div>
              </div>
            ) : (
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>학생</th>
                    <th>건수</th>
                    <th>내역</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(calendar?.students ?? []).map((s) => {
                    const cs = byStudent.get(s.id) ?? [];
                    const sorted = cs;  // 이미 byStudent 안에서 정렬됨
                    return (
                      <tr key={s.id}>
                        <td>
                          <Link to={`/student/${s.id}`}>{s.name}</Link>{' '}
                          <span className="hc-cell-student-grade">
                            {s.grade}
                          </span>
                        </td>
                        <td
                          className={`hc-cell-count ${cs.length ? 'has-records' : 'is-empty'}`}
                        >
                          {cs.length}
                        </td>
                        <td className="hc-cell-detail">
                          {sorted.length === 0 ? (
                            <span className="badge badge-warning">기록 없음</span>
                          ) : (
                            <div className="hc-detail-list">
                              {sorted.slice(0, 3).map((c) => (
                                <div key={c.id} className="hc-detail-row">
                                  <span
                                    className="badge hc-detail-cat"
                                    style={{
                                      borderColor: CATEGORY_COLOR[c.category],
                                      color: CATEGORY_COLOR[c.category],
                                    }}
                                  >
                                    {CATEGORY_LABEL[c.category] ?? c.category}
                                  </span>
                                  <strong>
                                    {new Date(c.consulted_at).toLocaleDateString('ko-KR')}
                                  </strong>{' '}
                                  <span>{c.summary.slice(0, 60)}</span>
                                </div>
                              ))}
                              {sorted.length > 3 && (
                                <span className="hc-detail-more">
                                  + {sorted.length - 3}건
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="hc-cell-action">
                          <Link to={`/student/${s.id}`} className="btn btn-ghost btn-sm">
                            기록
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
