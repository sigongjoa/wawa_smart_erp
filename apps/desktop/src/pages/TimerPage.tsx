/**
 * TimerPage = RealtimeView (v1.9.0 복원)
 *
 * 좌측: 대기 학생 카드 (클릭 → check-in)
 * 우측: 진행 중 세션 (카운트다운, pause/resume, check-out)
 *
 * 서버가 세션의 원본 — 1초마다 now 만 React state 로 갱신, 카운트다운은 client-side 계산
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { api, PauseRecord, RealtimeSession } from '../api';
import { useAuthStore } from '../store';
import { toast, useConfirm } from '../components/Toast';

type Day = '월' | '화' | '수' | '목' | '금' | '토' | '일';
const DAYS: Day[] = ['월', '화', '수', '목', '금', '토', '일'];
const PAUSE_REASONS = ['외출', '휴식', '화장실', '기타'] as const;

interface StudentRow {
  id: string;
  name: string;
  grade?: string;
  subjects: string[];
  enrollments: Array<{ id: string; day: string; startTime: string; endTime: string; subject?: string | null }>;
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
}: {
  student: StudentRow;
  session: RealtimeSession;
  now: Date;
  onPause: (session: RealtimeSession) => void;
  onCheckOut: (session: RealtimeSession) => void;
}) {

  const checkIn = new Date(session.checkInTime);
  const totalElapsed = Math.floor((now.getTime() - checkIn.getTime()) / 60000);
  const pausedMins = calcPausedMinutes(session.pauseHistory, now);
  const netMins = totalElapsed - pausedMins;
  const remaining = session.scheduledMinutes - netMins;
  const isWarning = remaining <= 10 && remaining > 0;
  const isOvertime = remaining <= 0;
  const progress = session.scheduledMinutes > 0 ? Math.min(netMins / session.scheduledMinutes, 1) : 0;

  return (
    <div className={`rt-session-card rt-grade-${gradeClass(student.grade)} ${isOvertime ? 'rt-session-card--overtime' : ''}`}>
      <div className="rt-session-top">
        <div className="rt-session-identity">
          <span className="rt-student-name">{student.name}</span>
          {student.grade && <span className={`grade-badge ${gradeClass(student.grade)}`}>{student.grade}</span>}
        </div>
        {isOvertime && <span className="rt-status-tag overtime">초과</span>}
      </div>

      <div className={`rt-timer-display ${isWarning ? 'warning' : ''} ${isOvertime ? 'overtime' : ''}`}>
        <span className="rt-timer-value">
          {isOvertime ? '+' : ''}
          {formatTimer(remaining)}
        </span>
        <span className="rt-timer-label">{isOvertime ? '초과' : '남음'}</span>
      </div>

      <div className="rt-progress-track">
        <div
          className={`rt-progress-fill ${isWarning ? 'warning' : ''} ${isOvertime ? 'overtime' : ''}`}
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>

      <div className="rt-session-meta">
        <span>순수 {netMins}분</span>
        <span className="rt-meta-divider">/</span>
        <span>예정 {session.scheduledMinutes}분</span>
        {pausedMins > 0 && (
          <>
            <span className="rt-meta-divider">|</span>
            <span className="rt-meta-paused">정지 {pausedMins}분</span>
          </>
        )}
      </div>

      <div className="rt-session-actions">
        <button className="rt-action-btn rt-action-btn--pause" onClick={() => onPause(session)} type="button">
          정지
        </button>
        <button className="rt-action-btn rt-action-btn--done" onClick={() => onCheckOut(session)} type="button">
          완료
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

  return (
    <div className={`rt-session-card rt-session-card--paused rt-grade-${gradeClass(student.grade)}`}>
      <div className="rt-session-top">
        <div className="rt-session-identity">
          <span className="rt-student-name">{student.name}</span>
          {student.grade && <span className={`grade-badge ${gradeClass(student.grade)}`}>{student.grade}</span>}
        </div>
        <span className="rt-status-tag paused">정지</span>
      </div>

      <div className="rt-pause-info">
        <div className="rt-pause-timer">
          {`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`}
          {reason && <span className="rt-pause-reason">{reason}</span>}
        </div>
        <div className="rt-pause-detail">총 정지 {session.pauseHistory.length}회</div>
      </div>

      <div className="rt-session-actions">
        <button className="rt-action-btn rt-action-btn--resume" onClick={() => onResume(session)} type="button">
          재개
        </button>
        <button className="rt-action-btn rt-action-btn--done" onClick={() => onCheckOut(session)} type="button">
          완료
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
  const [waitingOpen, setWaitingOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRealtimeToday(selectedDay, todayStr());
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

  return (
    <div className="rt-root">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">실시간 수업 관리 ({user?.name || ''})</h1>
            <p className="page-description">담당 학생의 체크인/체크아웃을 실시간으로 관리합니다</p>
          </div>
        </div>
      </div>

      {/* 요일 선택 */}
      <div className="filter-bar">
        <div className="filter-buttons">
          {DAYS.map((d) => (
            <button
              key={d}
              className={`filter-btn ${selectedDay === d ? 'active' : ''}`}
              onClick={() => setSelectedDay(d)}
              type="button"
            >
              {d}
              {d === todayDay && <span className="today-dot" />}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 바 */}
      <div className="rt-summary-bar">
        <div className="rt-clock">
          {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </div>
        <div className="rt-summary-pills">
          <span className="rt-pill waiting">대기 <strong>{waiting.length}</strong></span>
          <span className="rt-pill active">수업 <strong>{active.length}</strong></span>
          {paused.length > 0 && <span className="rt-pill paused">정지 <strong>{paused.length}</strong></span>}
          <span className="rt-pill completed">완료 <strong>{completed}</strong></span>
        </div>
        {isToday && (
          <button
            className="rt-finish-day-btn"
            onClick={handleFinishDay}
            type="button"
            data-testid="finish-day-btn"
          >
            퇴근
          </button>
        )}
      </div>

      {loading ? (
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>로딩 중...</span>
        </div>
      ) : (
        <div className="rt-columns">
          {/* 수업 진행 — 모바일에서 먼저 보임 */}
          <div className="rt-column rt-column--active">
            <div className="rt-column-label">
              <span>수업 진행</span>
              <span className="rt-column-count">{active.length + paused.length}</span>
            </div>
            <div className="rt-column-body">
              {active.length + paused.length === 0 ? (
                <div className="rt-empty">
                  <span>수업 중인 학생이 없습니다</span>
                </div>
              ) : (
                <>
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
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* 대기 학생 — 모바일에서 접이식, 데스크탑에서는 좌측 */}
          <div className="rt-column rt-column--waiting">
            <button
              className="rt-column-label rt-column-toggle"
              type="button"
              onClick={() => setWaitingOpen((v) => !v)}
              aria-expanded={waitingOpen}
            >
              <span>{isToday ? '대기 중' : `${selectedDay}요일`}</span>
              <span className="rt-column-count">{waiting.length}</span>
              <span className={`rt-toggle-arrow ${waitingOpen ? 'rt-toggle-arrow--open' : ''}`} aria-hidden="true" />
            </button>
            <div className={`rt-column-body rt-column-collapsible ${waitingOpen ? 'rt-column-collapsible--open' : ''}`}>
              {waiting.length === 0 ? (
                <div className="rt-empty">
                  <span>{isToday ? '모든 학생이 수업 중입니다' : '학생이 없습니다'}</span>
                </div>
              ) : (
                waiting.map((s) => {
                  const e = s.enrollments[0];
                  return (
                    <button
                      key={s.id}
                      className={`rt-waiting-card rt-grade-${gradeClass(s.grade)} ${!isToday ? 'rt-waiting-card--disabled' : ''}`}
                      onClick={isToday ? () => handleCheckIn(s) : undefined}
                      disabled={!isToday}
                      type="button"
                      data-testid={`waiting-card-${s.id}`}
                    >
                      <div className="rt-waiting-card-top">
                        <span className="rt-student-name">{s.name}</span>
                        {s.grade && <span className={`grade-badge ${gradeClass(s.grade)}`}>{s.grade}</span>}
                      </div>
                      {e ? (
                        <div className="rt-waiting-card-time">
                          {e.startTime} — {e.endTime}
                          {e.subject && <span className="rt-waiting-card-subject">({e.subject})</span>}
                        </div>
                      ) : (
                        <div className="rt-waiting-card-time rt-waiting-card-time--empty">
                          수강일정 없음 (기본 90분)
                        </div>
                      )}
                    </button>
                  );
                })
              )}
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

      {ConfirmDialog}
    </div>
  );
}
