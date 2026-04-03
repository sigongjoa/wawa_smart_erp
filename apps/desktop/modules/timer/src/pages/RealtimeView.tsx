import { useState, useEffect, useCallback } from 'react';
import { useScheduleStore, calculatePausedMinutes } from '../stores/scheduleStore';
import type { Student, GradeType, RealtimeSession } from '../types';

const gradeClassMap: Record<GradeType, string> = {
  '중1': 'm1',
  '중2': 'm2',
  '중3': 'm3',
  '고1': 'h1',
  '고2': 'h2',
  '고3': 'h3',
  '검정고시': 'etc',
};

const PAUSE_REASONS = [
  { label: '외출', icon: 'directions_walk' },
  { label: '휴식', icon: 'coffee' },
  { label: '화장실', icon: 'wc' },
  { label: '기타', icon: 'more_horiz' },
] as const;

export default function RealtimeView() {
  const {
    getTodayStudents,
    realtimeSessions,
    checkIn,
    checkOut,
    pauseSession,
    resumeSession,
  } = useScheduleStore();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [pauseTargetId, setPauseTargetId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStudents = getTodayStudents();

  const waitingStudents = todayStudents.filter(
    (s) => !realtimeSessions.some((sess) => sess.studentId === s.id)
  );
  const activeSessions = realtimeSessions.filter((s) => s.status === 'active' || s.status === 'overtime');
  const pausedSessions = realtimeSessions.filter((s) => s.status === 'paused');
  const completedCount = realtimeSessions.filter((s) => s.status === 'completed').length;

  const formatClock = (date: Date) =>
    date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const formatTimer = (minutes: number) => {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const formatSeconds = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getSessionTimes = useCallback((session: RealtimeSession) => {
    const now = currentTime;
    const checkIn = new Date(session.checkInTime);
    const totalElapsed = Math.floor((now.getTime() - checkIn.getTime()) / 1000 / 60);
    const pausedMins = calculatePausedMinutes(session.pauseHistory, now);
    const netMins = totalElapsed - pausedMins;
    const remaining = session.scheduledMinutes - netMins;
    return { totalElapsed, pausedMins, netMins, remaining };
  }, [currentTime]);

  const getCurrentPauseDuration = (session: RealtimeSession) => {
    const lastPause = session.pauseHistory[session.pauseHistory.length - 1];
    if (!lastPause || lastPause.resumedAt) return 0;
    return currentTime.getTime() - new Date(lastPause.pausedAt).getTime();
  };

  const handleCheckIn = (student: Student) => checkIn(student.id);
  const handleCheckOut = (studentId: string) => checkOut(studentId);

  const handlePauseClick = (studentId: string) => {
    setPauseTargetId(studentId);
  };

  const handlePauseWithReason = (reason?: string) => {
    if (pauseTargetId) {
      pauseSession(pauseTargetId, reason);
      setPauseTargetId(null);
    }
  };

  const handleResume = (studentId: string) => resumeSession(studentId);

  // 진행률 계산 (0~1, 초과 시 1 이상)
  const getProgress = (session: RealtimeSession) => {
    const { netMins } = getSessionTimes(session);
    if (session.scheduledMinutes <= 0) return 0;
    return Math.min(netMins / session.scheduledMinutes, 1);
  };

  return (
    <div className="rt-root">
      {/* 상단 요약 바 */}
      <div className="rt-summary-bar">
        <div className="rt-clock">
          <span className="material-symbols-outlined">schedule</span>
          {formatClock(currentTime)}
        </div>
        <div className="rt-summary-pills">
          <span className="rt-pill waiting">
            대기 <strong>{waitingStudents.length}</strong>
          </span>
          <span className="rt-pill active">
            수업 <strong>{activeSessions.length}</strong>
          </span>
          {pausedSessions.length > 0 && (
            <span className="rt-pill paused">
              정지 <strong>{pausedSessions.length}</strong>
            </span>
          )}
          <span className="rt-pill completed">
            완료 <strong>{completedCount}</strong>
          </span>
        </div>
      </div>

      {/* 메인 2컬럼 레이아웃 */}
      <div className="rt-columns">
        {/* 좌측: 대기 */}
        <div className="rt-column rt-column--waiting">
          <div className="rt-column-label">
            <span className="material-symbols-outlined">hourglass_empty</span>
            대기 중
            <span className="rt-column-count">{waitingStudents.length}</span>
          </div>
          <div className="rt-column-body">
            {waitingStudents.length === 0 ? (
              <div className="rt-empty">
                <span className="material-symbols-outlined">check_circle</span>
                <span>모든 학생이 수업 중입니다</span>
              </div>
            ) : (
              waitingStudents.map((student) => (
                <button
                  key={student.id}
                  className={`rt-waiting-card rt-grade-${gradeClassMap[student.grade]}`}
                  onClick={() => handleCheckIn(student)}
                  type="button"
                >
                  <div className="rt-waiting-card-top">
                    <span className="rt-student-name">{student.name}</span>
                    <span className={`grade-badge ${gradeClassMap[student.grade]}`}>
                      {student.grade}
                    </span>
                  </div>
                  <div className="rt-waiting-card-time">
                    {student.startTime} — {student.endTime}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 우측: 수업 중 + 일시정지 */}
        <div className="rt-column rt-column--active">
          <div className="rt-column-label">
            <span className="material-symbols-outlined">play_circle</span>
            수업 진행
            <span className="rt-column-count">{activeSessions.length + pausedSessions.length}</span>
          </div>
          <div className="rt-column-body">
            {activeSessions.length === 0 && pausedSessions.length === 0 ? (
              <div className="rt-empty">
                <span className="material-symbols-outlined">school</span>
                <span>수업 중인 학생이 없습니다</span>
              </div>
            ) : (
              <>
                {/* 일시정지된 학생들 (상단 고정) */}
                {pausedSessions.map((session) => {
                  const { netMins } = getSessionTimes(session);
                  const pauseDuration = getCurrentPauseDuration(session);
                  const lastReason = session.pauseHistory[session.pauseHistory.length - 1]?.reason;

                  return (
                    <div
                      key={session.studentId}
                      className={`rt-session-card rt-session-card--paused rt-grade-${gradeClassMap[session.student.grade]}`}
                    >
                      <div className="rt-session-top">
                        <div className="rt-session-identity">
                          <span className="rt-student-name">{session.student.name}</span>
                          <span className={`grade-badge ${gradeClassMap[session.student.grade]}`}>
                            {session.student.grade}
                          </span>
                        </div>
                        <span className="rt-status-tag paused">
                          <span className="material-symbols-outlined">pause</span>
                          정지
                        </span>
                      </div>

                      <div className="rt-pause-info">
                        <div className="rt-pause-timer">
                          <span className="material-symbols-outlined">pause_circle</span>
                          {formatSeconds(pauseDuration)}
                          {lastReason && <span className="rt-pause-reason">{lastReason}</span>}
                        </div>
                        <div className="rt-pause-detail">
                          순수 수업 {netMins}분 | 정지 {session.pauseHistory.length}회
                        </div>
                      </div>

                      <div className="rt-session-actions">
                        <button
                          className="rt-action-btn rt-action-btn--resume"
                          onClick={() => handleResume(session.studentId)}
                          type="button"
                        >
                          <span className="material-symbols-outlined">play_arrow</span>
                          재개
                        </button>
                        <button
                          className="rt-action-btn rt-action-btn--done"
                          onClick={() => handleCheckOut(session.studentId)}
                          type="button"
                        >
                          <span className="material-symbols-outlined">check</span>
                          완료
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 수업 중인 학생들 */}
                {activeSessions.map((session) => {
                  const { netMins, pausedMins, remaining } = getSessionTimes(session);
                  const isWarning = remaining <= 10 && remaining > 0;
                  const isOvertime = remaining <= 0;
                  const progress = getProgress(session);

                  return (
                    <div
                      key={session.studentId}
                      className={`rt-session-card rt-grade-${gradeClassMap[session.student.grade]} ${isOvertime ? 'rt-session-card--overtime' : ''}`}
                    >
                      <div className="rt-session-top">
                        <div className="rt-session-identity">
                          <span className="rt-student-name">{session.student.name}</span>
                          <span className={`grade-badge ${gradeClassMap[session.student.grade]}`}>
                            {session.student.grade}
                          </span>
                        </div>
                        {isOvertime && (
                          <span className="rt-status-tag overtime">초과</span>
                        )}
                      </div>

                      {/* 타이머 디스플레이 */}
                      <div className={`rt-timer-display ${isWarning ? 'warning' : ''} ${isOvertime ? 'overtime' : ''}`}>
                        <span className="rt-timer-value">
                          {isOvertime ? '+' : ''}{formatTimer(Math.abs(remaining))}
                        </span>
                        <span className="rt-timer-label">
                          {isOvertime ? '초과' : '남음'}
                        </span>
                      </div>

                      {/* 진행률 바 */}
                      <div className="rt-progress-track">
                        <div
                          className={`rt-progress-fill ${isWarning ? 'warning' : ''} ${isOvertime ? 'overtime' : ''}`}
                          style={{ width: `${Math.min(progress * 100, 100)}%` }}
                        />
                      </div>

                      {/* 상세 정보 */}
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

                      {/* 액션 버튼 */}
                      <div className="rt-session-actions">
                        <button
                          className="rt-action-btn rt-action-btn--pause"
                          onClick={() => handlePauseClick(session.studentId)}
                          type="button"
                        >
                          <span className="material-symbols-outlined">pause</span>
                          정지
                        </button>
                        <button
                          className="rt-action-btn rt-action-btn--done"
                          onClick={() => handleCheckOut(session.studentId)}
                          type="button"
                        >
                          <span className="material-symbols-outlined">check</span>
                          완료
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 일시정지 사유 선택 오버레이 */}
      {pauseTargetId && (
        <div className="rt-pause-overlay" onClick={() => setPauseTargetId(null)}>
          <div className="rt-pause-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rt-pause-sheet-title">일시정지 사유</div>
            <div className="rt-pause-sheet-options">
              {PAUSE_REASONS.map((r) => (
                <button
                  key={r.label}
                  className="rt-pause-option"
                  onClick={() => handlePauseWithReason(r.label)}
                  type="button"
                >
                  <span className="material-symbols-outlined">{r.icon}</span>
                  {r.label}
                </button>
              ))}
            </div>
            <button
              className="rt-pause-skip"
              onClick={() => handlePauseWithReason()}
              type="button"
            >
              사유 없이 정지
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
