import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, VocabWord } from '../../api';
import { toast } from '../../components/Toast';
import type { VocabOutletContext } from '../VocabAdminPage';

type StudentGroup = {
  studentId: string;
  studentName: string;
  wrongTotal: number;
  words: VocabWord[];
};

const POS_LABEL: Record<string, string> = {
  noun: '명사', verb: '동사', adj: '형용사', adv: '부사', prep: '전치사', conj: '접속사',
};

export default function VocabWrongTab() {
  const { setHeaderAction } = useOutletContext<VocabOutletContext>();

  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHeaderAction(null);
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [words, students] = await Promise.all([
        api.getVocabWords(),
        api.getGachaStudents().catch(() => []),
      ]);
      const nameById = new Map<string, string>((students || []).map((s: any) => [s.id, s.name]));

      const byStudent = new Map<string, StudentGroup>();
      for (const w of (words || [])) {
        if (!w.wrong_count || w.wrong_count === 0) continue;
        const sid = w.student_id;
        let g = byStudent.get(sid);
        if (!g) {
          g = {
            studentId: sid,
            studentName: nameById.get(sid) || '알 수 없음',
            wrongTotal: 0,
            words: [],
          };
          byStudent.set(sid, g);
        }
        g.words.push(w);
        g.wrongTotal += w.wrong_count;
      }

      const list = [...byStudent.values()]
        .map(g => ({
          ...g,
          words: g.words.sort((a, b) => b.wrong_count - a.wrong_count),
        }))
        .sort((a, b) => b.wrongTotal - a.wrongTotal);
      setGroups(list);
      // 기본: 첫 학생만 열어둠
      setExpanded(list.length > 0 ? new Set([list[0].studentId]) : new Set());
    } catch (e: any) {
      toast.error(e?.message || '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback((sid: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const resetWrong = useCallback(async (word: VocabWord) => {
    if (!confirm(`'${(word as any).english}' 의 오답 기록을 초기화할까요?\nBox는 1로 리셋되고 오답 수는 0이 됩니다.`)) return;
    try {
      await api.updateVocabWord(word.id, { box: 1 });
      toast.success('오답 초기화됨');
      load();
    } catch (e: any) {
      toast.error(e?.message || '처리 실패');
    }
  }, [load]);

  const topLevel = useMemo(() => {
    if (groups.length === 0) return null;
    const totalWrongWords = groups.reduce((s, g) => s + g.words.length, 0);
    const totalWrongCount = groups.reduce((s, g) => s + g.wrongTotal, 0);
    return { totalWrongWords, totalWrongCount, studentCount: groups.length };
  }, [groups]);

  if (loading) {
    return <div className="vocab-empty">오답 내역을 불러오고 있어요</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="vocab-empty-state" style={{ padding: 48 }}>
        <div className="vocab-empty-state__title">오답이 없어요 🎉</div>
        <p className="vocab-empty-state__hint">학생들이 단어를 잘 외우고 있어요.</p>
      </div>
    );
  }

  return (
    <>
      {topLevel && (
        <div className="vocab-wrong-summary">
          <span className="vocab-wrong-summary__item">
            <strong>{topLevel.studentCount}</strong>명
          </span>
          <span className="vocab-wrong-summary__sep">·</span>
          <span className="vocab-wrong-summary__item">
            오답 단어 <strong>{topLevel.totalWrongWords}</strong>개
          </span>
          <span className="vocab-wrong-summary__sep">·</span>
          <span className="vocab-wrong-summary__item">
            누적 오답 <strong>{topLevel.totalWrongCount}</strong>회
          </span>
        </div>
      )}

      <div className="vocab-wrong-groups">
        {groups.map(g => {
          const isOpen = expanded.has(g.studentId);
          return (
            <section key={g.studentId} className={`vocab-wrong-group ${isOpen ? 'vocab-wrong-group--open' : ''}`}>
              <button
                type="button"
                className="vocab-wrong-group-head"
                aria-expanded={isOpen}
                onClick={() => toggle(g.studentId)}
              >
                <span className="vocab-wrong-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                <span className="vocab-wrong-student">{g.studentName}</span>
                <span className="vocab-wrong-badge">오답 {g.words.length}개</span>
                <span className="vocab-wrong-count-sum">총 {g.wrongTotal}회</span>
              </button>

              {isOpen && (
                <ul className="vocab-wrong-list">
                  {g.words.map(w => (
                    <li key={w.id} className="vocab-wrong-item">
                      <div className="vocab-wrong-word">
                        <div className="vocab-wrong-english">{(w as any).english}</div>
                        <div className="vocab-wrong-korean">{(w as any).korean}</div>
                      </div>
                      <div className="vocab-wrong-meta">
                        {(w as any).pos && <span className="chip chip--neutral">{POS_LABEL[(w as any).pos] || (w as any).pos}</span>}
                        <span className="chip chip--ghost">Box {w.box}</span>
                      </div>
                      <div className="vocab-wrong-stat">
                        <span className="vocab-wrong-number">{w.wrong_count}</span>
                        <span className="vocab-wrong-unit">회</span>
                      </div>
                      <div className="vocab-wrong-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => resetWrong(w)}
                          title="Box 1로 초기화"
                        >재학습</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
