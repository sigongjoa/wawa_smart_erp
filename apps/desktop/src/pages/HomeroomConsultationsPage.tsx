import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { toast } from '../components/Toast';
import { errorMessage } from '../utils/errors';

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
  monthly: '#2563eb',
  pre_exam: '#d97706',
  post_exam: '#7c3aed',
  ad_hoc: '#64748b',
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
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ margin: 0 }}>학부모 상담</h2>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          담임 학생의 월 1회 정기 상담 현황
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(monthShift(month, -1))}>
          ◀
        </button>
        <input
          type="month"
          className="form-input"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="조회 월 선택"
          style={{ width: 160 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(monthShift(month, 1))}>
          ▶
        </button>
      </div>

      {loading ? (
        <p className="no-data" role="status" aria-live="polite">불러오는 중...</p>
      ) : summary && summary.homeroom_count === 0 ? (
        <p className="no-data">담임으로 지정된 학생이 없습니다.</p>
      ) : (
        <>
          {isCurrentMonth && pending.length > 0 && (
            <section
              className="dashboard-section"
              style={{ padding: 12, marginBottom: 16, borderLeft: '4px solid #d97706' }}
            >
              <h3 style={{ margin: '0 0 8px' }}>
                이번 달 미상담 ({pending.length} / {summary?.homeroom_count})
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pending.map((s) => (
                  <Link
                    key={s.id}
                    to={`/student/${s.id}`}
                    className="badge"
                    style={{ textDecoration: 'none' }}
                  >
                    {s.name} <span style={{ color: 'var(--text-tertiary)' }}>{s.grade}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="dashboard-section" style={{ padding: 12 }}>
            <h3 style={{ margin: '0 0 12px' }}>
              {month} 학생별 상담 내역
            </h3>
            {calendar && calendar.students.length === 0 ? (
              <p className="no-data">담임 학생이 없습니다.</p>
            ) : (
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '6px 8px' }}>학생</th>
                    <th style={{ padding: '6px 8px' }}>건수</th>
                    <th style={{ padding: '6px 8px' }}>내역</th>
                    <th style={{ padding: '6px 8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(calendar?.students ?? []).map((s) => {
                    const cs = byStudent.get(s.id) ?? [];
                    const sorted = cs;  // 이미 byStudent 안에서 정렬됨
                    return (
                      <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px' }}>
                          <Link to={`/student/${s.id}`}>{s.name}</Link>{' '}
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                            {s.grade}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '8px',
                            color: cs.length ? 'var(--accent)' : '#b45309',
                            fontWeight: 600,
                          }}
                        >
                          {cs.length}
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                          {sorted.length === 0 ? (
                            <span style={{ color: '#b45309' }}>기록 없음</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {sorted.slice(0, 3).map((c) => (
                                <div key={c.id} style={{ fontSize: 13 }}>
                                  <span
                                    className="badge"
                                    style={{
                                      borderColor: CATEGORY_COLOR[c.category],
                                      color: CATEGORY_COLOR[c.category],
                                      marginRight: 6,
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
                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                  + {sorted.length - 3}건
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
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
