import { useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useReportStore } from '../../stores/reportStore';
import type { GradeType, DayType } from '../../types';
import PageHeader from '../../components/common/PageHeader';

const gradeClassMap: Record<string, string> = {
  '초1': 'm1', '초2': 'm1', '초3': 'm1', '초4': 'm2', '초5': 'm2', '초6': 'm2',
  '중1': 'm1', '중2': 'm2', '중3': 'm3',
  '고1': 'h1', '고2': 'h2', '고3': 'h3',
  '검정고시': 'etc',
};

const dayClassMap: Record<DayType, string> = {
  '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun',
};

export default function StudentView() {
  const { students, enrollments, getFilteredStudents } = useAppStore();
  const { currentUser } = useReportStore();

  // 담당 학생 필터링
  const filteredStudents = useMemo(() => {
    const baseFiltered = getFilteredStudents();
    const teacherId = currentUser?.teacher.id || '';
    const teacherSubjects = currentUser?.teacher.subjects || [];
    const hasTeacher = !!teacherId;

    return baseFiltered
      .filter(student => {
        if (!hasTeacher) return true;
        return student.teacherIds?.includes(teacherId) || false;
      })
      .map(student => {
        // 해당 학생의 수강 일정들
        let studentEnrollments = enrollments.filter(e => e.studentId === student.id);

        // 본인 과목만 필터링
        if (hasTeacher && teacherSubjects.length > 0) {
          studentEnrollments = studentEnrollments.filter(e => teacherSubjects.includes(e.subject));
        }

        return {
          ...student,
          dayEnrollments: studentEnrollments
        };
      });
  }, [students, enrollments, getFilteredStudents, currentUser]);

  // 학년 정렬 순서
  const gradeOrder: Record<string, number> = {
    '초1': 0, '초2': 1, '초3': 2, '초4': 3, '초5': 4, '초6': 5,
    '중1': 6, '중2': 7, '중3': 8,
    '고1': 9, '고2': 10, '고3': 11,
    '검정고시': 12
  };

  const groups = filteredStudents.sort((a, b) => {
    const aOrder = gradeOrder[a.grade] ?? 99;
    const bOrder = gradeOrder[b.grade] ?? 99;
    return aOrder !== bOrder ? aOrder - bOrder : a.name.localeCompare(b.name);
  });

  return (
    <div>
      <PageHeader title="학생별 보기" description="학생별로 수업 일정을 확인합니다" />

      {groups.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="material-symbols-outlined empty-state-icon">person_off</span>
            <div className="empty-state-title">등록된 학생이 없습니다</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {groups.map((student) => (
            <div key={student.id} className="card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `var(--grade-${gradeClassMap[student.grade as GradeType] || 'etc'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '16px' }}>{student.name}</div>
                    <span className={`grade-badge ${gradeClassMap[student.grade as GradeType] || 'etc'}`}>{student.grade}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-icon" title="수정"><span className="material-symbols-outlined">edit_square</span></button>
                  <button className="btn-icon" title="삭제" style={{ color: 'var(--danger)' }}><span className="material-symbols-outlined">delete</span></button>
                </div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>수업 일정 ({student.dayEnrollments.length}건)</div>
                {student.dayEnrollments.length > 0 ? (
                  student.dayEnrollments
                    .sort((a, b) => {
                      const dayOrder: Record<string, number> = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
                      return (dayOrder[a.day] ?? 99) - (dayOrder[b.day] ?? 99);
                    })
                    .map((enrollment) => (
                      <div key={enrollment.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--background)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
                        <span className={`day-badge ${dayClassMap[enrollment.day] || 'etc'}`} style={{ fontWeight: 700, fontSize: '16px', minWidth: '24px' }}>{enrollment.day}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: '14px' }}>{enrollment.startTime} — {enrollment.endTime}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{enrollment.subject}</div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>등록된 수업 일정이 없습니다</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
