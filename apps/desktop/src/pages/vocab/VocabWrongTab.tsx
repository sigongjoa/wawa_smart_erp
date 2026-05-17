/**
 * VocabWrongTab — mockup v2/09a-vocab-wrong.html 톤으로 전면 재작성.
 *
 * 구조:
 *   - wrong-summary: 학생/오답 단어/누적 오답 3 cells
 *   - student-group: 학생별 접이식 패널 + 내부 wrong-word 행
 *
 * 비즈니스 로직 (API: getVocabWords/getGachaStudents/updateVocabWord) 유지.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, VocabWord } from '../../api';
import { toast, useConfirm } from '../../components/Toast';
import type { VocabOutletContext } from '../VocabAdminPage';
import { Icon } from '../../components/icons/Icon';

type StudentGroup = {
  studentId: string;
  studentName: string;
  studentGrade?: string | null;
  wrongTotal: number;
  words: VocabWord[];
};

const POS_LABEL: Record<string, string> = {
  noun: '명사', verb: '동사', adj: '형용사', adv: '부사', prep: '전치사', conj: '접속사',
};

function gradeClass(grade?: string | null): string {
  if (!grade) return '';
  const m: Record<string, string> = {
    중1: 'm1', 중2: 'm2', 중3: 'm3',
    고1: 'h1', 고2: 'h2', 고3: 'h3',
  };
  return m[grade] || '';
}

function avatarChars(name: string): string {
  return name.slice(0, 2);
}

export default function VocabWrongTab() {
  const { setHeaderAction } = useOutletContext<VocabOutletContext>();
  const { confirm, ConfirmDialog } = useConfirm();

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
      const studentById = new Map<string, { name: string; grade?: string | null }>(
        (students || []).map((s: any) => [s.id, { name: s.name, grade: s.grade }])
      );

      const byStudent = new Map<string, StudentGroup>();
      for (const w of (words || [])) {
        if (!w.wrong_count || w.wrong_count === 0) continue;
        const sid = w.student_id;
        let g = byStudent.get(sid);
        if (!g) {
          const meta = studentById.get(sid);
          g = {
            studentId: sid,
            studentName: meta?.name || '알 수 없음',
            studentGrade: meta?.grade ?? null,
            wrongTotal: 0,
            words: [],
          };
          byStudent.set(sid, g);
        }
        g.words.push(w);
        g.wrongTotal += w.wrong_count;
      }

      const list = [...byStudent.values()]
        .map((g) => ({
          ...g,
          words: g.words.sort((a, b) => b.wrong_count - a.wrong_count),
        }))
        .sort((a, b) => b.wrongTotal - a.wrongTotal);

      setGroups(list);
      setExpanded(list.length > 0 ? new Set([list[0].studentId]) : new Set());
    } catch (e: any) {
      toast.error(e?.message || '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback((sid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const resetWrong = useCallback(async (word: VocabWord) => {
    const english = (word as any).english;
    if (!(await confirm(`'${english}' 의 오답 기록을 초기화할까요?\nBox는 1로 리셋되고 오답 수는 0이 됩니다.`))) return;
    try {
      await api.updateVocabWord(word.id, { box: 1 });
      toast.success(`'${english}' 재학습 큐로 이동`);
      load();
    } catch (e: any) {
      toast.error(e?.message || '처리 실패');
    }
  }, [load, confirm]);

  const topLevel = useMemo(() => {
    if (groups.length === 0) return null;
    const totalWrongWords = groups.reduce((s, g) => s + g.words.length, 0);
    const totalWrongCount = groups.reduce((s, g) => s + g.wrongTotal, 0);
    return { totalWrongWords, totalWrongCount, studentCount: groups.length };
  }, [groups]);

  if (loading) {
    return <div className="v2-empty">오답 내역을 불러오고 있어요</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="v2-empty">
        <Icon name="CheckCircle2" size={32} />
        <div style={{ fontSize: 16, fontWeight: 700 }}>오답이 없어요</div>
        <div className="v2-text-mute">학생들이 단어를 잘 외우고 있어요.</div>
      </div>
    );
  }

  return (
    <>
      {topLevel && (
        <div className="v2-wrong-summary">
          <div className="v2-wrong-summary__cell">
            <div className="v2-wrong-summary__label">학생</div>
            <div className="v2-wrong-summary__value">
              {topLevel.studentCount}<span className="v2-wrong-summary__sub">명</span>
            </div>
          </div>
          <div className="v2-wrong-summary__cell">
            <div className="v2-wrong-summary__label">오답 단어</div>
            <div className="v2-wrong-summary__value">
              {topLevel.totalWrongWords}<span className="v2-wrong-summary__sub">개</span>
            </div>
          </div>
          <div className="v2-wrong-summary__cell">
            <div className="v2-wrong-summary__label">누적 오답</div>
            <div className="v2-wrong-summary__value">
              {topLevel.totalWrongCount}<span className="v2-wrong-summary__sub">회</span>
            </div>
          </div>
        </div>
      )}

      <div className="v2-student-groups">
        {groups.map((g) => {
          const isOpen = expanded.has(g.studentId);
          const wrongCount = g.words.length;
          const tone = wrongCount >= 40 ? 'danger' : wrongCount >= 25 ? 'warning' : 'neutral';
          return (
            <section key={g.studentId} className={`v2-student-group${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="v2-student-group__head"
                aria-expanded={isOpen}
                onClick={() => toggle(g.studentId)}
              >
                <Icon name="ChevronRight" size={14} className="v2-student-group__caret" />
                <div className="v2-student-group__name">
                  <div className={`v2-avatar v2-avatar--${tone}`}>{avatarChars(g.studentName)}</div>
                  <span>{g.studentName}</span>
                  {g.studentGrade && (
                    <span className={`grade-badge ${gradeClass(g.studentGrade)}`}>{g.studentGrade}</span>
                  )}
                  <span className={`v2-pill v2-pill--${tone}`}>오답 {wrongCount}개</span>
                </div>
                <div />
                <div className="v2-student-group__total">총 {g.wrongTotal}회</div>
              </button>

              {isOpen && (
                <div className="v2-student-group__body">
                  {g.words.map((w) => {
                    const pos = (w as any).pos;
                    return (
                      <div key={w.id} className="v2-wrong-word">
                        <span className="v2-word">{(w as any).english}</span>
                        <span className="v2-wrong-word__ko">{(w as any).korean}</span>
                        <span className="v2-pill v2-pill--neutral">{pos ? POS_LABEL[pos] || pos : '품사'}</span>
                        <span className="v2-pill v2-pill--neutral">Box {w.box}</span>
                        <div className="v2-wrong-word__actions">
                          <span className="v2-wrong-word__count">{w.wrong_count}회</span>
                          <button
                            type="button"
                            className="v2-btn v2-btn--sm"
                            onClick={() => resetWrong(w)}
                            title="Box 1로 초기화"
                          >
                            <Icon name="RotateCcw" size={12} /> 재학습
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {ConfirmDialog}
    </>
  );
}
