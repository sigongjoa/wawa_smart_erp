/**
 * VocabGradeTab — mockup v2/09b-vocab-grade.html 톤으로 전면 재작성.
 *
 * 구조:
 *   - metric chip row (전체/대기/응시중/제출됨)
 *   - .v2-panel: filter-bar (학생 select + 초기화) + data-table (상태·학생·문항·점수·시각·작업) + pager
 *   - score-cell: 정답/총 + 비율 pill (high/mid/low)
 *   - DetailModal — 응시 상세 (문항별 정답/오답)
 *
 * 비즈니스 로직 유지: listVocabPrintJobsPage, voidVocabPrintJob, deleteVocabPrintJob, getVocabPrintJobAnswers
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, type VocabPrintJobSummary, type VocabPrintJobAnswerRow } from '../../api';
import { toast, useConfirm } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { VocabOutletContext } from '../VocabAdminPage';
import { Icon } from '../../components/icons/Icon';

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'submitted' | 'voided';

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  in_progress: '응시중',
  submitted: '제출됨',
  voided: '무효',
};

const STATUS_TO_ATT: Record<string, 'ready' | 'running' | 'submitted' | 'voided'> = {
  pending: 'ready',
  in_progress: 'running',
  submitted: 'submitted',
  voided: 'voided',
};

const PAGE_SIZE = 50;

type GachaStudentLite = { id: string; name: string; grade?: string | null };

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function avatarChars(name: string): string {
  return name.slice(0, 2);
}

function gradeClass(grade?: string | null): string {
  if (!grade) return '';
  const m: Record<string, string> = {
    중1: 'm1', 중2: 'm2', 중3: 'm3',
    고1: 'h1', 고2: 'h2', 고3: 'h3',
  };
  return m[grade] || '';
}

export default function VocabGradeTab() {
  const { setHeaderAction } = useOutletContext<VocabOutletContext>();
  const { confirm, ConfirmDialog } = useConfirm();

  const [students, setStudents] = useState<GachaStudentLite[]>([]);
  const [jobs, setJobs] = useState<VocabPrintJobSummary[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, in_progress: 0, submitted: 0, voided: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [filterStudent, setFilterStudent] = useState('');
  const [offset, setOffset] = useState(0);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  useEffect(() => {
    setHeaderAction(
      <Link to="/vocab/policy" className="v2-btn v2-btn--secondary">
        <Icon name="Settings2" size={14} /> 정책 설정
      </Link>
    );
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

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

  useEffect(() => {
    if (!loading && jobs.length === 0 && offset > 0 && total > 0) {
      setOffset(Math.max(0, offset - PAGE_SIZE));
    }
  }, [loading, jobs.length, offset, total]);

  const handleVoid = useCallback(async (job: VocabPrintJobSummary) => {
    if (!(await confirm(`${job.student_name}의 시험지를 무효화할까요?\n학생 앱에서 더 이상 보이지 않아요.`))) return;
    try { await api.voidVocabPrintJob(job.job_id); toast.success('무효 처리됨'); loadJobs(); }
    catch (e: any) { toast.error(e?.message || '처리 실패'); }
  }, [loadJobs, confirm]);

  const handleDelete = useCallback(async (job: VocabPrintJobSummary) => {
    if (!(await confirm(`${job.student_name}의 시험지를 삭제할까요?\n채점 기록은 남지만 응시 내역이 사라집니다.`))) return;
    try { await api.deleteVocabPrintJob(job.job_id); toast.success('삭제됨'); loadJobs(); }
    catch (e: any) { toast.error(e?.message || '삭제 실패'); }
  }, [loadJobs, confirm]);

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
    return <div className="v2-empty">시험지 목록을 불러오고 있어요</div>;
  }

  return (
    <>
      {/* metric chips */}
      <div className="v2-metric-row" role="tablist">
        <button
          type="button"
          className={`v2-metric-chip${filter === 'all' ? ' is-active' : ''}`}
          onClick={() => setFilter('all')}
        >전체 <strong>{counts.all}</strong></button>
        <button
          type="button"
          className={`v2-metric-chip${filter === 'pending' ? ' is-active' : ''}`}
          onClick={() => setFilter('pending')}
          disabled={counts.pending === 0 && filter !== 'pending'}
        >대기 <strong>{counts.pending}</strong></button>
        <button
          type="button"
          className={`v2-metric-chip${filter === 'in_progress' ? ' is-active' : ''}`}
          onClick={() => setFilter('in_progress')}
          disabled={counts.in_progress === 0 && filter !== 'in_progress'}
        >응시중 <strong>{counts.in_progress}</strong></button>
        <button
          type="button"
          className={`v2-metric-chip${filter === 'submitted' ? ' is-active' : ''}`}
          onClick={() => setFilter('submitted')}
        >제출됨 <strong>{counts.submitted}</strong></button>
      </div>

      <div className="v2-panel">
        {/* filter-bar */}
        <div className="v2-filter-row">
          <select
            className="v2-select"
            value={filterStudent}
            onChange={(e) => setFilterStudent(e.target.value)}
            style={{ width: 200 }}
          >
            <option value="">전체 학생</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.grade ? ` · ${s.grade}` : ''}
              </option>
            ))}
          </select>
          {hasFilter && (
            <button type="button" className="v2-btn v2-btn--sm" onClick={clearFilters}>
              <Icon name="X" size={12} /> 필터 초기화
            </button>
          )}
          <div style={{ flex: 1 }} />
          <span className="v2-text-mute" style={{ fontSize: 13 }}>
            {total > 0 ? `${total.toLocaleString()}건 · ${rangeStart}-${rangeEnd}` : ''}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="v2-empty">
            <Icon name="ClipboardList" size={28} />
            <div>{hasFilter ? '조건에 맞는 시험지가 없어요' : '아직 응시 기록이 없어요'}</div>
            {hasFilter ? (
              <button type="button" className="v2-btn v2-btn--secondary v2-btn--sm" onClick={clearFilters}>
                필터 초기화
              </button>
            ) : (
              <Link to="/vocab/policy" className="v2-btn v2-btn--secondary v2-btn--sm">
                <Icon name="Settings2" size={12} /> 정책 설정
              </Link>
            )}
          </div>
        ) : (
          <table className="v2-data-table">
            <thead>
              <tr>
                <th style={{ width: 92 }}>상태</th>
                <th>학생</th>
                <th style={{ width: 70 }} className="v2-tabular">문항</th>
                <th style={{ width: 160 }} className="v2-tabular">점수</th>
                <th style={{ width: 140 }} className="v2-tabular">제출 시각</th>
                <th style={{ width: 160 }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const pct = j.auto_total && j.auto_correct !== null
                  ? Math.round((j.auto_correct / j.auto_total) * 100)
                  : null;
                const sMeta = studentMap.get(j.student_id);
                const sName = j.student_name || sMeta?.name || '—';
                const att = STATUS_TO_ATT[j.status] || 'ready';
                return (
                  <tr key={j.job_id}>
                    <td>
                      <span className={`v2-att v2-att--${att}`}>
                        <Icon
                          name={att === 'submitted' ? 'Check' : att === 'running' ? 'Play' : att === 'voided' ? 'X' : 'Clock'}
                          size={12}
                        />
                        {STATUS_LABEL[j.status] || j.status}
                      </span>
                    </td>
                    <td>
                      <div className="v2-cluster">
                        <div className="v2-avatar">{avatarChars(sName)}</div>
                        <div className="v2-cell-stack">
                          <span className="v2-cell-stack__primary">{sName}</span>
                          {sMeta?.grade && (
                            <span className="v2-cell-stack__meta">
                              <span className={`grade-badge ${gradeClass(sMeta.grade)}`}>{sMeta.grade}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="v2-tabular">{j.word_count}</td>
                    <td>
                      {j.status === 'submitted' && j.auto_total ? (
                        <span className="v2-score-cell">
                          <span className="v2-score-cell__main">{j.auto_correct} / {j.auto_total}</span>
                          {pct !== null && (
                            <span className={`v2-score-cell__pct v2-score-cell__pct--${pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low'}`}>
                              {pct}%
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="v2-text-mute">—</span>
                      )}
                    </td>
                    <td className="v2-tabular v2-text-mute" style={{ fontSize: 12 }}>
                      {fmtTime(j.submitted_at || j.started_at || j.created_at)}
                    </td>
                    <td>
                      <div className="v2-action-cell">
                        {j.status === 'submitted' && (
                          <button className="v2-btn v2-btn--secondary v2-btn--sm" onClick={() => setDetailJobId(j.job_id)}>
                            상세
                          </button>
                        )}
                        {j.status !== 'submitted' && j.status !== 'voided' && (
                          <button className="v2-btn v2-btn--sm" onClick={() => handleVoid(j)}>
                            무효
                          </button>
                        )}
                        {j.status === 'voided' && (
                          <span className="v2-text-mute" style={{ fontSize: 12 }}>무효</span>
                        )}
                        <button
                          className="v2-btn-icon v2-btn-icon--danger"
                          onClick={() => handleDelete(j)}
                          title="삭제"
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* pager */}
        {total > PAGE_SIZE && (
          <div className="v2-pager">
            <span className="v2-text-mute">{total.toLocaleString()}건 · {rangeStart}–{rangeEnd}</span>
            <div className="v2-pager__nav">
              <button
                className="v2-btn v2-btn--sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <Icon name="ChevronLeft" size={12} /> 이전
              </button>
              <span className="v2-tabular" style={{ fontWeight: 700, padding: '0 8px' }}>
                {page} / {lastPage}
              </span>
              <button
                className="v2-btn v2-btn--sm"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                다음 <Icon name="ChevronRight" size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {detailJobId && (
        <DetailModal
          jobId={detailJobId}
          onClose={() => setDetailJobId(null)}
        />
      )}
      {ConfirmDialog}
    </>
  );
}

// ── 응시 상세 모달 ──
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
      <Modal onClose={onClose}>
        <Modal.Header>응시 상세</Modal.Header>
        <Modal.Body>불러오는 중…</Modal.Body>
      </Modal>
    );
  }

  const { job, answers } = detail;
  const correct = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <Modal onClose={onClose} className="modal-content--wide">
      <Modal.Header>{job.student_name} · 응시 상세</Modal.Header>
      <Modal.Body>
        <div className="v2-detail-head">
          <span className="v2-detail-head__score">{correct} / {total}</span>
          <span className={`v2-score-cell__pct v2-score-cell__pct--${pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low'}`}>
            {pct}%
          </span>
          <span className="v2-text-mute" style={{ marginLeft: 'auto', fontSize: 12 }}>
            제출 · {fmtTime(job.submitted_at)}
          </span>
        </div>
        <ol className="v2-detail-list">
          {answers.map((a, i) => {
            const selectedText = a.selected_index !== null && a.choices[a.selected_index]
              ? a.choices[a.selected_index] : '미응답';
            const correctText = a.choices[a.correct_index] || '';
            return (
              <li key={a.word_id} className={`v2-detail-item ${a.correct ? 'is-ok' : 'is-ng'}`}>
                <span className="v2-detail-num">{i + 1}</span>
                <div className="v2-detail-body">
                  <span className="v2-word">{a.english}</span>
                  <div className="v2-detail-meta">
                    <span>선택: <strong>{selectedText}</strong></span>
                    {!a.correct && (
                      <span className="v2-detail-correct">정답: {correctText}</span>
                    )}
                  </div>
                </div>
                <span className={`v2-detail-mark${a.correct ? ' is-ok' : ' is-ng'}`}>
                  {a.correct ? '○' : '✕'}
                </span>
              </li>
            );
          })}
        </ol>
      </Modal.Body>
      <Modal.Footer>
        <button className="v2-btn v2-btn--secondary" onClick={onClose}>닫기</button>
      </Modal.Footer>
    </Modal>
  );
}
