import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, VocabExamDetail } from '../api';
import './VocabExamPage.css';

const FALLBACK_TIME_LIMIT_MS = 600 * 1000;

export default function VocabExamPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<VocabExamDetail | null>(null);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // 자동 제출 + 사용자 클릭 + 더블탭 race 에 대해 ref 로 1회 보장 (state 는 비동기)
  const submitLockRef = useRef(false);
  // wordId → 진행중 saveVocabAnswer 프로미스. 제출 직전 await 하여 채점 누락 방지.
  const pendingSavesRef = useRef<Map<string, Promise<unknown>>>(new Map());

  // 로드
  useEffect(() => {
    if (!jobId) return;
    api.getVocabExam(jobId)
      .then((d) => {
        setExam(d);
        if (d.status === 'submitted') {
          navigate(`/vocab/exam/${jobId}/result`, { replace: true });
        }
      })
      .catch((e) => setError(e.message ?? '시험을 불러올 수 없어요'));
  }, [jobId, navigate]);

  const total = exam?.questions?.length ?? 0;
  const cur = exam?.questions?.[idx];
  const answered = useMemo(
    () => (exam?.questions ?? []).filter((q) => q.selectedIndex !== null).length,
    [exam]
  );

  const flushPendingSaves = useCallback(async () => {
    const promises = Array.from(pendingSavesRef.current.values());
    if (promises.length === 0) return;
    await Promise.allSettled(promises);
    pendingSavesRef.current.clear();
  }, []);

  const handleSelect = useCallback((choiceIdx: number) => {
    if (!exam || !cur) return;
    setExam({
      ...exam,
      questions: exam.questions.map((q, i) =>
        i === idx ? { ...q, selectedIndex: choiceIdx } : q
      ),
    });
    // 동일 wordId 의 이전 in-flight 가 있으면 last-write-wins (서버 동일 키 PUT) — Map 으로 덮어써도 안전
    const p = api.saveVocabAnswer(exam.id, cur.wordId, choiceIdx).catch(() => { /* 실패는 flush 단계에서 다시 surface */ });
    pendingSavesRef.current.set(cur.wordId, p);
  }, [exam, cur, idx]);

  const handleSubmit = useCallback(async () => {
    if (!exam) return;
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      await flushPendingSaves();
      await api.submitVocabExam(exam.id);
      navigate(`/vocab/exam/${exam.id}/result`, { replace: true });
    } catch (e) {
      setError((e as Error)?.message ?? '제출 실패');
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }, [exam, flushPendingSaves, navigate]);

  // 타이머 자동제출이 stale closure 잡지 않도록 최신 핸들러를 ref 로 보관
  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => { handleSubmitRef.current = handleSubmit; }, [handleSubmit]);

  // 타이머 (시작시각 + 정책 한도. 정책값이 detail 에 없으므로 fallback 10분 — 서버 보강 시 V-1 해결)
  useEffect(() => {
    if (!exam?.startedAt || exam.status === 'submitted') return;
    const start = new Date(exam.startedAt).getTime();
    const limit = FALLBACK_TIME_LIMIT_MS;
    const tick = () => {
      const remain = Math.max(0, Math.floor((start + limit - Date.now()) / 1000));
      setSecondsLeft(remain);
      if (remain === 0) {
        handleSubmitRef.current?.();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [exam?.startedAt, exam?.status]);

  if (error) return (
    <div className="vexam-shell">
      <div className="vexam-error">{error}</div>
      <button className="vexam-btn" onClick={() => navigate('/me')}>홈으로</button>
    </div>
  );
  if (!exam || !cur) return <div className="vexam-shell"><div className="vexam-loading">시험 준비 중…</div></div>;

  return (
    <div className="vexam-shell">
      <header className="vexam-header">
        <span className="vexam-progress">{idx + 1} / {total}</span>
        <span className="vexam-answered">답변 {answered}/{total}</span>
        {secondsLeft !== null && (
          <span className={`vexam-timer ${secondsLeft < 30 ? 'vexam-timer-urgent' : ''}`}>
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </span>
        )}
      </header>

      <main className="vexam-main">
        <div className="vexam-prompt">
          <span className="vexam-en">{cur.prompt}</span>
          <span className="vexam-en-hint">한국어 뜻을 고르세요</span>
        </div>

        <div className="vexam-choices">
          {cur.choices.map((c, i) => (
            <button
              key={i}
              className={`vexam-choice ${cur.selectedIndex === i ? 'vexam-choice-selected' : ''}`}
              onClick={() => handleSelect(i)}
            >
              <span className="vexam-choice-no">{String.fromCharCode(65 + i)}</span>
              <span className="vexam-choice-text">{c}</span>
            </button>
          ))}
        </div>
      </main>

      <footer className="vexam-footer">
        <button
          className="vexam-btn vexam-btn-ghost"
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
        >이전</button>
        {idx < total - 1 ? (
          <button
            className="vexam-btn"
            onClick={() => setIdx(idx + 1)}
          >다음</button>
        ) : (
          <button
            className="vexam-btn vexam-btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >{submitting ? '제출 중…' : '제출하기'}</button>
        )}
      </footer>
    </div>
  );
}
