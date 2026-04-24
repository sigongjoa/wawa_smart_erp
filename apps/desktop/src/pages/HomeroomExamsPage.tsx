import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { toast } from '../components/Toast';

type Summary = Awaited<ReturnType<typeof api.getHomeroomSummary>>;
type Calendar = Awaited<ReturnType<typeof api.getHomeroomCalendar>>;
type Exam = Summary['upcoming_exams'][number];

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / 86400000);
}

export default function HomeroomExamsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [thisMonth, setThisMonth] = useState<Calendar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const month = new Date().toISOString().slice(0, 7);
    Promise.all([api.getHomeroomSummary(), api.getHomeroomCalendar(month)])
      .then(([s, c]) => {
        if (cancelled) return;
        setSummary(s);
        setThisMonth(c);
      })
      .catch((err) => {
        if (!cancelled) toast.error('시험 요약 로드 실패: ' + (err?.message || ''));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // student_id -> {preExam: Date[], postExam: Date[]}  (이번 달 기준)
  const examConsultByStudent = useMemo(() => {
    const m = new Map<string, { pre: string[]; post: string[] }>();
    if (!thisMonth) return m;
    for (const c of thisMonth.consultations) {
      if (c.category !== 'pre_exam' && c.category !== 'post_exam') continue;
      const entry = m.get(c.student_id) ?? { pre: [], post: [] };
      if (c.category === 'pre_exam') entry.pre.push(c.consulted_at);
      else entry.post.push(c.consulted_at);
      m.set(c.student_id, entry);
    }
    return m;
  }, [thisMonth]);

  // 학생별로 그룹핑한 다가오는 시험
  const byStudent = useMemo(() => {
    const m = new Map<string, { student_name: string; exams: Exam[] }>();
    if (!summary) return m;
    for (const e of summary.upcoming_exams) {
      if (!m.has(e.student_id))
        m.set(e.student_id, { student_name: e.student_name, exams: [] });
      m.get(e.student_id)!.exams.push(e);
    }
    return m;
  }, [summary]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>시험 전후 상담</h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
          14일 내 시험을 앞둔 담임 학생과 이번 달 시험 전/후 상담 기록을 함께 확인합니다.
        </p>
      </div>

      {loading ? (
        <p className="no-data">불러오는 중...</p>
      ) : !summary ? (
        <p className="no-data">데이터를 불러오지 못했습니다.</p>
      ) : summary.upcoming_exams.length === 0 ? (
        (() => {
          const preTotal = Array.from(examConsultByStudent.values()).reduce(
            (a, b) => a + b.pre.length,
            0
          );
          const postTotal = Array.from(examConsultByStudent.values()).reduce(
            (a, b) => a + b.post.length,
            0
          );
          return (
            <section className="dashboard-section" style={{ padding: 12 }}>
              <p className="no-data">14일 내 예정된 시험이 없습니다.</p>
              {(preTotal > 0 || postTotal > 0) && (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  이번 달 시험 전 상담 {preTotal}건 / 시험 후 상담 {postTotal}건 기록됨.
                </p>
              )}
            </section>
          );
        })()
      ) : (
        <section className="dashboard-section" style={{ padding: 12 }}>
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '6px 8px' }}>학생</th>
                <th style={{ padding: '6px 8px' }}>D-일</th>
                <th style={{ padding: '6px 8px' }}>시험</th>
                <th style={{ padding: '6px 8px' }}>시험 전 상담</th>
                <th style={{ padding: '6px 8px' }}>시험 후 상담</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {Array.from(byStudent.entries()).map(([studentId, { student_name, exams }]) => {
                const sorted = [...exams].sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
                const nearest = sorted[0];
                const d = daysUntil(nearest.starts_at);
                const ec = examConsultByStudent.get(studentId) ?? { pre: [], post: [] };
                return (
                  <tr key={studentId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>
                      <Link to={`/student/${studentId}`}>{student_name}</Link>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span
                        className="badge"
                        style={{
                          borderColor: d <= 3 ? '#dc2626' : d <= 7 ? '#d97706' : '#2563eb',
                          color: d <= 3 ? '#dc2626' : d <= 7 ? '#d97706' : '#2563eb',
                        }}
                      >
                        D-{d}
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div>
                        <strong>{new Date(nearest.starts_at).toLocaleDateString('ko-KR')}</strong>{' '}
                        {nearest.title}
                      </div>
                      {sorted.length > 1 && (
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                          +{sorted.length - 1}건
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {ec.pre.length > 0 ? (
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                          ✓ {ec.pre.length}건
                        </span>
                      ) : (
                        <span style={{ color: '#b45309' }}>미실시</span>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {ec.post.length > 0 ? (
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                          ✓ {ec.post.length}건
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <Link to={`/student/${studentId}`} className="btn btn-ghost btn-sm">
                        상담 기록
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
