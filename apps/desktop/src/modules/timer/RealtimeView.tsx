import { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { useAppStore, calculatePausedMinutes } from '../../stores/appStore';
import { useReportStore } from '../../stores/reportStore';
import { Student, DayType, RealtimeSession } from '../../types';
import { getTodayDay } from '../../constants/common';

const GRADE_OPTIONS: string[] = ['초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3','검정고시'];
const SUBJECT_OPTIONS: string[] = ['국어','영어','수학','사회','과학','화학','생물','기타'];

const PAUSE_REASONS = [
  { label: '외출', icon: 'directions_walk' },
  { label: '휴식', icon: 'coffee' },
  { label: '화장실', icon: 'wc' },
  { label: '기타', icon: 'more_horiz' },
] as const;

function TempStudentModal({ onClose, onAdd }: { onClose: () => void; onAdd: (data: { name: string; grade: string; startTime: string; endTime: string; subject?: string }) => void }) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('고1');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [subject, setSubject] = useState('수학');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startTime || !endTime) return;
    onAdd({ name: name.trim(), grade, startTime, endTime, subject });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: '360px', padding: '28px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--warning)' }}>person_add</span>임시 학생 추가
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>이름 <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input className="search-input" style={{ width: '100%' }} value={name} onChange={e => setName(e.target.value)} placeholder="학생 이름" autoFocus />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>학년</label>
            <select className="search-input" style={{ width: '100%' }} value={grade} onChange={e => setGrade(e.target.value)}>
              {GRADE_OPTIONS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>시작 시간 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="time" className="search-input" style={{ width: '100%' }} value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>종료 시간 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="time" className="search-input" style={{ width: '100%' }} value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>과목</label>
            <select className="search-input" style={{ width: '100%' }} value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECT_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim() || !startTime || !endTime}>추가하기</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const gradeClassMap: Record<string, string> = {
  '초1': 'm1', '초2': 'm1', '초3': 'm1', '초4': 'm2', '초5': 'm2', '초6': 'm2',
  '중1': 'm1', '중2': 'm2', '중3': 'm3',
  '고1': 'h1', '고2': 'h2', '고3': 'h3',
  '검정고시': 'etc',
};

const formatTime = (date: Date) => date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

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

const ActiveSessionCard = memo(function ActiveSessionCard({ session, onCheckOut, onPause, onExtend }: {
  session: RealtimeSession;
  onCheckOut: (studentId: string) => void;
  onPause: (studentId: string) => void;
  onExtend: (studentId: string) => void;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const checkIn = new Date(session.checkInTime);
  const totalElapsed = Math.floor((now.getTime() - checkIn.getTime()) / 1000 / 60);
  const pausedMins = calculatePausedMinutes(session.pauseHistory, now);
  const netMins = totalElapsed - pausedMins;
  const remaining = session.scheduledMinutes - netMins;
  const isWarning = remaining <= 10 && remaining > 0;
  const isOvertime = remaining <= 0;
  const progress = session.scheduledMinutes > 0 ? Math.min(netMins / session.scheduledMinutes, 1) : 0;
  const addedMins = session.addedMinutes || 0;

  // 실제 체크인 시각 HH:mm
  const checkInHHmm = `${checkIn.getHours().toString().padStart(2, '0')}:${checkIn.getMinutes().toString().padStart(2, '0')}`;

  // 예정 종료 시각 = 체크인 + scheduledMinutes (정지/추가 모두 반영됨)
  const expectedEnd = new Date(checkIn.getTime() + session.scheduledMinutes * 60 * 1000);
  const expectedEndHHmm = `${expectedEnd.getHours().toString().padStart(2, '0')}:${expectedEnd.getMinutes().toString().padStart(2, '0')}`;
  const originalEndMin = session.scheduledEndTime
    ? session.scheduledEndTime.split(':').reduce((h, m, i) => i === 0 ? Number(m) * 60 : h + Number(m), 0)
    : null;
  const currentEndMin = expectedEnd.getHours() * 60 + expectedEnd.getMinutes();
  const endShift = originalEndMin !== null ? currentEndMin - originalEndMin : 0;

  return (
    <div className={`rt-session-card rt-grade-${gradeClassMap[session.student.grade]} ${isOvertime ? 'rt-session-card--overtime' : ''}`}>
      <div className="rt-session-top">
        <div className="rt-session-identity">
          <span className="rt-student-name">{session.student.name}</span>
          <span className={`grade-badge ${gradeClassMap[session.student.grade]}`}>{session.student.grade}</span>
          {session.student.isTemp && (
            <span style={{ background: 'var(--warning)', color: 'white', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>임시</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {addedMins > 0 && (
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#dc2626', color: 'white' }}>
              +{addedMins}분 추가
            </span>
          )}
          {isOvertime && <span className="rt-status-tag overtime">초과</span>}
        </div>
      </div>

      {/* 시작 / 예정종료 시각 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        <span>시작 <strong style={{ color: 'var(--text-primary)' }}>{checkInHHmm}</strong></span>
        <span>예정종료 <strong style={{ color: endShift > 0 ? '#f59e0b' : isOvertime ? '#ef4444' : 'var(--text-primary)', textDecoration: isOvertime ? 'line-through' : 'none' }}>
          {expectedEndHHmm}
        </strong>
        {endShift > 0 && <span style={{ color: '#f59e0b', marginLeft: '4px', fontWeight: 400 }}>(+{endShift}분)</span>}
        </span>
      </div>

      <div className={`rt-timer-display ${isWarning ? 'warning' : ''} ${isOvertime ? 'overtime' : ''}`}>
        <span className="rt-timer-value">
          {isOvertime ? '+' : ''}{formatTimer(Math.abs(remaining))}
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
        <span>예정 {addedMins > 0
          ? <><s style={{ color: 'var(--text-muted)' }}>{session.scheduledMinutes - addedMins}</s> <span style={{ color: '#dc2626', fontWeight: 700 }}>{session.scheduledMinutes}분</span></>
          : <>{session.scheduledMinutes}분</>
        }</span>
        {pausedMins > 0 && (
          <>
            <span className="rt-meta-divider">|</span>
            <span className="rt-meta-paused">정지 {pausedMins}분</span>
          </>
        )}
        {addedMins > 0 && (
          <>
            <span className="rt-meta-divider">|</span>
            <span style={{ color: '#dc2626', fontWeight: 600 }}>벌칙 +{addedMins}분</span>
          </>
        )}
      </div>

      <div className="rt-session-actions">
        <button className="rt-action-btn rt-action-btn--pause" onClick={() => onPause(session.studentId)} type="button">
          <span className="material-symbols-outlined">pause</span>정지
        </button>
        <button className="rt-action-btn" onClick={() => onExtend(session.studentId)} type="button"
          style={{ background: '#fef2f2', color: '#dc2626', flex: 1, padding: '8px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined">add</span>수업추가
        </button>
        <button className="rt-action-btn rt-action-btn--done" onClick={() => onCheckOut(session.studentId)} type="button">
          <span className="material-symbols-outlined">check</span>완료
        </button>
      </div>
    </div>
  );
});

const PausedSessionCard = memo(function PausedSessionCard({ session, onResume, onCheckOut }: {
  session: RealtimeSession;
  onResume: (studentId: string) => void;
  onCheckOut: (studentId: string) => void;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const checkIn = new Date(session.checkInTime);
  const totalElapsed = Math.floor((now.getTime() - checkIn.getTime()) / 1000 / 60);
  const pausedMins = calculatePausedMinutes(session.pauseHistory, now);
  const netMins = totalElapsed - pausedMins;

  const lastPause = session.pauseHistory[session.pauseHistory.length - 1];
  const pauseDuration = lastPause && !lastPause.resumedAt
    ? now.getTime() - new Date(lastPause.pausedAt).getTime()
    : 0;
  const lastReason = lastPause?.reason;

  return (
    <div className={`rt-session-card rt-session-card--paused rt-grade-${gradeClassMap[session.student.grade]}`}>
      <div className="rt-session-top">
        <div className="rt-session-identity">
          <span className="rt-student-name">{session.student.name}</span>
          <span className={`grade-badge ${gradeClassMap[session.student.grade]}`}>{session.student.grade}</span>
        </div>
        <span className="rt-status-tag paused">
          <span className="material-symbols-outlined">pause</span>정지
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
        <button className="rt-action-btn rt-action-btn--resume" onClick={() => onResume(session.studentId)} type="button">
          <span className="material-symbols-outlined">play_arrow</span>재개
        </button>
        <button className="rt-action-btn rt-action-btn--done" onClick={() => onCheckOut(session.studentId)} type="button">
          <span className="material-symbols-outlined">check</span>완료
        </button>
      </div>
    </div>
  );
});

const dayOptions: { key: DayType; label: string }[] = [
  { key: '월', label: '월' },
  { key: '화', label: '화' },
  { key: '수', label: '수' },
  { key: '목', label: '목' },
  { key: '금', label: '금' },
  { key: '토', label: '토' },
];

const EXTEND_OPTIONS = [10, 20, 30];

function ExtendSheet({ onExtend, onClose }: { onExtend: (min: number) => void; onClose: () => void }) {
  const [custom, setCustom] = useState('');
  return (
    <div className="rt-pause-overlay" onClick={onClose}>
      <div className="rt-pause-sheet" onClick={e => e.stopPropagation()}>
        <div className="rt-pause-sheet-title">수업 추가</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px' }}>
          벌칙/보충으로 수업 시간을 연장합니다
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          {EXTEND_OPTIONS.map(m => (
            <button key={m} type="button"
              style={{ padding: '14px 8px', border: '2px solid #fecaca', borderRadius: '10px', background: '#fff5f5', fontSize: '15px', fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}
              onClick={() => onExtend(m)}>
              +{m}분
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="number" min={1} max={180} placeholder="직접 입력 (분)"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }}
          />
          <button type="button" disabled={!custom || Number(custom) < 1}
            style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => onExtend(Number(custom))}>
            추가
          </button>
        </div>
        <button className="rt-pause-skip" onClick={onClose} type="button">취소</button>
      </div>
    </div>
  );
}

export default function RealtimeView() {
  const { students, enrollments, realtimeSessions, checkIn, checkOut, pauseSession, resumeSession, extendSession, tempStudents, addTempStudent } = useAppStore();
  const { currentUser } = useReportStore();
  const [isTempModalOpen, setIsTempModalOpen] = useState(false);
  const [pauseTargetId, setPauseTargetId] = useState<string | null>(null);
  const [extendTargetId, setExtendTargetId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayDay = getTodayDay();
  const [selectedDay, setSelectedDay] = useState<DayType>(todayDay);
  const isToday = selectedDay === todayDay;

  const dayStudents = useMemo(() => {
    const teacherId = currentUser?.teacher.id || '';
    const teacherSubjects = currentUser?.teacher.subjects || [];
    const hasTeacher = !!teacherId;

    const dbStudents = students
      .filter(student => {
        if (hasTeacher && !student.teacherIds?.includes(teacherId)) return false;
        return true;
      })
      .map(student => {
        let dayEnrollments = enrollments.filter(e => e.studentId === student.id && e.day === selectedDay);

        if (hasTeacher && teacherSubjects.length > 0) {
          dayEnrollments = dayEnrollments.filter(e => teacherSubjects.includes(e.subject));
        }

        if (dayEnrollments.length > 0) {
          const firstEnrollment = dayEnrollments.sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
          return {
            ...student,
            startTime: firstEnrollment.startTime,
            endTime: firstEnrollment.endTime,
            subject: firstEnrollment.subject,
            day: selectedDay,
            todayEnrollments: dayEnrollments
          };
        }
        return null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const tempList = tempStudents.map(s => ({ ...s, day: selectedDay, todayEnrollments: [] }));
    return [...dbStudents, ...tempList];
  }, [students, enrollments, currentUser, selectedDay, tempStudents]);

  const waitingStudents = dayStudents.filter(
    (s) => !realtimeSessions.some((sess) => sess.studentId === s.id)
  );
  const activeSessions = realtimeSessions.filter((s) => s.status === 'active' || s.status === 'overtime');
  const pausedSessions = realtimeSessions.filter((s) => s.status === 'paused');
  const completedCount = realtimeSessions.filter((s) => s.status === 'completed').length;

  const handlePauseClick = (studentId: string) => setPauseTargetId(studentId);
  const handlePauseWithReason = (reason?: string) => {
    if (pauseTargetId) {
      pauseSession(pauseTargetId, reason);
      setPauseTargetId(null);
    }
  };
  const handleExtendClick = (studentId: string) => setExtendTargetId(studentId);
  const handleExtend = (minutes: number) => {
    if (extendTargetId) {
      extendSession(extendTargetId, minutes);
      setExtendTargetId(null);
    }
  };

  return (
    <div className="rt-root">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">실시간 수업 관리</h1>
            <p className="page-description">수업 출석 현황을 실시간으로 관리합니다</p>
          </div>
        </div>
      </div>

      {/* 요일 선택 */}
      <div className="filter-bar" style={{ marginBottom: '16px' }}>
        <div className="filter-buttons" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {dayOptions.map((day) => (
            <button
              key={day.key}
              className={`filter-btn ${selectedDay === day.key ? 'active' : ''}`}
              onClick={() => setSelectedDay(day.key)}
              style={{ position: 'relative' }}
            >
              {day.label}
              {day.key === todayDay && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)',
                }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 상단 요약 바 */}
      <div className="rt-summary-bar">
        <div className="rt-clock">
          <span className="material-symbols-outlined">schedule</span>
          {formatTime(currentTime)}
        </div>
        <div className="rt-summary-pills">
          <span className="rt-pill waiting">대기 <strong>{waitingStudents.length}</strong></span>
          <span className="rt-pill active">수업 <strong>{activeSessions.length}</strong></span>
          {pausedSessions.length > 0 && (
            <span className="rt-pill paused">정지 <strong>{pausedSessions.length}</strong></span>
          )}
          <span className="rt-pill completed">완료 <strong>{completedCount}</strong></span>
        </div>
      </div>

      {/* 메인 2컬럼 레이아웃 */}
      <div className="rt-columns">
        {/* 좌측: 대기 */}
        <div className="rt-column rt-column--waiting">
          <div className="rt-column-label" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined">hourglass_empty</span>
              {isToday ? '대기 중' : `${selectedDay}요일`}
              <span className="rt-column-count">{waitingStudents.length}</span>
            </div>
            {isToday && (
              <button
                onClick={() => setIsTempModalOpen(true)}
                title="임시 학생 추가"
                style={{ background: 'var(--warning)', color: 'white', border: 'none', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person_add</span>임시
              </button>
            )}
          </div>
          <div className="rt-column-body">
            {waitingStudents.length === 0 ? (
              <div className="rt-empty">
                <span className="material-symbols-outlined">check_circle</span>
                <span>{isToday ? '모든 학생이 수업 중입니다' : `${selectedDay}요일 수업 학생이 없습니다`}</span>
              </div>
            ) : (
              waitingStudents.map((student) => (
                <button
                  key={student.id}
                  className={`rt-waiting-card rt-grade-${gradeClassMap[student.grade]}`}
                  onClick={isToday ? () => checkIn(student.id, { startTime: student.startTime || '', endTime: student.endTime || '', subject: student.subject }) : undefined}
                  style={!isToday ? { cursor: 'default', opacity: 0.85 } : undefined}
                  type="button"
                >
                  <div className="rt-waiting-card-top">
                    <span className="rt-student-name">{student.name}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {student.isTemp && (
                        <span style={{ background: 'var(--warning)', color: 'white', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>임시</span>
                      )}
                      <span className={`grade-badge ${gradeClassMap[student.grade]}`}>{student.grade}</span>
                    </div>
                  </div>
                  <div className="rt-waiting-card-time">
                    {student.startTime} — {student.endTime}
                    {student.subject && <span style={{ marginLeft: '8px', opacity: 0.7 }}>({student.subject})</span>}
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
                {pausedSessions.map((session) => (
                  <PausedSessionCard
                    key={session.studentId}
                    session={session}
                    onResume={resumeSession}
                    onCheckOut={checkOut}
                  />
                ))}
                {activeSessions.map((session) => (
                  <ActiveSessionCard
                    key={session.studentId}
                    session={session}
                    onCheckOut={checkOut}
                    onPause={handlePauseClick}
                    onExtend={handleExtendClick}
                  />
                ))}
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
                <button key={r.label} className="rt-pause-option" onClick={() => handlePauseWithReason(r.label)} type="button">
                  <span className="material-symbols-outlined">{r.icon}</span>
                  {r.label}
                </button>
              ))}
            </div>
            <button className="rt-pause-skip" onClick={() => handlePauseWithReason()} type="button">
              사유 없이 정지
            </button>
          </div>
        </div>
      )}

      {extendTargetId && (
        <ExtendSheet
          onExtend={handleExtend}
          onClose={() => setExtendTargetId(null)}
        />
      )}

      {isTempModalOpen && (
        <TempStudentModal
          onClose={() => setIsTempModalOpen(false)}
          onAdd={(data) => addTempStudent(data)}
        />
      )}
    </div>
  );
}
