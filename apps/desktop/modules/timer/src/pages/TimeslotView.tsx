import { useScheduleStore } from '../stores/scheduleStore';
import type { Student, GradeType, DayType } from '../types';

const gradeClassMap: Record<GradeType, string> = {
  '중1': 'm1',
  '중2': 'm2',
  '중3': 'm3',
  '고1': 'h1',
  '고2': 'h2',
  '고3': 'h3',
  '검정고시': 'etc',
};

const days: { key: DayType; label: string; class: string }[] = [
  { key: '화', label: '화요일', class: 'tue' },
  { key: '목', label: '목요일', class: 'thu' },
  { key: '토', label: '토요일', class: 'sat' },
];

// 시간대 생성 (13:00 ~ 22:00, 30분 간격)
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

// 학생이 해당 시간대에 수업 중인지 확인
const isStudentInTimeSlot = (student: Student, time: string) => {
  const [slotH, slotM] = time.split(':').map(Number);
  const slotMinutes = slotH * 60 + slotM;

  const [startH, startM] = student.startTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;

  const [endH, endM] = student.endTime.split(':').map(Number);
  const endMinutes = endH * 60 + endM;

  return slotMinutes >= startMinutes && slotMinutes < endMinutes;
};

export default function TimeslotView() {
  const { getFilteredStudents, filters } = useScheduleStore();
  const filteredStudents = getFilteredStudents();

  // 현재 시간대 확인
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSlot = `${currentHour.toString().padStart(2, '0')}:${currentMinute >= 30 ? '30' : '00'}`;

  // 오늘 요일
  const dayMap: Record<number, DayType> = { 2: '화', 4: '목', 6: '토' };
  const todayDay = dayMap[now.getDay()];

  // 표시할 요일들
  const visibleDays = filters.day === 'all' ? days : days.filter((d) => d.key === filters.day);

  return (
    <div className="timeslot-container">
      {visibleDays.map((day) => {
        const dayStudents = filteredStudents.filter((s) => s.day === day.key);

        return (
          <div key={day.key} className="timeslot-day">
            <div className={`timeslot-day-header ${day.class}`}>
              {day.label}
              {todayDay === day.key && (
                <span
                  style={{
                    marginLeft: '8px',
                    background: 'rgba(255,255,255,0.3)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                  }}
                >
                  오늘
                </span>
              )}
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
                        <span
                          key={student.id}
                          className={`timeslot-student ${gradeClassMap[student.grade]}`}
                        >
                          {student.name}
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

      {visibleDays.length === 0 && (
        <div className="empty-state" style={{ width: '100%' }}>
          <div className="empty-state-icon">
            <span className="material-symbols-outlined icon-lg">calendar_month</span>
          </div>
          <div className="empty-state-title">요일을 선택해주세요</div>
        </div>
      )}
    </div>
  );
}
