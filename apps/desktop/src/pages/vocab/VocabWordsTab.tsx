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

const PAGE_SIZE = 50;

export default function VocabWordsTab() {
  const { setHeaderAction } = useOutletContext<VocabOutletContext>();

  const [students, setStudents] = useState<GachaStudentLite[]>([]);
  const [words, setWords] = useState<VocabWord[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // 필터/페이지 상태
  const [filterStudent, setFilterStudent] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'pending' | 'approved'>('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [offset, setOffset] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  // 헤더 우측 primary action
  useEffect(() => {
    setHeaderAction(
      <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
        <span aria-hidden="true">＋</span> 단어 추가
      </button>
    );
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  // 검색 입력 디바운스 (250ms, 2자 미만은 빈 값으로)
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchQ(trimmed.length >= 2 ? trimmed : '');
      setOffset(0);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 필터 변경 시 페이지 리셋
  useEffect(() => { setOffset(0); }, [filterStudent, filterStatus]);

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
      const res = await api.getVocabWordsPage({
        student_id: filterStudent || undefined,
        status: filterStatus || undefined,
        q: searchQ || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setWords(res.items || []);
      setTotal(res.pagination?.total ?? 0);
      setCounts(res.counts || { all: 0, pending: 0, approved: 0 });
    } catch (e: any) {
      toast.error(`불러오기 실패: ${e?.message || e}`);
      setWords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterStudent, filterStatus, searchQ, offset]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { loadWords(); }, [loadWords]);

  // 마지막 페이지에서 모두 삭제되어 페이지가 비면 한 단계 뒤로
  useEffect(() => {
    if (!loading && words.length === 0 && offset > 0 && total > 0) {
      setOffset(Math.max(0, offset - PAGE_SIZE));
    }
  }, [loading, words.length, offset, total]);

  const refresh = loadWords;

  const handleApprove = useCallback(async (id: string) => {
    try {
      await api.updateVocabWord(id, { status: 'approved' });
      toast.success('승인됨');
      refresh();
    } catch (e: any) {
      toast.error(e?.message || '승인 실패');
    }
  }, [refresh]);

  const handleReject = useCallback(async (id: string, english: string) => {
    if (!confirm(`'${english}' 거절할까요?\n학생 단어장에서 빠지고 복구할 수 없어요.`)) return;
    try {
      await api.deleteVocabWord(id);
      toast.success(`'${english}' 거절됨`);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || '거절하지 못했어요');
    }
  }, [refresh]);

  const handleDelete = useCallback(async (id: string, english: string) => {
    if (!confirm(`'${english}' 삭제할까요?\n복구할 수 없어요.`)) return;
    try {
      await api.deleteVocabWord(id);
      toast.success(`'${english}' 삭제됨`);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || '삭제하지 못했어요');
    }
  }, [refresh]);

  const handleBoxChange = useCallback(async (id: string, box: number) => {
    try {
      await api.updateVocabWord(id, { box });
      refresh();
    } catch (e: any) {
      toast.error(e?.message || '저장 실패');
    }
  }, [refresh]);

  const handleCategoryChange = useCallback(async (id: string, raw: string) => {
    const next = raw.trim() ? raw.trim() : null;
    try {
      await api.updateVocabWord(id, { category: next });
      refresh();
    } catch (e: any) {
      toast.error(e?.message || '유형 저장 실패');
    }
  }, [refresh]);

  const clearFilters = useCallback(() => {
    setFilterStudent('');
    setFilterStatus('');
    setSearchInput('');
    setSearchQ('');
    setOffset(0);
  }, []);

  const hasFilter = !!(filterStudent || filterStatus || searchQ);
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <>
      {/* 메트릭 (counts 기반 — 학생 필터는 적용, 상태 필터 무시) */}
      <div className="vocab-metrics" role="tablist" aria-label="상태 필터">
        <button
          type="button"
          role="tab"
          aria-selected={filterStatus === ''}
          className={`vocab-metric ${filterStatus === '' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilterStatus('')}
        >
          <span className="vocab-metric-value">{counts.all}</span>
          <span className="vocab-metric-label">전체</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterStatus === 'pending'}
          className={`vocab-metric vocab-metric--warning ${filterStatus === 'pending' ? 'vocab-metric--active' : ''} ${counts.pending === 0 ? 'vocab-metric--empty' : ''}`}
          onClick={() => setFilterStatus('pending')}
          disabled={counts.pending === 0 && filterStatus !== 'pending'}
        >
          <span className="vocab-metric-value">{counts.pending}</span>
          <span className="vocab-metric-label">대기</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterStatus === 'approved'}
          className={`vocab-metric ${filterStatus === 'approved' ? 'vocab-metric--active' : ''}`}
          onClick={() => setFilterStatus('approved')}
        >
          <span className="vocab-metric-value">{counts.approved}</span>
          <span className="vocab-metric-label">승인</span>
        </button>
      </div>

      {/* 필터 바: 학생 + 검색 + 초기화 */}
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
        <label className="filter-group">
          <span className="filter-label">검색</span>
          <input
            type="text"
            className="filter-select"
            placeholder="영어/한글 (2자 이상)"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{ minWidth: 200 }}
          />
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

      {/* 테이블 */}
      <div className="vocab-table-wrap">
        <table className="vocab-table">
          <thead>
            <tr>
              <th>단어</th>
              <th className="vocab-th-meta">메타</th>
              <th>유형</th>
              <th>상태</th>
              <th>Box</th>
              <th className="vocab-th-num">오답</th>
              <th className="vocab-th-actions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="vocab-empty">단어를 불러오고 있어요</td></tr>
            )}
            {!loading && words.length === 0 && (
              <tr><td colSpan={7} className="vocab-empty">
                <EmptyState
                  hasFilter={hasFilter}
                  totalAll={counts.all}
                  onClearFilter={clearFilters}
                  onAdd={() => setModalOpen(true)}
                />
              </td></tr>
            )}
            {!loading && words.map(w => {
              const sName = studentMap.get(w.student_id)?.name || '—';
              const addedBy = w.added_by === 'student' ? '학생' : '선생님';
              const isPending = w.status === 'pending';
              const example = w.example || '';
              const pos = w.pos;
              return (
                <tr key={w.id} data-id={w.id}>
                  <td className="vocab-cell-word" title={example || undefined}>
                    <div className="vocab-cell-english">{w.english}</div>
                    <div className="vocab-cell-korean">{w.korean}</div>
                    <div className="vocab-cell-student">{sName}</div>
                  </td>
                  <td className="vocab-cell-meta">
                    {pos && <span className="chip chip--neutral">{POS_LABEL[pos] || pos}</span>}
                    <span className={`chip chip--${w.added_by === 'student' ? 'accent' : 'outline'}`}>
                      {addedBy}
                    </span>
                    <span className="chip chip--ghost">{BLANK_LABEL[w.blank_type] || w.blank_type}</span>
                  </td>
                  <td>
                    <input
                      type="text"
                      defaultValue={w.category ?? ''}
                      list="vocab-words-category-suggest"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (w.category ?? '')) handleCategoryChange(w.id, v);
                      }}
                      placeholder="—"
                      style={{ width: 90, padding: '4px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e0' }}
                      aria-label="유형 변경"
                    />
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
                          <button className="btn btn-secondary btn-sm" onClick={() => handleReject(w.id, w.english)}>거절</button>
                        </>
                      ) : (
                        <button
                          className="btn-icon-danger"
                          onClick={() => handleDelete(w.id, w.english)}
                          title={`'${w.english}' 삭제`}
                          aria-label={`'${w.english}' 삭제`}
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

      {/* 페이지바 */}
      {total > PAGE_SIZE && (
        <div
          className="vocab-pager"
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

      <datalist id="vocab-words-category-suggest">
        <option value="기초" />
        <option value="숙어" />
        <option value="파생어" />
        <option value="동사구" />
        <option value="형용사" />
        <option value="부사" />
      </datalist>

      {modalOpen && (
        <VocabWordModal
          students={students}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); refresh(); }}
        />
      )}
    </>
  );
}

function EmptyState({
  hasFilter,
  totalAll,
  onClearFilter,
  onAdd,
}: {
  hasFilter: boolean;
  totalAll: number;
  onClearFilter: () => void;
  onAdd: () => void;
}) {
  if (hasFilter && totalAll > 0) {
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
