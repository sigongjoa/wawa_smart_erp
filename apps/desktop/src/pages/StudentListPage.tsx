import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, Student, StudentCreateInput, TeacherOption } from '../api';
import { useAuthStore } from '../store';
import { toast, useConfirm } from '../components/Toast';
import Modal from '../components/Modal';
import { errorMessage } from '../utils/errors';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

interface Enrollment {
  id: string;
  studentId: string;
  day: string;
  startTime: string;
  endTime: string;
  subject?: string | null;
}

const GRADE_OPTIONS = ['초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];

const emptyAdd: StudentCreateInput = {
  name: '', grade: '', school: '', contact: '', guardian_contact: '',
};

export default function StudentListPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<StudentCreateInput>(emptyAdd);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<StudentCreateInput>(emptyAdd);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [assignedTeacherIds, setAssignedTeacherIds] = useState<string[]>([]);

  // 시간표 편집
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollAddOpen, setEnrollAddOpen] = useState(false);
  const [newEnroll, setNewEnroll] = useState({ day: '', startTime: '', endTime: '', subject: '' });
  const [enrollSaving, setEnrollSaving] = useState(false);

  const loadEnrollments = async (studentId: string) => {
    setEnrollLoading(true);
    try {
      const data = await api.listEnrollments(studentId);
      setEnrollments(data);
    } catch { setEnrollments([]); }
    finally { setEnrollLoading(false); }
  };

  const handleAddEnrollment = async () => {
    if (!editTarget || !newEnroll.day || !newEnroll.startTime || !newEnroll.endTime) return;
    setEnrollSaving(true);
    try {
      await api.createEnrollment({
        studentId: editTarget.id,
        day: newEnroll.day,
        startTime: newEnroll.startTime,
        endTime: newEnroll.endTime,
        subject: newEnroll.subject.trim() || undefined,
      });
      toast.success('시간표 추가됨');
      setNewEnroll({ day: '', startTime: '', endTime: '', subject: '' });
      setEnrollAddOpen(false);
      loadEnrollments(editTarget.id);
    } catch (err: unknown) {
      toast.error(errorMessage(err, '시간표 추가 실패'));
    } finally { setEnrollSaving(false); }
  };

  const handleDeleteEnrollment = async (enrollId: string) => {
    if (!editTarget) return;
    try {
      await api.deleteEnrollment(enrollId);
      toast.success('시간표 삭제됨');
      loadEnrollments(editTarget.id);
    } catch (err: unknown) {
      toast.error(errorMessage(err, '삭제 실패'));
    }
  };

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getStudents(isAdmin && scope === 'all' ? 'all' : 'mine');
      setStudents(data);
    } catch {
      toast.error('학생 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, scope]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isAdmin) {
      api.getTeachers().then(setTeachers).catch(() => {});
    }
  }, [isAdmin]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (activeOnly && s.status !== 'active') return false;
      if (gradeFilter && s.grade !== gradeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !(s.school || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [students, search, gradeFilter, activeOnly]);

  const handleAdd = async () => {
    if (!addForm.name?.trim() || !addForm.grade) return;
    setSaving(true);
    try {
      await api.createStudent({
        ...addForm,
        name: addForm.name.trim(),
        school: addForm.school?.trim() || null,
        contact: addForm.contact?.trim() || null,
        guardian_contact: addForm.guardian_contact?.trim() || null,
      });
      toast.success('학생 추가 완료');
      setShowAdd(false);
      setAddForm(emptyAdd);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, '추가 실패'));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (s: Student) => {
    setEditTarget(s);
    setEditForm({
      name: s.name,
      grade: s.grade || '',
      school: s.school || '',
      contact: s.contact || '',
      guardian_contact: s.guardian_contact || '',
      class_id: s.class_id || null,
      status: (s.status as 'active' | 'inactive') || 'active',
    });
    setEnrollAddOpen(false);
    setNewEnroll({ day: '', startTime: '', endTime: '', subject: '' });
    loadEnrollments(s.id);
    if (isAdmin) {
      try {
        const profile = await api.getStudentProfile(s.id);
        setAssignedTeacherIds((profile.teachers || []).map(t => t.id));
      } catch {
        setAssignedTeacherIds([]);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await api.updateStudent(editTarget.id, {
        name: editForm.name?.trim(),
        grade: editForm.grade,
        school: editForm.school?.trim() || null,
        contact: editForm.contact?.trim() || null,
        guardian_contact: editForm.guardian_contact?.trim() || null,
        status: editForm.status,
      });
      if (isAdmin) {
        await api.setStudentTeachers(editTarget.id, assignedTeacherIds);
      }
      toast.success('수정 완료');
      setEditTarget(null);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, '수정 실패'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Student) => {
    const ok = await confirmDialog(`${s.name} 학생을 비활성 처리할까요? 관련 출석/성적은 유지됩니다.`);
    if (!ok) return;
    try {
      await api.updateStudent(s.id, { status: 'inactive' });
      toast.success('비활성 처리됨');
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, '삭제 실패'));
    }
  };

  const handleHardDelete = async (s: Student) => {
    const ok = await confirmDialog(`${s.name} 학생과 관련 매핑을 모두 삭제합니다. 복구할 수 없습니다.`);
    if (!ok) return;
    try {
      await api.deleteStudent(s.id);
      toast.success('삭제 완료');
      setEditTarget(null);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, '삭제 실패'));
    }
  };

  const handleInlineSave = async (id: string, field: 'school' | 'grade', value: string) => {
    const original = students.find(s => s.id === id);
    if (!original) return;
    if ((original[field] || '') === value) return;
    setStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: value || null } : s));
    try {
      await api.updateStudent(id, { [field]: value || null } as any);
    } catch {
      toast.error('저장 실패');
      load();
    }
  };

  const toggleAssigned = (teacherId: string) => {
    setAssignedTeacherIds(prev =>
      prev.includes(teacherId) ? prev.filter(id => id !== teacherId) : [...prev, teacherId]
    );
  };

  const grades = [...new Set(students.map(s => s.grade).filter(Boolean))].sort();

  return (
    <div className="student-list-page">
      {ConfirmDialog}

      <div className="student-list-header">
        <div className="student-list-title-row">
          <h2>학생 관리</h2>
          <span className="student-count">{filtered.length}명</span>
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
        <div className="student-list-filters">
          <input
            type="text"
            placeholder="이름 / 학교 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="student-search-input"
          />
          <select className="form-select" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
            <option value="">전체 학년</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <label className="student-filter-toggle">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            활성만
          </label>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ 학생 추가</button>
        </div>
      </div>

      {loading ? (
        <p className="student-list-empty">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="student-list-empty-state">
          <p className="student-list-empty-title">학생이 없습니다</p>
          <button className="btn btn-accent" onClick={() => setShowAdd(true)}>첫 학생 추가</button>
        </div>
      ) : (
        <table className="student-table">
          <thead>
            <tr>
              <th>이름</th>
              <th style={{ width: 70 }}>학년</th>
              <th style={{ width: 160 }}>학교</th>
              <th>학생 연락처</th>
              <th>보호자</th>
              <th style={{ width: 70 }}>상태</th>
              <th style={{ width: 140 }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className={s.status !== 'active' ? 'student-row--inactive' : ''}>
                <td className="student-cell-name">
                  <Link to={`/student/${s.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                    {s.name}
                  </Link>
                </td>
                <td>
                  <select
                    className="student-inline-select"
                    defaultValue={s.grade || ''}
                    onChange={(e) => handleInlineSave(s.id, 'grade', e.target.value)}
                  >
                    <option value="">-</option>
                    {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    className="student-inline-input"
                    defaultValue={s.school || ''}
                    placeholder="학교명"
                    onBlur={(e) => handleInlineSave(s.id, 'school', e.target.value.trim())}
                  />
                </td>
                <td className="student-cell-contact">{s.contact || '-'}</td>
                <td className="student-cell-contact">{s.guardian_contact || '-'}</td>
                <td>
                  <span className={`student-status student-status--${s.status}`}>
                    {s.status === 'active' ? '활성' : '비활성'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm btn-ghost" onClick={() => openEdit(s)}>수정</button>
                  {s.status === 'active' && (
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDelete(s)}>비활성</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 추가 모달 */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <Modal.Header>학생 추가</Modal.Header>
          <Modal.Body>
            <div className="form-grid">
              <div>
                <label className="form-label" htmlFor="add-name">이름 *</label>
                <input id="add-name" className="form-input" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
              </div>
              <div>
                <label className="form-label" htmlFor="add-grade">학년 *</label>
                <select id="add-grade" className="form-select" value={addForm.grade} onChange={e => setAddForm({ ...addForm, grade: e.target.value })}>
                  <option value="">학년 선택</option>
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-full">
                <label className="form-label" htmlFor="add-school">학교</label>
                <input id="add-school" className="form-input" value={addForm.school || ''} onChange={e => setAddForm({ ...addForm, school: e.target.value })} />
              </div>
              <div>
                <label className="form-label" htmlFor="add-contact">학생 연락처</label>
                <input id="add-contact" className="form-input" value={addForm.contact || ''} onChange={e => setAddForm({ ...addForm, contact: e.target.value })} />
              </div>
              <div>
                <label className="form-label" htmlFor="add-guardian">보호자 연락처</label>
                <input id="add-guardian" className="form-input" value={addForm.guardian_contact || ''} onChange={e => setAddForm({ ...addForm, guardian_contact: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !addForm.name?.trim() || !addForm.grade}>
              {saving ? '추가 중...' : '추가'}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {/* 수정 모달 */}
      {editTarget && (
        <Modal onClose={() => setEditTarget(null)} className="modal-content--wide">
          <Modal.Header>{editTarget.name} 수정</Modal.Header>
          <Modal.Body>
            <section className="form-section">
              <h4 className="form-section-title">기본 정보</h4>
              <div className="form-grid">
                <div>
                  <label className="form-label" htmlFor="edit-name">이름</label>
                  <input id="edit-name" className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" htmlFor="edit-grade">학년</label>
                  <select id="edit-grade" className="form-select" value={editForm.grade} onChange={e => setEditForm({ ...editForm, grade: e.target.value })}>
                    <option value="">학년 선택</option>
                    {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-full">
                  <label className="form-label" htmlFor="edit-school">학교</label>
                  <input id="edit-school" className="form-input" value={editForm.school || ''} onChange={e => setEditForm({ ...editForm, school: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" htmlFor="edit-contact">학생 연락처</label>
                  <input id="edit-contact" className="form-input" value={editForm.contact || ''} onChange={e => setEditForm({ ...editForm, contact: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" htmlFor="edit-guardian">보호자 연락처</label>
                  <input id="edit-guardian" className="form-input" value={editForm.guardian_contact || ''} onChange={e => setEditForm({ ...editForm, guardian_contact: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" htmlFor="edit-status">상태</label>
                  <select id="edit-status" className="form-select" value={editForm.status || 'active'} onChange={e => setEditForm({ ...editForm, status: e.target.value as 'active' | 'inactive' })}>
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                  </select>
                </div>
              </div>
            </section>

            {isAdmin && teachers.length > 0 && (
              <section className="form-section">
                <h4 className="form-section-title">담당 선생님</h4>
                <div className="teacher-checkboxes">
                  {teachers.map(t => (
                    <label key={t.id} className="teacher-checkbox">
                      <input
                        type="checkbox"
                        checked={assignedTeacherIds.includes(t.id)}
                        onChange={() => toggleAssigned(t.id)}
                      />
                      {t.name} <span className="teacher-role">({t.role === 'admin' ? '관리자' : '강사'})</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            <section className="form-section">
              <div className="form-section-head">
                <h4 className="form-section-title">수강 시간표</h4>
                <button
                  className="btn btn-sm btn-primary"
                  type="button"
                  onClick={() => setEnrollAddOpen(!enrollAddOpen)}
                >
                  {enrollAddOpen ? '닫기' : '+ 추가'}
                </button>
              </div>

              {enrollAddOpen && (
                <div className="enroll-add-row">
                  <select
                    className="form-select form-select--sm"
                    value={newEnroll.day}
                    onChange={(e) => setNewEnroll(f => ({ ...f, day: e.target.value }))}
                    aria-label="요일"
                  >
                    <option value="">요일</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input
                    className="form-input form-input--sm"
                    type="time"
                    value={newEnroll.startTime}
                    onChange={(e) => setNewEnroll(f => ({ ...f, startTime: e.target.value }))}
                    aria-label="시작 시간"
                  />
                  <input
                    className="form-input form-input--sm"
                    type="time"
                    value={newEnroll.endTime}
                    onChange={(e) => setNewEnroll(f => ({ ...f, endTime: e.target.value }))}
                    aria-label="종료 시간"
                  />
                  <input
                    className="form-input form-input--xs"
                    placeholder="과목"
                    value={newEnroll.subject}
                    onChange={(e) => setNewEnroll(f => ({ ...f, subject: e.target.value }))}
                    aria-label="과목"
                  />
                  <button
                    className="btn btn-sm btn-accent"
                    onClick={handleAddEnrollment}
                    disabled={enrollSaving || !newEnroll.day || !newEnroll.startTime || !newEnroll.endTime}
                  >
                    {enrollSaving ? '...' : '추가'}
                  </button>
                </div>
              )}

              {enrollLoading ? (
                <p className="form-hint">불러오는 중...</p>
              ) : enrollments.length === 0 ? (
                <p className="form-hint">등록된 시간표가 없습니다</p>
              ) : (
                <div className="enroll-edit-list">
                  {DAYS.filter(d => enrollments.some(e => e.day === d)).map(day => (
                    <div key={day} className="enroll-edit-day">
                      <span className="enroll-edit-day-label">{day}</span>
                      <div className="enroll-edit-day-items">
                        {enrollments.filter(e => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(e => (
                          <div key={e.id} className="enroll-edit-item">
                            <span>{e.startTime}~{e.endTime}</span>
                            {e.subject && <span className="enroll-edit-subject">{e.subject}</span>}
                            <button
                              className="enroll-edit-delete"
                              type="button"
                              onClick={() => handleDeleteEnrollment(e.id)}
                              aria-label="삭제"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-danger-ghost" onClick={() => handleHardDelete(editTarget)}>완전 삭제</button>
            <div className="modal-footer-spacer" />
            <button className="btn btn-ghost" onClick={() => setEditTarget(null)}>취소</button>
            <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}
