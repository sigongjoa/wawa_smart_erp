import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, VocabWord } from '../../api';
import { toast } from '../../components/Toast';
import VocabWordModal from './VocabWordModal';

type GachaStudentLite = { id: string; name: string; grade?: string | null };

const POS_LABEL: Record<string, string> = {
  noun: '명사', verb: '동사', adj: '형용사', adv: '부사', prep: '전치사', conj: '접속사',
};

const BLANK_LABEL: Record<string, string> = {
  korean: '한글 빈칸', english: '영어 빈칸', both: '둘 다',
};

export default function VocabWordsTab() {
  const [students, setStudents] = useState<GachaStudentLite[]>([]);
  const [words, setWords] = useState<VocabWord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStudent, setFilterStudent] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'pending' | 'approved'>('');
  const [modalOpen, setModalOpen] = useState(false);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

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
      // pending 우선 정렬
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
    if (!confirm(`"${english}" 단어를 거절하시겠습니까?\n학생의 제출이 거부되고 목록에서 제거됩니다.`)) return;
    try {
      await api.deleteVocabWord(id);
      toast.success('거절되었습니다');
      loadWords();
    } catch (e: any) {
      toast.error(e?.message || '거절 실패');
    }
  }, [loadWords]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await api.deleteVocabWord(id);
      toast.success('삭제됨');
      loadWords();
    } catch (e: any) {
      toast.error(e?.message || '삭제 실패');
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

  const clickPendingShortcut = useCallback(() => {
    setFilterStudent('');
    setFilterStatus('pending');
  }, []);

  return (
    <>
      {/* 필터 바 */}
      <div className="filter-bar vocab-filter-bar">
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
          <span className="filter-label">상태</span>
          <select
            className="filter-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
          >
            <option value="">전체</option>
            <option value="pending">대기중</option>
            <option value="approved">승인됨</option>
          </select>
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => loadWords()}>새로고침</button>
        <div className="vocab-filter-spacer" />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
        >+ 단어 추가</button>
      </div>

      {/* 대기중 배너 */}
      {pendingCount > 0 && filterStatus !== 'pending' && (
        <div className="vocab-pending-banner" role="status">
          <span className="vocab-pending-banner__dot" />
          <span className="vocab-pending-banner__text">
            학생 제출 대기 <strong>{pendingCount}건</strong>
          </span>
          <button
            type="button"
            className="btn btn-secondary vocab-pending-banner__btn"
            onClick={clickPendingShortcut}
          >대기중만 보기 →</button>
        </div>
      )}

      {/* 테이블 */}
      <div className="table-wrap vocab-table-wrap">
        <table className="exam-table vocab-table">
          <thead>
            <tr>
              <th>학생</th>
              <th>영어</th>
              <th>한글</th>
              <th>품사</th>
              <th>예문</th>
              <th>제출자</th>
              <th>빈칸</th>
              <th>상태</th>
              <th>Box</th>
              <th>오답</th>
              <th style={{ width: 160 }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>불러오는 중...</td></tr>
            )}
            {!loading && words.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                해당 조건의 단어가 없습니다.
              </td></tr>
            )}
            {!loading && words.map(w => {
              const sName = studentMap.get(w.student_id)?.name || '—';
              const addedBy = (w as any).added_by === 'student' ? '학생' : '선생님';
              const isPending = w.status === 'pending';
              return (
                <tr key={w.id} data-id={w.id}>
                  <td>{sName}</td>
                  <td><strong>{(w as any).english}</strong></td>
                  <td>{(w as any).korean}</td>
                  <td>{(w as any).pos ? (POS_LABEL[(w as any).pos] || (w as any).pos) : <span className="muted">—</span>}</td>
                  <td className="vocab-td-example" title={(w as any).example || ''}>
                    {(w as any).example || <span className="muted">—</span>}
                  </td>
                  <td>
                    <span className={`pill pill--${(w as any).added_by === 'student' ? 'accent' : 'primary'}`}>
                      {addedBy}
                    </span>
                  </td>
                  <td>{BLANK_LABEL[w.blank_type] || w.blank_type}</td>
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
                    >
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Box {n}</option>)}
                    </select>
                  </td>
                  <td>{w.wrong_count}</td>
                  <td>
                    <div className="vocab-row-actions">
                      {isPending ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleApprove(w.id)}>승인</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleReject(w.id, (w as any).english)}>거절</button>
                        </>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(w.id)}>삭제</button>
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
