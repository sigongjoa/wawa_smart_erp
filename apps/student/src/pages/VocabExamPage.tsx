import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, VocabExamDetail } from '../api';
import './VocabExamPage.css';

export default function VocabExamPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<VocabExamDetail | null>(null);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const submittedRef = useRef(false);

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

  // 타이머 (단순: 시작시각 + 10분 또는 정책 시간 — 일단 클라이언트 fallback 600초)
  useEffect(() => {
    if (!exam?.startedAt || exam.status === 'submitted') return;
    const start = new Date(exam.startedAt).getTime();
    const limit = 600 * 1000; // 정책에서 받아오는 게 정확하지만 일단 10분
    const tick = () => {
      const remain = Math.max(0, Math.floor((start + limit - Date.now()) / 1000));
      setSecondsLeft(remain);
      if (remain === 0 && !submittedRef.current) {
        submittedRef.current = true;
        handleSubmit();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam?.startedAt, exam?.status]);

  const total = exam?.questions?.length ?? 0;
  const cur = exam?.questions?.[idx];
  const answered = useMemo(
    () => (exam?.questions ?? []).filter((q) => q.selectedIndex !== null).length,
    [exam]
  );

  async function handleSelect(choiceIdx: number) {
    if (!exam || !cur) return;
    setExam({
      ...exam,
      questions: exam.questions.map((q, i) =>
        i === idx ? { ...q, selectedIndex: choiceIdx } : q
      ),
    });
    api.saveVocabAnswer(exam.id, cur.wordId, choiceIdx).catch(() => {/* swallow */});
  }

  async function handleSubmit() {
    if (!exam || submitting) return;
    setSubmitting(true);
    try {
      await api.submitVocabExam(exam.id);
      navigate(`/vocab/exam/${exam.id}/result`, { replace: true });
    } catch (e: any) {
      setError(e.message ?? '제출 실패');
      setSubmitting(false);
    }
  }

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
