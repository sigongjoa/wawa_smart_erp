import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { toast } from '../components/Toast';
import { useAuthStore } from '../store';
import Modal from '../components/Modal';
import AssignmentCreateModal from '../components/assignments/AssignmentCreateModal';
import TargetDetailModal from '../components/assignments/TargetDetailModal';
import AssignmentStatusBadge from '../components/assignments/AssignmentStatusBadge';
import { errorMessage } from '../utils/errors';

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
    if (!confirm(`"${title}" 과제를 닫으시겠습니까?\n(학생은 더 이상 제출할 수 없게 됩니다)`)) return;
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
    if (!confirm(
      `"${title}" 과제를 완전 삭제하시겠습니까?\n\n⚠ 모든 제출물과 피드백도 함께 영구 삭제되며 복구할 수 없습니다.`
    )) return;
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
    if (!confirm(
      `"${studentName}"의 "${title}" 제출을 완전 삭제하시겠습니까?\n\n⚠ 제출 이미지와 피드백도 함께 영구 삭제됩니다.`
    )) return;
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
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>과제 회수·첨삭</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            수행평가·시험지를 학생에게 발행하고, 제출물을 회수해서 피드백합니다.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + 새 과제 발행
        </button>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {statsCards.map((c) => (
          <div
            key={c.key}
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 8, padding: 12,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-secondary)', marginBottom: 12 }}>
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
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
        color: active ? '#2563eb' : '#666',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontSize: 14,
      }}
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
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>;
  if (rows.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
        회신 대기 중인 제출물이 없습니다.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div
          key={r.target_id}
          style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 8, padding: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}
        >
          <div
            onClick={() => onSelect(r.target_id)}
            style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, cursor: 'pointer', minWidth: 0 }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <AssignmentStatusBadge status={r.status} size="sm" />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{KIND_LABEL[r.kind] || r.kind}</span>
              <strong style={{ fontSize: 14 }}>{r.title}</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {r.student_name} {r.student_grade && <span style={{ color: 'var(--text-tertiary)' }}>({r.student_grade})</span>}
              {r.last_submitted_at && (
                <span style={{ marginLeft: 8, color: 'var(--text-tertiary)' }}>
                  · 제출: {new Date(r.last_submitted_at).toLocaleString('ko-KR')}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {r.due_at && (
              <span style={{ fontSize: 12, color: isOverdue(r.due_at) ? 'var(--danger-text)' : 'var(--text-tertiary)' }}>
                마감: {new Date(r.due_at).toLocaleDateString('ko-KR')}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(r.target_id, r.student_name || '-', r.title); }}
              aria-label={`${r.student_name || ''} ${r.title} 삭제`}
              style={{
                padding: '6px 10px', fontSize: 12, fontWeight: 600,
                background: 'var(--bg-secondary)', color: 'var(--danger-text)',
                border: '1.5px solid #fecaca', borderRadius: 6, cursor: 'pointer',
              }}
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <select className="input" value={kindFilter} onChange={(e) => onKindFilter(e.target.value)} style={{ width: 120 }}>
          <option value="">전체 종류</option>
          <option value="perf_eval">수행평가</option>
          <option value="exam_paper">시험지</option>
          <option value="general">일반</option>
        </select>
        <select className="input" value={statusFilter} onChange={(e) => onStatusFilter(e.target.value)} style={{ width: 120 }}>
          <option value="">전체 상태</option>
          <option value="published">진행 중</option>
          <option value="closed">닫힘</option>
        </select>
        {isAdmin && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={mineOnly} onChange={(e) => onMineOnly(e.target.checked)} />
            내가 발행한 것만
          </label>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
          발행한 과제가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((a) => (
            <div
              key={a.id}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 8, padding: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              }}
            >
              <div
                onClick={() => onSelect(a.id)}
                style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, cursor: 'pointer', minWidth: 0 }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>
                    {KIND_LABEL[a.kind] || a.kind}
                  </span>
                  {a.status === 'closed' && (
                    <span style={{ fontSize: 11, color: 'var(--text-on-primary)', background: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 4 }}>
                      닫힘
                    </span>
                  )}
                  <strong style={{ fontSize: 14 }}>{a.title}</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  대상 {a.target_count}명 · 제출 {a.submitted_count} · 완료 {a.completed_count}
                  {a.due_at && (
                    <span style={{ marginLeft: 8 }}>
                      · 마감 {new Date(a.due_at).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {new Date(a.created_at).toLocaleDateString('ko-KR')}
                </span>
                {a.status === 'published' && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClose(a.id, a.title); }}
                    style={{
                      padding: '6px 10px', fontSize: 12, fontWeight: 600,
                      background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                      border: '1.5px solid #d1d5db', borderRadius: 6, cursor: 'pointer',
                    }}
                  >
                    닫기
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(a.id, a.title); }}
                  style={{
                    padding: '6px 10px', fontSize: 12, fontWeight: 600,
                    background: 'var(--bg-secondary)', color: 'var(--danger-text)',
                    border: '1.5px solid #fecaca', borderRadius: 6, cursor: 'pointer',
                  }}
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
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400, marginTop: 2 }}>
          {KIND_LABEL[assignment.kind] || assignment.kind}
          {assignment.due_at && ` · 마감 ${new Date(assignment.due_at).toLocaleString('ko-KR')}`}
          {assignment.status === 'closed' && ' · 닫힘'}
        </div>
      </Modal.Header>
      <Modal.Body>
        {assignment.instructions && (
          <div style={{ background: 'var(--bg-tertiary)', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
            {assignment.instructions}
          </div>
        )}

        <h4 style={{ margin: '8px 0', fontSize: 14 }}>학생별 현황 ({targets.length}명)</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {targets.map((t) => (
            <div
              key={t.id}
              onClick={() => onSelectTarget(t.id)}
              style={{
                border: '1px solid var(--border-secondary)', borderRadius: 6, padding: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <AssignmentStatusBadge status={t.status} size="sm" />
                <strong>{t.student_name || '-'}</strong>
                {t.student_grade && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{t.student_grade}</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
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
          className="btn btn-secondary"
          onClick={onHardDelete}
          style={{ color: 'var(--danger-text)', borderColor: 'var(--danger-surface)' }}
        >
          완전 삭제
        </button>
        {assignment.status === 'published' && (
          <button type="button" className="btn btn-secondary" onClick={onCloseAssignment}>
            과제 닫기
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-secondary" onClick={onClose}>닫기</button>
      </Modal.Footer>
    </Modal>
  );
}

function isOverdue(dueAt: string): boolean {
  try { return new Date(dueAt).getTime() < Date.now(); } catch { return false; }
}
