/**
 * AbsencePage — mockup v2/11-attendance.html 톤으로 전면 재작성.
 *
 * 비즈니스 로직(API 호출, 모달 3종)은 유지. 마크업·스타일은 mockup 11 1:1 매핑.
 *
 * 핵심 요소:
 *   - PageHeader: title-row 안에 scope-toggle, sub 에 live stats, actions 에 월간 export + 결석 추가
 *   - SummaryBar (5 cells): 이번 달 결석 · 미보강 · 보강 예정 · 보강 완료 · 7일 내 미배정
 *   - Panel: filter-row (chips + 검색 + 월 select) + data-table
 *   - cluster/avatar/cell-stack 패턴, ms (makeup status) 핀, scheduled-meta 2줄, btn-icon 액션
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { toast, useConfirm } from '../components/Toast';
import Modal from '../components/Modal';
import MakeupSessionsModal from '../components/MakeupSessionsModal';
import { useAuthStore } from '../store';
import { errorMessage } from '../utils/errors';
import { PageHeader, SummaryBar } from '../components/v2';
import { Icon } from '../components/icons/Icon';

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

function daysBetween(iso: string, today: Date = new Date()): number {
  const d = new Date(iso + 'T00:00:00');
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

function avatarChars(name: string): string {
  return name.slice(0, 2);
}

export default function AbsencePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [makeups, setMakeups] = useState<MakeupRow[]>([]);
  const [filter, setFilter] = useState<MakeupStatus>('');
  const [search, setSearch] = useState('');
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
    } catch {
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

  // 카운트 (filter 와 무관하게 전체에서 산출)
  const counts = useMemo(() => {
    const acc = { pending: 0, scheduled: 0, completed: 0, overdue: 0 };
    for (const m of makeups) {
      if (m.status === 'pending') {
        acc.pending++;
        if (daysBetween(m.absence_date) >= 7) acc.overdue++;
      } else if (m.status === 'scheduled') acc.scheduled++;
      else if (m.status === 'completed') acc.completed++;
    }
    return acc;
  }, [makeups]);

  // 필터 + 검색
  const displayMakeups = useMemo(() => {
    let list = filter ? makeups.filter((m) => m.status === filter) : makeups;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((m) =>
        m.student_name.toLowerCase().includes(q) ||
        (m.class_name || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [makeups, filter, search]);

  return (
    <div className="absence-page-v2">
      {ConfirmDialog}
      <PageHeader
        crumb="운영 · 보강 관리"
        title="보강 관리"
        titleExtra={isAdmin ? (
          <div className="scope-toggle" role="group" aria-label="조회 범위">
            <button
              className={`scope-toggle-btn ${scope === 'mine' ? 'scope-toggle-btn--active' : ''}`}
              onClick={() => setScope('mine')}
              type="button"
            >내 학생</button>
            <button
              className={`scope-toggle-btn ${scope === 'all' ? 'scope-toggle-btn--active' : ''}`}
              onClick={() => setScope('all')}
              type="button"
            >모두 보기</button>
          </div>
        ) : undefined}
        sub={`결석 → 보강 일정 추적 · 미보강 ${counts.pending}건 · 보강예정 ${counts.scheduled}건${counts.overdue > 0 ? ` · 7일 경과 ${counts.overdue}건` : ''}`}
        actions={
          <button className="v2-btn v2-btn--primary" onClick={() => setShowAdd(true)} type="button">
            <Icon name="Plus" size={14} /> 결석 추가
          </button>
        }
      />

      <SummaryBar
        cells={[
          { label: '이번 달 결석', value: makeups.length, sub: '건' },
          { label: '미보강', value: counts.pending, alert: counts.pending > 0 },
          { label: '보강 예정', value: counts.scheduled },
          { label: '보강 완료', value: counts.completed },
          { label: '7일 경과', value: counts.overdue, alert: counts.overdue > 0 },
        ]}
      />

      <div className="v2-panel">
        {/* filter-row: chips + 검색 */}
        <div className="v2-filter-row">
          {([
            { key: '', label: '전체', count: makeups.length },
            { key: 'pending', label: '미보강', count: counts.pending },
            { key: 'scheduled', label: '보강예정', count: counts.scheduled },
            { key: 'completed', label: '보강완료', count: counts.completed },
          ] as { key: MakeupStatus; label: string; count: number }[]).map(({ key, label, count }) => (
            <button
              key={key}
              className={`v2-filter-chip${filter === key ? ' is-active' : ''}`}
              onClick={() => setFilter(key)}
              type="button"
            >
              {label}
              {count > 0 && <span className="v2-filter-chip__count">{count}</span>}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div className="v2-input-group">
            <Icon name="Search" size={14} />
            <input
              placeholder="학생·수업 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="rpt-loading" role="status">
            <div className="rpt-spinner" />
            <span>로딩 중...</span>
          </div>
        ) : displayMakeups.length === 0 ? (
          <div className="v2-empty">
            <Icon name="Info" size={28} />
            <div>
              {filter ? `${STATUS_LABELS[filter]} 항목이 없습니다` : '보강 데이터가 없습니다'}
            </div>
          </div>
        ) : (
          <>
            <table className="v2-data-table v2-absence-desktop">
              <thead>
                <tr>
                  <th>학생</th>
                  <th style={{ width: 110 }} className="v2-tabular">결석일</th>
                  <th>수업</th>
                  <th>사유</th>
                  <th style={{ width: 180 }}>보강일</th>
                  <th style={{ width: 130 }}>상태</th>
                  <th style={{ width: 230 }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {displayMakeups.map((m) => {
                  const overdue = m.status === 'pending' && daysBetween(m.absence_date) >= 7;
                  const isCompleted = m.status === 'completed';
                  return (
                    <tr key={m.id} className={`${overdue ? 'is-overdue' : ''} ${isCompleted ? 'is-completed' : ''}`}>
                      <td>
                        <div className="v2-cluster">
                          <div className={`v2-avatar${overdue ? ' v2-avatar--danger' : m.status === 'pending' ? ' v2-avatar--warning' : ''}`}>
                            {avatarChars(m.student_name)}
                          </div>
                          <div className="v2-cell-stack">
                            <span className="v2-cell-stack__primary">{m.student_name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="v2-tabular">{m.absence_date}</td>
                      <td>{m.class_name}</td>
                      <td>{m.reason || <span className="v2-text-mute">(미입력)</span>}</td>
                      <td>
                        {m.status === 'pending' ? (
                          <input
                            type="date"
                            className="v2-date-input"
                            value={scheduleDates[m.absence_id] || ''}
                            onChange={(e) =>
                              setScheduleDates((prev) => ({ ...prev, [m.absence_id]: e.target.value }))
                            }
                          />
                        ) : m.scheduled_date ? (
                          <div className="v2-scheduled-meta">
                            <span className="v2-scheduled-meta__date">{m.scheduled_date}</span>
                            <span className="v2-scheduled-meta__time">
                              {m.status === 'completed'
                                ? `완료 ${m.completed_date?.slice(5) || ''}`
                                : m.scheduled_start_time && m.scheduled_end_time
                                  ? `${m.scheduled_start_time}–${m.scheduled_end_time}`
                                  : '시간 미지정'}
                            </span>
                          </div>
                        ) : '-'}
                      </td>
                      <td>
                        <span className={`v2-ms v2-ms--${m.status}`}>
                          <Icon
                            name={m.status === 'pending' ? 'AlertCircle' : m.status === 'scheduled' ? 'CalendarClock' : 'CheckCircle2'}
                            size={12}
                          />
                          {STATUS_LABELS[m.status]}
                          {overdue && ` · ${daysBetween(m.absence_date)}일 경과`}
                        </span>
                      </td>
                      <td>
                        <div className="v2-action-cell">
                          {m.status === 'pending' && (
                            <button
                              className="v2-btn v2-btn--primary v2-btn--sm"
                              onClick={() => handleSchedule(m.absence_id)}
                              disabled={!scheduleDates[m.absence_id]}
                              type="button"
                            >지정</button>
                          )}
                          {m.status === 'scheduled' && (
                            <button
                              className="v2-btn v2-btn--accent v2-btn--sm"
                              onClick={() => handleComplete(m.id)}
                              type="button"
                            >
                              <Icon name="Check" size={12} /> 완료
                            </button>
                          )}
                          {isCompleted && (
                            <span className="v2-text-mute" style={{ fontSize: 12 }}>완료됨</span>
                          )}
                          <button className="v2-btn-icon" title="회차" onClick={() => setSessionsTarget(m)} type="button">
                            <Icon name="ListOrdered" size={14} />
                          </button>
                          <button className="v2-btn-icon" title="수정" onClick={() => openEdit(m)} type="button">
                            <Icon name="Pencil" size={14} />
                          </button>
                          <button className="v2-btn-icon v2-btn-icon--danger" title="삭제" onClick={() => handleDeleteAbsence(m)} type="button">
                            <Icon name="Trash2" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="v2-absence-mobile">
              {displayMakeups.map((m) => {
                const overdue = m.status === 'pending' && daysBetween(m.absence_date) >= 7;
                return (
                  <div key={m.id} className={`v2-absence-card${overdue ? ' is-overdue' : ''}`}>
                    <div className="v2-absence-card__head">
                      <div className="v2-cluster">
                        <div className={`v2-avatar${overdue ? ' v2-avatar--danger' : m.status === 'pending' ? ' v2-avatar--warning' : ''}`}>
                          {avatarChars(m.student_name)}
                        </div>
                        <div className="v2-cell-stack">
                          <span className="v2-cell-stack__primary">{m.student_name}</span>
                          <span className="v2-cell-stack__meta">{m.absence_date} · {m.class_name}</span>
                        </div>
                      </div>
                      <span className={`v2-ms v2-ms--${m.status}`}>
                        <Icon
                          name={m.status === 'pending' ? 'AlertCircle' : m.status === 'scheduled' ? 'CalendarClock' : 'CheckCircle2'}
                          size={12}
                        />
                        {STATUS_LABELS[m.status]}
                      </span>
                    </div>
                    {m.reason && (
                      <div className="v2-absence-card__reason">사유 · {m.reason}</div>
                    )}
                    {m.scheduled_date && (
                      <div className="v2-absence-card__schedule">
                        보강 {m.scheduled_date}
                        {m.scheduled_start_time && m.scheduled_end_time && ` · ${m.scheduled_start_time}–${m.scheduled_end_time}`}
                      </div>
                    )}
                    <div className="v2-action-cell">
                      {m.status === 'pending' && (
                        <>
                          <input
                            type="date"
                            className="v2-date-input"
                            value={scheduleDates[m.absence_id] || ''}
                            onChange={(e) =>
                              setScheduleDates((prev) => ({ ...prev, [m.absence_id]: e.target.value }))
                            }
                          />
                          <button
                            className="v2-btn v2-btn--primary v2-btn--sm"
                            onClick={() => handleSchedule(m.absence_id)}
                            disabled={!scheduleDates[m.absence_id]}
                            type="button"
                          >보강일 지정</button>
                        </>
                      )}
                      {m.status === 'scheduled' && (
                        <button
                          className="v2-btn v2-btn--accent v2-btn--sm"
                          onClick={() => handleComplete(m.id)}
                          type="button"
                        >
                          <Icon name="Check" size={12} /> 보강 완료
                        </button>
                      )}
                      <button className="v2-btn-icon" title="회차" onClick={() => setSessionsTarget(m)} type="button">
                        <Icon name="ListOrdered" size={14} />
                      </button>
                      <button className="v2-btn-icon" title="수정" onClick={() => openEdit(m)} type="button">
                        <Icon name="Pencil" size={14} />
                      </button>
                      <button className="v2-btn-icon v2-btn-icon--danger" title="삭제" onClick={() => handleDeleteAbsence(m)} type="button">
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 결석 추가 모달 */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <Modal.Header>결석 추가</Modal.Header>
          <Modal.Body>
            <label className="form-label">학생 *</label>
            <select className="form-select" value={addForm.studentId} onChange={(e) => setAddForm({ ...addForm, studentId: e.target.value })}>
              <option value="">학생 선택</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="form-label">수업 *</label>
            <select className="form-select" value={addForm.classId} onChange={(e) => setAddForm({ ...addForm, classId: e.target.value })}>
              <option value="">수업 선택</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="form-label">결석일 *</label>
            <input type="date" className="form-input" value={addForm.absenceDate} onChange={(e) => setAddForm({ ...addForm, absenceDate: e.target.value })} />
            <label className="form-label">사유</label>
            <input className="form-input" value={addForm.reason} onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })} placeholder="예: 감기" />
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? '추가 중...' : '추가'}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {/* 수정 모달 */}
      {editTarget && (
        <Modal onClose={() => setEditTarget(null)}>
          <Modal.Header>{editTarget.student_name} — 결석/보강 수정</Modal.Header>
          <Modal.Body>
            <label className="form-label">결석일</label>
            <input type="date" className="form-input" value={editForm.absence_date} onChange={(e) => setEditForm({ ...editForm, absence_date: e.target.value })} />
            <label className="form-label">수업</label>
            <select className="form-select" value={editForm.class_id} onChange={(e) => setEditForm({ ...editForm, class_id: e.target.value })}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="form-label">사유</label>
            <input className="form-input" value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} />
            <label className="form-label">보강일</label>
            <input type="date" className="form-input" value={editForm.scheduled_date} onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">시작 시각</label>
                <input type="time" className="form-input" value={editForm.scheduled_start_time} onChange={(e) => setEditForm({ ...editForm, scheduled_start_time: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">종료 시각</label>
                <input type="time" className="form-input" value={editForm.scheduled_end_time} onChange={(e) => setEditForm({ ...editForm, scheduled_end_time: e.target.value })} />
              </div>
            </div>
            <label className="form-label">보강 메모</label>
            <input className="form-input" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            <label className="form-label">보강 상태</label>
            <select className="form-select" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'pending' | 'scheduled' | 'completed' })}>
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
