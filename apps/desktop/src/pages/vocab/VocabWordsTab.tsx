/**
 * VocabWordsTab — mockup v2/09-vocab-admin.html 본체 톤으로 전면 재작성.
 *
 * 구조:
 *   - 메트릭 chip row (전체/대기/승인)
 *   - .v2-panel: toolbar (검색 + 학생/소스/등급 필터) + data-table + pagination
 *   - data-table: 단어(italic Georgia) / 뜻 / Box / 상태 / 오답 / 작업
 *
 * 비즈니스 로직 (API/state/handler) 은 기존 그대로.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, VocabWord } from '../../api';
import { toast, useConfirm } from '../../components/Toast';
import VocabWordModal from './VocabWordModal';
import type { VocabOutletContext } from '../VocabAdminPage';
import { Icon } from '../../components/icons/Icon';
import TtsButton from '../../components/TtsButton';

type GachaStudentLite = { id: string; name: string; grade?: string | null };

const POS_LABEL: Record<string, string> = {
  noun: '명사', verb: '동사', adj: '형용사', adv: '부사', prep: '전치사', conj: '접속사',
};

const GRADE_CLASS_MAP: Record<string, string> = {
  중1: 'm1', 중2: 'm2', 중3: 'm3',
  고1: 'h1', 고2: 'h2', 고3: 'h3',
};

function gradeClass(grade?: string | null): string {
  if (!grade) return '';
  return GRADE_CLASS_MAP[grade] || '';
}

const PAGE_SIZE = 50;

export default function VocabWordsTab() {
  const { setHeaderAction } = useOutletContext<VocabOutletContext>();
  const { confirm, ConfirmDialog } = useConfirm();

  const [students, setStudents] = useState<GachaStudentLite[]>([]);
  const [words, setWords] = useState<VocabWord[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  /** 학생별 오답/단어 통계 (chip row 표시용) */
  const [studentStats, setStudentStats] = useState<Record<string, { total: number; wrong: number }>>({});

  const [filterStudent, setFilterStudent] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'pending' | 'approved'>('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [offset, setOffset] = useState(0);
  /** 정렬 — 'default' | 'wrong-desc' */
  const [sortBy, setSortBy] = useState<'default' | 'wrong-desc'>('default');

  const [modalOpen, setModalOpen] = useState(false);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const selectedStudent = filterStudent ? studentMap.get(filterStudent) : null;

  // 헤더 우측 primary action
  useEffect(() => {
    setHeaderAction(
      <button type="button" className="v2-btn v2-btn--primary" onClick={() => setModalOpen(true)}>
        <Icon name="Plus" size={14} /> 단어 추가
      </button>
    );
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  // 검색 디바운스
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchQ(trimmed.length >= 2 ? trimmed : '');
      setOffset(0);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setOffset(0); }, [filterStudent, filterStatus]);

  const loadStudents = useCallback(async () => {
    try {
      const list = await api.getGachaStudents();
      setStudents((list || []).map((s: any) => ({ id: s.id, name: s.name, grade: s.grade })));
    } catch {
      setStudents([]);
    }
  }, []);

  /**
   * 학생별 단어 집계 — 정확도 위해 서버 GROUP BY 결과 사용.
   * (getVocabWords() 는 서버 pagination=50 이라 부정확)
   */
  const loadStudentStats = useCallback(async () => {
    try {
      const res = await api.getVocabStudentStats();
      const stats: Record<string, { total: number; wrong: number }> = {};
      for (const row of (res.items || [])) {
        stats[row.student_id] = { total: row.total, wrong: row.wrong };
      }
      setStudentStats(stats);
    } catch {
      setStudentStats({});
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

  useEffect(() => { loadStudents(); loadStudentStats(); }, [loadStudents, loadStudentStats]);
  useEffect(() => { loadWords(); }, [loadWords]);

  useEffect(() => {
    if (!loading && words.length === 0 && offset > 0 && total > 0) {
      setOffset(Math.max(0, offset - PAGE_SIZE));
    }
  }, [loading, words.length, offset, total]);

  const refresh = loadWords;

  const handleApprove = useCallback(async (id: string) => {
    try { await api.updateVocabWord(id, { status: 'approved' }); toast.success('승인됨'); refresh(); }
    catch (e: any) { toast.error(e?.message || '승인 실패'); }
  }, [refresh]);

  const handleReject = useCallback(async (id: string, english: string) => {
    if (!(await confirm(`'${english}' 거절할까요?\n학생 단어장에서 빠지고 복구할 수 없어요.`))) return;
    try { await api.deleteVocabWord(id); toast.success(`'${english}' 거절됨`); refresh(); }
    catch (e: any) { toast.error(e?.message || '거절하지 못했어요'); }
  }, [refresh, confirm]);

  const handleDelete = useCallback(async (id: string, english: string) => {
    if (!(await confirm(`'${english}' 삭제할까요?\n복구할 수 없어요.`))) return;
    try { await api.deleteVocabWord(id); toast.success(`'${english}' 삭제됨`); refresh(); }
    catch (e: any) { toast.error(e?.message || '삭제하지 못했어요'); }
  }, [refresh, confirm]);

  const handleBoxChange = useCallback(async (id: string, box: number) => {
    try { await api.updateVocabWord(id, { box }); refresh(); }
    catch (e: any) { toast.error(e?.message || '저장 실패'); }
  }, [refresh]);

  const clearFilters = useCallback(() => {
    setFilterStudent('');
    setFilterStatus('');
    setSearchInput('');
    setSearchQ('');
    setOffset(0);
  }, []);

  const hasFilter = !!(filterStudent || filterStatus || searchQ);
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 영단어 수강 학생만 (배정된 단어가 1개 이상) — wrong 많은 순 정렬
  const vocabStudents = useMemo(() => {
    return students
      .map((s) => ({
        ...s,
        wrong: studentStats[s.id]?.wrong || 0,
        total: studentStats[s.id]?.total || 0,
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.wrong - a.wrong);
  }, [students, studentStats]);

  // 학생 chip row — wrong 많은 순
  const studentChips = vocabStudents;

  // 정렬된 단어
  const displayWords = useMemo(() => {
    if (sortBy === 'wrong-desc') {
      return [...words].sort((a, b) => (b.wrong_count || 0) - (a.wrong_count || 0));
    }
    return words;
  }, [words, sortBy]);

  // 등급 (Box) 별 시각화 — 1~5 segment
  const renderLevelBar = (box: number) => (
    <span className="v2-level-bar" aria-label={`Box ${box}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`v2-level-bar__seg${n <= box ? ' is-on' : ''}`} />
      ))}
    </span>
  );

  return (
    <>
      {/* 학생 chip row — 학생별 보기 빠른 필터 */}
      {studentChips.length > 0 && (
        <div className="v2-student-chips" role="group" aria-label="학생별 필터">
          <button
            type="button"
            className={`v2-student-chip${!filterStudent ? ' is-active' : ''}`}
            onClick={() => setFilterStudent('')}
          >
            <Icon name="Users" size={13} />
            전체 학생
          </button>
          {studentChips.map((s) => {
            const isActive = filterStudent === s.id;
            const wrongTone = s.wrong >= 30 ? 'danger' : s.wrong >= 15 ? 'warning' : 'neutral';
            return (
              <button
                key={s.id}
                type="button"
                className={`v2-student-chip${isActive ? ' is-active' : ''}`}
                onClick={() => setFilterStudent(isActive ? '' : s.id)}
                title={`${s.name} · 단어 ${s.total}개 · 오답 ${s.wrong}개`}
              >
                <span className="v2-student-chip__name">
                  {s.name}
                  {s.grade && <span className={`grade-badge ${gradeClass(s.grade)}`} style={{ marginLeft: 4 }}>{s.grade}</span>}
                </span>
                {s.wrong > 0 && (
                  <span className={`v2-student-chip__count v2-student-chip__count--${wrongTone}`}>
                    오답 {s.wrong}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 선택된 학생 hero */}
      {selectedStudent && (
        <div className="v2-student-hero">
          <div className="v2-avatar v2-avatar--warning" style={{ width: 44, height: 44, fontSize: 14 }}>
            {selectedStudent.name.slice(0, 2)}
          </div>
          <div className="v2-student-hero__id">
            <div className="v2-student-hero__name">
              {selectedStudent.name}
              {selectedStudent.grade && (
                <span className={`grade-badge ${gradeClass(selectedStudent.grade)}`} style={{ marginLeft: 8 }}>
                  {selectedStudent.grade}
                </span>
              )}
            </div>
            <div className="v2-student-hero__meta">
              총 <strong>{studentStats[selectedStudent.id]?.total ?? '—'}</strong>단어
              {' · '}
              오답 <strong style={{ color: 'var(--danger)' }}>{studentStats[selectedStudent.id]?.wrong ?? '—'}</strong>개
            </div>
          </div>
          <button
            type="button"
            className="v2-btn v2-btn--sm"
            onClick={() => setFilterStudent('')}
          >
            <Icon name="X" size={12} /> 전체 보기
          </button>
        </div>
      )}

      {/* metric chips */}
      <div className="v2-metric-row" role="tablist" aria-label="단어 상태 필터">
        <button
          type="button"
          className={`v2-metric-chip${!filterStatus ? ' is-active' : ''}`}
          onClick={() => setFilterStatus('')}
        >전체 <strong>{counts.all.toLocaleString()}</strong></button>
        <button
          type="button"
          className={`v2-metric-chip${filterStatus === 'pending' ? ' is-active' : ''}`}
          onClick={() => setFilterStatus(filterStatus === 'pending' ? '' : 'pending')}
          disabled={counts.pending === 0 && filterStatus !== 'pending'}
        >대기 <strong>{counts.pending}</strong></button>
        <button
          type="button"
          className={`v2-metric-chip${filterStatus === 'approved' ? ' is-active' : ''}`}
          onClick={() => setFilterStatus(filterStatus === 'approved' ? '' : 'approved')}
        >승인 <strong>{counts.approved.toLocaleString()}</strong></button>
      </div>

      <div className="v2-panel">
        {/* toolbar */}
        <div className="v2-toolbar">
          <div className="v2-input-group" style={{ flex: 1, maxWidth: 320 }}>
            <Icon name="Search" size={14} />
            <input
              placeholder="단어 / 뜻 검색 (2자 이상)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <span className="v2-divider-v" />
          <label className="v2-toolbar-field">
            <span className="v2-toolbar-field__label">학생</span>
            <select
              className="v2-select"
              value={filterStudent}
              onChange={(e) => setFilterStudent(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="">전체 ({vocabStudents.length}명)</option>
              {vocabStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.grade ? ` · ${s.grade}` : ''} · {s.total}개
                </option>
              ))}
            </select>
          </label>
          <label className="v2-toolbar-field">
            <span className="v2-toolbar-field__label">정렬</span>
            <select
              className="v2-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'default' | 'wrong-desc')}
              style={{ minWidth: 130 }}
            >
              <option value="default">최신 순</option>
              <option value="wrong-desc">오답 많은 순</option>
            </select>
          </label>
          <div style={{ flex: 1 }} />
          {hasFilter && (
            <button type="button" className="v2-btn v2-btn--sm" onClick={clearFilters}>
              <Icon name="X" size={12} /> 초기화
            </button>
          )}
          <span className="v2-text-mute" style={{ fontSize: 13 }}>
            {total > 0 ? `${total.toLocaleString()}건 · ${rangeStart}-${rangeEnd}` : ''}
          </span>
        </div>

        {loading ? (
          <div className="v2-empty">단어를 불러오고 있어요</div>
        ) : words.length === 0 ? (
          <div className="v2-empty">
            <Icon name="BookMarked" size={28} />
            <div>{hasFilter ? '조건에 맞는 단어가 없어요' : '아직 단어가 없어요'}</div>
            {hasFilter ? (
              <button type="button" className="v2-btn v2-btn--secondary v2-btn--sm" onClick={clearFilters}>
                필터 초기화
              </button>
            ) : (
              <button type="button" className="v2-btn v2-btn--primary v2-btn--sm" onClick={() => setModalOpen(true)}>
                첫 단어 추가
              </button>
            )}
          </div>
        ) : (
          <table className="v2-data-table">
            <thead>
              <tr>
                <th>단어</th>
                <th>뜻</th>
                {!filterStudent && <th>학생</th>}
                <th style={{ width: 96 }}>추가자</th>
                <th>등급 (Box)</th>
                <th>상태</th>
                <th className="v2-tabular" style={{ width: 90 }}>오답</th>
                <th style={{ width: 200 }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {displayWords.map((w) => {
                const isPending = w.status === 'pending';
                const sName = studentMap.get(w.student_id)?.name || '—';
                const pos = (w as any).pos;
                const addedBy = (w as any).added_by as 'teacher' | 'student' | undefined;
                return (
                  <tr key={w.id}>
                    <td>
                      <span className="v2-word">{(w as any).english}</span>
                      <TtsButton text={(w as any).english} size={13} />
                      {pos && <span className="v2-text-mute" style={{ fontSize: 12, marginLeft: 6 }}>{POS_LABEL[pos] || pos}.</span>}
                    </td>
                    <td className="v2-meaning">{(w as any).korean}</td>
                    {!filterStudent && <td>{sName}</td>}
                    <td>
                      <span className={`v2-pill v2-pill--${addedBy === 'student' ? 'primary' : 'neutral'}`}>
                        {addedBy === 'student' ? '학생' : addedBy === 'teacher' ? '강사' : '—'}
                      </span>
                    </td>
                    <td>{renderLevelBar(w.box)}</td>
                    <td>
                      <span className={`v2-ms v2-ms--${isPending ? 'pending' : 'completed'}`}>
                        <Icon name={isPending ? 'AlertCircle' : 'CheckCircle2'} size={12} />
                        {isPending ? '대기' : '승인'}
                      </span>
                    </td>
                    <td className="v2-tabular" style={{ textAlign: 'right' }}>
                      {w.wrong_count > 0 ? (
                        <span style={{ color: w.wrong_count >= 5 ? 'var(--danger)' : 'inherit', fontWeight: 700 }}>
                          {w.wrong_count}<span className="v2-text-mute" style={{ fontWeight: 600, marginLeft: 2 }}>회</span>
                        </span>
                      ) : (
                        <span className="v2-text-mute">—</span>
                      )}
                    </td>
                    <td>
                      <div className="v2-action-cell">
                        {isPending ? (
                          <>
                            <button className="v2-btn v2-btn--primary v2-btn--sm" onClick={() => handleApprove(w.id)}>승인</button>
                            <button className="v2-btn v2-btn--sm" onClick={() => handleReject(w.id, (w as any).english)}>거절</button>
                          </>
                        ) : (
                          <>
                            <select
                              className="v2-select v2-select--sm"
                              value={w.box}
                              onChange={(e) => handleBoxChange(w.id, Number(e.target.value))}
                              aria-label="Box 변경"
                            >
                              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Box {n}</option>)}
                            </select>
                            <button
                              className="v2-btn-icon v2-btn-icon--danger"
                              onClick={() => handleDelete(w.id, (w as any).english)}
                              title="삭제"
                            >
                              <Icon name="Trash2" size={14} />
                            </button>
                          </>
                        )}
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
            <span className="v2-text-mute">{total.toLocaleString()} 단어 · {rangeStart}–{rangeEnd}</span>
            <div className="v2-pager__nav">
              <button
                className="v2-btn-icon"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <Icon name="ChevronLeft" size={14} />
              </button>
              <span className="v2-tabular" style={{ fontWeight: 700, padding: '0 8px' }}>
                {page} / {lastPage}
              </span>
              <button
                className="v2-btn-icon"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                <Icon name="ChevronRight" size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <VocabWordModal
          students={students}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); refresh(); }}
        />
      )}
      {ConfirmDialog}
    </>
  );
}
