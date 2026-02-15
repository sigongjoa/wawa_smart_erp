import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useReportStore } from '../../stores/reportStore';
import type { GradeType, DayType, Enrollment } from '../../types';
import { getTodayDay } from '../../constants/common';
import PageHeader from '../../components/common/PageHeader';

const gradeClassMap: Record<string, string> = {
  '초1': 'm1', '초2': 'm1', '초3': 'm1', '초4': 'm2', '초5': 'm2', '초6': 'm2',
  '중1': 'm1', '중2': 'm2', '중3': 'm3',
  '고1': 'h1', '고2': 'h2', '고3': 'h3',
  '검정고시': 'etc',
};

const dayClassMap: Record<string, string> = {
  '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun',
};

const days: { key: DayType; label: string }[] = [
  { key: '월', label: '월요일' },
  { key: '화', label: '화요일' },
  { key: '수', label: '수요일' },
  { key: '목', label: '목요일' },
  { key: '금', label: '금요일' },
  { key: '토', label: '토요일' },
  { key: '일', label: '일요일' },
];

const gradeOptions: { key: GradeType; label: string }[] = [
  { key: '초1', label: '초1' }, { key: '초2', label: '초2' }, { key: '초3', label: '초3' },
  { key: '초4', label: '초4' }, { key: '초5', label: '초5' }, { key: '초6', label: '초6' },
  { key: '중1', label: '중1' }, { key: '중2', label: '중2' }, { key: '중3', label: '중3' },
  { key: '고1', label: '고1' }, { key: '고2', label: '고2' }, { key: '고3', label: '고3' },
  { key: '검정고시', label: '기타' },
];

export default function DayView() {
  const {
    students,
    enrollments,
    timerFilters,
    getFilteredStudents,
    setTimerDayFilter,
    setTimerDayFilterAll,
    setTimerGradeFilter,
    setTimerGradeFilterAll,
    setTimerSearchFilter,
    clearFilters,
  } = useAppStore();

  const { currentUser } = useReportStore();

  const currentDay = getTodayDay();

  // 필터링 및 데이터 결합
  const studentsWithSessions = useMemo(() => {
    const filtered = getFilteredStudents();
    // 필터 선택 없으면 전체 요일 표시
    const allDays: DayType[] = ['월', '화', '수', '목', '금', '토', '일'];
    const targetDays = timerFilters.days.length > 0 ? timerFilters.days : allDays;

    // 선생님 필터링 (담당선생님 relation 기반, isAdmin 무관)
    const teacherId = currentUser?.teacher.id || '';
    const teacherSubjects = currentUser?.teacher.subjects || [];
    const hasTeacher = !!teacherId;

    return filtered
      .filter(student => {
        // 로그인한 선생님이 없으면 전체 표시
        if (!hasTeacher) return true;
        // 담당 학생만 표시 (teacherIds에 본인 ID가 포함된 경우)
        return student.teacherIds?.includes(teacherId) || false;
      })
      .map(student => {
        // 해당 요일의 수강 일정들
        let studentDayEnrollments = enrollments.filter(e => e.studentId === student.id && targetDays.includes(e.day));

        // 본인 과목만 필터링
        if (hasTeacher && teacherSubjects.length > 0) {
          studentDayEnrollments = studentDayEnrollments.filter(e => teacherSubjects.includes(e.subject));
        }

        return {
          ...student,
          dayEnrollments: studentDayEnrollments
        };
      })
      .sort((a, b) => {
        // 요일별 정렬
        const aDay = a.dayEnrollments[0]?.day || a.day || '월';
        const bDay = b.dayEnrollments[0]?.day || b.day || '월';
        if (aDay !== bDay) {
          const dayOrder = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
          return (dayOrder[aDay as DayType] ?? 99) - (dayOrder[bDay as DayType] ?? 99);
        }
        return (a.dayEnrollments[0]?.startTime || a.startTime || '').localeCompare(b.dayEnrollments[0]?.startTime || b.startTime || '');
      });
  }, [students, enrollments, timerFilters, currentDay, getFilteredStudents, currentUser]);

  const stats = {
    total: students.length,
    filtered: studentsWithSessions.length,
  };

  const isConfigured = !!currentUser;

  // 컴포넌트 마운트 시 데이터가 없으면 불러오기
  useEffect(() => {
    if (isConfigured && students.length === 0) {
      console.log('[DayView] Initial students fetch...');
      useAppStore.getState().fetchStudents();
    }
  }, [isConfigured]);

  if (isConfigured && students.length === 0) {
    return (
      <div className="empty-state" style={{ height: '400px' }}>
        <div className="loading-spinner" />
        <div className="empty-state-title">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <PageHeader title="요일별 시간표" description="학생들의 수업 일정을 요일별로 확인합니다" />

      {/* Stats and Consolidated Filters */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end', justifyContent: 'space-between' }}>

          {/* Left: Filter Results Stat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="stat-icon blue" style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifySelf: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>groups</span>
            </div>
            <div>
              <span className="stat-label" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>필터 결과</span>
              <div className="stat-value" style={{ fontSize: '20px', lineHeight: 1.2 }}>{stats.filtered}<span className="stat-unit" style={{ fontSize: '14px' }}>명</span></div>
            </div>
          </div>

          {/* Right: Consolidated Filter Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', flex: 1, justifyContent: 'flex-end', minWidth: '300px' }}>

            {/* Day Dropdown */}
            <div style={{ width: '120px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>요일</label>
              <select
                className="search-input"
                style={{ width: '100%', height: '38px', padding: '0 12px' }}
                value={timerFilters.days[0] || ''}
                onChange={(e) => setTimerDayFilterAll(e.target.value ? [e.target.value as DayType] : [])}
              >
                <option value="">전체 요일</option>
                {days.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>

            {/* Grade Dropdown */}
            <div style={{ width: '120px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>학년</label>
              <select
                className="search-input"
                style={{ width: '100%', height: '38px', padding: '0 12px' }}
                value={timerFilters.grades[0] || ''}
                onChange={(e) => setTimerGradeFilterAll(e.target.value ? [e.target.value as GradeType] : [])}
              >
                <option value="">전체 학년</option>
                {gradeOptions.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>

            {/* Search Input */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>학생 검색</label>
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--text-muted)' }}>search</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="학생 이름으로 검색..."
                  value={timerFilters.search}
                  onChange={(e) => setTimerSearchFilter(e.target.value)}
                  style={{ width: '100%', height: '38px', paddingLeft: '38px' }}
                />
              </div>
            </div>

            {/* Reset Button */}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={clearFilters}
                style={{ height: '38px', padding: '0 12px' }}
                title="필터 초기화"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>이름</th>
              <th style={{ width: '80px', textAlign: 'center' }}>학년</th>
              <th style={{ minWidth: '350px' }}>수강 과목 및 시간</th>
              <th style={{ width: '60px', textAlign: 'center' }}>요일</th>
              <th>수업 비고</th>
            </tr>
          </thead>
          <tbody>
            {studentsWithSessions.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <span className="material-symbols-outlined empty-state-icon">person_off</span>
                    <div className="empty-state-title">검색 결과가 없습니다</div>
                  </div>
                </td>
              </tr>
            ) : (
              studentsWithSessions.map((student) => {
                const displayDay = student.dayEnrollments[0]?.day || student.day || currentDay;
                return (
                  <tr key={student.id}>
                    <td><span style={{ fontWeight: 600 }}>{student.name}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`grade-badge ${gradeClassMap[student.grade] || 'etc'}`}>{student.grade || '—'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {student.dayEnrollments.length > 0 ? (
                          student.dayEnrollments.map((env, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="subject-badge">{env.subject}</span>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {env.startTime} ~ {env.endTime}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {student.subjects?.map(sub => (
                                <span key={sub} className="subject-badge">{sub}</span>
                              )) || <span className="subject-badge">{student.subject}</span>}
                            </div>
                            {student.startTime && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                ({student.startTime})
                              </span>
                            )}
                          </div>
                        )}

                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`day-badge ${dayClassMap[displayDay as DayType] || 'etc'}`}>
                        {displayDay}
                      </span>
                    </td>
                    <td style={{ color: student.note ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {student.note || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
