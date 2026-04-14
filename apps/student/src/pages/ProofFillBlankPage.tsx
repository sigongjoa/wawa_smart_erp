import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, FillBlankProblem, SubmitResult, getImageUrl } from '../api';
import KaTeX from '../components/KaTeX';

export default function ProofFillBlankPage() {
  const navigate = useNavigate();
  const { proofId } = useParams<{ proofId: string }>();
  const [problem, setProblem] = useState<FillBlankProblem | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<number, string>>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(new Date().toISOString());

  useEffect(() => {
    if (!proofId) return;
    api.getFillBlank(proofId)
      .then(p => {
        setProblem(p);
        // 빈칸 답안 초기화
        const init: Record<string, Record<number, string>> = {};
        for (const step of p.steps) {
          if (step.has_blank && step.blanks.length > 0) {
            init[step.id] = {};
            for (let i = 0; i < step.blanks.length; i++) {
              init[step.id][i] = '';
            }
          }
        }
        setAnswers(init);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [proofId, navigate]);

  const updateAnswer = (stepId: string, blankIdx: number, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], [blankIdx]: value },
    }));
  };

  const handleSubmit = async () => {
    if (!proofId) return;
    setSubmitting(true);
    try {
      const res = await api.submitProof(proofId, {
        mode: 'fill_blank',
        answers,
        start_time: startTime,
      });
      setResult(res);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setLoading(true);
    api.getFillBlank(proofId!)
      .then(p => {
        setProblem(p);
        const init: Record<string, Record<number, string>> = {};
        for (const step of p.steps) {
          if (step.has_blank && step.blanks.length > 0) {
            init[step.id] = {};
            for (let i = 0; i < step.blanks.length; i++) init[step.id][i] = '';
          }
        }
        setAnswers(init);
      })
      .finally(() => setLoading(false));
  };

  /** 단계 내용에서 빈칸 부분을 input으로 교체 */
  const renderStepWithBlanks = (step: FillBlankProblem['steps'][0]) => {
    if (!step.has_blank || step.blanks.length === 0) {
      return <KaTeX content={step.content} />;
    }

    // blanks를 position 역순으로 정렬해서 뒤에서부터 치환
    const sortedBlanks = [...step.blanks]
      .map((b, i) => ({ ...b, index: i }))
      .sort((a, b) => b.position - a.position);

    let content = step.content;
    const parts: Array<{ type: 'text' | 'blank'; value: string; blankIdx: number }> = [];

    // 빈칸 위치에 플레이스홀더 삽입
    let remaining = content;
    const blankPositions = [...step.blanks]
      .map((b, i) => ({ ...b, index: i }))
      .sort((a, b) => a.position - b.position);

    let offset = 0;
    let lastEnd = 0;
    for (const blank of blankPositions) {
      const start = blank.position;
      const end = start + blank.length;

      if (start > lastEnd) {
        parts.push({ type: 'text', value: content.slice(lastEnd, start), blankIdx: -1 });
      }
      parts.push({ type: 'blank', value: '', blankIdx: blank.index });
      lastEnd = end;
    }
    if (lastEnd < content.length) {
      parts.push({ type: 'text', value: content.slice(lastEnd), blankIdx: -1 });
    }

    return (
      <span className="fillblank-step-content">
        {parts.map((part, i) =>
          part.type === 'text' ? (
            <KaTeX key={i} content={part.value} />
          ) : (
            <input
              key={i}
              type="text"
              className="fillblank-input"
              value={answers[step.id]?.[part.blankIdx] || ''}
              onChange={e => updateAnswer(step.id, part.blankIdx, e.target.value)}
              placeholder="___"
              autoComplete="off"
            />
          )
        )}
      </span>
    );
  };

  if (loading) return <div className="page-center"><div className="loading">문제 생성 중...</div></div>;
  if (!problem) return null;

  return (
    <div className="proof-play-page">
      <header className="play-header">
        <button className="btn-ghost" onClick={() => navigate('/')}>← 홈</button>
        <span>빈칸채우기</span>
      </header>

      <div className="proof-play-title">
        <h2>{problem.proof.title}</h2>
        <span className="proof-play-meta">
          {problem.proof.grade} · {'★'.repeat(problem.proof.difficulty)} · 빈칸 {problem.total_blanks}개 · Box {problem.current_box}
        </span>
      </div>

      {problem.proof.description && (
        <p className="proof-play-desc"><KaTeX content={problem.proof.description} /></p>
      )}
      {problem.proof.description_image && (
        <img src={getImageUrl(problem.proof.description_image)} alt="desc" className="proof-play-desc-img" />
      )}

      {!result ? (
        <>
          <div className="fillblank-steps">
            {problem.steps.map((step) => (
              <div key={step.id} className={`fillblank-step ${step.has_blank ? 'fillblank-step--active' : ''}`}>
                <span className="fillblank-step-num">Step {step.step_order}</span>
                <div className="fillblank-step-body">
                  {step.content_image && (
                    <img src={getImageUrl(step.content_image)} alt={`step ${step.step_order}`} className="fillblank-step-img" />
                  )}
                  {renderStepWithBlanks(step)}
                </div>
              </div>
            ))}
          </div>

          <div className="proof-play-actions">
            <button className="btn-primary btn-lg" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '채점 중...' : '확인'}
            </button>
          </div>
        </>
      ) : (
        <div className="proof-result">
          <div className={`proof-result-score ${result.score >= 70 ? 'good' : 'low'}`}>
            {result.score}점
          </div>

          <div className="proof-result-detail">
            <p>정답 {result.detail.correct}/{result.detail.total}개</p>
            <p>Box {result.box_before} → {result.box_after}</p>
            {result.time_spent > 0 && <p>{result.time_spent}초 소요</p>}
          </div>

          {/* 빈칸별 결과 */}
          <div className="proof-result-steps">
            {result.detail.results?.map((r: any, i: number) => (
              <div key={i} className={`proof-result-step ${r.correct ? 'correct' : 'wrong'}`}>
                <span className="proof-result-submitted">{r.submitted || '(빈칸)'}</span>
                <span>{r.correct ? 'O' : `X → ${r.expected}`}</span>
              </div>
            ))}
          </div>

          <div className="proof-play-actions">
            <button className="btn-secondary" onClick={handleRetry}>다시 풀기</button>
            <button className="btn-primary" onClick={() => navigate('/')}>홈으로</button>
          </div>
        </div>
      )}
    </div>
  );
}
