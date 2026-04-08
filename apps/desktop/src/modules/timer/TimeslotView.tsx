import { useMemo, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useReportStore } from '../../stores/reportStore';
import type { Student, GradeType, DayType, Enrollment } from '../../types';
import { getTodayDay } from '../../constants/common';
import { includesHangul } from '../../utils/hangulUtils';
import PageHeader from '../../components/common/PageHeader';

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

const days: { key: DayType; label: string; class: string }[] = [
  { key: '월', label: '월요일', class: 'mon' },
  { key: '화', label: '화요일', class: 'tue' },
  { key: '수', label: '수요일', class: 'wed' },
  { key: '목', label: '목요일', class: 'thu' },
  { key: '금', label: '금요일', class: 'fri' },
  { key: '토', label: '토요일', class: 'sat' },
];

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let h = 10; h <= 21; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  slots.push('22:00');
  return slots;
};

const timeSlots = generateTimeSlots();

const isEnrollmentInTimeSlot = (enrollment: Enrollment, time: string) => {
  const [slotH, slotM] = time.split(':').map(Number);
  const slotMinutes = slotH * 60 + slotM;
  const [startH, startM] = enrollment.startTime.split(':').map(Number);
  const [endH, endM] = enrollment.endTime.split(':').map(Number);
  return slotMinutes >= startH * 60 + startM && slotMinutes < endH * 60 + endM;
};

export default function TimeslotView() {
  const { students, enrollments, timerFilters, addTempStudent } = useAppStore();
  const { currentUser } = useReportStore();
  const [showAddModal, setShowAddModal] = useState(false);

  const now = new Date();
  const currentSlot = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes() >= 30 ? '30' : '00'}`;
  const todayDay = getTodayDay();

  // 필터링된 요일 (선택 없으면 전체)
  const visibleDays = timerFilters.days.length > 0
    ? days.filter((d) => timerFilters.days.includes(d.key))
    : days;

  // 담당 학생 수강 일정 필터링
  const filteredEnrollments = useMemo(() => {
    const teacherId = currentUser?.teacher.id || '';
    const teacherSubjects = currentUser?.teacher.subjects || [];
    const hasTeacher = !!teacherId;

    // 담당 학생 ID 목록
    const myStudentIds = hasTeacher
      ? students.filter(s => s.teacherIds?.includes(teacherId)).map(s => s.id)
      : students.map(s => s.id);

    return enrollments
      .filter(e => {
        // 담당 학생만
        if (!myStudentIds.includes(e.studentId)) return false;
        // 본인 과목만
        if (hasTeacher && teacherSubjects.length > 0 && !teacherSubjects.includes(e.subject)) return false;
        // 학년 필터
        const student = students.find(s => s.id === e.studentId);
        if (timerFilters.grades.length > 0 && student && !timerFilters.grades.includes(student.grade as GradeType)) return false;
        // 검색 필터
        if (timerFilters.search && student && !includesHangul(student.name, timerFilters.search)) return false;
        return true;
      })
      .map(e => ({
        ...e,
        student: students.find(s => s.id === e.studentId)
      }));
  }, [students, enrollments, currentUser, timerFilters]);

  const handleAddStudent = (data: { name: string; grade: string; startTime: string; endTime: string; subject?: string }) => {
    addTempStudent(data);
  };

  return (
    <div>
      <PageHeader
        title="시간대별 보기"
        description="시간대별 수업 현황을 한눈에 확인합니다"
        actions={
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <span className="material-symbols-outlined">add</span>학생 추가
          </button>
        }
      />

      <div className="timeslot-container">
        {visibleDays.map((day) => {
          const dayEnrollments = filteredEnrollments.filter((e) => e.day === day.key);
          return (
            <div key={day.key} className="timeslot-day">
              <div className={`timeslot-day-header ${day.class}`}>
                {day.label}
                {todayDay === day.key && <span style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>오늘</span>}
              </div>
              {timeSlots.map((time) => {
                const enrollmentsInSlot = dayEnrollments.filter((e) => isEnrollmentInTimeSlot(e, time));
                const isCurrent = todayDay === day.key && time === currentSlot;
                return (
                  <div key={time} className={`timeslot-row ${isCurrent ? 'current' : ''}`}>
                    <div className="timeslot-time">{time}</div>
                    <div className="timeslot-students">
                      {enrollmentsInSlot.length === 0 ? (
                        <span className="timeslot-empty">—</span>
                      ) : (
                        enrollmentsInSlot.map((enrollment) => (
                          <span key={enrollment.id} className={`timeslot-student ${gradeClassMap[enrollment.student?.grade || ''] || 'etc'}`}>
                            {enrollment.student?.name || enrollment.studentName}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {showAddModal && <TempStudentModal onClose={() => setShowAddModal(false)} onAdd={handleAddStudent} />}
    </div>
  );
}
