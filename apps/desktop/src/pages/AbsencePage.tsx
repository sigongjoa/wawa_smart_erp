import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { toast, useConfirm } from '../components/Toast';
import Modal from '../components/Modal';
import MakeupSessionsModal from '../components/MakeupSessionsModal';
import { useAuthStore } from '../store';
import { errorMessage } from '../utils/errors';

type MakeupStatus = '' | 'pending' | 'scheduled' | 'completed';

interface MakeupRow {
  id: string;
  absence_id: string;
  absence_date: string;
  reason: string;
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  completed_date: string | null;
  status: 'pending' | 'scheduled' | 'completed';
  notes: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '미보강',
  scheduled: '보강예정',
  completed: '보강완료',
};

const todayStr = () => new Date().toISOString().split('T')[0];

export default function AbsencePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [makeups, setMakeups] = useState<MakeupRow[]>([]);
  const [filter, setFilter] = useState<MakeupStatus>('');
  const [loading, setLoading] = useState(true);
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});

  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ studentId: '', classId: '', absenceDate: todayStr(), reason: '' });
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<MakeupRow | null>(null);
  const [editForm, setEditForm] = useState({
    absence_date: '',
    reason: '',
    class_id: '',
    scheduled_date: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
    notes: '',
    status: 'pending' as 'pending' | 'scheduled' | 'completed',
  });

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();
  const [sessionsTarget, setSessionsTarget] = useState<MakeupRow | null>(null);

  const loadMakeups = async (status?: MakeupStatus) => {
    setLoading(true);
    try {
      const data = await api.getMakeups(status || undefined, isAdmin && scope === 'all' ? 'all' : 'mine');
      setMakeups(data || []);
    } catch (err) {
      toast.error('보강 목록 조회 실패');
      setMakeups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMakeups(filter); }, [filter, scope]);

  useEffect(() => {
    api.getStudents(isAdmin ? 'all' : 'mine').then((d) => setStudents(d.map(s => ({ id: s.id, name: s.name })))).catch(() => {});
    api.getClasses().then((d) => setClasses((d || []).map((c: any) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, [isAdmin]);

  const handleSchedule = async (absenceId: string) => {
    const date = scheduleDates[absenceId];
    if (!date) return;
    try {
      await api.scheduleMakeup({ absenceId, scheduledDate: date });
      loadMakeups(filter);
    } catch (err) {
      toast.error('보강일 지정 실패: ' + (err as Error).message);
    }
  };

  const handleComplete = async (makeupId: string) => {
    try {
      await api.completeMakeup(makeupId);
      loadMakeups(filter);
    } catch (err) {
      toast.error('보강 완료 처리 실패: ' + (err as Error).message);
    }
  };

  const handleAdd = async () => {
    if (!addForm.studentId || !addForm.classId || !addForm.absenceDate) {
      toast.error('학생/수업/날짜는 필수입니다');
      return;
    }
    setSaving(true);
    try {
      await api.recordAbsence({
        studentId: addForm.studentId,
        classId: addForm.classId,
        absenceDate: addForm.absenceDate,
        reason: addForm.reason.trim(),
        notifiedBy: user?.name || user?.id || '',
      });
      toast.success('결석 등록 완료');
      setShowAdd(false);
      setAddForm({ studentId: '', classId: '', absenceDate: todayStr(), reason: '' });
      loadMakeups(filter);
    } catch (err: unknown) {
      toast.error(errorMessage(err, '등록 실패'));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (m: MakeupRow) => {
    setEditTarget(m);
    setEditForm({
      absence_date: m.absence_date,
      reason: m.reason || '',
      class_id: m.class_id,
      scheduled_date: m.scheduled_date || '',
      scheduled_start_time: m.scheduled_start_time || '',
      scheduled_end_time: m.scheduled_end_time || '',
      notes: m.notes || '',
      status: m.status,
    });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await api.updateAbsence(editTarget.absence_id, {
        absence_date: editForm.absence_date,
        reason: editForm.reason.trim() || null,
        class_id: editForm.class_id,
      });
      await api.updateMakeup(editTarget.id, {
        scheduled_date: editForm.scheduled_date || null,
        scheduled_start_time: editForm.scheduled_start_time || null,
        scheduled_end_time: editForm.scheduled_end_time || null,
        notes: editForm.notes,
        status: editForm.status,
      });
      toast.success('수정 완료');
      setEditTarget(null);
      loadMakeups(filter);
    } catch (err: unknown) {
      toast.error(errorMessage(err, '수정 실패'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAbsence = async (m: MakeupRow) => {
    const ok = await confirmDialog(`${m.student_name} ${m.absence_date} 결석을 삭제합니다. 보강 정보도 함께 삭제됩니다.`);
    if (!ok) return;
    try {
      await api.deleteAbsence(m.absence_id);
      toast.success('삭제 완료');
      setEditTarget(null);
      loadMakeups(filter);
    } catch (err: unknown) {
      toast.error(errorMessage(err, '삭제 실패'));
    }
  };

  // 4번 순회 → 1번 순회로 통합
  const counts = useMemo(() => {
    const acc = { pending: 0, scheduled: 0, completed: 0 };
    for (const m of makeups) {
      if (m.status === 'pending') acc.pending++;
      else if (m.status === 'scheduled') acc.scheduled++;
      else if (m.status === 'completed') acc.completed++;
    }
    return acc;
  }, [makeups]);

  const displayMakeups = useMemo(
    () => (filter ? makeups.filter((m) => m.status === filter) : makeups),
    [makeups, filter],
  );

  return (
    <div className="absence-page">
      {ConfirmDialog}
      <div className="absence-page-header">
        <h2 className="page-title">보강 관리</h2>
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
        <div className="absence-filters">
          {([
            { key: '', label: '전체' },
            { key: 'pending', label: '미보강' },
            { key: 'scheduled', label: '보강예정' },
            { key: 'completed', label: '완료' },
          ] as { key: MakeupStatus; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              className={`filter-btn ${filter === key ? 'filter-btn--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              {key && counts[key as keyof typeof counts] > 0 && (
                <span className="filter-count">{counts[key as keyof typeof counts]}</span>
              )}
            </button>
          ))}
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ 결석 추가</button>
        </div>
      </div>

      {loading ? (
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>로딩 중...</span>
        </div>
      ) : displayMakeups.length === 0 ? (
        <div className="absence-empty">
          {filter ? `${STATUS_LABELS[filter]} 항목이 없습니다` : '보강 데이터가 없습니다'}
        </div>
      ) : (
        <>
        <table className="absence-table absence-desktop">
          <thead>
            <tr>
              <th>학생</th>
              <th>결석일</th>
              <th>수업</th>
              <th>사유</th>
              <th>보강일</th>
              <th>상태</th>
              <th style={{ width: 200 }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {displayMakeups.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.student_name}</td>
                <td>{m.absence_date}</td>
                <td>{m.class_name}</td>
                <td>{m.reason || '-'}</td>
                <td>
                  {m.status === 'pending' ? (
                    <input
                      type="date"
                      className="date-input"
                      value={scheduleDates[m.absence_id] || ''}
                      onChange={(e) =>
                        setScheduleDates((prev) => ({ ...prev, [m.absence_id]: e.target.value }))
                      }
                    />
                  ) : (
                    m.scheduled_date || '-'
                  )}
                </td>
                <td>
                  <span className={`makeup-status makeup-status--${m.status}`}>
                    {STATUS_LABELS[m.status]}
                  </span>
                </td>
                <td>
                  <div className="action-cell">
                    {m.status === 'pending' && (
                      <button
                        className="btn btn-sm btn-present"
                        onClick={() => handleSchedule(m.absence_id)}
                        disabled={!scheduleDates[m.absence_id]}
                      >지정</button>
                    )}
                    {m.status === 'scheduled' && (
                      <button className="btn btn-sm btn-present" onClick={() => handleComplete(m.id)}>완료</button>
                    )}
                    <button className="btn btn-sm btn-ghost" onClick={() => setSessionsTarget(m)}>회차</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(m)}>수정</button>
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDeleteAbsence(m)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="absence-cards absence-mobile">
          {displayMakeups.map((m) => (
            <div key={m.id} className="absence-card">
              <div className="absence-card-top">
                <span className="absence-card-name">{m.student_name}</span>
                <span className={`makeup-status makeup-status--${m.status}`}>
                  {STATUS_LABELS[m.status]}
                </span>
              </div>
              <div className="absence-card-details">
                <span>결석 {m.absence_date}</span>
                <span>{m.class_name}</span>
                {m.reason && <span>{m.reason}</span>}
              </div>
              {m.scheduled_date && (
                <div className="absence-card-schedule">보강일: {m.scheduled_date}</div>
              )}
              <div className="absence-card-action">
                {m.status === 'pending' && (
                  <>
                    <input
                      type="date"
                      className="date-input"
                      value={scheduleDates[m.absence_id] || ''}
                      onChange={(e) =>
                        setScheduleDates((prev) => ({ ...prev, [m.absence_id]: e.target.value }))
                      }
                    />
                    <button
                      className="btn btn-sm btn-present"
                      onClick={() => handleSchedule(m.absence_id)}
                      disabled={!scheduleDates[m.absence_id]}
                    >보강일 지정</button>
                  </>
                )}
                {m.status === 'scheduled' && (
                  <button className="btn btn-sm btn-present" onClick={() => handleComplete(m.id)}>보강 완료</button>
                )}
                <button className="btn btn-sm btn-ghost" onClick={() => openEdit(m)}>수정</button>
                <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDeleteAbsence(m)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <Modal.Header>결석 추가</Modal.Header>
          <Modal.Body>
              <label className="form-label">학생 *</label>
              <select className="form-select" value={addForm.studentId} onChange={e => setAddForm({ ...addForm, studentId: e.target.value })}>
                <option value="">학생 선택</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <label className="form-label">수업 *</label>
              <select className="form-select" value={addForm.classId} onChange={e => setAddForm({ ...addForm, classId: e.target.value })}>
                <option value="">수업 선택</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label className="form-label">결석일 *</label>
              <input type="date" className="form-input" value={addForm.absenceDate} onChange={e => setAddForm({ ...addForm, absenceDate: e.target.value })} />
              <label className="form-label">사유</label>
              <input className="form-input" value={addForm.reason} onChange={e => setAddForm({ ...addForm, reason: e.target.value })} placeholder="예: 감기" />
          </Modal.Body>
          <Modal.Footer>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
                {saving ? '추가 중...' : '추가'}
              </button>
          </Modal.Footer>
        </Modal>
      )}

      {editTarget && (
        <Modal onClose={() => setEditTarget(null)}>
          <Modal.Header>{editTarget.student_name} — 결석/보강 수정</Modal.Header>
          <Modal.Body>
              <label className="form-label">결석일</label>
              <input type="date" className="form-input" value={editForm.absence_date} onChange={e => setEditForm({ ...editForm, absence_date: e.target.value })} />
              <label className="form-label">수업</label>
              <select className="form-select" value={editForm.class_id} onChange={e => setEditForm({ ...editForm, class_id: e.target.value })}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label className="form-label">사유</label>
              <input className="form-input" value={editForm.reason} onChange={e => setEditForm({ ...editForm, reason: e.target.value })} />
              <label className="form-label">보강일</label>
              <input type="date" className="form-input" value={editForm.scheduled_date} onChange={e => setEditForm({ ...editForm, scheduled_date: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">시작 시각</label>
                  <input type="time" className="form-input" value={editForm.scheduled_start_time} onChange={e => setEditForm({ ...editForm, scheduled_start_time: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">종료 시각</label>
                  <input type="time" className="form-input" value={editForm.scheduled_end_time} onChange={e => setEditForm({ ...editForm, scheduled_end_time: e.target.value })} />
                </div>
              </div>
              <label className="form-label">보강 메모</label>
              <input className="form-input" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
              <label className="form-label">보강 상태</label>
              <select className="form-select" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as 'pending' | 'scheduled' | 'completed' })}>
                <option value="pending">미보강</option>
                <option value="scheduled">보강예정</option>
                <option value="completed">보강완료</option>
              </select>
          </Modal.Body>
          <Modal.Footer>
              <button className="btn btn-danger-ghost" onClick={() => handleDeleteAbsence(editTarget)}>삭제</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={() => setEditTarget(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
          </Modal.Footer>
        </Modal>
      )}

      {sessionsTarget && (
        <MakeupSessionsModal
          makeupId={sessionsTarget.id}
          studentName={sessionsTarget.student_name}
          absenceDate={sessionsTarget.absence_date}
          onClose={() => setSessionsTarget(null)}
          onChanged={() => loadMakeups(filter)}
        />
      )}
    </div>
  );
}
