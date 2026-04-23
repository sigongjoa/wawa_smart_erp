import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, VocabWord } from '../../api';
import { toast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { VocabOutletContext } from '../VocabAdminPage';

const PRINT_JOB_KEY = 'printJob';
const SIX_HOURS = 6 * 60 * 60 * 1000;
const BLANK_LABEL: Record<string, string> = {
  korean: '한글 빈칸', english: '영어 빈칸', both: '둘 다',
};

type GradeValue = true | false | null;

interface Part1Item {
  id: string;
  english: string;
  korean: string;
  blank_type: VocabWord['blank_type'];
}

interface Job {
  studentId: string;
  studentName: string;
  jobId?: string;
  part1: Part1Item[];
}

interface PrintJob {
  jobs: Job[];
  createdAt: number;
}

type GradeMap = Record<string, GradeValue>; // "p1_0" -> true/false/null

function loadPrintJob(): PrintJob | null {
  try {
    const raw = localStorage.getItem(PRINT_JOB_KEY) || sessionStorage.getItem(PRINT_JOB_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.jobs?.length) return null;
    return obj as PrintJob;
  } catch { return null; }
}

function makeInitialGrades(job: Job): GradeMap {
  const g: GradeMap = {};
  job.part1.forEach((_, i) => { g[`p1_${i}`] = null; });
  return g;
}

export default function VocabGradeTab() {
  const { setHeaderAction } = useOutletContext<VocabOutletContext>();

  const [printJob, setPrintJob] = useState<PrintJob | null>(() => loadPrintJob());
  const [gradesAll, setGradesAll] = useState<GradeMap[]>(() => (loadPrintJob()?.jobs ?? []).map(makeInitialGrades));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [studentPicker, setStudentPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const isExpired = useMemo(() => {
    if (!printJob?.createdAt) return false;
    return Date.now() - printJob.createdAt > SIX_HOURS;
  }, [printJob]);

  // 헤더에 액션: "시험지 새로 만들기"
  useEffect(() => {
    setHeaderAction(
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setStudentPicker(true)}
      >
        <span aria-hidden="true">＋</span> 시험지 만들기
      </button>
    );
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  const reload = useCallback(() => {
    const pj = loadPrintJob();
    setPrintJob(pj);
    setGradesAll((pj?.jobs ?? []).map(makeInitialGrades));
    setCurrentIdx(0);
  }, []);

  const clearPrintJob = useCallback(() => {
    if (!confirm('지금 채점 중인 시험지를 삭제할까요?\n채점 진행 상황이 사라져요.')) return;
    localStorage.removeItem(PRINT_JOB_KEY);
    sessionStorage.removeItem(PRINT_JOB_KEY);
    setPrintJob(null);
    setGradesAll([]);
    setCurrentIdx(0);
  }, []);

  const currentJob = printJob?.jobs[currentIdx] ?? null;
  const currentGrades = gradesAll[currentIdx] ?? {};

  const setGrade = useCallback((key: string, value: GradeValue) => {
    setGradesAll(prev => {
      const next = prev.slice();
      next[currentIdx] = { ...next[currentIdx], [key]: value };
      return next;
    });
  }, [currentIdx]);

  const score = useCallback((idx: number) => {
    const g = gradesAll[idx] ?? {};
    const total = Object.keys(g).length;
    const correct = Object.values(g).filter(v => v === true).length;
    const graded = Object.values(g).filter(v => v !== null).length;
    return { total, correct, graded };
  }, [gradesAll]);

  const handleSave = useCallback(async () => {
    if (!currentJob) return;
    const toUpdate = currentJob.part1
      .map((w, i) => ({ id: w.id, correct: currentGrades[`p1_${i}`] }))
      .filter(item => item.id && item.correct !== null) as Array<{ id: string; correct: boolean }>;

    if (toUpdate.length === 0) {
      toast.error('먼저 O/X로 채점해 주세요');
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        toUpdate.map(item =>
          api.updateVocabWord(item.id, { box: item.correct ? 5 : 1 })
        )
      );
      const o = toUpdate.filter(t => t.correct).length;
      const x = toUpdate.length - o;
      toast.success(`${currentJob.studentName} 저장 · 정답 ${o} · 오답 ${x}`);
    } catch (e: any) {
      toast.error(e?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  }, [currentJob, currentGrades]);

  // ── Render: Empty state ──
  if (!printJob) {
    return (
      <>
        <div className="vocab-grade-empty">
          <h3 className="vocab-grade-empty-title">아직 채점할 시험지가 없어요</h3>
          <p className="vocab-grade-empty-hint">
            학생을 골라 시험지를 만들면 이곳에서 O/X 채점하고 단어장 Box에 반영할 수 있어요.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStudentPicker(true)}
          >시험지 만들기</button>
        </div>
        {studentPicker && (
          <PickStudentsModal
            onClose={() => setStudentPicker(false)}
            onCreated={(pj) => {
              localStorage.setItem(PRINT_JOB_KEY, JSON.stringify(pj));
              setPrintJob(pj);
              setGradesAll(pj.jobs.map(makeInitialGrades));
              setCurrentIdx(0);
              setStudentPicker(false);
            }}
          />
        )}
      </>
    );
  }

  // ── Render: Expired ──
  if (isExpired) {
    return (
      <div className="vocab-grade-empty">
        <h3 className="vocab-grade-empty-title">시험지가 만료됐어요</h3>
        <p className="vocab-grade-empty-hint">
          6시간이 지났어요. 새 시험지를 만들어 다시 채점하세요.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={clearPrintJob}>
            만료 시험지 삭제
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setStudentPicker(true)}>
            새 시험지 만들기
          </button>
        </div>
        {studentPicker && (
          <PickStudentsModal
            onClose={() => setStudentPicker(false)}
            onCreated={(pj) => {
              localStorage.setItem(PRINT_JOB_KEY, JSON.stringify(pj));
              setPrintJob(pj);
              setGradesAll(pj.jobs.map(makeInitialGrades));
              setCurrentIdx(0);
              setStudentPicker(false);
            }}
          />
        )}
      </div>
    );
  }

  // ── Render: 채점 화면 ──
  const { correct, total, graded } = score(currentIdx);
  const remaining = total - graded;

  return (
    <>
      {/* 학생 탭 */}
      <div className="vocab-grade-students" role="tablist" aria-label="채점할 학생 선택">
        {printJob.jobs.map((job, i) => {
          const s = score(i);
          const done = s.graded === s.total && s.total > 0;
          return (
            <button
              key={job.studentId}
              type="button"
              role="tab"
              aria-selected={i === currentIdx}
              className={`vocab-grade-student-tab ${i === currentIdx ? 'vocab-grade-student-tab--active' : ''}`}
              onClick={() => setCurrentIdx(i)}
            >
              <span className="vocab-grade-student-name">{job.studentName}</span>
              {s.total > 0 && (
                <span className={`vocab-grade-student-badge ${done ? 'is-done' : ''}`}>
                  {done ? `${s.correct}/${s.total}` : `${s.graded}/${s.total}`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 요약 카드 */}
      {currentJob && (
        <div className="vocab-grade-summary">
          <div className="vocab-grade-summary-main">
            <span className="vocab-grade-summary-num">{correct}</span>
            <span className="vocab-grade-summary-sep">/</span>
            <span className="vocab-grade-summary-total">{total}</span>
          </div>
          <div className="vocab-grade-summary-meta">
            <span className="vocab-grade-student-heading">{currentJob.studentName}</span>
            <span className="vocab-grade-summary-stats">
              <span className="vocab-grade-summary-ok">O {correct}</span>
              <span className="vocab-grade-summary-ng">X {graded - correct}</span>
              <span className="vocab-grade-summary-todo">남음 {remaining}</span>
            </span>
          </div>
          <button
            type="button"
            className="vocab-grade-trash"
            onClick={clearPrintJob}
            title="이 시험지 전체 삭제"
            aria-label="이 시험지 전체 삭제"
          >×</button>
        </div>
      )}

      {/* 문제 리스트 */}
      {currentJob && currentJob.part1.length === 0 && (
        <div className="vocab-empty">이 학생은 출제할 단어가 없었어요.</div>
      )}
      {currentJob && currentJob.part1.length > 0 && (
        <ol className="vocab-grade-list">
          {currentJob.part1.map((w, i) => {
            const key = `p1_${i}`;
            const val = currentGrades[key];
            return (
              <li
                key={w.id || i}
                className={`vocab-grade-item ${val === true ? 'vocab-grade-item--ok' : val === false ? 'vocab-grade-item--ng' : ''}`}
              >
                <span className="vocab-grade-item-num">{i + 1}</span>
                <div className="vocab-grade-item-body">
                  <div className="vocab-grade-item-english">{w.english}</div>
                  <div className="vocab-grade-item-korean">
                    {w.korean}
                    <span className="vocab-grade-item-blank">{BLANK_LABEL[w.blank_type] || w.blank_type}</span>
                  </div>
                </div>
                <div className="vocab-grade-btns">
                  <button
                    type="button"
                    className={`vocab-grade-btn-o ${val === true ? 'is-active' : ''}`}
                    onClick={() => setGrade(key, true)}
                    aria-label={`${w.english} 정답`}
                    aria-pressed={val === true}
                  >O</button>
                  <button
                    type="button"
                    className={`vocab-grade-btn-x ${val === false ? 'is-active' : ''}`}
                    onClick={() => setGrade(key, false)}
                    aria-label={`${w.english} 오답`}
                    aria-pressed={val === false}
                  >X</button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Sticky 저장 */}
      <div className="vocab-grade-savebar">
        <button
          type="button"
          className="btn btn-primary vocab-grade-save"
          onClick={handleSave}
          disabled={saving || graded === 0}
        >
          {saving ? '저장 중…' : `${currentJob?.studentName || '학생'} 저장 · ${graded}/${total}`}
        </button>
      </div>

      {studentPicker && (
        <PickStudentsModal
          onClose={() => setStudentPicker(false)}
          onCreated={(pj) => {
            localStorage.setItem(PRINT_JOB_KEY, JSON.stringify(pj));
            setPrintJob(pj);
            setGradesAll(pj.jobs.map(makeInitialGrades));
            setCurrentIdx(0);
            setStudentPicker(false);
          }}
        />
      )}
    </>
  );
}

// ── 학생 선택 모달 ────────────────────────────────────
function PickStudentsModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (pj: PrintJob) => void;
}) {
  const [students, setStudents] = useState<Array<{ id: string; name: string; grade?: string | null }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [maxWords, setMaxWords] = useState(20);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.getGachaStudents();
        setStudents((list || []).map((s: any) => ({ id: s.id, name: s.name, grade: s.grade })));
      } catch {
        setStudents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const generate = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const ids = [...selected];
      const results = await Promise.all(
        ids.map(async sid => {
          try {
            const res = await api.pickVocabPrint({ student_id: sid, max_words: maxWords });
            return {
              studentId: res.student?.id || sid,
              studentName: res.student?.name || students.find(s => s.id === sid)?.name || '학생',
              jobId: res.job_id,
              part1: (res.words || []).map(w => ({
                id: w.id,
                english: (w as any).english,
                korean: (w as any).korean,
                blank_type: w.blank_type,
              })),
            } as Job;
          } catch {
            return null;
          }
        })
      );
      const jobs = results.filter(Boolean) as Job[];
      if (jobs.length === 0) {
        toast.error('출제할 단어가 있는 학생이 없어요');
        setBusy(false);
        return;
      }
      // 단어가 0개인 학생은 제외
      const valid = jobs.filter(j => j.part1.length > 0);
      if (valid.length === 0) {
        toast.error('학생의 승인된 단어가 부족해요');
        setBusy(false);
        return;
      }
      const pj: PrintJob = { jobs: valid, createdAt: Date.now() };
      toast.success(`${valid.length}명의 시험지 생성됨`);
      onCreated(pj);
    } catch (e: any) {
      toast.error(e?.message || '생성 실패');
    } finally {
      setBusy(false);
    }
  };

  const filtered = students;

  return (
    <Modal onClose={onClose} className="vocab-grade-picker-modal">
      <Modal.Header>시험지 만들기</Modal.Header>
      <Modal.Body>
        <div className="vocab-grade-picker-body">
          <label className="form-field">
            <span className="form-label">학생당 단어 수</span>
            <select
              className="form-input"
              value={maxWords}
              onChange={e => setMaxWords(Number(e.target.value))}
            >
              {[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}개</option>)}
            </select>
          </label>
          <div className="form-field">
            <span className="form-label">학생 선택 ({selected.size} 명)</span>
            {loading ? (
              <div className="vocab-empty">불러오는 중…</div>
            ) : students.length === 0 ? (
              <div className="vocab-empty">담당 학생이 없어요</div>
            ) : (
              <ul className="vocab-grade-picker-list">
                {filtered.map(s => {
                  const on = selected.has(s.id);
                  return (
                    <li key={s.id}>
                      <label className={`vocab-grade-picker-item ${on ? 'is-on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(s.id)}
                        />
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
            <button type="button" className="btn-link" onClick={() => setSelected(new Set(filtered.map(s => s.id)))}>전체 선택</button>
            <button type="button" className="btn-link" onClick={() => setSelected(new Set())}>선택 해제</button>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>취소</button>
        <button
          className="btn btn-primary"
          onClick={generate}
          disabled={busy || selected.size === 0}
        >{busy ? '생성 중…' : `${selected.size}명 시험지 만들기`}</button>
      </Modal.Footer>
    </Modal>
  );
}
