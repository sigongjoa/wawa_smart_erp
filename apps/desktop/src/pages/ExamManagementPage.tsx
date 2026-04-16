import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { toast } from '../components/Toast';
import { useAuthStore } from '../store';

type ByMonthStudent = {
  student_id: string;
  student_name: string;
  student_grade: string;
  student_school: string | null;
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

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [selectedMonth, setSelectedMonth] = useState<string>(thisMonth);
  const [students, setStudents] = useState<ByMonthStudent[]>([]);
  const [periodId, setPeriodId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const data = await api.getExamByMonth(month, isAdmin && scope === 'all' ? 'all' : 'mine');
      setPeriodId(data.period.id);
      setStudents(data.students);
    } catch (err) {
      toast.error('로드 실패: ' + (err as Error).message);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, scope]);

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

  const handleLinkSave = async (s: ByMonthStudent, link: string) => {
    if (!s.assignment_id) return;
    if ((s.drive_link || '') === link) return;
    setStudents(prev =>
      prev.map(x => x.student_id === s.student_id ? { ...x, drive_link: link || null } : x)
    );
    try {
      await api.updateExamAssignment(periodId, s.assignment_id, { drive_link: link } as any);
    } catch {
      toast.error('링크 저장 실패');
      load(selectedMonth);
    }
  };

  const handleSchoolSave = async (s: ByMonthStudent, school: string) => {
    if ((s.student_school || '') === school) return;
    setStudents(prev =>
      prev.map(x => x.student_id === s.student_id ? { ...x, student_school: school || null } : x)
    );
    try {
      await api.updateExamStudentSchool(s.student_id, school);
    } catch {
      toast.error('학교 저장 실패');
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

  const printCheckSheet = () => {
    const assigned = filtered.filter(s => s.assigned);
    if (assigned.length === 0) {
      toast.error('배정된 학생이 없습니다');
      return;
    }

    // 학년별 그룹핑
    const byGrade = new Map<string, ByMonthStudent[]>();
    for (const s of assigned) {
      const g = s.student_grade || '미지정';
      if (!byGrade.has(g)) byGrade.set(g, []);
      byGrade.get(g)!.push(s);
    }
    const sortedGrades = [...byGrade.keys()].sort();

    const [, mm] = selectedMonth.split('-');
    const title = `${parseInt(mm)}월 정기고사 프린트 확인 시트`;

    const rows = sortedGrades.map(grade => {
      const list = byGrade.get(grade)!;
      const header = `<tr class="grade-header"><td colspan="5">${grade} (${list.length}명)</td></tr>`;
      const items = list.map((s, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${s.student_name}</td>
          <td>${s.student_school || ''}</td>
          <td class="status">${s.printed ? '✔' : ''}</td>
          <td class="check-box"></td>
        </tr>`).join('');
      return header + items;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { margin: 15mm; size: A4; }
  body { font-family: 'Malgun Gothic', sans-serif; font-size: 12px; color: #000; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
  .meta { text-align: center; font-size: 11px; color: #666; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 4px 8px; }
  th { background: #eee; font-size: 11px; }
  .grade-header td { background: #f5f5f5; font-weight: bold; font-size: 12px; border-bottom: 2px solid #333; }
  .num { width: 30px; text-align: center; }
  .status { width: 50px; text-align: center; }
  .check-box { width: 50px; }
  .check-box::after { content: '\\2610'; font-size: 16px; display: block; text-align: center; }
  .summary { margin-top: 8px; font-size: 11px; color: #666; }
</style></head><body>
  <h1>${title}</h1>
  <div class="meta">${new Date().toLocaleDateString('ko-KR')} 출력</div>
  <table>
    <thead><tr><th class="num">No</th><th>이름</th><th>학교</th><th>DB</th><th>확인</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="summary">배정 ${assigned.length}명 | 프린트 완료 ${assigned.filter(s => s.printed).length}명 | 미완료 ${assigned.filter(s => !s.printed).length}명</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) { toast.error('팝업이 차단되었습니다'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
  };

  return (
    <div className="exam-page">
      <div className="exam-header">
        <h2 className="page-title">정기고사 관리</h2>
        {isAdmin && (
          <div className="scope-toggle" role="group">
            <button
              className={`scope-toggle-btn ${scope === 'mine' ? 'scope-toggle-btn--active' : ''}`}
              onClick={() => setScope('mine')}
            >내 학생</button>
            <button
              className={`scope-toggle-btn ${scope === 'all' ? 'scope-toggle-btn--active' : ''}`}
              onClick={() => setScope('all')}
            >모두 보기</button>
          </div>
        )}
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
          <button className="exam-print-btn" onClick={printCheckSheet} title="프린트 확인 시트 출력">
            프린트 확인 시트
          </button>
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
              <th className="exam-th-grade">학년</th>
              <th className="exam-th-school">학교</th>
              <th className="exam-th-check">제작</th>
              <th className="exam-th-check">프린트</th>
              <th className="exam-th-check">검토</th>
              <th className="exam-th-link">링크</th>
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
                  <td className="exam-cell-school">
                    <input
                      type="text"
                      className="exam-school-input"
                      defaultValue={s.student_school || ''}
                      placeholder="학교명"
                      onBlur={(e) => handleSchoolSave(s, e.target.value.trim())}
                    />
                  </td>
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
                  <td className="exam-cell-link">
                    {s.assigned && s.assignment_id ? (
                      <div className="exam-link-wrap">
                        <input
                          type="url"
                          className="exam-link-input"
                          defaultValue={s.drive_link || ''}
                          placeholder="드라이브 URL"
                          onBlur={(e) => handleLinkSave(s, e.target.value.trim())}
                        />
                        {s.drive_link && (
                          <a href={s.drive_link} target="_blank" rel="noreferrer" className="exam-link-icon" title="열기">↗</a>
                        )}
                      </div>
                    ) : (
                      <span className="exam-link-placeholder">—</span>
                    )}
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
