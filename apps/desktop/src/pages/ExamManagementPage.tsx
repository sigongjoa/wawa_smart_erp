import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ExamAbsentee, type ExamPaper, type ExamAttemptByPeriod } from '../api';
import { toast } from '../components/Toast';
import Modal from '../components/Modal';
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
  exam_date: string | null;
  exam_status: string;
  absence_reason: string | null;
  rescheduled_date: string | null;
  rescheduled_memo: string | null;
};

type ExamStatus = 'scheduled' | 'absent' | 'rescheduled' | 'completed' | 'exempted';

const EXAM_STATUS_MAP: Record<ExamStatus, { label: string; variant: string }> = {
  scheduled: { label: '정상', variant: 'scheduled' },
  absent: { label: '결시', variant: 'absent' },
  rescheduled: { label: '재시험', variant: 'rescheduled' },
  completed: { label: '완료', variant: 'completed' },
  exempted: { label: '면제', variant: 'exempted' },
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

function AbsenteeView({
  loading,
  absentees,
  onEdit,
  onComplete,
}: {
  loading: boolean;
  absentees: ExamAbsentee[];
  onEdit: (a: ExamAbsentee) => void;
  onComplete: (a: ExamAbsentee) => void;
}) {
  if (loading) {
    return (
      <div className="rpt-loading" role="status">
        <div className="rpt-spinner" />
        <span>로딩 중...</span>
      </div>
    );
  }
  if (absentees.length === 0) {
    return (
      <div className="exam-empty exam-empty--padded">
        결시/재시험 학생이 없습니다.
      </div>
    );
  }

  const absentOnly = absentees.filter(a => a.exam_status === 'absent');
  const rescheduled = absentees.filter(a => a.exam_status === 'rescheduled');

  return (
    <div className="exam-absentee-view">
      {absentOnly.length > 0 && (
        <section>
          <h3 className="exam-absentee-heading exam-absentee-heading--absent">
            결시 ({absentOnly.length}명) — 재시험 배정 필요
          </h3>
          <div className="exam-absentee-grid">
            {absentOnly.map(a => (
              <div key={a.assignment_id} className="exam-absentee-card">
                <div className="exam-absentee-card__header">
                  <div>
                    <div className="exam-absentee-card__name">{a.student_name}</div>
                    <div className="exam-absentee-card__meta">
                      {a.student_grade} · {a.student_school || '학교 미등록'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(a)}
                    className="btn btn-primary exam-absentee-card__action"
                    aria-label={`${a.student_name} 재시험 배정`}
                  >
                    재시험 배정
                  </button>
                </div>
                <div className="exam-absentee-card__reason">
                  사유: <b>{a.absence_reason || '(없음)'}</b>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {rescheduled.length > 0 && (
        <section>
          <h3 className="exam-absentee-heading exam-absentee-heading--rescheduled">
            재시험 예정 ({rescheduled.length}명)
          </h3>
          <table className="exam-table exam-table--resched">
            <thead>
              <tr>
                <th className="exam-resched-col-date">재시험 일정</th>
                <th>학생</th>
                <th>학년</th>
                <th>사유</th>
                <th>시간표</th>
                <th className="exam-resched-col-actions">조치</th>
              </tr>
            </thead>
            <tbody>
              {rescheduled.map(a => (
                <tr key={a.assignment_id}>
                  <td className="exam-resched-date">
                    {a.rescheduled_date || '—'}
                    {a.rescheduled_start && a.rescheduled_end && (
                      <div className="exam-resched-time">
                        {a.rescheduled_start}~{a.rescheduled_end}
                      </div>
                    )}
                  </td>
                  <td>{a.student_name}</td>
                  <td>{a.student_grade}</td>
                  <td className="exam-resched-reason">{a.absence_reason || '—'}</td>
                  <td>
                    {a.adhoc_session_id ? (
                      a.adhoc_status === 'cancelled' ? (
                        <span className="exam-adhoc-state exam-adhoc-state--cancelled">취소됨</span>
                      ) : (
                        <span className="exam-adhoc-state exam-adhoc-state--active">✓ 등록됨</span>
                      )
                    ) : (
                      <span className="exam-adhoc-state exam-adhoc-state--missing">⚠ 시간 미입력</span>
                    )}
                  </td>
                  <td>
                    <div className="exam-resched-actions">
                      <button
                        type="button"
                        onClick={() => onEdit(a)}
                        className="btn btn-secondary exam-resched-btn"
                        aria-label={`${a.student_name} 재시험 일정 수정`}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => onComplete(a)}
                        className="btn btn-primary exam-resched-btn"
                        aria-label={`${a.student_name} 응시 완료 처리`}
                      >
                        응시 완료
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
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
  const [attemptsByStudent, setAttemptsByStudent] = useState<Map<string, ExamAttemptByPeriod>>(new Map());
  const [reportSends, setReportSends] = useState<Record<string, { shareUrl: string; sentAt: string; type: 'midterm' | 'final' }>>({});
  const [loading, setLoading] = useState(true);

  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [examStatusFilter, setExamStatusFilter] = useState('');

  // 서브 탭: 배정/결시
  const [subTab, setSubTab] = useState<'assign' | 'absentees'>('assign');

  // 시험상태 변경 모달
  const [statusModalTarget, setStatusModalTarget] = useState<ByMonthStudent | null>(null);
  const [statusForm, setStatusForm] = useState<{
    exam_status: ExamStatus;
    exam_date: string;
    absence_reason: string;
    rescheduled_date: string;
    rescheduled_start: string;
    rescheduled_end: string;
    rescheduled_memo: string;
  }>({ exam_status: 'scheduled', exam_date: '', absence_reason: '', rescheduled_date: '', rescheduled_start: '', rescheduled_end: '', rescheduled_memo: '' });
  const [statusSaving, setStatusSaving] = useState(false);

  const openStatusModal = (s: ByMonthStudent, presetRescheduled = false) => {
    setStatusModalTarget(s);
    const currentStatus = (s.exam_status || 'scheduled') as ExamStatus;
    // 날짜 버튼으로 열면 재시험 상태로 자동 세팅 → 캘린더/시간 필드 바로 노출
    const initialStatus: ExamStatus = presetRescheduled ? 'rescheduled' : currentStatus;
    setStatusForm({
      exam_status: initialStatus,
      exam_date: s.exam_date || '',
      absence_reason: s.absence_reason || '',
      rescheduled_date: s.rescheduled_date || '',
      rescheduled_start: '',
      rescheduled_end: '',
      rescheduled_memo: s.rescheduled_memo || '',
    });
  };

  const handleStatusSave = async () => {
    if (!statusModalTarget?.assignment_id) return;
    // rescheduled일 때 날짜만 필수
    if (statusForm.exam_status === 'rescheduled' && !statusForm.rescheduled_date) {
      toast.error('재시험 날짜를 입력하세요');
      return;
    }
    setStatusSaving(true);
    try {
      // 재시험 날짜 있으면 rescheduled, 없으면 scheduled로 복귀
      const hasDate = !!statusForm.rescheduled_date;
      const payload: Record<string, unknown> = hasDate
        ? { exam_status: 'rescheduled', rescheduled_date: statusForm.rescheduled_date }
        : { exam_status: 'scheduled', rescheduled_date: null, rescheduled_memo: null, absence_reason: null };
      await api.updateExamAssignment(periodId, statusModalTarget.assignment_id, payload as any);
      toast.success('시험 상태가 변경되었습니다');
      setStatusModalTarget(null);
      load(selectedMonth);
      if (subTab === 'absentees') loadAbsentees(selectedMonth);
    } catch (err) {
      toast.error('상태 변경 실패: ' + (err as Error).message);
    } finally {
      setStatusSaving(false);
    }
  };

  // 모바일 상세 펼치기
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const toggleRowExpand = (id: string) =>
    setExpandedStudentId(prev => (prev === id ? null : id));

  // 결시/재시험 현황
  const [absentees, setAbsentees] = useState<ExamAbsentee[]>([]);
  const [absLoading, setAbsLoading] = useState(false);

  const loadAbsentees = useCallback(async (month: string) => {
    setAbsLoading(true);
    try {
      const data = await api.getExamAbsentees(month, isAdmin && scope === 'all' ? 'all' : 'mine');
      setAbsentees(data.absentees);
    } catch (err) {
      toast.error('결시 현황 로드 실패: ' + (err as Error).message);
      setAbsentees([]);
    } finally {
      setAbsLoading(false);
    }
  }, [isAdmin, scope]);

  useEffect(() => {
    if (subTab === 'absentees') loadAbsentees(selectedMonth);
  }, [subTab, selectedMonth, loadAbsentees]);

  const handleCompleteReschedule = async (a: ExamAbsentee) => {
    try {
      await api.updateExamAssignment(periodId, a.assignment_id, {
        exam_status: 'completed',
      } as any);
      toast.success('응시 완료로 처리했습니다');
      loadAbsentees(selectedMonth);
    } catch (err) {
      toast.error('처리 실패: ' + (err as Error).message);
    }
  };

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

  // selectedMonth → term (1학기/2학기 자동) + 중간/기말 둘 다 fetch해서 병합
  const reviewTerm = useMemo(() => {
    const [y, mStr] = selectedMonth.split('-');
    const m = Number(mStr);
    const half = m >= 7 ? 2 : 1;
    return `${y}-${half}`;
  }, [selectedMonth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [midMap, finalMap] = await Promise.all([
          api.getSendStatus({ reportType: 'midterm', term: reviewTerm }).catch(() => ({})),
          api.getSendStatus({ reportType: 'final', term: reviewTerm }).catch(() => ({})),
        ]);
        if (cancelled) return;
        const out: Record<string, { shareUrl: string; sentAt: string; type: 'midterm' | 'final' }> = {};
        // 중간 먼저 넣고, 기말이 있으면 기말로 덮어쓰기 (더 최신)
        for (const [sid, v] of Object.entries(midMap || {})) {
          out[sid] = { shareUrl: (v as any).shareUrl, sentAt: (v as any).sentAt, type: 'midterm' };
        }
        for (const [sid, v] of Object.entries(finalMap || {})) {
          out[sid] = { shareUrl: (v as any).shareUrl, sentAt: (v as any).sentAt, type: 'final' };
        }
        setReportSends(out);
      } catch {
        if (!cancelled) setReportSends({});
      }
    })();
    return () => { cancelled = true; };
  }, [reviewTerm]);

  // periodId 변경 시 응시 내역도 fetch (자동 채점 점수 표시용)
  useEffect(() => {
    if (!periodId) { setAttemptsByStudent(new Map()); return; }
    let cancelled = false;
    (async () => {
      try {
        const list = await api.getExamAttemptsByPeriod(periodId);
        if (cancelled) return;
        const map = new Map<string, ExamAttemptByPeriod>();
        // 한 학생에 여러 attempt가 있으면 가장 최근 submitted/expired 우선
        const priority: Record<string, number> = { submitted: 3, expired: 2, running: 1, paused: 1 };
        for (const a of list) {
          const existing = map.get(a.student_id);
          if (!existing || (priority[a.status] ?? 0) > (priority[existing.status] ?? 0)) {
            map.set(a.student_id, a);
          }
        }
        setAttemptsByStudent(map);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [periodId]);

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

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

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
    if (examStatusFilter && s.assigned && s.exam_status !== examStatusFilter) return false;
    return true;
  });

  const grades = [...new Set(students.map(s => s.student_grade).filter(Boolean))].sort();

  const assignedStudents = students.filter(s => s.assigned);
  const stats = {
    total: students.length,
    assigned: assignedStudents.length,
    created: assignedStudents.filter(s => s.created_check).length,
    printed: assignedStudents.filter(s => s.printed).length,
    reviewed: assignedStudents.filter(s => s.reviewed).length,
    absent: assignedStudents.filter(s => s.exam_status === 'absent').length,
    rescheduled: assignedStudents.filter(s => s.exam_status === 'rescheduled').length,
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
          <div className="scope-toggle" role="group" aria-label="담당 범위 선택">
            <button
              type="button"
              aria-pressed={scope === 'mine'}
              className={`scope-toggle-btn ${scope === 'mine' ? 'scope-toggle-btn--active' : ''}`}
              onClick={() => setScope('mine')}
            >내 학생</button>
            <button
              type="button"
              aria-pressed={scope === 'all'}
              className={`scope-toggle-btn ${scope === 'all' ? 'scope-toggle-btn--active' : ''}`}
              onClick={() => setScope('all')}
            >모두 보기</button>
          </div>
        )}
        <EnglishExamPaperPicker periodId={periodId} />
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

      {/* 서브 탭: 배정 / 결시·재시험 */}
      <div className="exam-subtabs" role="tablist">
        <button
          role="tab"
          aria-selected={subTab === 'assign'}
          className={`exam-subtab ${subTab === 'assign' ? 'exam-subtab--active' : ''}`}
          onClick={() => setSubTab('assign')}
        >
          정기고사 배정
        </button>
        <button
          role="tab"
          aria-selected={subTab === 'absentees'}
          className={`exam-subtab ${subTab === 'absentees' ? 'exam-subtab--active' : ''}`}
          onClick={() => setSubTab('absentees')}
        >
          결시 · 재시험
          {(stats.absent + stats.rescheduled) > 0 && (
            <span className="exam-subtab__count">
              ({stats.absent + stats.rescheduled})
            </span>
          )}
        </button>
      </div>

      {subTab === 'absentees' ? (
        <AbsenteeView
          loading={absLoading}
          absentees={absentees}
          onEdit={(a) => {
            // 기존 상태 모달 재사용: by-month 학생 형태로 변환
            const match = students.find(s => s.student_id === a.student_id);
            if (match) openStatusModal(match);
          }}
          onComplete={handleCompleteReschedule}
        />
      ) : (
        <>
      {/* 통계 */}
      <div className="exam-summary-bar">
        <span>담당 학생 {stats.total}명</span>
        <span className="exam-stat">배정: {stats.assigned}/{stats.total}</span>
        <span className="exam-stat">제작: {stats.created}/{stats.assigned}</span>
        <span className="exam-stat">프린트: {stats.printed}/{stats.assigned}</span>
        <span className="exam-stat">검토: {stats.reviewed}/{stats.assigned}</span>
        {stats.absent > 0 && <span className="exam-stat exam-stat--absent">결시: {stats.absent}</span>}
        {stats.rescheduled > 0 && <span className="exam-stat exam-stat--rescheduled">재시험: {stats.rescheduled}</span>}
        <span className="exam-stat" title={`${reviewTerm} 중간/기말 합산`}>
          리포트: {Object.keys(reportSends).length}/{students.length}
        </span>
        <div className="exam-filters">
          <select className="exam-filter-select" aria-label="학년 필터" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
            <option value="">전체 학년</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="exam-filter-select" aria-label="배정 상태 필터" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">전체</option>
            <option value="assigned">배정됨</option>
            <option value="unassigned">미배정</option>
            <option value="incomplete">미완료</option>
            <option value="complete">완료</option>
          </select>
          <select className="exam-filter-select" aria-label="시험 상태 필터" value={examStatusFilter} onChange={e => setExamStatusFilter(e.target.value)}>
            <option value="">전체 시험상태</option>
            <option value="scheduled">정상</option>
            <option value="absent">결시</option>
            <option value="rescheduled">재시험</option>
            <option value="completed">완료</option>
            <option value="exempted">면제</option>
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
        <table className="exam-table exam-table--assign">
          <thead>
            <tr>
              <th className="exam-th-assign">배정</th>
              <th>이름</th>
              <th className="exam-th-grade">학년</th>
              <th className="exam-th-school">학교</th>
              <th className="exam-th-check">제작</th>
              <th className="exam-th-check">프린트</th>
              <th className="exam-th-check">검토</th>
              <th className="exam-th-link">링크</th>
              <th className="exam-th-exam-status">시험상태</th>
              <th className="exam-th-exam-date">시험일</th>
              <th className="exam-th-score">점수</th>
              <th className="exam-th-report">리포트</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const done = s.assigned && s.created_check && s.printed && s.reviewed;
              const expanded = expandedStudentId === s.student_id;
              return (
                <tr
                  key={s.student_id}
                  className={`${done ? 'exam-row--done' : ''} ${expanded ? 'exam-row--expanded' : ''}`.trim()}
                  data-expanded={expanded ? '' : undefined}
                >
                  <td className="exam-cell-check exam-cell-assign">
                    <input
                      type="checkbox"
                      className="exam-checkbox"
                      checked={s.assigned}
                      onChange={() => handleToggle(s)}
                      aria-label={`${s.student_name} 정기고사 배정`}
                    />
                  </td>
                  <td className="exam-cell-name">{s.student_name}</td>
                  <td className="exam-cell-grade">{s.student_grade}</td>
                  <td className="exam-cell-school">
                    <span className="exam-school-text">
                      {s.student_school || <span className="exam-cell-empty">—</span>}
                    </span>
                  </td>
                  <td className="exam-cell-check exam-cell-created">
                    <input
                      type="checkbox"
                      className="exam-checkbox"
                      disabled={!s.assigned}
                      checked={!!s.created_check}
                      onChange={() => handleCheck(s, 'created_check')}
                      aria-label={`${s.student_name} 시험지 제작 완료`}
                    />
                  </td>
                  <td className="exam-cell-check exam-cell-printed">
                    <input
                      type="checkbox"
                      className="exam-checkbox"
                      disabled={!s.assigned}
                      checked={!!s.printed}
                      onChange={() => handleCheck(s, 'printed')}
                      aria-label={`${s.student_name} 프린트 완료`}
                    />
                  </td>
                  <td className="exam-cell-check exam-cell-reviewed">
                    <input
                      type="checkbox"
                      className="exam-checkbox"
                      disabled={!s.assigned}
                      checked={!!s.reviewed}
                      onChange={() => handleCheck(s, 'reviewed')}
                      aria-label={`${s.student_name} 검토 완료`}
                    />
                  </td>
                  <td className="exam-cell-link">
                    {!s.assigned || !s.assignment_id ? (
                      <span className="exam-link-placeholder">—</span>
                    ) : editingLinkId === s.student_id ? (
                      <input
                        type="url"
                        className="exam-link-input"
                        defaultValue={s.drive_link || ''}
                        placeholder="드라이브 URL"
                        autoFocus
                        aria-label="드라이브 링크 입력"
                        onBlur={(e) => {
                          handleLinkSave(s, e.target.value.trim());
                          setEditingLinkId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingLinkId(null);
                        }}
                      />
                    ) : s.drive_link ? (
                      <span className="exam-link-compact">
                        <a href={s.drive_link} target="_blank" rel="noreferrer" className="exam-link-open">
                          열기
                        </a>
                        <button
                          type="button"
                          className="exam-link-edit"
                          onClick={() => setEditingLinkId(s.student_id)}
                          aria-label="링크 편집"
                          title="편집"
                        >
                          ✏️
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="exam-link-add"
                        onClick={() => setEditingLinkId(s.student_id)}
                      >
                        + 링크
                      </button>
                    )}
                  </td>
                  <td className="exam-cell-check exam-cell-status">
                    {s.assigned ? (() => {
                      const es = (s.exam_status || 'scheduled') as ExamStatus;
                      const info = EXAM_STATUS_MAP[es] || EXAM_STATUS_MAP.scheduled;
                      return (
                        <button
                          type="button"
                          className={`exam-status-badge exam-status-badge--${info.variant}`}
                          onClick={() => openStatusModal(s)}
                          aria-label={`시험 상태: ${info.label}. 클릭하여 변경`}
                          title="클릭하여 시험 상태/날짜 변경"
                        >
                          {info.label} <span className="exam-status-badge__caret" aria-hidden="true">▼</span>
                        </button>
                      );
                    })() : <span className="exam-cell-empty">—</span>}
                  </td>
                  <td className="exam-cell-date">
                    {s.assigned ? (
                      <button
                        type="button"
                        className={`exam-date-btn ${s.rescheduled_date ? 'exam-date-btn--rescheduled' : ''}`}
                        onClick={() => openStatusModal(s, true)}
                        aria-label="시험 날짜 변경"
                        title="클릭하여 시험 날짜 변경"
                      >
                        {s.rescheduled_date
                          ? s.rescheduled_date.slice(5)
                          : s.exam_date
                            ? s.exam_date.slice(5)
                            : '날짜 변경 +'}
                      </button>
                    ) : <span className="exam-cell-empty">—</span>}
                  </td>
                  <td className="exam-cell-score">
                    {(() => {
                      const attempt = attemptsByStudent.get(s.student_id);
                      if (!attempt) return <span className="exam-cell-empty">—</span>;
                      const isDone = attempt.status === 'submitted' || attempt.status === 'expired';
                      if (!isDone) {
                        return (
                          <span className="exam-score-inprogress" title="응시 중">
                            <span className="exam-score-dot" /> 응시중
                          </span>
                        );
                      }
                      const total = attempt.auto_total ?? 0;
                      const correct = attempt.auto_correct ?? 0;
                      const pct = total > 0 ? Math.round((correct / total) * 100) : null;
                      return (
                        <button
                          type="button"
                          className="exam-score-btn"
                          onClick={() => navigate(`/exam-result/${attempt.id}`)}
                          title="문항별 응시 결과 보기"
                        >
                          <span className="exam-score-num">
                            <strong>{correct}</strong>/<span>{total}</span>
                          </span>
                          {pct !== null && (
                            <span className={`exam-score-pct exam-score-pct--${pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low'}`}>
                              {pct}%
                            </span>
                          )}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="exam-cell-report">
                    {(() => {
                      const rep = reportSends[s.student_id];
                      if (!rep) return null;  // 미작성은 빈 칸
                      const typeLabel = rep.type === 'midterm' ? '중간' : '기말';
                      return (
                        <a
                          href={rep.shareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="exam-report-check"
                          title={`${typeLabel} · ${new Date(rep.sentAt).toLocaleDateString('ko-KR')}`}
                          aria-label={`${typeLabel} 리포트 보기`}
                        >✓</a>
                      );
                    })()}
                  </td>
                  <td className="exam-cell-summary">
                    <span className="exam-cell-summary__desktop">
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
                    </span>
                    {s.assigned && (
                      <button
                        type="button"
                        className="exam-row-expand"
                        onClick={() => toggleRowExpand(s.student_id)}
                        aria-expanded={expanded}
                        aria-label={`${s.student_name} 상세 ${expanded ? '닫기' : '펼치기'}`}
                      >
                        <span aria-hidden="true">{expanded ? '▲' : '▼ 상세'}</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      </>
      )}

      {/* 시험 상태 변경 모달 */}
      {statusModalTarget && (
        <Modal
          className="exam-date-modal"
          onClose={() => { if (!statusSaving) setStatusModalTarget(null); }}
        >
          <Modal.Header closeDisabled={statusSaving}>
            {statusModalTarget.student_name} — 시험 날짜 변경
          </Modal.Header>
          <Modal.Body>
            <label className="form-label" htmlFor="exam-rescheduled-date">
              재시험 날짜
            </label>
            <input
              id="exam-rescheduled-date"
              type="date"
              className="form-input"
              value={statusForm.rescheduled_date}
              onChange={(e) => setStatusForm(f => ({ ...f, rescheduled_date: e.target.value }))}
              aria-describedby="exam-rescheduled-hint"
            />
            <div id="exam-rescheduled-hint" className="form-hint">
              비워두면 정상(기본 시험일)로 되돌립니다
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              className="btn btn-secondary"
              onClick={() => setStatusModalTarget(null)}
              disabled={statusSaving}
              type="button"
            >
              취소
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStatusSave}
              disabled={statusSaving}
              type="button"
            >
              {statusSaving ? '저장 중...' : '저장'}
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}

// ── 영어 시험 문제 편집 진입 드롭다운 ──
function EnglishExamPaperPicker({ periodId }: { periodId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && periodId && papers.length === 0) {
      setLoading(true);
      try {
        const list = await api.getExamPapers(periodId);
        setPapers(list || []);
      } catch {
        setPapers([]);
      } finally {
        setLoading(false);
      }
    }
  };

  if (!periodId) return null;

  return (
    <div style={{ position: 'relative', marginLeft: 'auto' }}>
      <button
        type="button"
        onClick={toggle}
        style={{
          padding: '8px 14px', borderRadius: 8,
          background: '#eef0f8', color: '#2d3a8c', border: '1px solid #2d3a8c',
          cursor: 'pointer', fontWeight: 600, fontSize: 13,
        }}
      >영어 문제 입력 {open ? '▴' : '▾'}</button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 20,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          minWidth: 280, maxHeight: 400, overflowY: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)', padding: 8,
        }}>
          {loading && <div style={{ padding: 12, color: '#4a5568', fontSize: 13 }}>불러오는 중...</div>}
          {!loading && papers.length === 0 && (
            <div style={{ padding: 12, color: '#4a5568', fontSize: 13 }}>
              이 기간에 시험지가 없습니다.
            </div>
          )}
          {!loading && papers.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setOpen(false);
                navigate(`/exam-questions/${p.id}?back=/exams&title=${encodeURIComponent(p.title)}`);
              }}
              style={{
                display: 'block', width: '100%',
                padding: '10px 12px', textAlign: 'left',
                background: 'transparent', border: 'none',
                borderRadius: 6, cursor: 'pointer',
                fontSize: 13, color: '#1a202c',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f7fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontWeight: 600 }}>{p.title}</div>
              {p.grade_filter && (
                <div style={{ fontSize: 11, color: '#4a5568', marginTop: 2 }}>{p.grade_filter}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
