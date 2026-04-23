import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, type VocabPrintJobSummary, type VocabPrintJobAnswerRow } from '../../api';
import { toast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { VocabOutletContext } from '../VocabAdminPage';

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'submitted';

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  in_progress: '응시중',
  submitted: '제출됨',
  voided: '무효',
};

const STATUS_PILL_CLASS: Record<string, string> = {
  pending: 'pill--warning',
  in_progress: 'pill--primary',
  submitted: 'pill--success',
  voided: 'pill--danger',
};

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function VocabGradeTab() {
  const { setHeaderAction } = useOutletContext<VocabOutletContext>();

  const [jobs, setJobs] = useState<VocabPrintJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);

  useEffect(() => {
    setHeaderAction(
      <button type="button" className="btn btn-primary" onClick={() => setPickerOpen(true)}>
        <span aria-hidden="true">＋</span> 시험지 배정
      </button>
    );
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listVocabPrintJobs({ days: 14 });
      setJobs(list || []);
    } catch (e: any) {
      toast.error(e?.message || '목록 불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const s = { pending: 0, in_progress: 0, submitted: 0, voided: 0 };
    for (const j of jobs) { (s as any)[j.status] = ((s as any)[j.status] || 0) + 1; }
    return s;
  }, [jobs]);

  const filtered = useMemo(
    () => filter === 'all' ? jobs : jobs.filter(j => j.status === filter),
    [jobs, filter]
  );

  const handleVoid = useCallback(async (job: VocabPrintJobSummary) => {
    if (!confirm(`${job.student_name}의 시험지를 무효화할까요?\n학생 앱에서 더 이상 보이지 않아요.`)) return;
    try {
      await api.voidVocabPrintJob(job.job_id);
      toast.success('무효 처리됨');
      load();
    } catch (e: any) {
      toast.error(e?.message || '처리 실패');
    }
  }, [load]);

  const handleDelete = useCallback(async (job: VocabPrintJobSummary) => {
    if (!confirm(`${job.student_name}의 시험지를 삭제할까요?\n채점 기록은 남지만 응시 내역이 사라집니다.`)) return;
    try {
      await api.deleteVocabPrintJob(job.job_id);
      toast.success('삭제됨');
      load();
    } catch (e: any) {
      toast.error(e?.message || '삭제 실패');
    }
  }, [load]);

  if (loading && jobs.length === 0) {
    return <div className="vocab-empty">시험지 목록을 불러오고 있어요</div>;
  }

  return (
    <>
      {/* 상태 요약 필터 */}
      <div className="vocab-metrics" role="tablist" aria-label="상태 필터">
        <button
          type="button" role="tab"
          aria-selected={filter === 'all'}
          className={`vocab-metric ${filter === 'all' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <span className="vocab-metric-value">{jobs.length}</span>
          <span className="vocab-metric-label">전체</span>
        </button>
        <button
          type="button" role="tab"
          aria-selected={filter === 'pending'}
          className={`vocab-metric vocab-metric--warning ${filter === 'pending' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilter('pending')}
          disabled={stats.pending === 0 && filter !== 'pending'}
        >
          <span className="vocab-metric-value">{stats.pending}</span>
          <span className="vocab-metric-label">대기</span>
        </button>
        <button
          type="button" role="tab"
          aria-selected={filter === 'in_progress'}
          className={`vocab-metric ${filter === 'in_progress' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilter('in_progress')}
          disabled={stats.in_progress === 0 && filter !== 'in_progress'}
        >
          <span className="vocab-metric-value">{stats.in_progress}</span>
          <span className="vocab-metric-label">응시중</span>
        </button>
        <button
          type="button" role="tab"
          aria-selected={filter === 'submitted'}
          className={`vocab-metric ${filter === 'submitted' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilter('submitted')}
        >
          <span className="vocab-metric-value">{stats.submitted}</span>
          <span className="vocab-metric-label">제출됨</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="vocab-empty-state" style={{ padding: 48 }}>
          <div className="vocab-empty-state__title">시험지가 없어요</div>
          <p className="vocab-empty-state__hint">학생을 선택해 시험지를 배정해 보세요.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setPickerOpen(true)}>
            시험지 배정
          </button>
        </div>
      ) : (
        <div className="vocab-table-wrap">
          <table className="vocab-table">
            <thead>
              <tr>
                <th>상태</th>
                <th>학생</th>
                <th className="vocab-th-num">문항</th>
                <th>점수</th>
                <th>제출 시각</th>
                <th className="vocab-th-actions">작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(j => {
                const pct = j.auto_total && j.auto_correct !== null
                  ? Math.round((j.auto_correct / j.auto_total) * 100)
                  : null;
                return (
                  <tr key={j.job_id}>
                    <td>
                      <span className={`pill ${STATUS_PILL_CLASS[j.status] || ''}`}>
                        {STATUS_LABEL[j.status] || j.status}
                      </span>
                    </td>
                    <td><strong>{j.student_name}</strong></td>
                    <td className="vocab-cell-num">{j.word_count}</td>
                    <td>
                      {j.status === 'submitted' && j.auto_total ? (
                        <span className="vocab-score-inline">
                          <strong>{j.auto_correct}</strong>/{j.auto_total}
                          {pct !== null && (
                            <span className={`vocab-score-pct vocab-score-pct--${pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low'}`}>
                              {pct}%
                            </span>
                          )}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {fmtTime(j.submitted_at || j.started_at || j.created_at)}
                    </td>
                    <td>
                      <div className="vocab-row-actions">
                        {j.status === 'submitted' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setDetailJobId(j.job_id)}>
                            상세
                          </button>
                        )}
                        {j.status !== 'submitted' && j.status !== 'voided' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleVoid(j)}>
                            무효
                          </button>
                        )}
                        <button className="btn-icon-danger" onClick={() => handleDelete(j)} title="삭제" aria-label="삭제">×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pickerOpen && (
        <AssignModal
          onClose={() => setPickerOpen(false)}
          onAssigned={(n) => {
            setPickerOpen(false);
            toast.success(`${n}명에게 배정됨`);
            load();
          }}
        />
      )}

      {detailJobId && (
        <DetailModal
          jobId={detailJobId}
          onClose={() => setDetailJobId(null)}
        />
      )}
    </>
  );
}

// ── 학생 배정 모달 ──────────────────────────────────────
function AssignModal({ onClose, onAssigned }: { onClose: () => void; onAssigned: (count: number) => void; }) {
  const [students, setStudents] = useState<Array<{ id: string; name: string; grade?: string | null }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [maxWords, setMaxWords] = useState(20);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.getGachaStudents();
        setStudents((list || []).map((s: any) => ({ id: s.id, name: s.name, grade: s.grade })));
      } catch { setStudents([]); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await api.assignVocabPrint({
        student_ids: [...selected],
        max_words: maxWords,
      });
      if (res.created.length === 0) {
        toast.error('배정된 학생이 없어요 (승인된 단어 부족)');
        setBusy(false);
        return;
      }
      if (res.skipped.length > 0) {
        toast.info(`${res.skipped.length}명은 출제할 단어 부족으로 제외됨`);
      }
      onAssigned(res.created.length);
    } catch (e: any) {
      toast.error(e?.message || '배정 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} className="vocab-grade-picker-modal">
      <Modal.Header>시험지 배정</Modal.Header>
      <Modal.Body>
        <div className="vocab-grade-picker-body">
          <label className="form-field">
            <span className="form-label">학생당 단어 수</span>
            <select className="form-input" value={maxWords} onChange={e => setMaxWords(Number(e.target.value))}>
              {[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}개</option>)}
            </select>
          </label>
          <div className="form-field">
            <span className="form-label">학생 ({selected.size} 명 선택됨)</span>
            {loading ? (
              <div className="vocab-empty">불러오는 중…</div>
            ) : students.length === 0 ? (
              <div className="vocab-empty">담당 학생이 없어요</div>
            ) : (
              <ul className="vocab-grade-picker-list">
                {students.map(s => {
                  const on = selected.has(s.id);
                  return (
                    <li key={s.id}>
                      <label className={`vocab-grade-picker-item ${on ? 'is-on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggle(s.id)} />
                        <span>{s.name}</span>
                        {s.grade && <span className="vocab-grade-picker-grade">{s.grade}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="vocab-grade-picker-quick">
            <button type="button" className="btn-link" onClick={() => setSelected(new Set(students.map(s => s.id)))}>전체</button>
            <button type="button" className="btn-link" onClick={() => setSelected(new Set())}>해제</button>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>취소</button>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={busy || selected.size === 0}
        >{busy ? '배정 중…' : `${selected.size}명에게 배정`}</button>
      </Modal.Footer>
    </Modal>
  );
}

// ── 상세 모달 (문항별 breakdown) ─────────────────────────
function DetailModal({ jobId, onClose }: { jobId: string; onClose: () => void; }) {
  const [detail, setDetail] = useState<{ job: any; answers: VocabPrintJobAnswerRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.getVocabPrintJobAnswers(jobId);
        setDetail(d);
      } catch (e: any) {
        toast.error(e?.message || '불러오기 실패');
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId, onClose]);

  if (loading || !detail) {
    return (
      <Modal onClose={onClose} className="vocab-grade-detail-modal">
        <Modal.Header>응시 상세</Modal.Header>
        <Modal.Body>불러오는 중…</Modal.Body>
      </Modal>
    );
  }

  const { job, answers } = detail;
  const correct = answers.filter(a => a.correct).length;
  const total = answers.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <Modal onClose={onClose} className="vocab-grade-detail-modal">
      <Modal.Header>{job.student_name} · 응시 상세</Modal.Header>
      <Modal.Body>
        <div className="vocab-detail-head">
          <div className="vocab-detail-score">
            <span className="vocab-detail-num">{correct}</span>/<span>{total}</span>
            <span className={`vocab-score-pct vocab-score-pct--${pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low'}`} style={{ marginLeft: 10 }}>{pct}%</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            제출 · {fmtTime(job.submitted_at)}
          </div>
        </div>
        <ol className="vocab-detail-list">
          {answers.map((a, i) => {
            const selectedText = a.selected_index !== null && a.choices[a.selected_index]
              ? a.choices[a.selected_index] : '미응답';
            const correctText = a.choices[a.correct_index] || '';
            return (
              <li key={a.word_id} className={`vocab-detail-item ${a.correct ? 'is-ok' : 'is-ng'}`}>
                <span className="vocab-detail-num">{i + 1}</span>
                <div className="vocab-detail-body">
                  <div className="vocab-detail-english">{a.english}</div>
                  <div className="vocab-detail-meta">
                    <span>선택: <strong>{selectedText}</strong></span>
                    {!a.correct && <span className="vocab-detail-correct-ans">정답: {correctText}</span>}
                  </div>
                </div>
                <span className={`vocab-detail-mark ${a.correct ? 'is-ok' : 'is-ng'}`}>
                  {a.correct ? '○' : '✕'}
                </span>
              </li>
            );
          })}
        </ol>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-primary" onClick={onClose}>닫기</button>
      </Modal.Footer>
    </Modal>
  );
}
