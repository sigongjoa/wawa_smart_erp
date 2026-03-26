import { useState, useEffect, useMemo, memo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useReportStore } from '../../stores/reportStore';
import { Student, GradeType, DayType } from '../../types';
import { getTodayDay } from '../../constants/common';

const GRADE_OPTIONS: string[] = ['초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3','검정고시'];
const SUBJECT_OPTIONS: string[] = ['국어','영어','수학','사회','과학','화학','생물','기타'];

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
          <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>person_add</span>임시 학생 추가
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
  return `${minutes < 0 ? '-' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const CurrentTimeClock = memo(function CurrentTimeClock() {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{formatTime(currentTime)}</>;
});

const ActiveSessionCard = memo(function ActiveSessionCard({ session, onCheckOut }: {
  session: any;
  onCheckOut: (studentId: string) => void;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = Math.floor((now.getTime() - new Date(session.checkInTime).getTime()) / 1000 / 60);
  const remaining = session.scheduledMinutes - elapsed;
  const isWarning = remaining <= 10 && remaining > 0;
  const isOvertime = remaining <= 0;

  return (
    <div className={`realtime-card ${gradeClassMap[session.student.grade]}`} style={{ cursor: 'default' }}>
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
        <button className="btn btn-primary btn-sm" onClick={() => onCheckOut(session.studentId)}>
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

export default function RealtimeView() {
  const { students, enrollments, realtimeSessions, checkIn, checkOut, tempStudents, addTempStudent } = useAppStore();
  const { currentUser } = useReportStore();
  const [isTempModalOpen, setIsTempModalOpen] = useState(false);

  // 오늘 요일
  const todayDay = getTodayDay();
  // 선택된 요일 (기본값: 오늘)
  const [selectedDay, setSelectedDay] = useState<DayType>(todayDay);
  const isToday = selectedDay === todayDay;

  // 선택된 요일의 수업 학생 목록
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

    // 임시 학생은 요일 필터 없이 항상 포함 (오늘 뷰에서만 의미 있음)
    const tempList = tempStudents.map(s => ({ ...s, day: selectedDay, todayEnrollments: [] }));

    return [...dbStudents, ...tempList];
  }, [students, enrollments, currentUser, selectedDay, tempStudents]);

  const waitingStudents = dayStudents.filter(
    (s) => !realtimeSessions.some((sess) => sess.studentId === s.id)
  );
  const activeStudents = realtimeSessions.filter((s) => s.status === 'active');
  const completedCount = realtimeSessions.filter((s) => s.status === 'completed').length;


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
            <div className="stat-value" style={{ fontSize: '20px' }}><CurrentTimeClock /></div>
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
          <div className="realtime-panel-header waiting" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{isToday ? '대기 중인 학생' : `${selectedDay}요일 수업 학생`}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{waitingStudents.length}명</span>
              {isToday && (
                <button
                  onClick={() => setIsTempModalOpen(true)}
                  title="임시 학생 추가"
                  style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person_add</span>임시
                </button>
              )}
            </div>
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
                  style={!isToday ? { cursor: 'default', opacity: 0.85 } : student.isTemp ? { borderLeft: '3px solid #f59e0b' } : undefined}
                >
                  <div className="realtime-card-header">
                    <span className="realtime-card-name">{student.name}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {student.isTemp && (
                        <span style={{ background: '#f59e0b', color: 'white', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>임시</span>
                      )}
                      <span className={`grade-badge ${gradeClassMap[student.grade]}`}>{student.grade}</span>
                    </div>
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
              activeStudents.map((session) => (
                <ActiveSessionCard key={session.studentId} session={session} onCheckOut={checkOut} />
              ))
            )}
          </div>
        </div>
      </div>

      {isTempModalOpen && (
        <TempStudentModal
          onClose={() => setIsTempModalOpen(false)}
          onAdd={(data) => addTempStudent(data)}
        />
      )}
    </div>
  );
}
