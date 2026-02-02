import { useScheduleStore } from '../stores/scheduleStore';
import type { GradeType } from '../types';

const gradeClassMap: Record<GradeType, string> = {
  '중1': 'm1',
  '중2': 'm2',
  '중3': 'm3',
  '고1': 'h1',
  '고2': 'h2',
  '고3': 'h3',
  '검정고시': 'etc',
};

const dayClassMap: Record<string, string> = {
  '화': 'tue',
  '목': 'thu',
  '토': 'sat',
};

export default function StudentView() {
  const { getFilteredStudents } = useScheduleStore();
  const filteredStudents = getFilteredStudents();

  // 학생별로 그룹화 (같은 이름의 학생을 묶음)
  const studentGroups = filteredStudents.reduce((acc, student) => {
    const key = `${student.name}-${student.grade}`;
    if (!acc[key]) {
      acc[key] = {
        name: student.name,
        grade: student.grade,
        schedules: [],
      };
    }
    acc[key].schedules.push(student);
    return acc;
  }, {} as Record<string, { name: string; grade: GradeType; schedules: typeof filteredStudents }>);

  const groups = Object.values(studentGroups).sort((a, b) => {
    // 학년순 정렬
    const gradeOrder: Record<GradeType, number> = {
      '중1': 0, '중2': 1, '중3': 2,
      '고1': 3, '고2': 4, '고3': 5,
      '검정고시': 6,
    };
    if (gradeOrder[a.grade] !== gradeOrder[b.grade]) {
      return gradeOrder[a.grade] - gradeOrder[b.grade];
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {groups.length === 0 ? (
        <div className="table-container">
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined icon-lg">person_off</span>
            </div>
            <div className="empty-state-title">등록된 학생이 없습니다</div>
            <div className="empty-state-description">
              '학생 추가' 버튼을 눌러 새 학생을 등록해보세요.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {groups.map((group) => (
            <div key={`${group.name}-${group.grade}`} className="table-container" style={{ padding: '0' }}>
              {/* Student Card Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: `var(--grade-${gradeClassMap[group.grade]})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '14px',
                    }}
                  >
                    {group.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '16px' }}>{group.name}</div>
                    <span className={`grade-badge ${gradeClassMap[group.grade]}`}>{group.grade}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-icon" title="수정">
                    <span className="material-symbols-outlined icon-sm">edit_square</span>
                  </button>
                  <button className="btn-icon" title="삭제" style={{ color: 'var(--danger)' }}>
                    <span className="material-symbols-outlined icon-sm">delete</span>
                  </button>
                </div>
              </div>

              {/* Schedule List */}
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>
                  수업 일정 ({group.schedules.length}건)
                </div>
                {group.schedules
                  .sort((a, b) => {
                    const dayOrder = { '화': 0, '목': 1, '토': 2 };
                    return dayOrder[a.day] - dayOrder[b.day];
                  })
                  .map((schedule) => (
                    <div
                      key={schedule.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        background: 'var(--background)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '8px',
                      }}
                    >
                      <span className={`day-badge ${dayClassMap[schedule.day]}`} style={{ fontWeight: 700, fontSize: '16px', minWidth: '24px' }}>
                        {schedule.day}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: '14px' }}>
                          {schedule.startTime} — {schedule.endTime}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {schedule.subject}
                        </div>
                      </div>
                      {schedule.localFolder && (
                        <button className="btn btn-sm btn-success" style={{ padding: '4px 8px' }}>
                          <span className="material-symbols-outlined icon-sm">folder</span>
                        </button>
                      )}
                    </div>
                  ))}

                {/* Note */}
                {group.schedules[0]?.note && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 12px',
                      background: 'var(--primary-light)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px',
                      color: 'var(--primary)',
                    }}
                  >
                    <span className="material-symbols-outlined icon-sm" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                      info
                    </span>
                    {group.schedules[0].note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
