import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuthStore } from '../store';
import { toast, useConfirm } from '../components/Toast';

interface Notice {
  id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: number;
  due_date: string | null;
  author_name: string;
  read_count: number;
  total_users: number;
  is_read: number;
  created_at: string;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  assigned_to_name: string;
  assigned_by_name: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  notice_title: string | null;
  created_at: string;
}

interface Teacher {
  id: string;
  name: string;
  role: string;
}

const CATEGORIES: Record<string, { label: string; color: string; bg: string }> = {
  general: { label: '일반', color: '#5a5550', bg: '#eae7e2' },
  education: { label: '의무교육', color: '#c62828', bg: '#fce4ec' },
  exam: { label: '정기고사', color: '#1565c0', bg: '#e3f2fd' },
  promotion: { label: '홍보', color: '#2e7d32', bg: '#e8f5e9' },
  meeting: { label: '회의', color: '#e65100', bg: '#fff3e0' },
};

function getDday(dueDate: string | null): { text: string; urgency: string } | null {
  if (!dueDate) return null;
  const diff = Math.ceil((new Date(dueDate + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (diff < 0) return { text: `D+${Math.abs(diff)}`, urgency: 'overdue' };
  if (diff === 0) return { text: 'D-Day', urgency: 'urgent' };
  if (diff <= 3) return { text: `D-${diff}`, urgency: 'urgent' };
  if (diff <= 7) return { text: `D-${diff}`, urgency: 'soon' };
  return { text: `D-${diff}`, urgency: 'normal' };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function BoardPage() {
  const user = useAuthStore((s) => s.user);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [myActions, setMyActions] = useState<ActionItem[]>([]);
  const [allActions, setAllActions] = useState<ActionItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // 공지 작성 모달
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', category: 'general', isPinned: false, dueDate: '' });
  const [actionDrafts, setActionDrafts] = useState<Array<{ title: string; assignedTo: string; dueDate: string }>>([]);
  const [saving, setSaving] = useState(false);

  // 액션 추가 모달
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionForm, setActionForm] = useState({ title: '', assignedTo: '', dueDate: '', description: '' });

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [n, ma, aa, t] = await Promise.all([
        api.getNotices(),
        api.getMyActions(),
        api.getActions(),
        api.getBoardTeachers(),
      ]);
      setNotices(n || []);
      setMyActions(ma || []);
      setAllActions(aa || []);
      setTeachers(t || []);
    } catch (err) {
      const msg = (err as Error).message || '보드 데이터를 불러오지 못했습니다';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 공지 읽음 처리
  const handleReadNotice = async (id: string) => {
    try {
      await api.markNoticeRead(id);
      setNotices((prev) => prev.map((n) => n.id === id ? { ...n, is_read: 1, read_count: n.read_count + 1 } : n));
    } catch { /* ignore */ }
  };

  // 공지 작성
  const handleCreateNotice = async () => {
    if (!noticeForm.title.trim()) return;
    setSaving(true);
    try {
      await api.createNotice({
        ...noticeForm,
        isPinned: noticeForm.isPinned,
        dueDate: noticeForm.dueDate || undefined,
        actionItems: actionDrafts.filter((d) => d.title && d.assignedTo).map((d) => ({
          title: d.title,
          assignedTo: d.assignedTo,
          dueDate: d.dueDate || undefined,
        })),
      });
      setShowNoticeModal(false);
      setNoticeForm({ title: '', content: '', category: 'general', isPinned: false, dueDate: '' });
      setActionDrafts([]);
      loadData();
    } catch (err) {
      toast.error('작성 실패: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 액션 완료 토글
  const handleToggleAction = async (action: ActionItem) => {
    const newStatus = action.status === 'completed' ? 'pending' : 'completed';
    try {
      await api.updateAction(action.id, { status: newStatus });
      loadData();
    } catch { /* ignore */ }
  };

  // 독립 액션 추가
  const handleCreateAction = async () => {
    if (!actionForm.title.trim() || !actionForm.assignedTo) return;
    setSaving(true);
    try {
      await api.createAction({
        title: actionForm.title,
        assignedTo: actionForm.assignedTo,
        dueDate: actionForm.dueDate || undefined,
        description: actionForm.description || undefined,
      });
      setShowActionModal(false);
      setActionForm({ title: '', assignedTo: '', dueDate: '', description: '' });
      loadData();
    } catch (err) {
      toast.error('추가 실패: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  // 공지 삭제
  const handleDeleteNotice = async (id: string) => {
    const ok = await confirmDialog('이 공지를 삭제하시겠습니까?');
    if (!ok) return;
    try {
      await api.deleteNotice(id);
      loadData();
    } catch { /* ignore */ }
  };

  // 할일 삭제
  const handleDeleteAction = async (action: ActionItem) => {
    const ok = await confirmDialog(`"${action.title}" 할일을 삭제하시겠습니까?`);
    if (!ok) return;
    try {
      await api.deleteAction(action.id);
      toast.success('할일을 삭제했습니다');
      loadData();
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  };

  // 고정 토글 (admin 전용)
  const handleTogglePin = async (notice: Notice) => {
    if (user?.role !== 'admin') {
      toast.error('공지 고정/해제는 관리자만 가능합니다');
      return;
    }
    try {
      await api.updateNotice(notice.id, { isPinned: !notice.is_pinned });
      loadData();
    } catch (err) {
      toast.error('고정 상태 변경 실패: ' + (err as Error).message);
    }
  };

  // 할일 수정 모달
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [editActionForm, setEditActionForm] = useState({ title: '', assignedTo: '', dueDate: '' });

  const openEditAction = (a: ActionItem) => {
    setEditingAction(a);
    setEditActionForm({ title: a.title, assignedTo: a.assigned_to, dueDate: a.due_date || '' });
  };

  const handleUpdateAction = async () => {
    if (!editingAction) return;
    if (!editActionForm.title.trim() || !editActionForm.assignedTo) return;
    const today = new Date().toISOString().slice(0, 10);
    if (editActionForm.dueDate && editActionForm.dueDate < today) {
      toast.error('마감일은 오늘 이후여야 합니다');
      return;
    }
    try {
      await api.updateAction(editingAction.id, {
        title: editActionForm.title,
        assignedTo: editActionForm.assignedTo,
        dueDate: editActionForm.dueDate || undefined,
      });
      toast.success('할일을 수정했습니다');
      setEditingAction(null);
      loadData();
    } catch (err) {
      toast.error('수정 실패: ' + (err as Error).message);
    }
  };

  const pinnedNotices = notices.filter((n) => n.is_pinned);
  const fourteenDaysAgo = Date.now() - 14 * 86400000;
  const recentNotices = notices.filter(
    (n) => !n.is_pinned && new Date(n.created_at).getTime() >= fourteenDaysAgo
  );
  const pendingActions = myActions.filter((a) => a.status !== 'completed');
  const completedActions = myActions.filter((a) => a.status === 'completed');
  const allPending = allActions.filter((a) => a.status !== 'completed');

  return (
    <div className="board-page">
      <div className="board-header">
        <h2 className="page-title">보드</h2>
        <div className="board-header-actions">
          <button className="btn btn-sm btn-secondary" onClick={() => setShowActionModal(true)}>
            + 할일
          </button>
          <button className="btn btn-primary" onClick={() => setShowNoticeModal(true)}>
            + 공지 작성
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rpt-loading" role="status"><div className="rpt-spinner" /><span>로딩 중...</span></div>
      ) : (
        <div className="board-layout">
          {/* ═══ 좌측: 고정 공지 + 내 할일 ═══ */}
          <div className="board-main">
            {/* 고정 공지 */}
            {pinnedNotices.length > 0 && (
              <section className="board-section">
                <div className="board-section-title">고정 공지</div>
                <div className="board-cards">
                  {pinnedNotices.map((n) => {
                    const cat = CATEGORIES[n.category] || CATEGORIES.general;
                    const dday = getDday(n.due_date);
                    return (
                      <article
                        key={n.id}
                        className={`board-card board-card--pinned ${!n.is_read ? 'board-card--unread' : ''}`}
                        role={!n.is_read ? 'button' : undefined}
                        tabIndex={!n.is_read ? 0 : undefined}
                        onClick={() => !n.is_read && handleReadNotice(n.id)}
                        onKeyDown={(e) => { if (!n.is_read && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleReadNotice(n.id); } }}
                        aria-label={`${n.title} — ${!n.is_read ? '읽지 않음, 클릭하여 읽음 처리' : '읽음'}`}
                      >
                        <div className="board-card-top">
                          <span className="board-cat" style={{ color: cat.color, background: cat.bg }}>{cat.label}</span>
                          {dday && <span className={`board-dday board-dday--${dday.urgency}`}>{dday.text}</span>}
                          {user?.role === 'admin' && <button className="board-pin-btn" onClick={(e) => { e.stopPropagation(); handleTogglePin(n); }} aria-label="고정 해제">고정 해제</button>}
                          <button className="board-del-btn" onClick={(e) => { e.stopPropagation(); handleDeleteNotice(n.id); }} aria-label={`${n.title} 삭제`}>×</button>
                        </div>
                        <div className="board-card-title">{n.title}</div>
                        {n.content && <div className="board-card-content">{n.content}</div>}
                        <div className="board-card-meta">
                          <span>읽음: {n.read_count}/{n.total_users}명</span>
                          <span>{n.author_name} · {formatDate(n.created_at)}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 내 할일 */}
            <section className="board-section">
              <div className="board-section-title">내 할일 <span className="board-count">{pendingActions.length}</span></div>
              {pendingActions.length === 0 && completedActions.length === 0 ? (
                <div className="board-empty">할당된 할일이 없습니다</div>
              ) : (
                <div className="board-action-list">
                  {pendingActions.map((a) => {
                    const dday = getDday(a.due_date);
                    return (
                      <div key={a.id} className="board-action-row">
                        <button className="board-check" onClick={() => handleToggleAction(a)} aria-label={`${a.title} (${a.due_date || '기한없음'}) 완료 처리`}>☐</button>
                        <div className="board-action-info">
                          <span className="board-action-title">{a.title}</span>
                          {a.notice_title && <span className="board-action-notice">← {a.notice_title}</span>}
                        </div>
                        {dday && <span className={`board-dday board-dday--${dday.urgency}`}>{dday.text}</span>}
                        {a.due_date && <span className="board-action-due">{a.due_date}</span>}
                        <button className="board-edit-btn" onClick={() => openEditAction(a)} aria-label={`${a.title} (${a.due_date || '기한없음'}) 수정`}>✎</button>
                        <button className="board-del-btn" onClick={() => handleDeleteAction(a)} aria-label={`${a.title} (${a.due_date || '기한없음'}) 삭제`}>×</button>
                      </div>
                    );
                  })}
                  {completedActions.slice(0, 5).map((a) => (
                    <div key={a.id} className="board-action-row board-action-row--done">
                      <button className="board-check board-check--done" onClick={() => handleToggleAction(a)} aria-label={`${a.title} (${a.completed_at ? formatDate(a.completed_at) : ''}) 미완료로 되돌리기`}>☑</button>
                      <span className="board-action-title board-action-title--done">{a.title}</span>
                      {a.completed_at && <span className="board-action-due">{formatDate(a.completed_at)}</span>}
                      <button className="board-del-btn" onClick={() => handleDeleteAction(a)} aria-label={`${a.title} (완료: ${a.completed_at ? formatDate(a.completed_at) : ''}) 삭제`}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 전체 진행 현황 (원장님 뷰) */}
            {allPending.length > 0 && (
              <section className="board-section">
                <div className="board-section-title">전체 미완료 <span className="board-count">{allPending.length}</span></div>
                <div className="board-action-list">
                  {allPending.map((a) => {
                    const dday = getDday(a.due_date);
                    const canDelete = user?.role === 'admin' || a.assigned_to === user?.id;
                    return (
                      <div key={a.id} className="board-action-row">
                        <span className="board-action-assignee">{a.assigned_to_name}</span>
                        <span className="board-action-title">{a.title}</span>
                        {dday && <span className={`board-dday board-dday--${dday.urgency}`}>{dday.text}</span>}
                        {canDelete && (
                          <button className="board-del-btn" onClick={() => handleDeleteAction(a)} aria-label={`${a.assigned_to_name}의 ${a.title} (${a.due_date || '기한없음'}) 삭제`}>×</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* ═══ 우측: 최근 공지 ═══ */}
          <div className="board-side">
            <div className="board-section-title">최근 공지</div>
            {recentNotices.length === 0 ? (
              <div className="board-empty">공지가 없습니다</div>
            ) : (
              <div className="board-notice-list">
                {recentNotices.map((n) => {
                  const cat = CATEGORIES[n.category] || CATEGORIES.general;
                  return (
                    <article
                      key={n.id}
                      className={`board-notice-item ${!n.is_read ? 'board-notice-item--unread' : ''}`}
                      role={!n.is_read ? 'button' : undefined}
                      tabIndex={!n.is_read ? 0 : undefined}
                      onClick={() => !n.is_read && handleReadNotice(n.id)}
                      onKeyDown={(e) => { if (!n.is_read && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleReadNotice(n.id); } }}
                    >
                      <div className="board-notice-item-top">
                        <span className="board-cat board-cat--sm" style={{ color: cat.color, background: cat.bg }}>{cat.label}</span>
                        <span className="board-notice-date">{formatDate(n.created_at)}</span>
                        {user?.role === 'admin' && <button className="board-pin-btn" onClick={(e) => { e.stopPropagation(); handleTogglePin(n); }} aria-label="고정">고정</button>}
                        <button className="board-del-btn" onClick={(e) => { e.stopPropagation(); handleDeleteNotice(n.id); }} aria-label={`${n.title} 삭제`}>×</button>
                      </div>
                      <div className="board-notice-item-title">{n.title}</div>
                      {n.content && <div className="board-notice-item-body">{n.content.slice(0, 80)}{n.content.length > 80 ? '...' : ''}</div>}
                      <div className="board-notice-item-meta">{n.author_name} · 읽음 {n.read_count}/{n.total_users}</div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {ConfirmDialog}

      {/* ═══ 공지 작성 모달 ═══ */}
      {showNoticeModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="공지 작성"
          onClick={() => setShowNoticeModal(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowNoticeModal(false); }}
        >
          <div className="modal-content modal-board" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">공지 작성</h3>
            <div className="modal-body">
              <div className="form-row">
                <select className="form-select" value={noticeForm.category} onChange={(e) => setNoticeForm((p) => ({ ...p, category: e.target.value }))}>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {user?.role === 'admin' && (
                  <label className="form-checkbox">
                    <input type="checkbox" checked={noticeForm.isPinned} onChange={(e) => setNoticeForm((p) => ({ ...p, isPinned: e.target.checked }))} />
                    고정
                  </label>
                )}
              </div>
              <input className="form-input" placeholder="제목" aria-label="공지 제목" value={noticeForm.title} onChange={(e) => setNoticeForm((p) => ({ ...p, title: e.target.value }))} />
              <textarea className="form-textarea" placeholder="내용 (선택)" aria-label="공지 내용" rows={3} value={noticeForm.content} onChange={(e) => setNoticeForm((p) => ({ ...p, content: e.target.value }))} />
              <div className="form-row">
                <label className="form-label">기한</label>
                <input type="date" className="form-input form-input--sm" min={new Date().toISOString().slice(0, 10)} value={noticeForm.dueDate} onChange={(e) => setNoticeForm((p) => ({ ...p, dueDate: e.target.value }))} />
              </div>

              {/* 액션 아이템 추가 */}
              <div className="form-divider" />
              <div className="form-row">
                <span className="form-label">액션 아이템</span>
                <button className="btn btn-sm btn-secondary" onClick={() => setActionDrafts((p) => [...p, { title: '', assignedTo: '', dueDate: '' }])}>+ 추가</button>
              </div>
              {actionDrafts.map((draft, i) => (
                <div key={i} className="form-action-draft">
                  <input className="form-input form-input--sm" placeholder="할일" value={draft.title} onChange={(e) => { const d = [...actionDrafts]; d[i].title = e.target.value; setActionDrafts(d); }} />
                  <select className="form-select form-select--sm" value={draft.assignedTo} onChange={(e) => { const d = [...actionDrafts]; d[i].assignedTo = e.target.value; setActionDrafts(d); }}>
                    <option value="">담당자</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input type="date" className="form-input form-input--xs" min={new Date().toISOString().slice(0, 10)} value={draft.dueDate} onChange={(e) => { const d = [...actionDrafts]; d[i].dueDate = e.target.value; setActionDrafts(d); }} />
                  <button className="btn-icon" onClick={() => setActionDrafts((p) => p.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNoticeModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleCreateNotice} disabled={saving || !noticeForm.title.trim()}>
                {saving ? '저장 중...' : '작성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 할일 추가 모달 ═══ */}
      {showActionModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="할일 추가"
          onClick={() => setShowActionModal(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowActionModal(false); }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">할일 추가</h3>
            <div className="modal-body">
              <input className="form-input" placeholder="할일 제목" aria-label="할일 제목" value={actionForm.title} onChange={(e) => setActionForm((p) => ({ ...p, title: e.target.value }))} />
              <select className="form-select" aria-label="담당자 선택" value={actionForm.assignedTo} onChange={(e) => setActionForm((p) => ({ ...p, assignedTo: e.target.value }))}>
                <option value="">담당자 선택</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input type="date" className="form-input" aria-label="마감일" min={new Date().toISOString().slice(0, 10)} value={actionForm.dueDate} onChange={(e) => setActionForm((p) => ({ ...p, dueDate: e.target.value }))} />
              <textarea className="form-textarea" placeholder="설명 (선택)" aria-label="할일 설명" rows={2} value={actionForm.description} onChange={(e) => setActionForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowActionModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleCreateAction} disabled={saving || !actionForm.title.trim() || !actionForm.assignedTo}>
                {saving ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 할일 수정 모달 ═══ */}
      {editingAction && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="할일 수정"
          onClick={() => setEditingAction(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditingAction(null); }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">할일 수정</h3>
            <div className="modal-body">
              <input className="form-input" placeholder="할일 제목" aria-label="할일 제목" value={editActionForm.title} onChange={(e) => setEditActionForm((p) => ({ ...p, title: e.target.value }))} />
              <select className="form-select" aria-label="담당자 선택" value={editActionForm.assignedTo} onChange={(e) => setEditActionForm((p) => ({ ...p, assignedTo: e.target.value }))}>
                <option value="">담당자 선택</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input type="date" className="form-input" aria-label="마감일" min={new Date().toISOString().slice(0, 10)} value={editActionForm.dueDate} onChange={(e) => setEditActionForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingAction(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleUpdateAction} disabled={!editActionForm.title.trim() || !editActionForm.assignedTo}>저장</button>
            </div>
          </div>
        </div>
      )}

      {loadError && (
        <div className="board-error-banner" role="alert">
          <span>보드 데이터 로드 실패: {loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>다시 시도</button>
        </div>
      )}
    </div>
  );
}
