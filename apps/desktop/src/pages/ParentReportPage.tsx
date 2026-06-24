import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check, ArrowUp, AlertTriangle, Circle, MoreHorizontal, Minus } from 'lucide-react';
import { parentApi, ParentApiError } from '../api/parent';
import { ParentGateView, useParentToken } from '../components/ParentTokenGate';
import './ParentReportPage.css';

type IconCmp = typeof Check;

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

function assignmentStatusLabel(s: string): { text: string; badge: string; Icon: IconCmp } {
  switch (s) {
    case 'assigned': return { text: '배정됨', badge: 'badge-neutral', Icon: Circle };
    case 'submitted': return { text: '제출 완료', badge: 'badge-info', Icon: ArrowUp };
    case 'reviewed': return { text: '첨삭 완료', badge: 'badge-success', Icon: Check };
    case 'needs_resubmit': return { text: '재제출 요청', badge: 'badge-warning', Icon: AlertTriangle };
    case 'completed': return { text: '완료', badge: 'badge-success', Icon: Check };
    default: return { text: s, badge: 'badge-neutral', Icon: Circle };
  }
}

function examStatusLabel(s: string): { text: string; badge: string; Icon: IconCmp } {
  switch (s) {
    case 'reviewed': return { text: '풀이 검토까지 완료', badge: 'badge-success', Icon: Check };
    case 'printed': return { text: '시험지 인쇄 완료', badge: 'badge-info', Icon: Check };
    case 'prepared': return { text: '자료 준비 중', badge: 'badge-warning', Icon: MoreHorizontal };
    default: return { text: '배정됨', badge: 'badge-neutral', Icon: Circle };
  }
}

function sentimentMeta(s: string): { color: string; label: string; Icon: IconCmp } {
  if (s === 'positive') return { color: 'var(--success)', label: '긍정', Icon: Check };
  if (s === 'concern') return { color: 'var(--danger)', label: '우려', Icon: AlertTriangle };
  return { color: 'var(--text-secondary)', label: '중립', Icon: Minus };
}

export default function ParentReportPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams] = useSearchParams();
  const token = useParentToken();
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | ParentApiError | null>(null);

  useEffect(() => {
    if (!studentId || !token) {
      setError(new ParentApiError('TOKEN_MISSING', '잘못된 링크입니다.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    parentApi
      .getReport<ReportData>(studentId, token, month)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e))
      .finally(() => setLoading(false));
  }, [studentId, token, month]);

  const attendanceRate = useMemo(() => {
    if (!data) return 0;
    const { scheduled, attended } = data.attendance;
    // scheduled=0 인데 attended가 양수인 경우는 데이터 모순 → 100%로 가리지 않고 0 반환
    if (scheduled <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((attended / scheduled) * 100)));
  }, [data]);

  if (loading || error || !data) {
    return (
      <div className="prpt-wrap">
        <ParentGateView loading={loading} error={error}>
          {null}
        </ParentGateView>
      </div>
    );
  }

  return (
    <div className="prpt-wrap">
      <div className="prpt-sheet">
        {/* 헤더 — 인사 + 월 강조 */}
        <header
          className="prpt-header"
          aria-label={`${data.student.name} 학부모님께 보내는 ${fmtMonth(data.month)} 학습 리포트`}
        >
          <div className="prpt-eyebrow">학습 리포트</div>
          <h1 className="prpt-month-title">{fmtMonth(data.month)}</h1>
          <p className="prpt-greeting">
            <b>{data.student.name}</b> 학부모님, 이번 달{' '}
            <b>{data.student.name}</b> 학생의 학습 현황을 전해 드립니다.
          </p>
          <div className="prpt-meta">
            {[data.student.grade, data.student.school].filter(Boolean).join(' · ') || ''}
          </div>
        </header>

        {/* 이번 달 한눈에 — 출석률 원형 + 숫자 3개 */}
        <Section title="이번 달 한눈에">
          <div className="prpt-glance-row">
            <AttendanceRing
              rate={attendanceRate}
              attended={data.attendance.attended}
              scheduled={data.attendance.scheduled}
            />
            <div className="prpt-glance-side">
              <SideStat label="총 수업시간" value={fmtHourMin(data.attendance.total_net_minutes)} />
              <SideStat label="지각" value={`${data.attendance.late}회`} muted={data.attendance.late === 0} />
              <SideStat label="결석" value={`${data.attendance.absent}회`} muted={data.attendance.absent === 0} />
            </div>
          </div>
          {data.attendance.by_subject.length > 0 && (
            <div className="prpt-subject-list">
              {data.attendance.by_subject.map((s, i) => (
                <span key={i} className="prpt-chip">
                  {s.subject || '기타'} · {s.count}회 · {fmtHourMin(s.minutes)}
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* 선생님 코멘트 — 부모가 가장 보고 싶은 것, 앞쪽 배치 */}
        <Section title="선생님 코멘트" accent>
          {data.notes.length === 0 ? (
            <div className="prpt-empty">공유된 코멘트가 없습니다.</div>
          ) : (
            <div className="prpt-stack-3">
              {data.notes.map((n, i) => {
                const s = sentimentMeta(n.sentiment);
                return (
                  <div key={i} className="prpt-note" style={{ borderLeftColor: s.color }}>
                    <div className="prpt-note-head">
                      <span
                        className="prpt-sentiment-tag with-icon"
                        style={{ color: s.color, borderColor: s.color }}
                        aria-label={`감정: ${s.label}`}
                      >
                        <s.Icon size={12} aria-hidden="true" /> {s.label}
                      </span>
                      <span className="prpt-note-subject">{n.subject}</span>
                      <span className="prpt-row-meta-date">· {fmtDate(n.created_at)}</span>
                    </div>
                    <div className="prpt-note-body">
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
            <div className="prpt-empty">이 달에 배정된 시험이 없습니다.</div>
          ) : (
            <div className="prpt-stack-3">
              {data.exams.map((e, i) => {
                const st = examStatusLabel(e.status);
                return (
                  <div key={i} className="prpt-row">
                    <div className="prpt-row-main">
                      <div className="prpt-row-title">{e.period_title}</div>
                      <div className="prpt-row-sub">
                        {e.paper_title || '과목별 시험지'}
                        {e.score != null && <> · 점수 <b>{e.score}</b></>}
                      </div>
                    </div>
                    <span
                      className={`badge ${st.badge} with-icon`}
                      aria-label={`상태: ${st.text}`}
                    >
                      <st.Icon size={11} className="prpt-badge-icon" aria-hidden="true" />
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
            <div className="prpt-empty">이번 달 진도 기록이 없습니다.</div>
          ) : (
            <div className="prpt-stack-4">
              {data.progress.map((p, i) => {
                const pct = p.total_units > 0
                  ? Math.max(0, Math.min(100, Math.round((p.completed / p.total_units) * 100)))
                  : 0;
                return (
                  <div key={i}>
                    <div className="prpt-progress-head">
                      <div className="prpt-row-title">{p.textbook}</div>
                      <div className="prpt-progress-pct">
                        {p.completed}/{p.total_units} 단원 · {pct}%
                      </div>
                    </div>
                    <div
                      className="prpt-progress-bar"
                      role="progressbar"
                      aria-label={`${p.textbook} 진도`}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={`${p.completed} / ${p.total_units} 단원, ${pct}%`}
                    >
                      <div className="prpt-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="prpt-progress-meta">
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
            <div className="prpt-empty">이 달에 기록된 자료가 없습니다.</div>
          ) : (
            <div className="prpt-stack-2">
              {data.materials.assignments.map((a, i) => {
                const st = assignmentStatusLabel(a.status);
                return (
                  <div key={`a${i}`} className="prpt-row">
                    <div className="prpt-row-main">
                      <div className="prpt-row-title">
                        <span className="prpt-kind-tag">{assignmentKindLabel(a.kind)}</span> {a.title}
                      </div>
                      <div className="prpt-row-sub">
                        배정 {fmtDate(a.assigned_at)}
                        {a.due_at && <> · 기한 {fmtDate(a.due_at)}</>}
                        {a.submitted_at && <> · 제출 {fmtDate(a.submitted_at)}</>}
                      </div>
                    </div>
                    <span
                      className={`badge ${st.badge} with-icon`}
                      aria-label={`상태: ${st.text}`}
                    >
                      <st.Icon size={11} className="prpt-badge-icon" aria-hidden="true" />
                      {st.text}
                    </span>
                  </div>
                );
              })}
              {data.materials.print_materials.map((m, i) => (
                <div key={`p${i}`} className="prpt-row">
                  <div className="prpt-row-main">
                    <div className="prpt-row-title">
                      <span className="prpt-kind-tag">인쇄물</span>{' '}
                      {m.file_url ? (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="prpt-file-link">
                          {m.title}
                        </a>
                      ) : (
                        m.title
                      )}
                    </div>
                    {m.memo && <div className="prpt-row-sub">{m.memo}</div>}
                  </div>
                  <span className="prpt-row-meta-date">{fmtDate(m.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <footer className="prpt-footer">
          이 리포트는 담당 선생님이 공유한 링크로만 열람됩니다.
          <br />지난 달 리포트가 필요하시면 선생님께 요청해 주세요.
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className={`prpt-section${accent ? ' prpt-section-accent' : ''}`}>
      <h2 className="prpt-section-title">{title}</h2>
      {children}
    </section>
  );
}

function SideStat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="prpt-side-stat">
      <div className="prpt-side-stat-label">{label}</div>
      <div className={`prpt-side-stat-value${muted ? ' is-muted' : ''}`}>
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
      className="prpt-ring-wrap"
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
      <div className="prpt-ring-center">
        <div className="prpt-ring-pct" style={{ color }}>{rate}%</div>
        <div className="prpt-ring-count">{attended} / {scheduled}회</div>
        <div className="prpt-ring-label" style={{ color }}>{label}</div>
      </div>
    </div>
  );
}
