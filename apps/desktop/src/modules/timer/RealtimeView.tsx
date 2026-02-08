import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useReportStore } from '../../stores/reportStore';
import { Student, GradeType, DayType } from '../../types';
import { getTodayDay } from '../../constants/common';

const gradeClassMap: Record<string, string> = {
  '초1': 'm1', '초2': 'm1', '초3': 'm1', '초4': 'm2', '초5': 'm2', '초6': 'm2',
  '중1': 'm1', '중2': 'm2', '중3': 'm3',
  '고1': 'h1', '고2': 'h2', '고3': 'h3',
  '검정고시': 'etc',
};

const dayOptions: { key: DayType; label: string }[] = [
  { key: '월', label: '월' },
  { key: '화', label: '화' },
  { key: '수', label: '수' },
  { key: '목', label: '목' },
  { key: '금', label: '금' },
  { key: '토', label: '토' },
];

export default function RealtimeView() {
  const { students, enrollments, realtimeSessions, checkIn, checkOut } = useAppStore();
  const { currentUser } = useReportStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  // 오늘 요일
  const todayDay = getTodayDay();
  // 선택된 요일 (기본값: 오늘)
  const [selectedDay, setSelectedDay] = useState<DayType>(todayDay);
  const isToday = selectedDay === todayDay;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 선택된 요일의 수업 학생 목록
  const dayStudents = useMemo(() => {
    const teacherId = currentUser?.teacher.id || '';
    const teacherSubjects = currentUser?.teacher.subjects || [];
    const hasTeacher = !!teacherId;

    return students
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
  }, [students, enrollments, currentUser, selectedDay]);

  const waitingStudents = dayStudents.filter(
    (s) => !realtimeSessions.some((sess) => sess.studentId === s.id)
  );
  const activeStudents = realtimeSessions.filter((s) => s.status === 'active');
  const completedCount = realtimeSessions.filter((s) => s.status === 'completed').length;

  const formatTime = (date: Date) => date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const getElapsedTime = (checkInTime: string, scheduledMinutes: number) => {
    const elapsed = Math.floor((currentTime.getTime() - new Date(checkInTime).getTime()) / 1000 / 60);
    return { elapsed, remaining: scheduledMinutes - elapsed };
  };

  const formatTimer = (minutes: number) => {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    return `${minutes < 0 ? '-' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div>
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
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <span className="material-symbols-outlined">schedule</span>
          </div>
          <div>
            <span className="stat-label">현재 시간</span>
            <div className="stat-value" style={{ fontSize: '20px' }}>{formatTime(currentTime)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <span className="material-symbols-outlined">hourglass_empty</span>
          </div>
          <div>
            <span className="stat-label">대기 중</span>
            <div className="stat-value">{waitingStudents.length}<span className="stat-unit">명</span></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <span className="material-symbols-outlined">play_circle</span>
          </div>
          <div>
            <span className="stat-label">수업 중</span>
            <div className="stat-value">{activeStudents.length}<span className="stat-unit">명</span></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <span className="stat-label">완료</span>
            <div className="stat-value">{completedCount}<span className="stat-unit">명</span></div>
          </div>
        </div>
      </div>

      <div className="realtime-container">
        <div className="realtime-panel">
          <div className="realtime-panel-header waiting">
            <span>{isToday ? '대기 중인 학생' : `${selectedDay}요일 수업 학생`}</span>
            <span>{waitingStudents.length}명</span>
          </div>
          <div className="realtime-panel-body">
            {waitingStudents.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--text-muted)' }}>person_off</span>
                <div className="empty-state-title">
                  {isToday ? '대기 중인 학생이 없습니다' : `${selectedDay}요일 수업 학생이 없습니다`}
                </div>
              </div>
            ) : (
              waitingStudents.map((student) => (
                <div
                  key={student.id}
                  className={`realtime-card ${gradeClassMap[student.grade]}`}
                  onClick={isToday ? () => checkIn(student.id, { startTime: student.startTime || '', endTime: student.endTime || '', subject: student.subject }) : undefined}
                  style={!isToday ? { cursor: 'default', opacity: 0.85 } : undefined}
                >
                  <div className="realtime-card-header">
                    <span className="realtime-card-name">{student.name}</span>
                    <span className={`grade-badge ${gradeClassMap[student.grade]}`}>{student.grade}</span>
                  </div>
                  <div className="realtime-card-time">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle' }}>schedule</span>
                    {' '}{student.startTime} — {student.endTime}
                    {student.subject && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>({student.subject})</span>}
                  </div>
                  {isToday && (
                    <div style={{ textAlign: 'center', marginTop: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      클릭하여 수업 시작
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="realtime-panel">
          <div className="realtime-panel-header active">
            <span>수업 중</span>
            <span>{activeStudents.length}명</span>
          </div>
          <div className="realtime-panel-body">
            {activeStudents.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--text-muted)' }}>school</span>
                <div className="empty-state-title">수업 중인 학생이 없습니다</div>
              </div>
            ) : (
              activeStudents.map((session) => {
                const { remaining } = getElapsedTime(session.checkInTime, session.scheduledMinutes);
                const isWarning = remaining <= 10 && remaining > 0;
                const isOvertime = remaining <= 0;

                return (
                  <div key={session.studentId} className={`realtime-card ${gradeClassMap[session.student.grade]}`} style={{ cursor: 'default' }}>
                    <div className="realtime-card-header">
                      <span className="realtime-card-name">{session.student.name}</span>
                      <span className={`grade-badge ${gradeClassMap[session.student.grade]}`}>{session.student.grade}</span>
                    </div>
                    <div className={`realtime-timer ${isWarning ? 'warning' : ''} ${isOvertime ? 'overtime' : ''}`}>
                      {isOvertime ? `+${formatTimer(Math.abs(remaining))} 초과` : `${formatTimer(remaining)} 남음`}
                    </div>
                    <div className="realtime-card-actions">
                      <button className="btn btn-sm" style={{ background: 'var(--warning)', color: 'white' }}>
                        <span className="material-symbols-outlined">add</span>연장
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => checkOut(session.studentId)}>
                        <span className="material-symbols-outlined">check</span>완료
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
