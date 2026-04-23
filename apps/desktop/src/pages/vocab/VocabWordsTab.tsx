import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, VocabWord } from '../../api';
import { toast } from '../../components/Toast';
import VocabWordModal from './VocabWordModal';
import type { VocabOutletContext } from '../VocabAdminPage';

type GachaStudentLite = { id: string; name: string; grade?: string | null };

const POS_LABEL: Record<string, string> = {
  noun: '명사', verb: '동사', adj: '형용사', adv: '부사', prep: '전치사', conj: '접속사',
};

const BLANK_LABEL: Record<string, string> = {
  korean: '한글 빈칸', english: '영어 빈칸', both: '둘 다',
};

export default function VocabWordsTab() {
  const { setHeaderAction } = useOutletContext<VocabOutletContext>();

  const [students, setStudents] = useState<GachaStudentLite[]>([]);
  const [words, setWords] = useState<VocabWord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStudent, setFilterStudent] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'pending' | 'approved'>('');
  const [modalOpen, setModalOpen] = useState(false);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  // 헤더 우측에 primary action 등록
  useEffect(() => {
    setHeaderAction(
      <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
        <span aria-hidden="true">＋</span> 단어 추가
      </button>
    );
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  const loadStudents = useCallback(async () => {
    try {
      const list = await api.getGachaStudents();
      setStudents((list || []).map((s: any) => ({ id: s.id, name: s.name, grade: s.grade })));
    } catch {
      setStudents([]);
    }
  }, []);

  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, pendingList] = await Promise.all([
        api.getVocabWords(filterStatus ? { status: filterStatus } : undefined),
        filterStatus === 'pending' ? Promise.resolve([]) : api.getVocabWords({ status: 'pending' }),
      ]);
      const filtered = filterStudent ? (rows || []).filter(w => w.student_id === filterStudent) : (rows || []);
      filtered.sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status === 'pending' ? -1 : 1;
      });
      setWords(filtered);
      setPendingCount(filterStatus === 'pending' ? rows.length : pendingList.length);
    } catch (e: any) {
      toast.error(`불러오기 실패: ${e?.message || e}`);
      setWords([]);
    } finally {
      setLoading(false);
    }
  }, [filterStudent, filterStatus]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { loadWords(); }, [loadWords]);

  const handleApprove = useCallback(async (id: string) => {
    try {
      await api.updateVocabWord(id, { status: 'approved' });
      toast.success('승인됨');
      loadWords();
    } catch (e: any) {
      toast.error(e?.message || '승인 실패');
    }
  }, [loadWords]);

  const handleReject = useCallback(async (id: string, english: string) => {
    if (!confirm(`'${english}' 거절할까요?\n학생 단어장에서 빠지고 복구할 수 없어요.`)) return;
    try {
      await api.deleteVocabWord(id);
      toast.success(`'${english}' 거절됨`);
      loadWords();
    } catch (e: any) {
      toast.error(e?.message || '거절하지 못했어요');
    }
  }, [loadWords]);

  const handleDelete = useCallback(async (id: string, english: string) => {
    if (!confirm(`'${english}' 삭제할까요?\n복구할 수 없어요.`)) return;
    try {
      await api.deleteVocabWord(id);
      toast.success(`'${english}' 삭제됨`);
      loadWords();
    } catch (e: any) {
      toast.error(e?.message || '삭제하지 못했어요');
    }
  }, [loadWords]);

  const handleBoxChange = useCallback(async (id: string, box: number) => {
    try {
      await api.updateVocabWord(id, { box });
      loadWords();
    } catch (e: any) {
      toast.error(e?.message || '저장 실패');
    }
  }, [loadWords]);

  const approvedCount = words.length - words.filter(w => w.status === 'pending').length;

  return (
    <>
      {/* 메트릭 필터 — 클릭하면 해당 상태로 필터 적용 */}
      <div className="vocab-metrics" role="tablist" aria-label="상태 필터">
        <button
          type="button"
          role="tab"
          aria-selected={filterStatus === ''}
          className={`vocab-metric ${filterStatus === '' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilterStatus('')}
        >
          <span className="vocab-metric-value">{words.length}</span>
          <span className="vocab-metric-label">전체</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterStatus === 'pending'}
          className={`vocab-metric vocab-metric--warning ${filterStatus === 'pending' ? 'vocab-metric--active' : ''} ${pendingCount === 0 ? 'vocab-metric--empty' : ''}`}
          onClick={() => setFilterStatus('pending')}
          disabled={pendingCount === 0 && filterStatus !== 'pending'}
        >
          <span className="vocab-metric-value">{pendingCount}</span>
          <span className="vocab-metric-label">대기</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterStatus === 'approved'}
          className={`vocab-metric ${filterStatus === 'approved' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilterStatus('approved')}
        >
          <span className="vocab-metric-value">{approvedCount}</span>
          <span className="vocab-metric-label">승인</span>
        </button>
      </div>

      {/* 학생 필터만 남김 */}
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
      </div>

      {/* 테이블 — 6열 */}
      <div className="vocab-table-wrap">
        <table className="vocab-table">
          <thead>
            <tr>
              <th>단어</th>
              <th className="vocab-th-meta">메타</th>
              <th>상태</th>
              <th>Box</th>
              <th className="vocab-th-num">오답</th>
              <th className="vocab-th-actions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="vocab-empty">단어를 불러오고 있어요</td></tr>
            )}
            {!loading && words.length === 0 && (
              <tr><td colSpan={6} className="vocab-empty">
                <EmptyState
                  hasFilter={!!(filterStudent || filterStatus)}
                  onClearFilter={() => { setFilterStudent(''); setFilterStatus(''); }}
                  onAdd={() => setModalOpen(true)}
                />
              </td></tr>
            )}
            {!loading && words.map(w => {
              const sName = studentMap.get(w.student_id)?.name || '—';
              const addedBy = (w as any).added_by === 'student' ? '학생' : '선생님';
              const isPending = w.status === 'pending';
              const example = (w as any).example || '';
              const pos = (w as any).pos;
              return (
                <tr key={w.id} data-id={w.id}>
                  <td className="vocab-cell-word" title={example || undefined}>
                    <div className="vocab-cell-english">{(w as any).english}</div>
                    <div className="vocab-cell-korean">{(w as any).korean}</div>
                    <div className="vocab-cell-student">{sName}</div>
                  </td>
                  <td className="vocab-cell-meta">
                    {pos && <span className="chip chip--neutral">{POS_LABEL[pos] || pos}</span>}
                    <span className={`chip chip--${(w as any).added_by === 'student' ? 'accent' : 'outline'}`}>
                      {addedBy}
                    </span>
                    <span className="chip chip--ghost">{BLANK_LABEL[w.blank_type] || w.blank_type}</span>
                  </td>
                  <td>
                    <span className={`pill pill--${isPending ? 'warning' : 'success'}`}>
                      {isPending ? '대기중' : '승인됨'}
                    </span>
                  </td>
                  <td>
                    <select
                      className="vocab-box-select"
                      value={w.box}
                      onChange={e => handleBoxChange(w.id, Number(e.target.value))}
                      disabled={isPending}
                      aria-label="Box 변경"
                    >
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Box {n}</option>)}
                    </select>
                  </td>
                  <td className="vocab-cell-num">
                    {w.wrong_count > 0
                      ? <span className="vocab-wrong-count">{w.wrong_count}</span>
                      : <span className="vocab-zero">—</span>}
                  </td>
                  <td>
                    <div className="vocab-row-actions">
                      {isPending ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleApprove(w.id)}>승인</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleReject(w.id, (w as any).english)}>거절</button>
                        </>
                      ) : (
                        <button
                          className="btn-icon-danger"
                          onClick={() => handleDelete(w.id, (w as any).english)}
                          title={`'${(w as any).english}' 삭제`}
                          aria-label={`'${(w as any).english}' 삭제`}
                        >×</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <VocabWordModal
          students={students}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); loadWords(); }}
        />
      )}
    </>
  );
}

function EmptyState({
  hasFilter,
  onClearFilter,
  onAdd,
}: {
  hasFilter: boolean;
  onClearFilter: () => void;
  onAdd: () => void;
}) {
  if (hasFilter) {
    return (
      <div className="vocab-empty-state">
        <div className="vocab-empty-state__title">조건에 맞는 단어가 없어요</div>
        <p className="vocab-empty-state__hint">필터를 바꾸거나 초기화해보세요.</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClearFilter}>
          필터 초기화
        </button>
      </div>
    );
  }
  return (
    <div className="vocab-empty-state">
      <div className="vocab-empty-state__title">아직 단어가 없어요</div>
      <p className="vocab-empty-state__hint">학생이 제출하거나 선생님이 직접 추가할 수 있어요.</p>
      <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
        첫 단어 추가하기
      </button>
    </div>
  );
}
