import { useState, useEffect } from 'react';
import { useScheduleStore } from '../stores/scheduleStore';
import type { Student, GradeType } from '../types';

const gradeClassMap: Record<GradeType, string> = {
  '중1': 'm1',
  '중2': 'm2',
  '중3': 'm3',
  '고1': 'h1',
  '고2': 'h2',
  '고3': 'h3',
  '검정고시': 'etc',
};

export default function RealtimeView() {
  const { getTodayStudents, realtimeSessions, checkIn, checkOut } = useScheduleStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStudents = getTodayStudents();

  // 대기 중인 학생 (아직 체크인하지 않은 학생)
  const waitingStudents = todayStudents.filter(
    (s) => !realtimeSessions.some((sess) => sess.studentId === s.id)
  );

  // 수업 중인 학생
  const activeStudents = realtimeSessions.filter((s) => s.status === 'active');

  // 완료된 학생
  const completedCount = realtimeSessions.filter((s) => s.status === 'completed').length;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const handleCheckIn = (student: Student) => {
    checkIn(student.id);
  };

  const handleCheckOut = (studentId: string) => {
    checkOut(studentId);
  };

  // 경과 시간 계산
  const getElapsedTime = (checkInTime: string, scheduledMinutes: number) => {
    const startTime = new Date(checkInTime);
    const elapsed = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000 / 60);
    const remaining = scheduledMinutes - elapsed;

    return { elapsed, remaining };
  };

  const formatTimer = (minutes: number) => {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '';
    return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <span className="material-symbols-outlined">schedule</span>
          </div>
          <div className="stat-content">
            <span className="stat-label">현재 시간</span>
            <span className="stat-value" style={{ fontSize: '20px', letterSpacing: '-0.025em' }}>
              {formatTime(currentTime)}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <span className="material-symbols-outlined">hourglass_empty</span>
          </div>
          <div className="stat-content">
            <span className="stat-label">대기 중</span>
            <span className="stat-value">
              {waitingStudents.length}
              <span className="stat-unit">명</span>
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <span className="material-symbols-outlined">play_circle</span>
          </div>
          <div className="stat-content">
            <span className="stat-label">수업 중</span>
            <span className="stat-value">
              {activeStudents.length}
              <span className="stat-unit">명</span>
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div className="stat-content">
            <span className="stat-label">완료</span>
            <span className="stat-value">
              {completedCount}
              <span className="stat-unit">명</span>
            </span>
          </div>
        </div>
      </div>

      {/* Realtime Panels */}
      <div className="realtime-container">
        {/* Waiting Panel */}
        <div className="realtime-panel">
          <div className="realtime-panel-header waiting">
            <span>대기 중인 학생</span>
            <span>{waitingStudents.length}명</span>
          </div>
          <div className="realtime-panel-body">
            {waitingStudents.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <span className="material-symbols-outlined icon-lg" style={{ color: 'var(--text-muted)' }}>
                  person_off
                </span>
                <div className="empty-state-title">대기 중인 학생이 없습니다</div>
              </div>
            ) : (
              waitingStudents.map((student) => (
                <div
                  key={student.id}
                  className={`realtime-card ${gradeClassMap[student.grade]}`}
                  onClick={() => handleCheckIn(student)}
                >
                  <div className="realtime-card-header">
                    <span className="realtime-card-name">{student.name}</span>
                    <span className={`grade-badge ${gradeClassMap[student.grade]}`}>
                      {student.grade}
                    </span>
                  </div>
                  <div className="realtime-card-time">
                    <span className="material-symbols-outlined icon-sm" style={{ verticalAlign: 'middle' }}>
                      schedule
                    </span>
                    {' '}{student.startTime} — {student.endTime}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    클릭하여 수업 시작
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Panel */}
        <div className="realtime-panel">
          <div className="realtime-panel-header active">
            <span>수업 중</span>
            <span>{activeStudents.length}명</span>
          </div>
          <div className="realtime-panel-body">
            {activeStudents.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <span className="material-symbols-outlined icon-lg" style={{ color: 'var(--text-muted)' }}>
                  school
                </span>
                <div className="empty-state-title">수업 중인 학생이 없습니다</div>
              </div>
            ) : (
              activeStudents.map((session) => {
                const { elapsed, remaining } = getElapsedTime(session.checkInTime, session.scheduledMinutes);
                const isWarning = remaining <= 10 && remaining > 0;
                const isOvertime = remaining <= 0;

                return (
                  <div
                    key={session.studentId}
                    className={`realtime-card ${gradeClassMap[session.student.grade]} ${isOvertime ? 'overtime' : ''}`}
                    style={{ cursor: 'default' }}
                  >
                    <div className="realtime-card-header">
                      <span className="realtime-card-name">{session.student.name}</span>
                      <span className={`grade-badge ${gradeClassMap[session.student.grade]}`}>
                        {session.student.grade}
                      </span>
                    </div>
                    <div className={`realtime-timer ${isWarning ? 'warning' : ''} ${isOvertime ? 'overtime' : ''}`}>
                      {isOvertime ? (
                        <span>+{formatTimer(Math.abs(remaining))} 초과</span>
                      ) : (
                        <span>{formatTimer(remaining)} 남음</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      경과: {elapsed}분 / 예정: {session.scheduledMinutes}분
                    </div>
                    <div className="realtime-card-actions">
                      <button className="btn btn-secondary btn-sm" style={{ background: 'var(--warning)', color: 'white', border: 'none' }}>
                        <span className="material-symbols-outlined icon-sm">add</span>
                        연장
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleCheckOut(session.studentId)}
                      >
                        <span className="material-symbols-outlined icon-sm">check</span>
                        완료
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
