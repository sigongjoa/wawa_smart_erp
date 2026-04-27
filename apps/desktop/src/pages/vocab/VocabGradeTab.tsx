import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, type VocabPrintJobSummary, type VocabPrintJobAnswerRow } from '../../api';
import { toast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { VocabOutletContext } from '../VocabAdminPage';

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'submitted' | 'voided';

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

const PAGE_SIZE = 50;

type GachaStudentLite = { id: string; name: string; grade?: string | null };

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function VocabGradeTab() {
  const { setHeaderAction } = useOutletContext<VocabOutletContext>();

  const [students, setStudents] = useState<GachaStudentLite[]>([]);
  const [jobs, setJobs] = useState<VocabPrintJobSummary[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, in_progress: 0, submitted: 0, voided: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [filterStudent, setFilterStudent] = useState('');
  const [offset, setOffset] = useState(0);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  // 헤더 액션
  useEffect(() => {
    setHeaderAction(
      <Link to="/vocab/policy" className="btn btn-secondary">
        정책 설정
      </Link>
    );
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  // 필터 변경 시 페이지 리셋
  useEffect(() => { setOffset(0); }, [filter, filterStudent]);

  const loadStudents = useCallback(async () => {
    try {
      const list = await api.getGachaStudents();
      setStudents((list || []).map((s: any) => ({ id: s.id, name: s.name, grade: s.grade })));
    } catch {
      setStudents([]);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listVocabPrintJobsPage({
        status: filter === 'all' ? undefined : filter,
        student_id: filterStudent || undefined,
        days: 14,
        limit: PAGE_SIZE,
        offset,
      });
      setJobs(res.items || []);
      setTotal(res.pagination?.total ?? 0);
      setCounts(res.counts || { all: 0, pending: 0, in_progress: 0, submitted: 0, voided: 0 });
    } catch (e: any) {
      toast.error(e?.message || '목록 불러오기 실패');
      setJobs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filter, filterStudent, offset]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  // 마지막 페이지 정리
  useEffect(() => {
    if (!loading && jobs.length === 0 && offset > 0 && total > 0) {
      setOffset(Math.max(0, offset - PAGE_SIZE));
    }
  }, [loading, jobs.length, offset, total]);

  const handleVoid = useCallback(async (job: VocabPrintJobSummary) => {
    if (!confirm(`${job.student_name}의 시험지를 무효화할까요?\n학생 앱에서 더 이상 보이지 않아요.`)) return;
    try {
      await api.voidVocabPrintJob(job.job_id);
      toast.success('무효 처리됨');
      loadJobs();
    } catch (e: any) {
      toast.error(e?.message || '처리 실패');
    }
  }, [loadJobs]);

  const handleDelete = useCallback(async (job: VocabPrintJobSummary) => {
    if (!confirm(`${job.student_name}의 시험지를 삭제할까요?\n채점 기록은 남지만 응시 내역이 사라집니다.`)) return;
    try {
      await api.deleteVocabPrintJob(job.job_id);
      toast.success('삭제됨');
      loadJobs();
    } catch (e: any) {
      toast.error(e?.message || '삭제 실패');
    }
  }, [loadJobs]);

  const clearFilters = useCallback(() => {
    setFilter('all');
    setFilterStudent('');
    setOffset(0);
  }, []);

  const hasFilter = filter !== 'all' || !!filterStudent;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  if (loading && jobs.length === 0 && counts.all === 0) {
    return <div className="vocab-empty">시험지 목록을 불러오고 있어요</div>;
  }

  return (
    <>
      {/* 메트릭 (counts 기반 — 학생 필터 적용, 상태 필터 무시) */}
      <div className="vocab-metrics" role="tablist" aria-label="상태 필터">
        <button
          type="button" role="tab"
          aria-selected={filter === 'all'}
          className={`vocab-metric ${filter === 'all' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <span className="vocab-metric-value">{counts.all}</span>
          <span className="vocab-metric-label">전체</span>
        </button>
        <button
          type="button" role="tab"
          aria-selected={filter === 'pending'}
          className={`vocab-metric vocab-metric--warning ${filter === 'pending' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilter('pending')}
          disabled={counts.pending === 0 && filter !== 'pending'}
        >
          <span className="vocab-metric-value">{counts.pending}</span>
          <span className="vocab-metric-label">대기</span>
        </button>
        <button
          type="button" role="tab"
          aria-selected={filter === 'in_progress'}
          className={`vocab-metric ${filter === 'in_progress' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilter('in_progress')}
          disabled={counts.in_progress === 0 && filter !== 'in_progress'}
        >
          <span className="vocab-metric-value">{counts.in_progress}</span>
          <span className="vocab-metric-label">응시중</span>
        </button>
        <button
          type="button" role="tab"
          aria-selected={filter === 'submitted'}
          className={`vocab-metric ${filter === 'submitted' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilter('submitted')}
        >
          <span className="vocab-metric-value">{counts.submitted}</span>
          <span className="vocab-metric-label">제출됨</span>
        </button>
      </div>

      {/* 필터 바: 학생 + 초기화 + 범위 표시 */}
      <div className="vocab-filter-bar">
        <label className="filter-group">
          <span className="filter-label">학생</span>
          <select
            className="filter-select"
            value={filterStudent}
            onChange={e => setFilterStudent(e.target.value)}
          >
            <option value="">전체</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name}{s.grade ? ` · ${s.grade}` : ''}</option>
            ))}
          </select>
        </label>
        {hasFilter && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
            필터 초기화
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
          {total > 0 ? `${total.toLocaleString()}건 중 ${rangeStart}-${rangeEnd}` : ''}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="vocab-empty-state" style={{ padding: 48 }}>
          <div className="vocab-empty-state__title">
            {hasFilter ? '조건에 맞는 시험지가 없어요' : '아직 응시 기록이 없어요'}
          </div>
          <p className="vocab-empty-state__hint">
            {hasFilter
              ? '필터를 바꾸거나 초기화해보세요.'
              : '학생들이 학생 앱에서 직접 시험을 시작하면 여기에 결과가 쌓입니다.'}
          </p>
          {hasFilter ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              필터 초기화
            </button>
          ) : (
            <Link to="/vocab/policy" className="btn btn-secondary btn-sm">
              정책 설정 →
            </Link>
          )}
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
              {jobs.map(j => {
                const pct = j.auto_total && j.auto_correct !== null
                  ? Math.round((j.auto_correct / j.auto_total) * 100)
                  : null;
                const sName = j.student_name || studentMap.get(j.student_id)?.name || '—';
                return (
                  <tr key={j.job_id}>
                    <td>
                      <span className={`pill ${STATUS_PILL_CLASS[j.status] || ''}`}>
                        {STATUS_LABEL[j.status] || j.status}
                      </span>
                    </td>
                    <td><strong>{sName}</strong></td>
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

      {/* 페이지바 */}
      {total > PAGE_SIZE && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '12px 0',
            fontSize: 13,
            color: '#475569',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            ‹ 이전
          </button>
          <span>{page} / {lastPage}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            다음 ›
          </button>
        </div>
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
