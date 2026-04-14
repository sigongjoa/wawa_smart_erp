import { useCallback, useEffect, useState } from 'react';
import { api, ExamPeriod, ExamPaper, ExamAssignment, Student } from '../api';
import { toast, useConfirm } from '../components/Toast';

export default function ExamManagementPage() {
  const [periods, setPeriods] = useState<ExamPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [assignments, setAssignments] = useState<ExamAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // 새 기간 생성
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMonth, setNewMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // 시험지 추가
  const [showAddPaper, setShowAddPaper] = useState(false);
  const [paperTitle, setPaperTitle] = useState('');
  const [paperGrade, setPaperGrade] = useState('');
  const [paperCustom, setPaperCustom] = useState(false);

  // 수동 배정
  const [showManualAssign, setShowManualAssign] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignPaperId, setAssignPaperId] = useState('');

  // 드라이브 링크 편집
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState('');

  // 점수/메모 편집
  const [editingScore, setEditingScore] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState('');
  const [editingMemo, setEditingMemo] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState('');

  // 필터
  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  // 시험 기간 목록 로드
  useEffect(() => {
    api.getExamPeriods().then(data => {
      setPeriods(data || []);
      if (data?.length && !selectedPeriodId) {
        setSelectedPeriodId(data[0].id);
      }
    }).catch(() => {});
    api.getStudents().then(setStudents).catch(() => {});
  }, []);

  // 선택된 기간의 시험지 + 배정 로드
  const loadPeriodData = useCallback(async () => {
    if (!selectedPeriodId) { setPapers([]); setAssignments([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        api.getExamPapers(selectedPeriodId),
        api.getExamAssignments(selectedPeriodId),
      ]);
      setPapers(p || []);
      setAssignments(a || []);
    } catch {
      setPapers([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId]);

  useEffect(() => { loadPeriodData(); }, [loadPeriodData]);

  // ── 핸들러 ──

  const handleCreatePeriod = async () => {
    if (!newTitle.trim() || !newMonth) return;
    try {
      const res = await api.createExamPeriod({ title: newTitle.trim(), period_month: newMonth });
      const newPeriod = { id: res.id, title: res.title, period_month: res.period_month, status: 'preparing', academy_id: '', created_by: '', created_at: '', updated_at: '' };
      setPeriods(prev => [newPeriod, ...prev]);
      setSelectedPeriodId(res.id);
      setShowNewPeriod(false);
      setNewTitle('');

      // 자동으로 학생 전원 배정
      const autoRes = await api.autoAssignExam(res.id);
      toast.success(`시험 기간 생성 + ${autoRes.created}명 자동 배정 완료`);
    } catch (err) {
      toast.error('생성 실패: ' + (err as Error).message);
    }
  };

  const handleDeletePeriod = async () => {
    if (!selectedPeriodId) return;
    const period = periods.find(p => p.id === selectedPeriodId);
    const ok = await confirmDialog(`"${period?.title}" 시험 기간을 삭제할까요?\n모든 시험지와 배정 데이터가 삭제됩니다.`);
    if (!ok) return;
    try {
      await api.deleteExamPeriod(selectedPeriodId);
      setPeriods(prev => prev.filter(p => p.id !== selectedPeriodId));
      setSelectedPeriodId(periods.find(p => p.id !== selectedPeriodId)?.id || '');
      toast.success('삭제 완료');
    } catch (err) {
      toast.error('삭제 실패: ' + (err as Error).message);
    }
  };

  const handleAddPaper = async () => {
    if (!paperTitle.trim() || !selectedPeriodId) return;
    try {
      await api.createExamPaper(selectedPeriodId, {
        title: paperTitle.trim(),
        grade_filter: paperGrade || undefined,
        is_custom: paperCustom,
      });
      setPaperTitle('');
      setPaperGrade('');
      setPaperCustom(false);
      setShowAddPaper(false);
      loadPeriodData();
      toast.success('시험지 추가 완료');
    } catch (err) {
      toast.error('추가 실패: ' + (err as Error).message);
    }
  };

  const handleDeletePaper = async (paper: ExamPaper) => {
    const ok = await confirmDialog(`"${paper.title}" 시험지를 삭제할까요?`);
    if (!ok) return;
    try {
      await api.deleteExamPaper(selectedPeriodId, paper.id);
      loadPeriodData();
    } catch (err) {
      toast.error('삭제 실패: ' + (err as Error).message);
    }
  };

  const handleAutoAssign = async () => {
    if (!selectedPeriodId) return;
    try {
      const res = await api.autoAssignExam(selectedPeriodId);
      toast.success(`자동 배정 완료: ${res.created}명 배정 (전체 ${res.total}명)`);
      loadPeriodData();
    } catch (err) {
      toast.error('자동 배정 실패: ' + (err as Error).message);
    }
  };

  const handleManualAssign = async () => {
    if (!assignStudentId || !assignPaperId) return;
    try {
      await api.manualAssignExam(selectedPeriodId, {
        student_id: assignStudentId,
        exam_paper_id: assignPaperId,
      });
      setShowManualAssign(false);
      setAssignStudentId('');
      setAssignPaperId('');
      loadPeriodData();
      toast.success('배정 완료');
    } catch (err) {
      toast.error('배정 실패: ' + (err as Error).message);
    }
  };

  const handleCheck = async (assign: ExamAssignment, field: 'created_check' | 'printed' | 'reviewed') => {
    const newVal = !assign[field];
    // optimistic update
    setAssignments(prev =>
      prev.map(a => a.id === assign.id ? { ...a, [field]: newVal ? 1 : 0 } : a)
    );
    try {
      await api.updateExamAssignment(selectedPeriodId, assign.id, { [field]: newVal });
    } catch (err) {
      // rollback
      setAssignments(prev =>
        prev.map(a => a.id === assign.id ? { ...a, [field]: assign[field] } : a)
      );
      toast.error('업데이트 실패');
    }
  };

  const handleBulkCheck = async (field: 'created_check' | 'printed' | 'reviewed') => {
    const allChecked = filteredAssignments.every(a => a[field]);
    try {
      await api.bulkCheckExam(selectedPeriodId, field, !allChecked);
      loadPeriodData();
    } catch (err) {
      toast.error('일괄 업데이트 실패');
    }
  };

  const handleSaveLink = async (assignId: string) => {
    try {
      await api.updateExamAssignment(selectedPeriodId, assignId, { drive_link: linkDraft });
      setAssignments(prev =>
        prev.map(a => a.id === assignId ? { ...a, drive_link: linkDraft || null } : a)
      );
      setEditingLink(null);
      setLinkDraft('');
    } catch (err) {
      toast.error('링크 저장 실패');
    }
  };

  const handleSaveScore = async (assignId: string) => {
    const val = scoreDraft.trim() ? parseFloat(scoreDraft) : undefined;
    try {
      await api.updateExamAssignment(selectedPeriodId, assignId, { score: val as any });
      setAssignments(prev =>
        prev.map(a => a.id === assignId ? { ...a, score: val ?? null } : a)
      );
      setEditingScore(null);
    } catch (err) {
      toast.error('점수 저장 실패');
    }
  };

  const handleSaveMemo = async (assignId: string) => {
    try {
      await api.updateExamAssignment(selectedPeriodId, assignId, { memo: memoDraft } as any);
      setAssignments(prev =>
        prev.map(a => a.id === assignId ? { ...a, memo: memoDraft || null } : a)
      );
      setEditingMemo(null);
    } catch (err) {
      toast.error('메모 저장 실패');
    }
  };

  const handleDeleteAssign = async (assign: ExamAssignment) => {
    const ok = await confirmDialog(`${assign.student_name}의 배정을 삭제할까요?`);
    if (!ok) return;
    try {
      await api.deleteExamAssignment(selectedPeriodId, assign.id);
      setAssignments(prev => prev.filter(a => a.id !== assign.id));
    } catch (err) {
      toast.error('삭제 실패');
    }
  };

  // ── 필터링 ──
  const filteredAssignments = assignments.filter(a => {
    if (gradeFilter && a.student_grade !== gradeFilter) return false;
    if (statusFilter === 'incomplete' && a.created_check && a.printed && a.reviewed) return false;
    if (statusFilter === 'complete' && (!a.created_check || !a.printed || !a.reviewed)) return false;
    return true;
  });

  // 통계
  const stats = {
    total: assignments.length,
    created: assignments.filter(a => a.created_check).length,
    printed: assignments.filter(a => a.printed).length,
    reviewed: assignments.filter(a => a.reviewed).length,
  };

  // 학년 목록 추출
  const grades = [...new Set(assignments.map(a => a.student_grade).filter(Boolean))].sort();

  const getStatus = (a: ExamAssignment) => {
    if (a.created_check && a.printed && a.reviewed) return { label: '완료', cls: 'exam-badge--done' };
    if (a.created_check && a.printed) return { label: '검토전', cls: 'exam-badge--review' };
    if (a.created_check) return { label: '프린트전', cls: 'exam-badge--print' };
    return { label: '미제작', cls: 'exam-badge--none' };
  };

  // 미배정 학생 (수동 배정 모달용)
  const assignedStudentIds = new Set(assignments.map(a => a.student_id));
  const unassignedStudents = students.filter(s => !assignedStudentIds.has(s.id));

  return (
    <div className="exam-page">
      {/* 헤더 */}
      <div className="exam-header">
        <h2 className="page-title">정기고사 관리</h2>
        <div className="exam-header-actions">
          <select
            className="exam-period-select"
            value={selectedPeriodId}
            onChange={e => setSelectedPeriodId(e.target.value)}
          >
            {periods.length === 0 && <option value="">시험 기간 없음</option>}
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.title} ({p.period_month})</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewPeriod(true)}>+ 새 기간</button>
          {selectedPeriodId && (
            <button className="btn btn-danger btn-sm" onClick={handleDeletePeriod}>삭제</button>
          )}
        </div>
      </div>

      {/* 새 기간 생성 폼 */}
      {showNewPeriod && (
        <div className="exam-form-inline">
          <input
            type="text"
            className="exam-input"
            placeholder="시험 기간 제목 (예: 2026년 4월 정기고사)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            autoFocus
          />
          <input
            type="month"
            className="exam-input exam-input--month"
            value={newMonth}
            onChange={e => setNewMonth(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={handleCreatePeriod} disabled={!newTitle.trim()}>생성</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowNewPeriod(false)}>취소</button>
        </div>
      )}

      {selectedPeriodId && (
        <>
          {/* 시험지 관리 */}
          <div className="exam-section">
            <div className="exam-section-header">
              <h3>시험지</h3>
              <div className="exam-section-actions">
                <button className="btn btn-sm btn-secondary" onClick={() => setShowAddPaper(!showAddPaper)}>
                  {showAddPaper ? '취소' : '+ 시험지 추가'}
                </button>
              </div>
            </div>

            {showAddPaper && (
              <div className="exam-form-inline">
                <input
                  type="text"
                  className="exam-input"
                  placeholder="시험지 제목"
                  value={paperTitle}
                  onChange={e => setPaperTitle(e.target.value)}
                  autoFocus
                />
                <input
                  type="text"
                  className="exam-input exam-input--short"
                  placeholder="학년 (예: 중1)"
                  value={paperGrade}
                  onChange={e => setPaperGrade(e.target.value)}
                />
                <label className="exam-checkbox-label">
                  <input type="checkbox" checked={paperCustom} onChange={e => setPaperCustom(e.target.checked)} />
                  개인
                </label>
                <button className="btn btn-primary btn-sm" onClick={handleAddPaper} disabled={!paperTitle.trim()}>추가</button>
              </div>
            )}

            {papers.length > 0 && (
              <div className="exam-papers-list">
                {papers.map(p => (
                  <div key={p.id} className="exam-paper-tag">
                    <span className="exam-paper-title">{p.title}</span>
                    {p.grade_filter && <span className="exam-paper-grade">{p.grade_filter}</span>}
                    {p.is_custom ? <span className="exam-paper-custom">개인</span> : null}
                    <button className="exam-paper-delete" onClick={() => handleDeletePaper(p)} aria-label="삭제">&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 배정 액션 */}
          <div className="exam-section">
            <div className="exam-section-header">
              <h3>학생 배정</h3>
              <div className="exam-section-actions">
                <button className="btn btn-primary btn-sm" onClick={handleAutoAssign} disabled={papers.length === 0}>
                  자동 배정
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowManualAssign(!showManualAssign)}>
                  수동 배정
                </button>
              </div>
            </div>

            {showManualAssign && (
              <div className="exam-form-inline">
                <select className="exam-input" value={assignStudentId} onChange={e => setAssignStudentId(e.target.value)}>
                  <option value="">학생 선택</option>
                  {unassignedStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
                  ))}
                </select>
                <select className="exam-input" value={assignPaperId} onChange={e => setAssignPaperId(e.target.value)}>
                  <option value="">시험지 선택</option>
                  {papers.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleManualAssign} disabled={!assignStudentId || !assignPaperId}>배정</button>
              </div>
            )}
          </div>

          {/* 요약 + 필터 */}
          <div className="exam-summary-bar">
            <span>전체 {stats.total}명</span>
            <span className="exam-stat">제작: {stats.created}/{stats.total}</span>
            <span className="exam-stat">프린트: {stats.printed}/{stats.total}</span>
            <span className="exam-stat">검토: {stats.reviewed}/{stats.total}</span>
            <div className="exam-filters">
              <select className="exam-filter-select" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                <option value="">전체 학년</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select className="exam-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">전체 상태</option>
                <option value="incomplete">미완료</option>
                <option value="complete">완료</option>
              </select>
            </div>
          </div>

          {/* 일괄 체크 */}
          {filteredAssignments.length > 0 && (
            <div className="exam-bulk-actions">
              <button className="btn btn-sm btn-outline" onClick={() => handleBulkCheck('created_check')}>
                {filteredAssignments.every(a => a.created_check) ? '전체 제작 해제' : '전체 제작완료'}
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => handleBulkCheck('printed')}>
                {filteredAssignments.every(a => a.printed) ? '전체 프린트 해제' : '전체 프린트완료'}
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => handleBulkCheck('reviewed')}>
                {filteredAssignments.every(a => a.reviewed) ? '전체 검토 해제' : '전체 검토완료'}
              </button>
            </div>
          )}

          {/* 체크리스트 테이블 */}
          {loading ? (
            <div className="rpt-loading" role="status">
              <div className="rpt-spinner" />
              <span>로딩 중...</span>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="exam-empty">
              {assignments.length === 0
                ? '배정된 학생이 없습니다. 시험지를 추가하고 자동 배정을 실행하세요.'
                : '필터 조건에 맞는 학생이 없습니다.'}
            </div>
          ) : (
            <table className="exam-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>학년</th>
                  <th>시험지</th>
                  <th className="exam-th-check">제작</th>
                  <th className="exam-th-check">프린트</th>
                  <th className="exam-th-check">검토</th>
                  <th>드라이브</th>
                  <th>점수</th>
                  <th>비고</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map(a => {
                  const st = getStatus(a);
                  return (
                    <tr key={a.id} className={st.cls === 'exam-badge--done' ? 'exam-row--done' : ''}>
                      <td className="exam-cell-name">{a.student_name}</td>
                      <td className="exam-cell-grade">{a.student_grade}</td>
                      <td className="exam-cell-paper">{a.paper_title}</td>
                      <td className="exam-cell-check">
                        <input
                          type="checkbox"
                          checked={!!a.created_check}
                          onChange={() => handleCheck(a, 'created_check')}
                          className="exam-checkbox"
                        />
                      </td>
                      <td className="exam-cell-check">
                        <input
                          type="checkbox"
                          checked={!!a.printed}
                          onChange={() => handleCheck(a, 'printed')}
                          className="exam-checkbox"
                        />
                      </td>
                      <td className="exam-cell-check">
                        <input
                          type="checkbox"
                          checked={!!a.reviewed}
                          onChange={() => handleCheck(a, 'reviewed')}
                          className="exam-checkbox"
                        />
                      </td>
                      <td className="exam-cell-link">
                        {editingLink === a.id ? (
                          <div className="exam-link-edit">
                            <input
                              type="url"
                              className="exam-link-input"
                              placeholder="구글 드라이브 URL"
                              value={linkDraft}
                              onChange={e => setLinkDraft(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveLink(a.id); if (e.key === 'Escape') setEditingLink(null); }}
                              autoFocus
                            />
                            <button className="btn btn-sm btn-primary" onClick={() => handleSaveLink(a.id)}>저장</button>
                          </div>
                        ) : a.drive_link ? (
                          <a
                            href={a.drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="exam-drive-link"
                            onClick={e => { if (e.ctrlKey || e.metaKey) return; }}
                            onDoubleClick={() => { setEditingLink(a.id); setLinkDraft(a.drive_link || ''); }}
                            title="더블클릭으로 수정"
                          >
                            링크
                          </a>
                        ) : (
                          <button
                            className="exam-add-link"
                            onClick={() => { setEditingLink(a.id); setLinkDraft(''); }}
                          >
                            +
                          </button>
                        )}
                      </td>
                      <td className="exam-cell-score">
                        {editingScore === a.id ? (
                          <input
                            type="number"
                            className="exam-score-input"
                            value={scoreDraft}
                            onChange={e => setScoreDraft(e.target.value)}
                            onBlur={() => handleSaveScore(a.id)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveScore(a.id); if (e.key === 'Escape') setEditingScore(null); }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className="exam-score-display"
                            onClick={() => { setEditingScore(a.id); setScoreDraft(a.score != null ? String(a.score) : ''); }}
                          >
                            {a.score != null ? a.score : '-'}
                          </span>
                        )}
                      </td>
                      <td className="exam-cell-memo">
                        {editingMemo === a.id ? (
                          <input
                            type="text"
                            className="exam-memo-input"
                            value={memoDraft}
                            onChange={e => setMemoDraft(e.target.value)}
                            onBlur={() => handleSaveMemo(a.id)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveMemo(a.id); if (e.key === 'Escape') setEditingMemo(null); }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className="exam-memo-display"
                            onClick={() => { setEditingMemo(a.id); setMemoDraft(a.memo || ''); }}
                          >
                            {a.memo || '-'}
                          </span>
                        )}
                      </td>
                      <td><span className={`exam-badge ${st.cls}`}>{st.label}</span></td>
                      <td>
                        <button className="exam-delete-btn" onClick={() => handleDeleteAssign(a)} aria-label="배정 삭제">&times;</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {ConfirmDialog}
    </div>
  );
}
