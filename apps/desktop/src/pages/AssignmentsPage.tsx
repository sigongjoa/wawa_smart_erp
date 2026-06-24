import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { toast, useConfirm } from '../components/Toast';
import { useAuthStore } from '../store';
import Modal from '../components/Modal';
import AssignmentCreateModal from '../components/assignments/AssignmentCreateModal';
import TargetDetailModal from '../components/assignments/TargetDetailModal';
import AssignmentStatusBadge from '../components/assignments/AssignmentStatusBadge';
import { errorMessage } from '../utils/errors';
import './AssignmentsPage.css';

const KIND_LABEL: Record<string, string> = {
  perf_eval: '수행평가',
  exam_paper: '시험지',
  general: '일반',
};

type Tab = 'inbox' | 'list';

interface Stats {
  assigned_count?: number;
  inbox_count?: number;
  resubmit_count?: number;
  completed_count?: number;
  total_count?: number;
}

export default function AssignmentsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const { confirm, ConfirmDialog } = useConfirm();

  const [tab, setTab] = useState<Tab>('inbox');
  const [stats, setStats] = useState<Stats>({});
  const [inbox, setInbox] = useState<any[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [kindFilter, setKindFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [mineOnly, setMineOnly] = useState<boolean>(!isAdmin);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [assignmentDetail, setAssignmentDetail] = useState<any | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.getAssignmentStats();
      setStats(s || {});
    } catch { /* non-critical */ }
  }, []);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.getAssignmentInbox();
      setInbox(rows || []);
    } catch (err: unknown) {
      toast.error(errorMessage(err, '인박스 로딩 실패'));
      setInbox([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.getAssignments({
        status: statusFilter || undefined,
        kind: kindFilter || undefined,
        mine: mineOnly,
      });
      setList(rows || []);
    } catch (err: unknown) {
      toast.error(errorMessage(err, '목록 로딩 실패'));
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, kindFilter, mineOnly]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'inbox') loadInbox();
    else loadList();
  }, [tab, loadInbox, loadList]);

  const openAssignmentDetail = async (id: string) => {
    setSelectedAssignmentId(id);
    setAssignmentDetail(null);
    try {
      const data = await api.getAssignment(id);
      setAssignmentDetail(data);
    } catch (err: unknown) {
      toast.error(errorMessage(err, '로딩 실패'));
      setSelectedAssignmentId(null);
    }
  };

  const closeAssignment = async (id: string, title: string) => {
    if (!(await confirm(`"${title}" 과제를 닫으시겠습니까?\n(학생은 더 이상 제출할 수 없게 됩니다)`))) return;
    try {
      await api.closeAssignment(id);
      toast.success('과제가 닫혔습니다');
      setSelectedAssignmentId(null);
      setAssignmentDetail(null);
      loadList();
      loadStats();
    } catch (err: unknown) {
      toast.error(errorMessage(err, '닫기 실패'));
    }
  };

  const hardDeleteAssignment = async (id: string, title: string) => {
    if (!(await confirm(
      `"${title}" 과제를 완전 삭제하시겠습니까?\n\n주의: 모든 제출물과 피드백도 함께 영구 삭제되며 복구할 수 없습니다.`
    ))) return;
    try {
      await api.hardDeleteAssignment(id);
      toast.success('과제가 완전 삭제되었습니다');
      setSelectedAssignmentId(null);
      setAssignmentDetail(null);
      loadList();
      loadInbox();
      loadStats();
    } catch (err: unknown) {
      toast.error(errorMessage(err, '삭제 실패'));
    }
  };

  const deleteTarget = async (targetId: string, studentName: string, title: string) => {
    if (!(await confirm(
      `"${studentName}"의 "${title}" 제출을 완전 삭제하시겠습니까?\n\n주의: 제출 이미지와 피드백도 함께 영구 삭제됩니다.`
    ))) return;
    try {
      await api.deleteAssignmentTarget(targetId);
      toast.success('삭제되었습니다');
      loadInbox();
      loadList();
      loadStats();
    } catch (err: unknown) {
      toast.error(errorMessage(err, '삭제 실패'));
    }
  };

  const statsCards = useMemo(
    () => [
      { key: 'inbox', label: '회신 대기', value: stats.inbox_count || 0, color: 'var(--info)' },
      { key: 'resubmit', label: '재제출 진행', value: stats.resubmit_count || 0, color: 'var(--danger-text)' },
      { key: 'assigned', label: '미제출', value: stats.assigned_count || 0, color: 'var(--text-tertiary)' },
      { key: 'completed', label: '완료', value: stats.completed_count || 0, color: 'var(--success)' },
    ],
    [stats]
  );

  return (
    <div className="page-container">
      {/* 헤더 */}
      <div className="page-header page-header-row">
        <div>
          <h1 className="page-title">과제 회수·첨삭</h1>
          <p className="page-description">
            수행평가·시험지를 학생에게 발행하고, 제출물을 회수해서 피드백합니다.
          </p>
        </div>
        <button className="btn btn-primary with-icon" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> 새 과제 발행
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="asn-stats-grid">
        {statsCards.map((c) => (
          <div key={c.key} className="asn-stat-card">
            <div className="asn-stat-label">{c.label}</div>
            <div className="asn-stat-value" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="asn-tabs">
        <TabButton active={tab === 'inbox'} onClick={() => setTab('inbox')}>
          회신 대기 {stats.inbox_count ? `(${stats.inbox_count})` : ''}
        </TabButton>
        <TabButton active={tab === 'list'} onClick={() => setTab('list')}>
          발행한 과제
        </TabButton>
      </div>

      {tab === 'inbox' && (
        <InboxTab
          rows={inbox}
          loading={loading}
          onSelect={(targetId) => setSelectedTargetId(targetId)}
          onDelete={deleteTarget}
        />
      )}

      {tab === 'list' && (
        <ListTab
          rows={list}
          loading={loading}
          kindFilter={kindFilter}
          statusFilter={statusFilter}
          mineOnly={mineOnly}
          isAdmin={isAdmin}
          onKindFilter={setKindFilter}
          onStatusFilter={setStatusFilter}
          onMineOnly={setMineOnly}
          onSelect={openAssignmentDetail}
          onClose={closeAssignment}
          onDelete={hardDeleteAssignment}
        />
      )}

      {/* 모달: 새 과제 발행 */}
      {showCreate && (
        <AssignmentCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { loadList(); loadStats(); setTab('list'); }}
        />
      )}

      {/* 모달: 타깃 상세 (회신) */}
      {selectedTargetId && (
        <TargetDetailModal
          targetId={selectedTargetId}
          onClose={() => setSelectedTargetId(null)}
          onChanged={() => { loadInbox(); loadStats(); }}
        />
      )}

      {/* 모달: 과제 상세 (타깃 리스트) */}
      {selectedAssignmentId && assignmentDetail && (
        <AssignmentDetailModal
          assignment={assignmentDetail}
          onClose={() => { setSelectedAssignmentId(null); setAssignmentDetail(null); }}
          onCloseAssignment={() => closeAssignment(assignmentDetail.id, assignmentDetail.title)}
          onHardDelete={() => hardDeleteAssignment(assignmentDetail.id, assignmentDetail.title)}
          onSelectTarget={(targetId) => setSelectedTargetId(targetId)}
        />
      )}
      {ConfirmDialog}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`asn-tab${active ? ' asn-tab--active' : ''}`}
    >
      {children}
    </button>
  );
}

const InboxTab = memo(function InboxTab({
  rows, loading, onSelect, onDelete,
}: {
  rows: any[]; loading: boolean;
  onSelect: (targetId: string) => void;
  onDelete: (targetId: string, studentName: string, title: string) => void;
}) {
  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        로딩 중...
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-desc">회신 대기 중인 제출물이 없습니다.</div>
      </div>
    );
  }
  return (
    <div className="asn-list">
      {rows.map((r) => (
        <div key={r.target_id} className="asn-row">
          <div onClick={() => onSelect(r.target_id)} className="asn-row-main">
            <div className="asn-row-titleline">
              <AssignmentStatusBadge status={r.status} size="sm" />
              <span className="asn-kind">{KIND_LABEL[r.kind] || r.kind}</span>
              <strong className="asn-row-title">{r.title}</strong>
            </div>
            <div className="asn-row-sub">
              {r.student_name} {r.student_grade && <span className="asn-muted">({r.student_grade})</span>}
              {r.last_submitted_at && (
                <span className="asn-muted asn-inline-gap">
                  · 제출: {new Date(r.last_submitted_at).toLocaleString('ko-KR')}
                </span>
              )}
            </div>
          </div>
          <div className="asn-row-meta">
            {r.due_at && (
              <span className={`asn-due${isOverdue(r.due_at) ? ' asn-due--overdue' : ''}`}>
                마감: {new Date(r.due_at).toLocaleDateString('ko-KR')}
              </span>
            )}
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={(e) => { e.stopPropagation(); onDelete(r.target_id, r.student_name || '-', r.title); }}
              aria-label={`${r.student_name || ''} ${r.title} 삭제`}
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});

const ListTab = memo(function ListTab({
  rows, loading, kindFilter, statusFilter, mineOnly, isAdmin,
  onKindFilter, onStatusFilter, onMineOnly, onSelect, onClose, onDelete,
}: {
  rows: any[]; loading: boolean; kindFilter: string; statusFilter: string; mineOnly: boolean; isAdmin: boolean;
  onKindFilter: (v: string) => void; onStatusFilter: (v: string) => void; onMineOnly: (v: boolean) => void;
  onSelect: (id: string) => void;
  onClose: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
}) {
  return (
    <div>
      {/* 필터 */}
      <div className="asn-filters">
        <select className="input asn-filter-select" value={kindFilter} onChange={(e) => onKindFilter(e.target.value)}>
          <option value="">전체 종류</option>
          <option value="perf_eval">수행평가</option>
          <option value="exam_paper">시험지</option>
          <option value="general">일반</option>
        </select>
        <select className="input asn-filter-select" value={statusFilter} onChange={(e) => onStatusFilter(e.target.value)}>
          <option value="">전체 상태</option>
          <option value="published">진행 중</option>
          <option value="closed">닫힘</option>
        </select>
        {isAdmin && (
          <label className="asn-checkbox-label">
            <input type="checkbox" checked={mineOnly} onChange={(e) => onMineOnly(e.target.checked)} />
            내가 발행한 것만
          </label>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          로딩 중...
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-desc">발행한 과제가 없습니다.</div>
        </div>
      ) : (
        <div className="asn-list">
          {rows.map((a) => (
            <div key={a.id} className="asn-row">
              <div onClick={() => onSelect(a.id)} className="asn-row-main">
                <div className="asn-row-titleline">
                  <span className="asn-kind-tag">
                    {KIND_LABEL[a.kind] || a.kind}
                  </span>
                  {a.status === 'closed' && (
                    <span className="badge badge-neutral">
                      닫힘
                    </span>
                  )}
                  <strong className="asn-row-title">{a.title}</strong>
                </div>
                <div className="asn-row-sub--sm">
                  대상 {a.target_count}명 · 제출 {a.submitted_count} · 완료 {a.completed_count}
                  {a.due_at && (
                    <span className="asn-inline-gap">
                      · 마감 {new Date(a.due_at).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                </div>
              </div>
              <div className="asn-row-meta">
                <span className="asn-created">
                  {new Date(a.created_at).toLocaleDateString('ko-KR')}
                </span>
                {a.status === 'published' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); onClose(a.id, a.title); }}
                  >
                    닫기
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={(e) => { e.stopPropagation(); onDelete(a.id, a.title); }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

interface AssignmentTarget {
  id: string;
  student_id: string;
  student_name?: string;
  student_grade?: string | null;
  status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  last_submitted_at?: string | null;
  submission_count?: number;
  response_count?: number;
}

interface AssignmentDetail {
  id: string;
  title: string;
  kind: string;
  status: 'draft' | 'published' | 'closed';
  instructions?: string | null;
  due_at?: string | null;
  targets?: AssignmentTarget[];
}

function AssignmentDetailModal({
  assignment, onClose, onCloseAssignment, onHardDelete, onSelectTarget,
}: {
  assignment: AssignmentDetail;
  onClose: () => void;
  onCloseAssignment: () => void;
  onHardDelete: () => void;
  onSelectTarget: (targetId: string) => void;
}) {
  const targets: AssignmentTarget[] = assignment.targets || [];
  return (
    <Modal onClose={onClose} className="modal-content--lg">
      <Modal.Header>
        {assignment.title}
        <div className="asn-modal-sub">
          {KIND_LABEL[assignment.kind] || assignment.kind}
          {assignment.due_at && ` · 마감 ${new Date(assignment.due_at).toLocaleString('ko-KR')}`}
          {assignment.status === 'closed' && ' · 닫힘'}
        </div>
      </Modal.Header>
      <Modal.Body>
        {assignment.instructions && (
          <div className="asn-instructions">
            {assignment.instructions}
          </div>
        )}

        <h4 className="asn-modal-section-title">학생별 현황 ({targets.length}명)</h4>
        <div className="asn-target-list">
          {targets.map((t) => (
            <div
              key={t.id}
              onClick={() => onSelectTarget(t.id)}
              className="asn-target-row"
            >
              <div className="asn-target-name">
                <AssignmentStatusBadge status={t.status} size="sm" />
                <strong>{t.student_name || '-'}</strong>
                {t.student_grade && <span className="asn-target-grade">{t.student_grade}</span>}
              </div>
              <div className="asn-target-meta">
                제출 {t.submission_count || 0} · 회신 {t.response_count || 0}
                {t.last_submitted_at && (
                  <span style={{ marginLeft: 6 }}>
                    {new Date(t.last_submitted_at).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          className="btn btn-danger"
          onClick={onHardDelete}
        >
          완전 삭제
        </button>
        {assignment.status === 'published' && (
          <button type="button" className="btn btn-secondary" onClick={onCloseAssignment}>
            과제 닫기
          </button>
        )}
        <div className="asn-footer-spacer" />
        <button type="button" className="btn btn-secondary" onClick={onClose}>닫기</button>
      </Modal.Footer>
    </Modal>
  );
}

function isOverdue(dueAt: string): boolean {
  try { return new Date(dueAt).getTime() < Date.now(); } catch { return false; }
}
