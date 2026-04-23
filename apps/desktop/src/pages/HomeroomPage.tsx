import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import HomeroomNotesOverview from '../components/HomeroomNotesOverview';

type Calendar = Awaited<ReturnType<typeof api.getHomeroomCalendar>>;
type CalendarConsultation = Calendar['consultations'][number];
type Summary = Awaited<ReturnType<typeof api.getHomeroomSummary>>;

const CATEGORY_DOT: Record<string, string> = {
  monthly: '●',
  pre_exam: '▲',
  post_exam: '▼',
  ad_hoc: '◇',
};
const CATEGORY_COLOR: Record<string, string> = {
  monthly: '#2563eb',
  pre_exam: '#d97706',
  post_exam: '#7c3aed',
  ad_hoc: '#64748b',
};
const CATEGORY_LABEL: Record<string, string> = {
  monthly: '월 1회',
  pre_exam: '시험 전',
  post_exam: '시험 후',
  ad_hoc: '수시',
};

function monthShift(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export default function HomeroomPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [cal, sum] = await Promise.all([
        api.getHomeroomCalendar(month),
        api.getHomeroomSummary(),
      ]);
      setCalendar(cal);
      setSummary(sum);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [month]);

  const days = useMemo(() => daysInMonth(month), [month]);

  // student_id -> day -> consultations[]
  const matrix = useMemo(() => {
    const m = new Map<string, Map<number, CalendarConsultation[]>>();
    if (!calendar) return m;
    for (const c of calendar.consultations) {
      const day = new Date(c.consulted_at).getDate();
      if (!m.has(c.student_id)) m.set(c.student_id, new Map());
      const byDay = m.get(c.student_id)!;
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(c);
    }
    return m;
  }, [calendar]);

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
        <h2 style={{ margin: 0 }}>담임 대시보드</h2>
        <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost btn-sm" to="/homeroom/consultations">
            학부모 상담
          </Link>
          <Link className="btn btn-ghost btn-sm" to="/homeroom/follow-ups">
            후속 상담
          </Link>
          <Link className="btn btn-ghost btn-sm" to="/homeroom/exams">
            시험 전후 상담
          </Link>
        </nav>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(monthShift(month, -1))}>
          ◀
        </button>
        <input
          type="month"
          className="form-input"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ width: 160 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(monthShift(month, 1))}>
          ▶
        </button>
      </div>

      {summary && summary.homeroom_count === 0 ? (
        <p className="no-data">담임으로 지정된 학생이 없습니다. (관리자에게 문의)</p>
      ) : loading ? (
        <p className="no-data">불러오는 중...</p>
      ) : (
        <>
          {/* 요약 카드 */}
          {summary && (
            <section
              className="dashboard-section"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12,
                padding: 12,
              }}
            >
              <KV label="담임 학생" value={`${summary.homeroom_count}명`} />
              <KV
                label="이번 달 상담 완료"
                value={`${summary.this_month_consulted.length} / ${summary.homeroom_count}`}
              />
              <KV label="7일 내 후속" value={`${summary.follow_ups_due.length}건`} />
              <KV label="14일 내 시험" value={`${summary.upcoming_exams.length}건`} />
            </section>
          )}

          {/* 상담 달력 매트릭스 */}
          <section className="dashboard-section" style={{ marginTop: 16, padding: 12 }}>
            <div className="section-title-row">
              <h3 style={{ margin: 0 }}>월별 상담 매트릭스 ({month})</h3>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <span key={k} style={{ marginLeft: 8 }}>
                    <span style={{ color: CATEGORY_COLOR[k] }}>{CATEGORY_DOT[k]}</span> {v}
                  </span>
                ))}
              </div>
            </div>

            {calendar && calendar.students.length === 0 ? (
              <p className="no-data">담임 학생이 없습니다</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    borderCollapse: 'collapse',
                    fontSize: 12,
                    minWidth: 600,
                    width: '100%',
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          position: 'sticky',
                          left: 0,
                          background: 'var(--bg-primary)',
                          textAlign: 'left',
                          padding: '4px 8px',
                          borderBottom: '1px solid var(--border)',
                          minWidth: 120,
                        }}
                      >
                        학생
                      </th>
                      {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                        <th
                          key={d}
                          style={{
                            padding: '4px 2px',
                            borderBottom: '1px solid var(--border)',
                            textAlign: 'center',
                            minWidth: 20,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {d}
                        </th>
                      ))}
                      <th
                        style={{
                          padding: '4px 8px',
                          borderBottom: '1px solid var(--border)',
                          textAlign: 'center',
                        }}
                      >
                        합
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(calendar?.students || []).map((s) => {
                      const byDay = matrix.get(s.id) || new Map();
                      const total = Array.from(byDay.values()).reduce(
                        (a, b) => a + b.length,
                        0
                      );
                      const compliant = total > 0;
                      return (
                        <tr key={s.id}>
                          <td
                            style={{
                              position: 'sticky',
                              left: 0,
                              background: 'var(--bg-primary)',
                              padding: '6px 8px',
                              borderBottom: '1px solid var(--border)',
                              fontWeight: compliant ? 500 : 400,
                            }}
                          >
                            <Link to={`/student/${s.id}`}>{s.name}</Link>{' '}
                            <span style={{ color: 'var(--text-tertiary)' }}>{s.grade}</span>
                          </td>
                          {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                            const cs: CalendarConsultation[] = byDay.get(d) || [];
                            return (
                              <td
                                key={d}
                                title={cs
                                  .map(
                                    (c: CalendarConsultation) =>
                                      `[${CATEGORY_LABEL[c.category]}] ${c.summary.slice(0, 40)}`
                                  )
                                  .join('\n')}
                                style={{
                                  padding: '2px',
                                  textAlign: 'center',
                                  borderBottom: '1px solid var(--border)',
                                  cursor: cs.length ? 'help' : 'default',
                                }}
                              >
                                {cs.map((c: CalendarConsultation, i: number) => (
                                  <span
                                    key={i}
                                    style={{ color: CATEGORY_COLOR[c.category] }}
                                  >
                                    {CATEGORY_DOT[c.category]}
                                  </span>
                                ))}
                              </td>
                            );
                          })}
                          <td
                            style={{
                              padding: '4px 8px',
                              textAlign: 'center',
                              borderBottom: '1px solid var(--border)',
                              color: compliant ? 'var(--accent)' : '#b45309',
                              fontWeight: 600,
                            }}
                          >
                            {total}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 교과 메모 종합 (담임 종합 조회) */}
          <HomeroomNotesOverview />

          {/* 후속 상담 리스트 */}
          {summary && summary.follow_ups_due.length > 0 && (
            <section className="dashboard-section" style={{ marginTop: 16, padding: 12 }}>
              <h3>7일 내 후속 상담</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {summary.follow_ups_due.map((f) => (
                  <li key={f.id} style={{ marginBottom: 6 }}>
                    <strong>{f.follow_up_due}</strong>{' '}
                    <Link to={`/student/${f.student_id}`}>{f.student_name}</Link> — {f.follow_up}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 다가오는 시험 */}
          {summary && summary.upcoming_exams.length > 0 && (
            <section className="dashboard-section" style={{ marginTop: 16, padding: 12 }}>
              <h3>14일 내 시험</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {summary.upcoming_exams.map((e) => (
                  <li key={e.id} style={{ marginBottom: 6 }}>
                    <strong>{new Date(e.starts_at).toLocaleDateString('ko-KR')}</strong>{' '}
                    <Link to={`/student/${e.student_id}`}>{e.student_name}</Link> — {e.title}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--bg-secondary)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
