import { useAppStore } from '../../stores/appStore';
import type { GradeType, DayType } from '../../types';

const gradeClassMap: Record<GradeType, string> = {
  '중1': 'm1', '중2': 'm2', '중3': 'm3',
  '고1': 'h1', '고2': 'h2', '고3': 'h3',
  '검정고시': 'etc',
};

const dayClassMap: Record<DayType, string> = {
  '화': 'tue', '목': 'thu', '토': 'sat',
};

export default function StudentView() {
  const { getFilteredStudents } = useAppStore();
  const filteredStudents = getFilteredStudents();

  const studentGroups = filteredStudents.reduce((acc, student) => {
    const key = `${student.name}-${student.grade}`;
    if (!acc[key]) {
      acc[key] = { name: student.name, grade: student.grade, schedules: [] };
    }
    acc[key].schedules.push(student);
    return acc;
  }, {} as Record<string, { name: string; grade: GradeType; schedules: typeof filteredStudents }>);

  const groups = Object.values(studentGroups).sort((a, b) => {
    const gradeOrder: Record<GradeType, number> = { '중1': 0, '중2': 1, '중3': 2, '고1': 3, '고2': 4, '고3': 5, '검정고시': 6 };
    return gradeOrder[a.grade] !== gradeOrder[b.grade] ? gradeOrder[a.grade] - gradeOrder[b.grade] : a.name.localeCompare(b.name);
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">학생별 보기</h1>
            <p className="page-description">학생별로 수업 일정을 확인합니다</p>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="material-symbols-outlined empty-state-icon">person_off</span>
            <div className="empty-state-title">등록된 학생이 없습니다</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {groups.map((group) => (
            <div key={`${group.name}-${group.grade}`} className="card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `var(--grade-${gradeClassMap[group.grade]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                    {group.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '16px' }}>{group.name}</div>
                    <span className={`grade-badge ${gradeClassMap[group.grade]}`}>{group.grade}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-icon" title="수정"><span className="material-symbols-outlined">edit_square</span></button>
                  <button className="btn-icon" title="삭제" style={{ color: 'var(--danger)' }}><span className="material-symbols-outlined">delete</span></button>
                </div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>수업 일정 ({group.schedules.length}건)</div>
                {group.schedules.sort((a, b) => ({ '화': 0, '목': 1, '토': 2 })[a.day] - ({ '화': 0, '목': 1, '토': 2 })[b.day]).map((schedule) => (
                  <div key={schedule.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--background)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
                    <span className={`day-badge ${dayClassMap[schedule.day]}`} style={{ fontWeight: 700, fontSize: '16px', minWidth: '24px' }}>{schedule.day}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '14px' }}>{schedule.startTime} — {schedule.endTime}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{schedule.subject}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
