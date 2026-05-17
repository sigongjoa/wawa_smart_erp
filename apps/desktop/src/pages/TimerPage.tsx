/**
 * TimerPage = RealtimeView (v1.9.0 복원)
 *
 * 좌측: 대기 학생 카드 (클릭 → check-in)
 * 우측: 진행 중 세션 (카운트다운, pause/resume, check-out)
 *
 * 서버가 세션의 원본 — 1초마다 now 만 React state 로 갱신, 카운트다운은 client-side 계산
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { api, PauseRecord, RealtimeSession, AdhocSession, Student } from '../api';
import { useAuthStore } from '../store';
import { toast, useConfirm } from '../components/Toast';
import { PageHeader, SummaryBar, Panel, Pill } from '../components/v2';
import { Icon } from '../components/icons/Icon';

type Day = '월' | '화' | '수' | '목' | '금' | '토' | '일';
const DAYS: Day[] = ['월', '화', '수', '목', '금', '토', '일'];
const PAUSE_REASONS = ['외출', '휴식', '화장실', '기타'] as const;

interface StudentRow {
  id: string;
  name: string;
  grade?: string;
  subjects: string[];
  enrollments: Array<{ id: string; day: string; startTime: string; endTime: string; subject?: string | null }>;
  makeups?: Array<{ id: string; absenceId: string; originalDate: string; classId: string; className: string; notes: string; status: string; scheduledStartTime: string | null; scheduledEndTime: string | null }>;
  adhocs?: Array<{ id: string; date: string; startTime: string; endTime: string; subject?: string | null; reason?: string | null }>;
  activeSession: RealtimeSession | null;
  completedSession: RealtimeSession | null;
}

function getTodayDay(): Day {
  const dow = new Date().getDay(); // 0=일
  return (['일', '월', '화', '수', '목', '금', '토'] as Day[])[dow];
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// 선택한 요일의 다음 발생일 (오늘 포함) — 보강 조회에 사용
function dateForDay(targetDay: Day): string {
  const dayToIdx: Record<Day, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  const today = new Date();
  const todayIdx = today.getDay();
  const targetIdx = dayToIdx[targetDay];
  const diff = (targetIdx - todayIdx + 7) % 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function calcPausedMinutes(history: PauseRecord[], now: Date): number {
  let total = 0;
  for (const p of history) {
    const start = new Date(p.pausedAt);
    const end = p.resumedAt ? new Date(p.resumedAt) : now;
    total += (end.getTime() - start.getTime()) / 1000 / 60;
  }
  return Math.floor(total);
}

function formatTimer(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

const GRADE_CLASS_MAP: Record<string, string> = {
  초1: 'm1', 초2: 'm1', 초3: 'm1', 초4: 'm2', 초5: 'm2', 초6: 'm2',
  중1: 'm1', 중2: 'm2', 중3: 'm3',
  고1: 'h1', 고2: 'h2', 고3: 'h3',
  검정고시: 'etc',
};
const gradeClass = (g?: string) => (g && GRADE_CLASS_MAP[g]) || 'etc';

// ─── 활성 세션 카드 ────────────────────────────────────
const ActiveSessionCard = memo(function ActiveSessionCard({
  student,
  session,
  now,
  onPause,
  onCheckOut,
  onExtend,
}: {
  student: StudentRow;
  session: RealtimeSession;
  now: Date;
  onPause: (session: RealtimeSession) => void;
  onCheckOut: (session: RealtimeSession) => void;
  onExtend: (session: RealtimeSession, minutes: number) => void;
}) {

  const checkIn = new Date(session.checkInTime);
  const totalElapsed = Math.floor((now.getTime() - checkIn.getTime()) / 60000);
  const pausedMins = calcPausedMinutes(session.pauseHistory, now);
  const netMins = totalElapsed - pausedMins;
  const addedMins = session.addedMinutes || 0;
  const totalAllotted = session.scheduledMinutes + addedMins;
  const remaining = totalAllotted - netMins;
  const isWarning = remaining <= 10 && remaining > 0;
  const isOvertime = remaining <= 0;
  const progress = totalAllotted > 0 ? Math.min(netMins / totalAllotted, 1) : 0;

  // 시작/종료 시간 표시
  const checkInHHMM = checkIn.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const expectedEnd = new Date(checkIn.getTime() + (totalAllotted + pausedMins) * 60000);
  const expectedEndHHMM = expectedEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  // 스케줄 대비 지연 표시 (scheduledEndTime이 있을 때)
  let delayLabel = '';
  if (session.scheduledEndTime) {
    const [seh, sem] = session.scheduledEndTime.split(':').map(Number);
    const schedEndMin = seh * 60 + sem;
    const expectEndMin = expectedEnd.getHours() * 60 + expectedEnd.getMinutes();
    const diff = expectEndMin - schedEndMin;
    if (diff > 0) delayLabel = `(+${diff}분)`;
  }

  const cardClass = [
    'v2-timer-card',
    isOvertime ? 'v2-timer-card--overtime' : isWarning ? 'v2-timer-card--warning' : 'v2-timer-card--running',
  ].join(' ');

  return (
    <div className={cardClass} data-testid={`active-session-${session.id}`}>
      <div className="v2-timer-card__top">
        <div className="v2-timer-card__id">
          <span className="v2-timer-card__name">
            {student.name}
            {student.grade && <span className={`grade-badge ${gradeClass(student.grade)}`}>{student.grade}</span>}
          </span>
          <span className="v2-timer-card__times">
            <span>시작 <strong>{checkInHHMM}</strong></span>
            <span className="v2-timer-card__meta-divider">→</span>
            <span>예정종료 <strong>{expectedEndHHMM}</strong></span>
            {delayLabel && <span className="v2-timer-card__times-delay">{delayLabel}</span>}
          </span>
        </div>
        {isOvertime ? (
          <Pill tone="danger"><Icon name="AlertCircle" size={12} /> 초과</Pill>
        ) : isWarning ? (
          <Pill tone="warning"><Icon name="Clock" size={12} /> 임박</Pill>
        ) : (
          <Pill tone="primary"><Icon name="Play" size={12} /> 수업 중</Pill>
        )}
      </div>

      <div className="v2-timer-card__display">
        <span className="v2-timer-card__time">
          {isOvertime ? '+' : ''}
          {formatTimer(remaining)}
        </span>
        <span className="v2-timer-card__label">{isOvertime ? '초과' : '남은 시간'}</span>
      </div>

      <div className="v2-timer-card__progress" aria-hidden="true">
        <div
          className="v2-timer-card__progress-fill"
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>

      <div className="v2-timer-card__meta">
        <span>순수 {netMins}분</span>
        <span className="v2-timer-card__meta-divider">/</span>
        <span>
          예정 {totalAllotted}분
          {addedMins !== 0 && (
            <span className="v2-timer-card__meta-added"> ({session.scheduledMinutes}{addedMins >= 0 ? '+' : ''}{addedMins})</span>
          )}
        </span>
        {pausedMins > 0 && (
          <>
            <span className="v2-timer-card__meta-divider">|</span>
            <span className="v2-timer-card__meta-paused">정지 {pausedMins}분</span>
          </>
        )}
      </div>

      <div className="v2-timer-card__actions v2-timer-card__actions--four">
        <button className="v2-timer-card__btn" onClick={() => onExtend(session, 10)} type="button" title="10분 연장">
          +10분
        </button>
        <button className="v2-timer-card__btn" onClick={() => onExtend(session, 30)} type="button" title="30분 연장">
          +30분
        </button>
        <button className="v2-timer-card__btn" onClick={() => onPause(session)} type="button">
          <Icon name="Pause" size={13} /> 정지
        </button>
        <button className="v2-timer-card__btn v2-timer-card__btn--primary" onClick={() => onCheckOut(session)} type="button">
          <Icon name="Check" size={13} /> 완료
        </button>
      </div>
    </div>
  );
});

// ─── 정지 중 세션 카드 ────────────────────────────────
const PausedSessionCard = memo(function PausedSessionCard({
  student,
  session,
  now,
  onResume,
  onCheckOut,
}: {
  student: StudentRow;
  session: RealtimeSession;
  now: Date;
  onResume: (session: RealtimeSession) => void;
  onCheckOut: (session: RealtimeSession) => void;
}) {

  const last = session.pauseHistory[session.pauseHistory.length - 1];
  const pausedForMs = last && !last.resumedAt ? now.getTime() - new Date(last.pausedAt).getTime() : 0;
  const secs = Math.floor(pausedForMs / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const reason = last?.reason;

  // 시작/종료 시간
  const checkIn = new Date(session.checkInTime);
  const checkInHHMM = checkIn.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const totalPausedMins = calcPausedMinutes(session.pauseHistory, now);
  const totalAllotted = session.scheduledMinutes + (session.addedMinutes || 0);
  const expectedEnd = new Date(checkIn.getTime() + (totalAllotted + totalPausedMins) * 60000);
  const expectedEndHHMM = expectedEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="v2-timer-card v2-timer-card--paused" data-testid={`paused-session-${session.id}`}>
      <div className="v2-timer-card__top">
        <div className="v2-timer-card__id">
          <span className="v2-timer-card__name">
            {student.name}
            {student.grade && <span className={`grade-badge ${gradeClass(student.grade)}`}>{student.grade}</span>}
          </span>
          <span className="v2-timer-card__times">
            <span>시작 <strong>{checkInHHMM}</strong></span>
            <span className="v2-timer-card__meta-divider">→</span>
            <span>예정종료 <strong>{expectedEndHHMM}</strong></span>
          </span>
        </div>
        <Pill tone="warning"><Icon name="Pause" size={12} /> 정지</Pill>
      </div>

      <div className="v2-timer-card__pause-info">
        <span className="v2-timer-card__pause-clock">
          {`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`}
        </span>
        <span className="v2-timer-card__pause-reason">
          {reason ? `정지 중 · ${reason}` : '정지 중'}
        </span>
      </div>

      <div className="v2-timer-card__meta">
        <span>총 정지 {session.pauseHistory.length}회</span>
      </div>

      <div className="v2-timer-card__actions">
        <button className="v2-timer-card__btn" onClick={() => onResume(session)} type="button">
          <Icon name="Play" size={13} /> 재개
        </button>
        <button className="v2-timer-card__btn v2-timer-card__btn--primary" onClick={() => onCheckOut(session)} type="button">
          <Icon name="Check" size={13} /> 완료
        </button>
      </div>
    </div>
  );
});

// ═══ 메인 컴포넌트 ═══════════════════════════════════
export default function TimerPage() {
  const user = useAuthStore((s) => s.user);
  const todayDay = getTodayDay();
  const [selectedDay, setSelectedDay] = useState<Day>(todayDay);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pauseTarget, setPauseTarget] = useState<RealtimeSession | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRealtimeToday(selectedDay, dateForDay(selectedDay));
      setStudents(res?.students || []);
    } catch (err) {
      toast.error('목록 조회 실패: ' + (err as Error).message);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDay]);

  useEffect(() => {
    load();
  }, [load]);

  const isToday = selectedDay === todayDay;

  // 대기/활성/정지/완료 분류
  const { waiting, active, paused, completed } = useMemo(() => {
    const w: StudentRow[] = [];
    const a: StudentRow[] = [];
    const p: StudentRow[] = [];
    let done = 0;
    for (const s of students) {
      if (s.activeSession) {
        if (s.activeSession.status === 'paused') p.push(s);
        else a.push(s);
      } else if (s.completedSession) {
        done++;
      } else {
        w.push(s);
      }
    }
    return { waiting: w, active: a, paused: p, completed: done };
  }, [students]);

  // ─── 액션 ───────────────────────────
  const handleCheckIn = async (student: StudentRow) => {
    if (!isToday) return;
    const enrollment = student.enrollments[0];
    try {
      await api.sessionCheckIn({
        studentId: student.id,
        enrollmentId: enrollment?.id,
        scheduledStartTime: enrollment?.startTime,
        scheduledEndTime: enrollment?.endTime,
        subject: enrollment?.subject || undefined,
      });
      await load();
    } catch (err) {
      toast.error('체크인 실패: ' + (err as Error).message);
    }
  };

  const handleMakeupCheckIn = async (student: StudentRow, makeupId: string, subject?: string) => {
    if (!isToday) return;
    try {
      await api.sessionCheckIn({
        studentId: student.id,
        makeupId,
        subject: subject || undefined,
      });
      toast.success('보강 체크인 완료');
      await load();
    } catch (err) {
      toast.error('보강 체크인 실패: ' + (err as Error).message);
    }
  };

  const handleAdhocCheckIn = async (student: StudentRow, adhocId: string, subject?: string | null) => {
    if (!isToday) return;
    try {
      await api.sessionCheckIn({
        studentId: student.id,
        adhocId,
        subject: subject || undefined,
      });
      toast.success('임시 수업 체크인 완료');
      await load();
    } catch (err) {
      toast.error('임시 수업 체크인 실패: ' + (err as Error).message);
    }
  };

  // ─── 임시 수업 추가 모달 ───────────────────
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [adhocStudentList, setAdhocStudentList] = useState<Student[]>([]);
  const [adhocForm, setAdhocForm] = useState({
    studentId: '',
    date: todayStr(),
    startTime: '16:00',
    endTime: '18:00',
    subject: '',
    reason: '시간표변경',
  });
  const [adhocSaving, setAdhocSaving] = useState(false);
  const [adhocSearch, setAdhocSearch] = useState('');

  const openAdhocModal = async () => {
    try {
      const list = await api.getStudents('mine');
      setAdhocStudentList(list || []);
    } catch { /* ignore */ }
    setAdhocForm(f => ({ ...f, date: todayStr() }));
    setAdhocOpen(true);
  };

  const filteredAdhocStudents = adhocStudentList.filter(s =>
    !adhocSearch || s.name.includes(adhocSearch) || (s.grade || '').includes(adhocSearch)
  );

  const handleAdhocSubmit = async () => {
    if (!adhocForm.studentId) { toast.error('학생을 선택해주세요'); return; }
    if (!adhocForm.startTime || !adhocForm.endTime) { toast.error('시간을 입력해주세요'); return; }
    setAdhocSaving(true);
    try {
      await api.createAdhocSession({
        studentId: adhocForm.studentId,
        date: adhocForm.date,
        startTime: adhocForm.startTime,
        endTime: adhocForm.endTime,
        subject: adhocForm.subject || undefined,
        reason: adhocForm.reason || undefined,
      });
      toast.success('임시 수업이 추가되었습니다');
      setAdhocOpen(false);
      setAdhocForm({ studentId: '', date: todayStr(), startTime: '16:00', endTime: '18:00', subject: '', reason: '시간표변경' });
      setAdhocSearch('');
      await load();
    } catch (err) {
      toast.error('임시 수업 추가 실패: ' + (err as Error).message);
    } finally {
      setAdhocSaving(false);
    }
  };

  const handlePauseClick = (session: RealtimeSession) => {
    setPauseTarget(session);
  };

  const confirmPause = async (reason?: string) => {
    if (!pauseTarget) return;
    try {
      await api.sessionPause(pauseTarget.id, reason);
      setPauseTarget(null);
      await load();
    } catch (err) {
      toast.error('정지 실패: ' + (err as Error).message);
      setPauseTarget(null);
    }
  };

  const handleResume = async (session: RealtimeSession) => {
    try {
      await api.sessionResume(session.id);
      await load();
    } catch (err) {
      toast.error('재개 실패: ' + (err as Error).message);
    }
  };

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const handleCheckOut = async (session: RealtimeSession) => {
    const ok = await confirmDialog('수업을 종료할까요?');
    if (!ok) return;
    try {
      await api.sessionCheckOut(session.id);
      await load();
    } catch (err) {
      toast.error('체크아웃 실패: ' + (err as Error).message);
    }
  };

  const handleExtend = async (session: RealtimeSession, minutes: number) => {
    try {
      const res = await api.sessionExtend(session.id, minutes);
      toast.success(`${minutes >= 0 ? '+' : ''}${minutes}분 적용 (총 ${res.scheduledMinutes + res.addedMinutes}분)`);
      await load();
    } catch (err) {
      toast.error('연장 실패: ' + (err as Error).message);
    }
  };

  // ─── 퇴근(수업 마침) ───────────────────────────
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishResult, setFinishResult] = useState<{
    date: string;
    absentStudents: string[];
    recorded: number;
  } | null>(null);
  const [finishing, setFinishing] = useState(false);

  const handleFinishDay = async () => {
    // 진행 중 세션이 있으면 경고
    if (active.length + paused.length > 0) {
      const ok = await confirmDialog(
        `수업 중인 학생이 ${active.length + paused.length}명 있습니다.\n먼저 모든 수업을 종료해야 퇴근할 수 있습니다.`
      );
      return;
    }

    if (waiting.length === 0) {
      toast.info('모든 학생이 수업을 완료했습니다. 퇴근 처리할 학생이 없습니다.');
      return;
    }

    // 대기 학생 목록을 보여주고 확인
    setFinishOpen(true);
  };

  const confirmFinishDay = async () => {
    setFinishing(true);
    try {
      const date = todayStr();
      const res = await api.finishDay({ date });
      setFinishResult({
        date,
        absentStudents: waiting.map((s) => s.name),
        recorded: res.recorded,
      });
      await load(); // 목록 새로고침
      toast.success(`${res.recorded}명 결석 처리 + 보강 등록 완료`);
    } catch (err) {
      toast.error('퇴근 처리 실패: ' + (err as Error).message);
      setFinishOpen(false);
    } finally {
      setFinishing(false);
    }
  };

  const clockStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="v2-app-main">
      <PageHeader
        crumb="운영 · 실시간 수업 타이머"
        title="수업 타이머"
        sub={`오늘 ${active.length}명 진행 중 · ${waiting.length}명 대기 · ${paused.length}명 정지 · ${completed}명 완료 · 1초 간격 카운트다운`}
        actions={
          <>
            <span className="v2-live-pulse" aria-live="polite">
              <span className="v2-live-pulse__dot" />
              LIVE · {clockStr}
            </span>
            {isToday && (
              <button className="v2-timer-card__btn" onClick={openAdhocModal} type="button">
                <Icon name="Plus" size={14} /> 임시 수업
              </button>
            )}
            {isToday && (
              <button
                className="v2-timer-card__btn v2-timer-card__btn--danger"
                onClick={handleFinishDay}
                type="button"
                data-testid="finish-day-btn"
              >
                <Icon name="LogIn" size={14} style={{ transform: 'rotate(180deg)' }} /> 퇴근
              </button>
            )}
          </>
        }
      />

      {/* 요약 strip — mockup 05 와 동일한 가로 스트립 */}
      <SummaryBar
        cells={[
          { label: '진행 중', value: active.length, hint: '체크인 후 수업 중인 학생' },
          { label: '대기', value: waiting.length, hint: '오늘 수업 예정인데 아직 미체크인' },
          { label: '정지', value: paused.length, alert: paused.length > 0, hint: '일시정지 상태' },
          { label: '완료', value: completed, hint: '오늘 체크아웃 완료' },
          { label: '보강 대기', value: waiting.reduce((acc, s) => acc + (s.makeups?.filter(m => m.status === 'scheduled').length || 0), 0), hint: '보강 체크인 가능' },
          { label: '임시 수업', value: waiting.reduce((acc, s) => acc + (s.adhocs?.length || 0), 0), hint: '임시 수업 체크인 가능' },
        ]}
      />

      {loading ? (
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>로딩 중...</span>
        </div>
      ) : (
        <div className="v2-timer-shell">

          {/* LEFT: 대기 학생 (mockup pending panel) */}
          <Panel
            title="대기 학생"
            titleMeta={`총 ${waiting.length}명`}
            headerActions={
              <select
                className="v2-timer-day-select"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value as Day)}
                aria-label="요일 선택"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}요일{d === todayDay ? ' (오늘)' : ''}
                  </option>
                ))}
              </select>
            }
            flush
          >
            {waiting.length === 0 ? (
              <div className="v2-timer-empty">
                {isToday ? '모든 학생이 수업 중입니다' : '학생이 없습니다'}
              </div>
            ) : (
                <div className="v2-pending-list">
                  {waiting.map((s) => {
                    const e = s.enrollments[0];
                    const pendingMakeups = (s.makeups || []).filter(m => m.status === 'scheduled');
                    const hasMakeup = pendingMakeups.length > 0;
                    const pendingAdhocs = (s.adhocs || []);
                    const hasAdhoc = pendingAdhocs.length > 0;
                    const rowClass = [
                      'v2-pending-row',
                      hasMakeup ? 'v2-pending-row--makeup' : '',
                      hasAdhoc ? 'v2-pending-row--adhoc' : '',
                    ].filter(Boolean).join(' ');
                    return (
                      <div key={s.id} className={rowClass} data-testid={`waiting-card-${s.id}`}>
                        <button
                          className="v2-pending-row__main"
                          onClick={isToday ? () => handleCheckIn(s) : undefined}
                          disabled={!isToday}
                          type="button"
                        >
                          <span className="v2-pending-row__name">
                            {s.name}
                            {s.grade && <span className={`grade-badge ${gradeClass(s.grade)}`}>{s.grade}</span>}
                            {hasMakeup && <Pill tone="info">보강 {pendingMakeups.length}</Pill>}
                            {hasAdhoc && <Pill tone="warning">임시</Pill>}
                          </span>
                          {e ? (
                            <span className="v2-pending-row__meta">
                              {e.startTime} — {e.endTime}
                              {e.subject && ` · ${e.subject}`}
                            </span>
                          ) : hasAdhoc ? (
                            <span className="v2-pending-row__meta">
                              {pendingAdhocs[0].startTime} — {pendingAdhocs[0].endTime}
                              {pendingAdhocs[0].subject && ` · ${pendingAdhocs[0].subject}`}
                              {pendingAdhocs[0].reason && ` · ${pendingAdhocs[0].reason}`}
                            </span>
                          ) : (
                            <span className="v2-pending-row__meta v2-pending-row__meta--empty">
                              수강일정 없음 (기본 90분)
                            </span>
                          )}
                        </button>
                        {hasAdhoc && pendingAdhocs.map(ad => (
                          <button
                            key={ad.id}
                            className="v2-pending-row__sub-btn v2-pending-row__sub-btn--adhoc"
                            onClick={isToday ? () => handleAdhocCheckIn(s, ad.id, ad.subject) : undefined}
                            disabled={!isToday}
                            type="button"
                          >
                            {isToday ? '▶ 임시 수업 체크인' : '· 임시 수업 예정'} · {ad.startTime}~{ad.endTime}
                            {ad.reason && ` (${ad.reason})`}
                          </button>
                        ))}
                        {hasMakeup && pendingMakeups.map(mk => {
                          const timeRange = mk.scheduledStartTime && mk.scheduledEndTime
                            ? `${mk.scheduledStartTime}~${mk.scheduledEndTime}`
                            : '기본 90분';
                          return (
                            <button
                              key={mk.id}
                              className="v2-pending-row__sub-btn v2-pending-row__sub-btn--makeup"
                              onClick={isToday ? () => handleMakeupCheckIn(s, mk.id, mk.className) : undefined}
                              disabled={!isToday}
                              type="button"
                              aria-label={`${s.name} 보강 체크인 원결석 ${mk.originalDate}`}
                            >
                              {isToday ? '▶ 보강 체크인' : '· 보강 예정'} · {mk.className} {timeRange} (원결석 {mk.originalDate})
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
            )}
          </Panel>

          {/* RIGHT: 수업 진행 + modal-hint */}
          <div className="v2-timer-right">
            <Panel
              title="수업 진행"
              titleMeta={`${active.length + paused.length}명`}
            >
              {active.length + paused.length === 0 ? (
                <div className="v2-timer-empty">수업 중인 학생이 없습니다</div>
              ) : (
                <div className="v2-timer-cards">
                  {paused.map((s) => (
                    <PausedSessionCard
                      key={s.id}
                      student={s}
                      session={s.activeSession!}
                      now={now}
                      onResume={handleResume}
                      onCheckOut={handleCheckOut}
                    />
                  ))}
                  {active.map((s) => (
                    <ActiveSessionCard
                      key={s.id}
                      student={s}
                      session={s.activeSession!}
                      now={now}
                      onPause={handlePauseClick}
                      onCheckOut={handleCheckOut}
                      onExtend={handleExtend}
                    />
                  ))}
                </div>
              )}
            </Panel>

            {/* mockup 의 modal-hint 카드 */}
            <div className="v2-modal-hint">
              <div className="v2-modal-hint__title">
                <Icon name="Info" size={14} />
                정지 모달
              </div>
              정지 버튼 클릭 시 사유 바텀시트가 표시됩니다 — <strong>외출</strong> · <strong>휴식</strong> · <strong>화장실</strong> · <strong>기타</strong>.
              누적 정지 시간은 카드 메타에 자동 기록되며, 남은 시간 계산에서 차감됩니다.
            </div>
          </div>
        </div>
      )}

      {/* 정지 사유 바텀시트 */}
      {pauseTarget && (
        <div
          className="rt-pause-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="일시정지 사유 선택"
          onClick={() => setPauseTarget(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setPauseTarget(null); }}
        >
          <div className="rt-pause-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rt-pause-sheet-title">일시정지 사유</div>
            <div className="rt-pause-sheet-options">
              {PAUSE_REASONS.map((r) => (
                <button key={r} className="rt-pause-option" onClick={() => confirmPause(r)} type="button">
                  {r}
                </button>
              ))}
            </div>
            <button className="rt-pause-skip" onClick={() => confirmPause()} type="button">
              사유 없이 정지
            </button>
          </div>
        </div>
      )}

      {/* 퇴근 확인 모달 */}
      {finishOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="퇴근 확인"
          onClick={() => { if (!finishing) { setFinishOpen(false); setFinishResult(null); } }}
          onKeyDown={(e) => { if (e.key === 'Escape' && !finishing) { setFinishOpen(false); setFinishResult(null); } }}
        >
          <div className="modal-content rt-finish-modal" onClick={(e) => e.stopPropagation()}>
            {!finishResult ? (
              <>
                <h3 className="rt-finish-title">퇴근 — 수업 마침</h3>
                <p className="rt-finish-desc">
                  아래 <strong>{waiting.length}명</strong>이 오늘 수업에 오지 않았습니다.
                  <br />퇴근 처리하면 일괄 <strong>결석 + 보강</strong> 등록됩니다.
                </p>
                <ul className="rt-finish-student-list">
                  {waiting.map((s) => (
                    <li key={s.id} className="rt-finish-student-item">
                      <span className="rt-student-name">{s.name}</span>
                      {s.grade && <span className={`grade-badge ${gradeClass(s.grade)}`}>{s.grade}</span>}
                      {s.enrollments[0] && (
                        <span className="rt-finish-student-time">
                          {s.enrollments[0].startTime}~{s.enrollments[0].endTime}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setFinishOpen(false)}
                    disabled={finishing}
                    type="button"
                  >
                    취소
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={confirmFinishDay}
                    disabled={finishing}
                    type="button"
                    data-testid="confirm-finish-day"
                  >
                    {finishing ? '처리 중...' : '퇴근 처리'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="rt-finish-title">퇴근 완료</h3>
                <div className="rt-finish-summary">
                  <div className="rt-finish-summary-item">
                    <span className="rt-finish-summary-label">날짜</span>
                    <span className="rt-finish-summary-value">{finishResult.date}</span>
                  </div>
                  <div className="rt-finish-summary-item">
                    <span className="rt-finish-summary-label">수업 완료</span>
                    <span className="rt-finish-summary-value">{completed}명</span>
                  </div>
                  <div className="rt-finish-summary-item rt-finish-summary-item--absent">
                    <span className="rt-finish-summary-label">결석 처리</span>
                    <span className="rt-finish-summary-value">{finishResult.recorded}명</span>
                  </div>
                  {finishResult.absentStudents.length > 0 && (
                    <div className="rt-finish-absent-names">
                      {finishResult.absentStudents.join(', ')}
                    </div>
                  )}
                </div>
                <p className="rt-finish-notice">
                  보강 관리 페이지에서 보강일을 지정할 수 있습니다.
                </p>
                <div className="modal-footer">
                  <button
                    className="btn btn-primary"
                    onClick={() => { setFinishOpen(false); setFinishResult(null); }}
                    type="button"
                  >
                    확인
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 임시 수업 추가 모달 */}
      {adhocOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="임시 수업 추가"
          onClick={() => !adhocSaving && setAdhocOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape' && !adhocSaving) setAdhocOpen(false); }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>임시 수업 추가</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* 학생 선택 */}
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                학생
                <input
                  type="text"
                  className="exam-input"
                  placeholder="이름 검색..."
                  value={adhocSearch}
                  onChange={(e) => setAdhocSearch(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
              <div style={{ maxHeight: 150, overflow: 'auto', border: '1px solid var(--border-primary)', borderRadius: 6, fontSize: 13 }}>
                {filteredAdhocStudents.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setAdhocForm(f => ({ ...f, studentId: s.id })); setAdhocSearch(s.name); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '6px 10px', border: 'none', cursor: 'pointer',
                      background: adhocForm.studentId === s.id ? 'var(--primary-surface, #e8e5ff)' : 'transparent',
                    }}
                  >
                    {s.name} <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{s.grade}</span>
                  </button>
                ))}
                {filteredAdhocStudents.length === 0 && (
                  <div style={{ padding: '8px 10px', color: 'var(--text-tertiary)' }}>결과 없음</div>
                )}
              </div>

              {/* 날짜 */}
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                날짜
                <input
                  type="date"
                  className="exam-input"
                  value={adhocForm.date}
                  onChange={(e) => setAdhocForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>

              {/* 시간 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                  시작
                  <input
                    type="time"
                    className="exam-input"
                    value={adhocForm.startTime}
                    onChange={(e) => setAdhocForm(f => ({ ...f, startTime: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </label>
                <label style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                  종료
                  <input
                    type="time"
                    className="exam-input"
                    value={adhocForm.endTime}
                    onChange={(e) => setAdhocForm(f => ({ ...f, endTime: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </label>
              </div>

              {/* 과목 */}
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                과목
                <input
                  type="text"
                  className="exam-input"
                  placeholder="수학"
                  value={adhocForm.subject}
                  onChange={(e) => setAdhocForm(f => ({ ...f, subject: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>

              {/* 사유 */}
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                사유
                <select
                  className="exam-filter-select"
                  value={adhocForm.reason}
                  onChange={(e) => setAdhocForm(f => ({ ...f, reason: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  <option value="시간표변경">시간표변경</option>
                  <option value="보충수업">보충수업</option>
                  <option value="시험대비">시험대비</option>
                  <option value="대타">대타</option>
                  <option value="기타">기타</option>
                </select>
              </label>
            </div>

            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setAdhocOpen(false)}
                disabled={adhocSaving}
                type="button"
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAdhocSubmit}
                disabled={adhocSaving}
                type="button"
              >
                {adhocSaving ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}
