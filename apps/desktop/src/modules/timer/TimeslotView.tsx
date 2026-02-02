import { useAppStore } from '../../stores/appStore';
import type { Student, GradeType, DayType } from '../../types';

const gradeClassMap: Record<GradeType, string> = {
  '중1': 'm1', '중2': 'm2', '중3': 'm3',
  '고1': 'h1', '고2': 'h2', '고3': 'h3',
  '검정고시': 'etc',
};

const days: { key: DayType; label: string; class: string }[] = [
  { key: '화', label: '화요일', class: 'tue' },
  { key: '목', label: '목요일', class: 'thu' },
  { key: '토', label: '토요일', class: 'sat' },
];

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let h = 13; h <= 21; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  slots.push('22:00');
  return slots;
};

const timeSlots = generateTimeSlots();

const isStudentInTimeSlot = (student: Student, time: string) => {
  const [slotH, slotM] = time.split(':').map(Number);
  const slotMinutes = slotH * 60 + slotM;
  const [startH, startM] = student.startTime.split(':').map(Number);
  const [endH, endM] = student.endTime.split(':').map(Number);
  return slotMinutes >= startH * 60 + startM && slotMinutes < endH * 60 + endM;
};

export default function TimeslotView() {
  const { getFilteredStudents, timerFilters } = useAppStore();
  const filteredStudents = getFilteredStudents();

  const now = new Date();
  const currentSlot = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes() >= 30 ? '30' : '00'}`;
  const dayMap: Record<number, DayType> = { 2: '화', 4: '목', 6: '토' };
  const todayDay = dayMap[now.getDay()];
  const visibleDays = timerFilters.day === 'all' ? days : days.filter((d) => d.key === timerFilters.day);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">시간대별 보기</h1>
            <p className="page-description">시간대별 수업 현황을 한눈에 확인합니다</p>
          </div>
        </div>
      </div>

      <div className="timeslot-container">
        {visibleDays.map((day) => {
          const dayStudents = filteredStudents.filter((s) => s.day === day.key);
          return (
            <div key={day.key} className="timeslot-day">
              <div className={`timeslot-day-header ${day.class}`}>
                {day.label}
                {todayDay === day.key && <span style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>오늘</span>}
              </div>
              {timeSlots.map((time) => {
                const studentsInSlot = dayStudents.filter((s) => isStudentInTimeSlot(s, time));
                const isCurrent = todayDay === day.key && time === currentSlot;
                return (
                  <div key={time} className={`timeslot-row ${isCurrent ? 'current' : ''}`}>
                    <div className="timeslot-time">{time}</div>
                    <div className="timeslot-students">
                      {studentsInSlot.length === 0 ? (
                        <span className="timeslot-empty">—</span>
                      ) : (
                        studentsInSlot.map((student) => (
                          <span key={student.id} className={`timeslot-student ${gradeClassMap[student.grade]}`}>{student.name}</span>
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
