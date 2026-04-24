import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ExamAttemptFull, ExamListItem } from '../api';

type Phase = 'ready' | 'take' | 'result';

const POLL_INTERVAL_MS = 5000;

function fmtMMSS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function ExamPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('ready');
  const [meta, setMeta] = useState<ExamListItem | null>(null);
  const [attempt, setAttempt] = useState<ExamAttemptFull | null>(null);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimers = useRef<Map<number, number>>(new Map());

  // 초기 로드 — 리스트에서 메타 찾고, attempt가 이미 있으면 바로 take
  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listExams();
        const m = list.find(x => x.assignmentId === assignmentId);
        if (!m) { setError('시험을 찾을 수 없습니다'); return; }
        if (cancelled) return;
        setMeta(m);
        if (m.attemptId) {
          const a = await api.getExamAttemptFull(m.attemptId);
          if (cancelled) return;
          setAttempt(a);
          setRemaining(a.remainingSeconds);
          if (a.status === 'running' || a.status === 'paused') setPhase('take');
          else setPhase('result');
        }
      } catch (e: any) {
        setError(e?.message || '불러오기 실패');
      }
    })();
    return () => { cancelled = true; };
  }, [assignmentId]);

  // 5초 폴링 — 남은시간 동기화 + 종료 감지
  useEffect(() => {
    if (phase !== 'take' || !attempt) return;
    const tick = async () => {
      try {
        const fresh = await api.getExamAttemptFull(attempt.id);
        setRemaining(fresh.remainingSeconds);
        if (['submitted', 'expired', 'voided'].includes(fresh.status)) {
          setAttempt(fresh);
          setPhase('result');
        }
      } catch { /* ignore */ }
    };
    const t = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [phase, attempt?.id]);

  // 1초 카운트다운
  useEffect(() => {
    if (phase !== 'take') return;
    const t = window.setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          // 자동 제출
          autoSubmit();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const answersByNo = useMemo(() => {
    const m = new Map<number, number | null>();
    for (const a of attempt?.answers ?? []) m.set(a.questionNo, a.selectedChoice);
    return m;
  }, [attempt?.answers]);

  const currentQ = attempt?.questions?.[idx] ?? null;
  const selectedForCurrent = currentQ ? answersByNo.get(currentQ.questionNo) ?? null : null;

  const handleStart = useCallback(async () => {
    if (!assignmentId || !meta) return;
    try {
      await api.startExam(assignmentId);
      const next = await api.listExams();
      const m = next.find(x => x.assignmentId === assignmentId);
      if (!m?.attemptId) throw new Error('attempt id 없음');
      const full = await api.getExamAttemptFull(m.attemptId);
      setAttempt(full);
      setRemaining(full.remainingSeconds);
      setPhase('take');
    } catch (e: any) {
      setError(e?.message || '시작 실패');
    }
  }, [assignmentId, meta]);

  const pendingSaves = useRef<Map<number, { choice: number | null; promise: Promise<any> | null }>>(new Map());

  const handlePickChoice = useCallback((choice: number) => {
    if (!attempt || !currentQ) return;
    const qNo = currentQ.questionNo;
    // 낙관적 업데이트
    setAttempt(prev => {
      if (!prev) return prev;
      const list = [...(prev.answers ?? [])];
      const i = list.findIndex(a => a.questionNo === qNo);
      const entry = { questionNo: qNo, selectedChoice: choice };
      if (i >= 0) list[i] = entry;
      else list.push(entry);
      return { ...prev, answers: list };
    });
    // debounced save (300ms) — 여러 번 탭할 때 중복 요청 방지
    const existing = saveTimers.current.get(qNo);
    if (existing) window.clearTimeout(existing);
    pendingSaves.current.set(qNo, { choice, promise: null });
    const tid = window.setTimeout(() => {
      const p = api.saveExamAnswer(attempt.id, qNo, choice).catch(() => {});
      pendingSaves.current.set(qNo, { choice, promise: p });
      saveTimers.current.delete(qNo);
    }, 300);
    saveTimers.current.set(qNo, tid);
  }, [attempt, currentQ]);

  // 진행 이동/제출 전에 pending save를 즉시 flush
  const flushPendingSaves = useCallback(async () => {
    if (!attempt) return;
    const entries = Array.from(pendingSaves.current.entries());
    const promises: Promise<any>[] = [];
    for (const [qNo, { choice, promise }] of entries) {
      const tid = saveTimers.current.get(qNo);
      if (tid) {
        window.clearTimeout(tid);
        saveTimers.current.delete(qNo);
        promises.push(api.saveExamAnswer(attempt.id, qNo, choice).catch(() => {}));
      } else if (promise) {
        promises.push(promise);
      }
    }
    await Promise.all(promises);
    pendingSaves.current.clear();
  }, [attempt]);

  const autoSubmit = useCallback(async () => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    try {
      await flushPendingSaves();
      await api.submitExam(attempt.id);
      const fresh = await api.getExamAttemptFull(attempt.id);
      setAttempt(fresh);
      setPhase('result');
    } catch (e: any) {
      setError(e?.message || '제출 실패');
    } finally {
      setSubmitting(false);
    }
  }, [attempt, submitting, flushPendingSaves]);

  const handleSubmit = useCallback(async () => {
    if (!attempt) return;
    if (!confirm('답안을 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.')) return;
    await autoSubmit();
  }, [attempt, autoSubmit]);

  if (error) {
    return (
      <div className="page-center">
        <div style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ color: '#c53030' }}>{error}</p>
          <button className="btn-primary" onClick={() => navigate('/')}>홈으로</button>
        </div>
      </div>
    );
  }

  if (!meta) return <div className="page-center"><div className="loading">불러오는 중...</div></div>;

  // ── Phase: Ready ──
  if (phase === 'ready') {
    const ready = meta.questionCount > 0;
    return (
      <div className="page-center" style={{ padding: 20 }}>
        <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ margin: '24px 0 8px' }}>{meta.title}</h1>
          <p style={{ color: '#4a5568', marginBottom: 24 }}>
            ⏱ {meta.durationMinutes}분 · {meta.questionCount}문항
          </p>
          <div style={{
            background: '#f7fafc', borderRadius: 12, padding: 16, textAlign: 'left', marginBottom: 24,
            fontSize: 14, color: '#4a5568', lineHeight: 1.7,
          }}>
            • 답을 선택하면 자동 저장됩니다.<br />
            • 중간에 나가도 돌아와서 이어 풀 수 있어요.<br />
            • 시간이 끝나면 자동으로 제출돼요.<br />
          </div>
          <button
            onClick={handleStart}
            disabled={!ready}
            style={{
              width: '100%', padding: '14px 20px', fontSize: 16, fontWeight: 700,
              background: ready ? '#2d3a8c' : '#cbd5e0', color: '#fff',
              border: 'none', borderRadius: 10, cursor: ready ? 'pointer' : 'not-allowed',
            }}
          >
            {ready ? '시험 시작하기' : '아직 문제가 등록되지 않았어요'}
          </button>
          <button
            onClick={() => navigate('/')}
            style={{ marginTop: 10, padding: '10px 20px', background: 'transparent', border: 'none', color: '#4a5568' }}
          >
            ← 홈으로
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: Take ──
  if (phase === 'take' && attempt && currentQ) {
    const total = attempt.questions?.length ?? 0;
    const isLast = idx === total - 1;
    const answeredCount = (attempt.answers ?? []).filter(a => a.selectedChoice !== null).length;
    const lowTime = remaining < 60;
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: 16, minHeight: '100vh', background: '#fff' }}>
        {/* 상단 진행/타이머 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#2d3a8c' }}>
            {idx + 1} / {total}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            padding: '4px 10px', borderRadius: 20,
            background: lowTime ? '#fed7d7' : '#eef0f8',
            color: lowTime ? '#c53030' : '#2d3a8c',
          }}>
            ⏱ {fmtMMSS(remaining)}
          </span>
        </div>
        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{
            height: '100%', background: '#2d3a8c', width: `${(idx / Math.max(1, total)) * 100}%`,
            transition: 'width .2s',
          }} />
        </div>

        {/* 문제 */}
        <div style={{
          background: '#f7fafc', borderRadius: 12, padding: 20, marginBottom: 16,
          minHeight: 120, fontSize: 16, lineHeight: 1.7, color: '#1a202c',
          whiteSpace: 'pre-wrap',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#2d3a8c' }}>Q{currentQ.questionNo}.</div>
          {currentQ.prompt}
        </div>

        {/* 보기 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {currentQ.choices.map((c, i) => {
            const n = i + 1;
            const selected = selectedForCurrent === n;
            return (
              <button
                key={n}
                onClick={() => handlePickChoice(n)}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: selected ? '2px solid #2d3a8c' : '2px solid #e2e8f0',
                  background: selected ? '#eef0f8' : '#fff',
                  color: '#1a202c',
                  fontSize: 15,
                  fontWeight: selected ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: selected ? '#2d3a8c' : '#e2e8f0',
                  color: selected ? '#fff' : '#4a5568',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13, flexShrink: 0,
                }}>{n}</span>
                {c}
              </button>
            );
          })}
        </div>

        {/* 하단 네비 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            style={{
              flex: 1, padding: '12px', borderRadius: 10,
              border: '1px solid #cbd5e0', background: '#fff',
              color: '#4a5568', fontWeight: 600,
              cursor: idx === 0 ? 'not-allowed' : 'pointer',
              opacity: idx === 0 ? 0.5 : 1,
            }}
          >← 이전</button>
          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                flex: 2, padding: '12px', borderRadius: 10,
                border: 'none', background: '#00c4a3', color: '#fff',
                fontWeight: 700, fontSize: 15,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >{submitting ? '제출 중…' : `제출하기 (${answeredCount}/${total})`}</button>
          ) : (
            <button
              onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
              style={{
                flex: 2, padding: '12px', borderRadius: 10,
                border: 'none', background: '#2d3a8c', color: '#fff',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >다음 →</button>
          )}
        </div>

        {/* 문항 dot 네비 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16, justifyContent: 'center' }}>
          {(attempt.questions ?? []).map((q, i) => {
            const a = answersByNo.get(q.questionNo);
            const active = i === idx;
            return (
              <button
                key={q.questionNo}
                onClick={() => setIdx(i)}
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: active ? '#2d3a8c' : (a ? '#d1fae5' : '#f7fafc'),
                  color: active ? '#fff' : (a ? '#065f46' : '#a0aec0'),
                  border: '1px solid ' + (active ? '#2d3a8c' : '#e2e8f0'),
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >{q.questionNo}</button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Phase: Result ──
  if (phase === 'result' && attempt) {
    const score = attempt.score ?? 0;
    const correct = attempt.correct ?? 0;
    const total = attempt.total ?? 0;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: 20, minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', marginTop: 20, marginBottom: 30 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, letterSpacing: 2,
            color: pct >= 80 ? '#10b981' : (pct >= 60 ? '#2d3a8c' : '#dc2626'),
            marginBottom: 12,
          }}>
            {pct >= 80 ? 'GREAT' : (pct >= 60 ? 'GOOD' : 'TRY AGAIN')}
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#2d3a8c', marginBottom: 4 }}>
            {correct} / {total}
          </div>
          <div style={{ fontSize: 16, color: '#4a5568' }}>{score}점 · 정답률 {pct}%</div>
        </div>

        {attempt.breakdown && (
          <div style={{
            background: '#f7fafc', borderRadius: 12, padding: 16, marginBottom: 20,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 10, color: '#4a5568', fontSize: 13 }}>문항별 결과</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {attempt.breakdown.map(b => (
                <div key={b.questionNo} style={{
                  textAlign: 'center', padding: '10px 4px',
                  background: b.correct ? '#d1fae5' : '#fee2e2',
                  color: b.correct ? '#065f46' : '#991b1b',
                  borderRadius: 6, fontSize: 12, fontWeight: 600,
                }}>
                  {b.questionNo} {b.correct ? 'O' : 'X'}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%', padding: '14px', borderRadius: 10,
            border: 'none', background: '#2d3a8c', color: '#fff',
            fontWeight: 700, fontSize: 15, cursor: 'pointer',
          }}
        >홈으로</button>
      </div>
    );
  }

  return <div className="page-center"><div className="loading">불러오는 중...</div></div>;
}
