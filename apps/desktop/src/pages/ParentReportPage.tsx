import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

interface AttendanceBySubject {
  subject: string | null;
  count: number;
  minutes: number;
}

interface ReportData {
  student: { id: string; name: string; grade: string | null; school: string | null };
  month: string;
  attendance: {
    scheduled: number;
    attended: number;
    late: number;
    absent: number;
    total_net_minutes: number;
    by_subject: AttendanceBySubject[];
  };
  exams: Array<{
    period_title: string;
    period_month: string;
    paper_title: string;
    status: 'assigned' | 'prepared' | 'printed' | 'reviewed';
    drive_link: string | null;
    score: number | null;
  }>;
  progress: Array<{
    textbook: string;
    total_units: number;
    completed: number;
    in_progress: number;
    avg_understanding: number | null;
    recent_unit: string | null;
    recent_at: string | null;
  }>;
  materials: {
    assignments: Array<{
      title: string;
      kind: string;
      status: string;
      due_at: string | null;
      assigned_at: string;
      submitted_at: string | null;
      reviewed_at: string | null;
    }>;
    print_materials: Array<{
      title: string;
      memo: string | null;
      status: string;
      file_url: string | null;
      created_at: string;
    }>;
  };
  notes: Array<{
    subject: string;
    category: string;
    sentiment: string;
    content: string;
    created_at: string;
  }>;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-');
  return `${y}년 ${Number(mo)}월`;
}

function fmtHourMin(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function assignmentKindLabel(k: string): string {
  if (k === 'perf_eval') return '수행평가';
  if (k === 'exam_paper') return '시험지';
  return '과제';
}

type StatusFill = 'solid' | 'tint' | 'outline';

function assignmentStatusLabel(s: string): { text: string; color: string; fill: StatusFill; icon: string } {
  switch (s) {
    case 'assigned': return { text: '배정됨', color: 'var(--text-secondary)', fill: 'outline', icon: '•' };
    case 'submitted': return { text: '제출 완료', color: 'var(--primary)', fill: 'tint', icon: '↑' };
    case 'reviewed': return { text: '첨삭 완료', color: 'var(--success)', fill: 'solid', icon: '✓' };
    case 'needs_resubmit': return { text: '재제출 요청', color: 'var(--warning)', fill: 'tint', icon: '!' };
    case 'completed': return { text: '완료', color: 'var(--success)', fill: 'solid', icon: '✓' };
    default: return { text: s, color: 'var(--text-secondary)', fill: 'outline', icon: '•' };
  }
}

function examStatusLabel(s: string): { text: string; color: string; fill: StatusFill; icon: string } {
  switch (s) {
    case 'reviewed': return { text: '풀이 검토까지 완료', color: 'var(--success)', fill: 'solid', icon: '✓' };
    case 'printed': return { text: '시험지 인쇄 완료', color: 'var(--primary)', fill: 'tint', icon: '✓' };
    case 'prepared': return { text: '자료 준비 중', color: 'var(--warning)', fill: 'tint', icon: '…' };
    default: return { text: '배정됨', color: 'var(--text-secondary)', fill: 'outline', icon: '•' };
  }
}

function sentimentMeta(s: string): { color: string; label: string; icon: string } {
  if (s === 'positive') return { color: 'var(--success)', label: '긍정', icon: '✓' };
  if (s === 'concern') return { color: 'var(--danger)', label: '우려', icon: '!' };
  return { color: 'var(--text-secondary)', label: '중립', icon: '–' };
}

function badgeStyle(color: string, fill: StatusFill): React.CSSProperties {
  if (fill === 'solid') {
    return { color: 'white', background: color, borderColor: color };
  }
  if (fill === 'tint') {
    return { color, background: `color-mix(in srgb, ${color} 12%, white)`, borderColor: color };
  }
  return { color, background: 'transparent', borderColor: color, borderStyle: 'dashed' };
}

export default function ParentReportPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !token) {
      setError('잘못된 링크입니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(
      `${API_BASE}/api/parent-report/${studentId}?token=${encodeURIComponent(token)}&month=${month}`
    )
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || '리포트를 불러올 수 없습니다.');
        }
        setData(json.data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId, token, month]);

  const attendanceRate = useMemo(() => {
    if (!data) return 0;
    const { scheduled, attended } = data.attendance;
    if (scheduled === 0) return attended > 0 ? 100 : 0;
    return Math.max(0, Math.min(100, Math.round((attended / scheduled) * 100)));
  }, [data]);

  if (loading) {
    return (
      <div style={pageStyle.wrap}>
        <div role="status" aria-live="polite" style={pageStyle.message}>불러오는 중...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={pageStyle.wrap}>
        <div role="alert" style={pageStyle.messageError}>{error}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div style={pageStyle.wrap}>
      <div style={pageStyle.sheet}>
        {/* 헤더 — 인사 + 월 강조 */}
        <header
          style={pageStyle.header}
          aria-label={`${data.student.name} 학부모님께 보내는 ${fmtMonth(data.month)} 학습 리포트`}
        >
          <div style={pageStyle.headerEyebrow}>학습 리포트</div>
          <h1 style={pageStyle.monthTitle}>{fmtMonth(data.month)}</h1>
          <p style={pageStyle.greeting}>
            <b>{data.student.name}</b> 학부모님, 이번 달{' '}
            <b>{data.student.name}</b> 학생의 학습 현황을 전해 드립니다.
          </p>
          <div style={pageStyle.meta}>
            {[data.student.grade, data.student.school].filter(Boolean).join(' · ') || ''}
          </div>
        </header>

        {/* 이번 달 한눈에 — 출석률 원형 + 숫자 3개 */}
        <Section title="이번 달 한눈에">
          <div style={pageStyle.glanceRow}>
            <AttendanceRing
              rate={attendanceRate}
              attended={data.attendance.attended}
              scheduled={data.attendance.scheduled}
            />
            <div style={pageStyle.glanceSide}>
              <SideStat label="총 수업시간" value={fmtHourMin(data.attendance.total_net_minutes)} />
              <SideStat label="지각" value={`${data.attendance.late}회`} muted={data.attendance.late === 0} />
              <SideStat label="결석" value={`${data.attendance.absent}회`} muted={data.attendance.absent === 0} />
            </div>
          </div>
          {data.attendance.by_subject.length > 0 && (
            <div style={pageStyle.subjectList}>
              {data.attendance.by_subject.map((s, i) => (
                <span key={i} style={pageStyle.chip}>
                  {s.subject || '기타'} · {s.count}회 · {fmtHourMin(s.minutes)}
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* 선생님 코멘트 — 부모가 가장 보고 싶은 것, 앞쪽 배치 */}
        <Section title="선생님 코멘트" accent>
          {data.notes.length === 0 ? (
            <div style={pageStyle.empty}>공유된 코멘트가 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {data.notes.map((n, i) => {
                const s = sentimentMeta(n.sentiment);
                return (
                  <div key={i} style={{ ...pageStyle.note, borderLeftColor: s.color }}>
                    <div style={pageStyle.noteHead}>
                      <span
                        style={{ ...pageStyle.sentimentTag, color: s.color, borderColor: s.color }}
                        aria-label={`감정: ${s.label}`}
                      >
                        <span aria-hidden="true">{s.icon}</span> {s.label}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.subject}</span>
                      <span style={pageStyle.rowMetaDate}>· {fmtDate(n.created_at)}</span>
                    </div>
                    <div style={{ color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap', fontSize: '0.9375rem' }}>
                      {n.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 시험 일정 & 준비 */}
        <Section title="시험 일정 & 준비">
          {data.exams.length === 0 ? (
            <div style={pageStyle.empty}>이 달에 배정된 시험이 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {data.exams.map((e, i) => {
                const st = examStatusLabel(e.status);
                return (
                  <div key={i} style={pageStyle.row}>
                    <div style={{ flex: 1 }}>
                      <div style={pageStyle.rowTitle}>{e.period_title}</div>
                      <div style={pageStyle.rowSub}>
                        {e.paper_title || '과목별 시험지'}
                        {e.score != null && <> · 점수 <b>{e.score}</b></>}
                      </div>
                    </div>
                    <span
                      style={{ ...pageStyle.badge, ...badgeStyle(st.color, st.fill) }}
                      aria-label={`상태: ${st.text}`}
                    >
                      <span aria-hidden="true" style={pageStyle.badgeIcon}>{st.icon}</span>
                      {st.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 진도 */}
        <Section title="진도 현황">
          {data.progress.length === 0 ? (
            <div style={pageStyle.empty}>이번 달 진도 기록이 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {data.progress.map((p, i) => {
                const pct = p.total_units > 0
                  ? Math.max(0, Math.min(100, Math.round((p.completed / p.total_units) * 100)))
                  : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={pageStyle.rowTitle}>{p.textbook}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {p.completed}/{p.total_units} 단원 · {pct}%
                      </div>
                    </div>
                    <div
                      style={pageStyle.progressBar}
                      role="progressbar"
                      aria-label={`${p.textbook} 진도`}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={`${p.completed} / ${p.total_units} 단원, ${pct}%`}
                    >
                      <div style={{ ...pageStyle.progressFill, width: `${pct}%` }} />
                    </div>
                    <div style={pageStyle.progressMeta}>
                      {p.recent_unit && <>최근 학습: {p.recent_unit}</>}
                      {p.avg_understanding != null && (
                        <> · 평균 이해도 {Math.round(p.avg_understanding)}%</>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 선생님이 준비한 자료 */}
        <Section title="선생님이 준비한 자료">
          {data.materials.assignments.length === 0 && data.materials.print_materials.length === 0 ? (
            <div style={pageStyle.empty}>이 달에 기록된 자료가 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {data.materials.assignments.map((a, i) => {
                const st = assignmentStatusLabel(a.status);
                return (
                  <div key={`a${i}`} style={pageStyle.row}>
                    <div style={{ flex: 1 }}>
                      <div style={pageStyle.rowTitle}>
                        <span style={pageStyle.kindTag}>{assignmentKindLabel(a.kind)}</span> {a.title}
                      </div>
                      <div style={pageStyle.rowSub}>
                        배정 {fmtDate(a.assigned_at)}
                        {a.due_at && <> · 기한 {fmtDate(a.due_at)}</>}
                        {a.submitted_at && <> · 제출 {fmtDate(a.submitted_at)}</>}
                      </div>
                    </div>
                    <span
                      style={{ ...pageStyle.badge, ...badgeStyle(st.color, st.fill) }}
                      aria-label={`상태: ${st.text}`}
                    >
                      <span aria-hidden="true" style={pageStyle.badgeIcon}>{st.icon}</span>
                      {st.text}
                    </span>
                  </div>
                );
              })}
              {data.materials.print_materials.map((m, i) => (
                <div key={`p${i}`} style={pageStyle.row}>
                  <div style={{ flex: 1 }}>
                    <div style={pageStyle.rowTitle}>
                      <span style={pageStyle.kindTag}>인쇄물</span>{' '}
                      {m.file_url ? (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" style={pageStyle.fileLink}>
                          {m.title}
                        </a>
                      ) : (
                        m.title
                      )}
                    </div>
                    {m.memo && <div style={pageStyle.rowSub}>{m.memo}</div>}
                  </div>
                  <span style={pageStyle.rowMetaDate}>{fmtDate(m.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <footer style={pageStyle.footer}>
          이 리포트는 담당 선생님이 공유한 링크로만 열람됩니다.
          <br />지난 달 리포트가 필요하시면 선생님께 요청해 주세요.
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section style={{ ...pageStyle.section, ...(accent ? pageStyle.sectionAccent : null) }}>
      <h2 style={pageStyle.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function SideStat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={pageStyle.sideStat}>
      <div style={pageStyle.sideStatLabel}>{label}</div>
      <div style={{ ...pageStyle.sideStatValue, color: muted ? 'var(--text-tertiary, var(--text-secondary))' : 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function AttendanceRing({ rate, attended, scheduled }: { rate: number; attended: number; scheduled: number }) {
  const color = rate >= 90 ? 'var(--success)' : rate >= 70 ? 'var(--warning)' : 'var(--danger)';
  const label = rate >= 90 ? '매우 성실' : rate >= 70 ? '양호' : rate >= 50 ? '주의 필요' : '점검 필요';
  const R = 56;
  const C = 2 * Math.PI * R;
  const dash = (C * rate) / 100;
  return (
    <div
      style={pageStyle.ringWrap}
      role="img"
      aria-label={`출석률 ${rate}%, ${attended} / ${scheduled}회, ${label}`}
    >
      <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={R}
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dasharray 500ms ease' }}
        />
      </svg>
      <div style={pageStyle.ringCenter}>
        <div style={{ ...pageStyle.ringPct, color }}>{rate}%</div>
        <div style={pageStyle.ringCount}>{attended} / {scheduled}회</div>
        <div style={{ ...pageStyle.ringLabel, color }}>{label}</div>
      </div>
    </div>
  );
}

const pageStyle: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    padding: 'var(--sp-4)',
    display: 'flex',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 720,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--sp-8) var(--sp-6)',
  },
  header: {
    paddingBottom: 'var(--sp-6)',
    borderBottom: '1px solid var(--border-secondary)',
    marginBottom: 'var(--sp-7)',
  },
  headerEyebrow: {
    fontSize: '0.6875rem',
    color: 'var(--primary)',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  monthTitle: {
    fontSize: '2.25rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  greeting: {
    fontSize: '0.9375rem',
    color: 'var(--text-primary)',
    lineHeight: 1.6,
    marginTop: 'var(--sp-3)',
    marginBottom: 0,
  },
  meta: { fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 8 },
  section: { marginBottom: 'var(--sp-7)' },
  sectionAccent: {
    padding: 'var(--sp-5) var(--sp-5)',
    background: 'var(--primary-surface, color-mix(in srgb, var(--primary) 6%, transparent))',
    borderRadius: 'var(--radius-md)',
    border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
  },
  sectionTitle: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 'var(--sp-4)',
    letterSpacing: '-0.01em',
  },
  glanceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-5)',
    flexWrap: 'wrap' as const,
  },
  glanceSide: {
    flex: '1 1 180px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--sp-2)',
  },
  sideStat: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
  },
  sideStatLabel: { fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 },
  sideStatValue: { fontSize: '1.0625rem', fontWeight: 700 },
  ringWrap: {
    position: 'relative' as const,
    width: 140, height: 140,
    flex: '0 0 140px',
  },
  ringCenter: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ringPct: { fontSize: '1.75rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' },
  ringCount: { fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 },
  ringLabel: { fontSize: '0.6875rem', fontWeight: 700, marginTop: 2 },
  subjectList: {
    marginTop: 'var(--sp-3)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--sp-2)',
  },
  chip: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    background: 'var(--primary-surface)',
    color: 'var(--primary)',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    padding: 'var(--sp-3) var(--sp-4)',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
  },
  rowTitle: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' },
  rowSub: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.6875rem',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  badgeIcon: {
    fontWeight: 700,
    fontSize: '0.6875rem',
    lineHeight: 1,
  },
  kindTag: {
    display: 'inline-block',
    fontSize: '0.625rem',
    padding: '2px 6px',
    borderRadius: 'var(--radius-xs)',
    background: 'var(--primary-surface)',
    color: 'var(--primary)',
    marginRight: 6,
    fontWeight: 600,
  },
  progressBar: {
    height: 8,
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--primary)',
    borderRadius: 'var(--radius-full)',
    transition: 'width 300ms ease',
  },
  note: {
    padding: 'var(--sp-4)',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-sm)',
    borderLeft: '3px solid',
    borderLeftColor: 'var(--primary)',
  },
  noteHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    fontSize: '0.8125rem',
  },
  sentimentTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: '0.6875rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid',
  },
  progressMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: 4,
  },
  rowMetaDate: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  },
  fileLink: {
    color: 'var(--primary)',
    textDecoration: 'underline',
  },
  empty: {
    padding: 'var(--sp-4)',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    textAlign: 'center',
  },
  footer: {
    marginTop: 'var(--sp-6)',
    paddingTop: 'var(--sp-4)',
    borderTop: '1px solid var(--border-secondary)',
    fontSize: '0.6875rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  message: {
    maxWidth: 400,
    margin: '20vh auto',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.9375rem',
  },
  messageError: {
    maxWidth: 400,
    margin: '20vh auto',
    textAlign: 'center',
    color: 'var(--danger)',
    fontWeight: 500,
    fontSize: '0.9375rem',
  },
};
