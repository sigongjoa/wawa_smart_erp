import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { toast } from '../components/Toast';

type ByMonthStudent = {
  student_id: string;
  student_name: string;
  student_grade: string;
  assignment_id: string | null;
  assigned: boolean;
  created_check: number;
  printed: number;
  reviewed: number;
  drive_link: string | null;
  score: number | null;
  memo: string | null;
};

function monthOffset(baseISO: string, delta: number): string {
  const [y, m] = baseISO.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(iso: string): string {
  const [, m] = iso.split('-');
  return `${parseInt(m)}월`;
}

export default function ExamManagementPage() {
  const thisMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const monthTabs = useMemo(
    () => [
      { iso: monthOffset(thisMonth, -1), label: '지난달' },
      { iso: thisMonth, label: '이번달' },
      { iso: monthOffset(thisMonth, +1), label: '다음달' },
      { iso: monthOffset(thisMonth, +2), label: '+2달' },
    ],
    [thisMonth]
  );

  const [selectedMonth, setSelectedMonth] = useState<string>(thisMonth);
  const [students, setStudents] = useState<ByMonthStudent[]>([]);
  const [periodId, setPeriodId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const data = await api.getExamByMonth(month);
      setPeriodId(data.period.id);
      setStudents(data.students);
    } catch (err) {
      toast.error('로드 실패: ' + (err as Error).message);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedMonth); }, [load, selectedMonth]);

  const handleToggle = async (s: ByMonthStudent) => {
    // optimistic
    setStudents(prev =>
      prev.map(x => x.student_id === s.student_id ? { ...x, assigned: !x.assigned } : x)
    );
    try {
      await api.toggleExamByMonth(selectedMonth, s.student_id);
      await load(selectedMonth);
    } catch (err) {
      toast.error('배정 변경 실패');
      load(selectedMonth);
    }
  };

  const handleCheck = async (s: ByMonthStudent, field: 'created_check' | 'printed' | 'reviewed') => {
    if (!s.assignment_id) return;
    const newVal = !s[field];
    setStudents(prev =>
      prev.map(x => x.student_id === s.student_id ? { ...x, [field]: newVal ? 1 : 0 } : x)
    );
    try {
      await api.updateExamAssignment(periodId, s.assignment_id, { [field]: newVal } as any);
    } catch {
      toast.error('업데이트 실패');
      load(selectedMonth);
    }
  };

  const filtered = students.filter(s => {
    if (gradeFilter && s.student_grade !== gradeFilter) return false;
    if (statusFilter === 'assigned' && !s.assigned) return false;
    if (statusFilter === 'unassigned' && s.assigned) return false;
    if (statusFilter === 'incomplete' && s.assigned && s.created_check && s.printed && s.reviewed) return false;
    if (statusFilter === 'complete' && (!s.assigned || !s.created_check || !s.printed || !s.reviewed)) return false;
    return true;
  });

  const grades = [...new Set(students.map(s => s.student_grade).filter(Boolean))].sort();

  const stats = {
    total: students.length,
    assigned: students.filter(s => s.assigned).length,
    created: students.filter(s => s.assigned && s.created_check).length,
    printed: students.filter(s => s.assigned && s.printed).length,
    reviewed: students.filter(s => s.assigned && s.reviewed).length,
  };

  return (
    <div className="exam-page">
      <div className="exam-header">
        <h2 className="page-title">정기고사 관리</h2>
      </div>

      {/* 월 탭 */}
      <div className="exam-month-tabs" role="tablist">
        {monthTabs.map(t => (
          <button
            key={t.iso}
            role="tab"
            aria-selected={selectedMonth === t.iso}
            className={`exam-month-tab ${selectedMonth === t.iso ? 'exam-month-tab--active' : ''}`}
            onClick={() => setSelectedMonth(t.iso)}
          >
            <div className="exam-month-tab-label">{t.label}</div>
            <div className="exam-month-tab-sub">{monthLabel(t.iso)}</div>
          </button>
        ))}
      </div>

      {/* 통계 */}
      <div className="exam-summary-bar">
        <span>담당 학생 {stats.total}명</span>
        <span className="exam-stat">배정: {stats.assigned}/{stats.total}</span>
        <span className="exam-stat">제작: {stats.created}/{stats.assigned}</span>
        <span className="exam-stat">프린트: {stats.printed}/{stats.assigned}</span>
        <span className="exam-stat">검토: {stats.reviewed}/{stats.assigned}</span>
        <div className="exam-filters">
          <select className="exam-filter-select" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
            <option value="">전체 학년</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="exam-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">전체</option>
            <option value="assigned">배정됨</option>
            <option value="unassigned">미배정</option>
            <option value="incomplete">미완료</option>
            <option value="complete">완료</option>
          </select>
        </div>
      </div>

      {/* 학생 리스트 */}
      {loading ? (
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>로딩 중...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="exam-empty">
          {students.length === 0 ? '담당 학생이 없습니다.' : '필터 조건에 맞는 학생이 없습니다.'}
        </div>
      ) : (
        <table className="exam-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>배정</th>
              <th>이름</th>
              <th>학년</th>
              <th className="exam-th-check">제작</th>
              <th className="exam-th-check">프린트</th>
              <th className="exam-th-check">검토</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const done = s.assigned && s.created_check && s.printed && s.reviewed;
              return (
                <tr key={s.student_id} className={done ? 'exam-row--done' : ''}>
                  <td className="exam-cell-check">
                    <input
                      type="checkbox"
                      className="exam-checkbox"
                      checked={s.assigned}
                      onChange={() => handleToggle(s)}
                    />
                  </td>
                  <td className="exam-cell-name">{s.student_name}</td>
                  <td className="exam-cell-grade">{s.student_grade}</td>
                  <td className="exam-cell-check">
                    <input
                      type="checkbox"
                      className="exam-checkbox"
                      disabled={!s.assigned}
                      checked={!!s.created_check}
                      onChange={() => handleCheck(s, 'created_check')}
                    />
                  </td>
                  <td className="exam-cell-check">
                    <input
                      type="checkbox"
                      className="exam-checkbox"
                      disabled={!s.assigned}
                      checked={!!s.printed}
                      onChange={() => handleCheck(s, 'printed')}
                    />
                  </td>
                  <td className="exam-cell-check">
                    <input
                      type="checkbox"
                      className="exam-checkbox"
                      disabled={!s.assigned}
                      checked={!!s.reviewed}
                      onChange={() => handleCheck(s, 'reviewed')}
                    />
                  </td>
                  <td>
                    {!s.assigned ? (
                      <span className="exam-badge exam-badge--none">미배정</span>
                    ) : done ? (
                      <span className="exam-badge exam-badge--done">완료</span>
                    ) : s.created_check && s.printed ? (
                      <span className="exam-badge exam-badge--review">검토전</span>
                    ) : s.created_check ? (
                      <span className="exam-badge exam-badge--print">프린트전</span>
                    ) : (
                      <span className="exam-badge exam-badge--none">미제작</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
