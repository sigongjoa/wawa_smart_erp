import { useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useReportStore } from '../../stores/reportStore';
import type { Student, GradeType, DayType, Enrollment } from '../../types';
import { getTodayDay } from '../../constants/common';
import { includesHangul } from '../../utils/hangulUtils';
import PageHeader from '../../components/common/PageHeader';

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
  const { students, enrollments, timerFilters } = useAppStore();
  const { currentUser } = useReportStore();

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

  return (
    <div>
      <PageHeader title="시간대별 보기" description="시간대별 수업 현황을 한눈에 확인합니다" />

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
    </div>
  );
}
