import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUp, Check, X, Pencil, RefreshCw, Clock } from 'lucide-react';
import {
  getRecommendationQueue,
  patchRecommendation,
  type RecItem,
  type RecItemStatus,
  type RecItemUrgency,
  type RecPatchAction,
  type RecQueueStudent,
} from '../api';
import { useAuthStore } from '../store';
import './RecommendationQueuePage.css';

const URGENCY_LABEL: Record<RecItemUrgency, string> = {
  critical: '긴급',
  high: '높음',
  medium: '보통',
  low: '낮음',
};

// urgency → semantic color token (NO hardcoded hex)
const URGENCY_COLOR: Record<RecItemUrgency, string> = {
  critical: 'var(--danger)',
  high: 'var(--warning)',
  medium: 'var(--info)',
  low: 'var(--text-tertiary)',
};

const URGENCY_RANK: Record<RecItemUrgency, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

const STATUS_LABEL: Record<RecItemStatus, string> = {
  auto_served: '자동 노출',
  teacher_pending: '검토 대기',
  teacher_approved: '내줌',
  teacher_rejected: '반려',
  teacher_boosted: '끌어올림',
};

const STATUS_BADGE: Record<RecItemStatus, string> = {
  auto_served: 'badge-info',
  teacher_pending: 'badge-warning',
  teacher_approved: 'badge-success',
  teacher_rejected: 'badge-danger',
  teacher_boosted: 'badge-success',
};

const TYPE_LABEL: Record<RecItem['type'], string> = {
  gacha_deck: '가챠 덱',
  jingdari_set: '징다리 셋',
  proof: '증명',
  assignment: '과제',
  review: '복습',
  exam: '시험',
};

/** 조기경보 점수 — churn(이탈위험) + 미행동 일수가 클수록 위로.
 *  관리쌤이 *희소한 주의력을 어디 쓸지* 짚어주는 신호. */
function earlyWarningScore(s: RecQueueStudent): number {
  const maxUrgency = s.items.reduce(
    (m, it) => Math.max(m, URGENCY_RANK[it.urgency]),
    0,
  );
  return (s.risk.churn ? 1000 : 0) + s.risk.stale_days * 10 + maxUrgency;
}

export default function RecommendationQueuePage() {
  const academyId = useAuthStore((st) => st.user?.academyId as string | undefined);
  const [students, setStudents] = useState<RecQueueStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 진행 중인 아이템 액션 (낙관적 UI 중복방지)
  const [busyItems, setBusyItems] = useState<Record<string, boolean>>({});
  // 사유수정 인라인 편집 상태
  const [editing, setEditing] = useState<{ itemId: string; value: string } | null>(null);

  const reload = useCallback(async () => {
    if (!academyId) {
      setError('학원 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getRecommendationQueue(academyId);
      setStudents(res.students);
      setError(null);
    } catch (e) {
      setError((e as Error).message || '추천 큐를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 조기경보 우선순위 정렬 (이탈위험·미행동·긴급 → TOP)
  const sorted = useMemo(
    () => [...students].sort((a, b) => earlyWarningScore(b) - earlyWarningScore(a)),
    [students],
  );

  const summary = useMemo(() => {
    let pending = 0;
    let atRisk = 0;
    for (const s of students) {
      if (s.risk.churn || s.risk.stale_days >= 3) atRisk += 1;
      pending += s.items.filter((it) => it.status === 'teacher_pending').length;
    }
    return { students: students.length, pending, atRisk };
  }, [students]);

  /** 낙관적 패치: 로컬 상태 즉시 갱신 → 서버 응답으로 확정, 실패 시 롤백(reload). */
  const applyPatch = useCallback(
    async (
      studentId: string,
      item: RecItem,
      action: RecPatchAction,
      opts?: { note?: string; new_target?: string },
    ) => {
      if (busyItems[item.id]) return;
      setBusyItems((m) => ({ ...m, [item.id]: true }));

      // 낙관적 로컬 전이
      const optimistic: RecItem = { ...item };
      if (action === 'approve') optimistic.status = 'teacher_approved';
      else if (action === 'reject') optimistic.status = 'teacher_rejected';
      else if (action === 'boost') {
        optimistic.status = 'teacher_boosted';
        optimistic.rank = 1;
      } else if (action === 'edit_reason' && opts?.note != null) {
        optimistic.reason = opts.note;
      } else if (action === 'replace' && opts?.new_target != null) {
        optimistic.target_path = opts.new_target;
      }

      setStudents((prev) =>
        prev.map((s) =>
          s.erp_student_id !== studentId
            ? s
            : {
                ...s,
                items: s.items
                  .map((it) => (it.id === item.id ? optimistic : it))
                  .sort((a, b) => a.rank - b.rank),
              },
        ),
      );

      try {
        const res = await patchRecommendation(item.id, {
          action,
          note: opts?.note,
          new_target: opts?.new_target,
        });
        // 서버 확정 item으로 치환
        setStudents((prev) =>
          prev.map((s) =>
            s.erp_student_id !== studentId
              ? s
              : {
                  ...s,
                  items: s.items
                    .map((it) => (it.id === item.id ? res.item : it))
                    .sort((a, b) => a.rank - b.rank),
                },
          ),
        );
        setError(null);
      } catch (e) {
        setError((e as Error).message || '적용 실패 — 되돌립니다');
        void reload(); // 롤백
      } finally {
        setBusyItems((m) => {
          const next = { ...m };
          delete next[item.id];
          return next;
        });
      }
    },
    [busyItems, reload],
  );

  const commitEditReason = useCallback(
    (studentId: string, item: RecItem) => {
      if (!editing) return;
      const note = editing.value.trim();
      setEditing(null);
      if (!note || note === item.reason) return;
      void applyPatch(studentId, item, 'edit_reason', { note });
    },
    [editing, applyPatch],
  );

  const promptReplace = useCallback(
    (studentId: string, item: RecItem) => {
      const next = window.prompt('교체할 새 타깃 경로 (target_path)', item.target_path);
      if (next == null) return;
      const trimmed = next.trim();
      if (!trimmed || trimmed === item.target_path) return;
      void applyPatch(studentId, item, 'replace', { new_target: trimmed });
    },
    [applyPatch],
  );

  return (
    <div className="recq">
      <header className="recq-header">
        <div>
          <h1 className="recq-title">코칭 큐 · 관리쌤 콘솔</h1>
          <p className="recq-sub">
            학생별 추천을 검토하고 채찍·당근을 내립니다 · 이탈위험·미행동 우선
          </p>
        </div>
        <div className="recq-summary">
          <div className="recq-stat">
            <span className="recq-stat-label">학생</span>
            <span className="recq-stat-num">{summary.students}</span>
          </div>
          <div className="recq-stat">
            <span className="recq-stat-label">검토 대기</span>
            <span className="recq-stat-num">{summary.pending}</span>
          </div>
          <div className="recq-stat">
            <span className="recq-stat-label">조기경보</span>
            <span
              className={`recq-stat-num${summary.atRisk > 0 ? ' recq-stat-num--warn' : ''}`}
            >
              {summary.atRisk}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm with-icon"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw size={14} aria-hidden />
            새로고침
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="recq-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {loading && <div className="recq-empty">불러오는 중…</div>}
      {!loading && sorted.length === 0 && !error && (
        <div className="recq-empty">추천 큐에 학생이 없습니다</div>
      )}

      <div className="recq-list">
        {sorted.map((s) => {
          const isAlert = s.risk.churn || s.risk.stale_days >= 3;
          return (
            <section
              key={s.erp_student_id}
              className={`recq-student${isAlert ? ' recq-student--alert' : ''}`}
            >
              <header className="recq-student-head">
                <div className="recq-student-id">
                  {isAlert && (
                    <AlertTriangle
                      size={16}
                      className="recq-alert-icon"
                      aria-label="조기경보"
                    />
                  )}
                  <span className="recq-student-name">{s.name}</span>
                  {s.grade && <span className="badge badge-neutral">{s.grade}</span>}
                </div>
                <div className="recq-risk">
                  {s.risk.churn && (
                    <span className="badge badge-danger">이탈위험</span>
                  )}
                  <span
                    className={`recq-stale${s.risk.stale_days >= 3 ? ' recq-stale--warn' : ''}`}
                  >
                    <Clock size={12} aria-hidden />
                    {s.risk.stale_days}일째 미행동
                  </span>
                </div>
              </header>

              {s.items.length === 0 ? (
                <div className="recq-item-empty">추천 아이템 없음</div>
              ) : (
                <ul className="recq-items">
                  {s.items.map((item) => {
                    const busy = !!busyItems[item.id];
                    const isEditing = editing?.itemId === item.id;
                    return (
                      <li
                        key={item.id}
                        className="recq-item"
                        style={{ ['--urgency-color' as string]: URGENCY_COLOR[item.urgency] }}
                      >
                        <span className="recq-item-stripe" aria-hidden />
                        <span className="recq-item-rank" aria-label={`순위 ${item.rank}`}>
                          {item.rank}
                        </span>
                        <div className="recq-item-body">
                          <div className="recq-item-row1">
                            <span className="recq-item-icon" aria-hidden>
                              {item.icon}
                            </span>
                            <span className="recq-item-title">{item.title}</span>
                            <span className="recq-item-type">{TYPE_LABEL[item.type]}</span>
                            <span
                              className="recq-item-urgency"
                              style={{ color: URGENCY_COLOR[item.urgency] }}
                            >
                              {URGENCY_LABEL[item.urgency]}
                            </span>
                            <span className={`badge ${STATUS_BADGE[item.status]}`}>
                              {STATUS_LABEL[item.status]}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="recq-edit">
                              <input
                                className="recq-edit-input"
                                value={editing.value}
                                autoFocus
                                onChange={(e) =>
                                  setEditing({ itemId: item.id, value: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEditReason(s.erp_student_id, item);
                                  if (e.key === 'Escape') setEditing(null);
                                }}
                                maxLength={300}
                              />
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => commitEditReason(s.erp_student_id, item)}
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditing(null)}
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <p className="recq-item-reason">{item.reason}</p>
                          )}

                          <div className="recq-item-meta">
                            <span className="recq-item-path">{item.target_path}</span>
                            <span className="recq-item-score">
                              score {item.score.toFixed(2)}
                            </span>
                            {item.teacher_note && (
                              <span className="recq-item-note">“{item.teacher_note}”</span>
                            )}
                          </div>
                        </div>

                        <div className="recq-item-actions">
                          <button
                            type="button"
                            className="btn btn-present btn-sm with-icon"
                            disabled={busy || item.status === 'teacher_approved'}
                            onClick={() => applyPatch(s.erp_student_id, item, 'approve')}
                            title="내주기 (승인)"
                          >
                            <Check size={14} aria-hidden />
                            내주기
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm with-icon"
                            disabled={busy || item.status === 'teacher_rejected'}
                            onClick={() => applyPatch(s.erp_student_id, item, 'reject')}
                            title="반려 (거절)"
                          >
                            <X size={14} aria-hidden />
                            반려
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm with-icon"
                            disabled={busy || item.rank === 1}
                            onClick={() => applyPatch(s.erp_student_id, item, 'boost')}
                            title="끌어올리기 (최상위)"
                          >
                            <ArrowUp size={14} aria-hidden />
                            끌어올리기
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm with-icon"
                            disabled={busy}
                            onClick={() =>
                              setEditing({ itemId: item.id, value: item.reason })
                            }
                            title="사유수정"
                          >
                            <Pencil size={14} aria-hidden />
                            사유수정
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm with-icon"
                            disabled={busy}
                            onClick={() => promptReplace(s.erp_student_id, item)}
                            title="교체 (타깃 변경)"
                          >
                            <RefreshCw size={14} aria-hidden />
                            교체
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
