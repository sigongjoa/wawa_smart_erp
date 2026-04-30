import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { medtermApi, MedTermExamAttempt, MedTermExamItem } from '../api';

export function MedTermExamsListPage() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<MedTermExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    medtermApi.listExamAttempts()
      .then((r) => setAttempts(r.items))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="medterm-page">불러오는 중...</div>;

  return (
    <div className="medterm-page" data-testid="medterm-exams-list">
      <header className="medterm-header">
        <h2>단원평가</h2>
        <button onClick={() => navigate('/medterm')} className="medterm-exam-link">학습으로 돌아가기</button>
      </header>
      {attempts.length === 0 && (
        <p data-testid="medterm-exams-empty">진행 중인 평가가 없습니다.</p>
      )}
      {attempts.map((a) => (
        <article
          key={a.id}
          className="medterm-card"
          style={{ cursor: a.status !== 'graded' ? 'pointer' : 'default' }}
          onClick={() => navigate(`/medterm/exams/${a.id}`)}
          data-testid={`medterm-attempt-${a.id}`}
        >
          <div className="medterm-mode-badge">
            {a.status === 'created' && '미응시'}
            {a.status === 'submitted' && '채점 중'}
            {a.status === 'graded' && '채점 완료'}
            {' · '}
            {a.total ? `${a.total}문항` : '-'}
          </div>
          <div className="medterm-term" style={{ fontSize: 18 }}>
            {a.chapter_id}
          </div>
          {a.status === 'graded' && (
            <div className="medterm-feedback correct">
              점수: <b>{a.score}점</b> ({a.correct_cnt} / {a.total})
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export function MedTermExamAttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<MedTermExamAttempt | null>(null);
  const [items, setItems] = useState<MedTermExamItem[]>([]);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [results, setResults] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    medtermApi.getExamAttempt(attemptId).then((r) => {
      setAttempt(r.attempt);
      setItems(r.items);
      const respMap: Record<string, unknown> = {};
      const resultMap: Record<string, number | null> = {};
      r.responses.forEach((rs) => {
        if (rs.response !== null) respMap[rs.item_id] = rs.response;
        resultMap[rs.item_id] = rs.correct;
      });
      setResponses(respMap);
      setResults(resultMap);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [attemptId]);

  async function saveResponse(itemId: string, response: unknown) {
    if (!attemptId) return;
    setResponses((prev) => ({ ...prev, [itemId]: response }));
    try {
      await medtermApi.saveExamResponse(attemptId, itemId, response);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    }
  }

  async function submit() {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      await medtermApi.submitExam(attemptId);
      // 새로 fetch — 채점 결과 표시
      const r = await medtermApi.getExamAttempt(attemptId);
      setAttempt(r.attempt);
      const resultMap: Record<string, number | null> = {};
      r.responses.forEach((rs) => {
        resultMap[rs.item_id] = rs.correct;
      });
      setResults(resultMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출 실패');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="medterm-page">불러오는 중...</div>;
  if (!attempt) return <div className="medterm-page" data-testid="medterm-attempt-error">평가를 찾을 수 없습니다.</div>;

  const allAnswered = items.every((it) => responses[it.id] !== undefined);
  const isGraded = attempt.status === 'graded';
  const isSubmittedOrGraded = attempt.status !== 'created';

  return (
    <div className="medterm-page" data-testid="medterm-exam-attempt">
      <header className="medterm-header">
        <h2>단원평가 응시</h2>
        <button onClick={() => navigate('/medterm/exams')} className="medterm-exam-link">목록</button>
      </header>

      {isGraded && (
        <div className="medterm-feedback correct" data-testid="medterm-exam-score">
          <strong>점수: {attempt.score}점</strong> ({attempt.correct_cnt} / {attempt.total} 정답)
        </div>
      )}

      {error && <div className="medterm-error">{error}</div>}

      {items.map((it) => {
        const myResp = responses[it.id];
        const correct = results[it.id];
        return (
          <article key={it.id} className="medterm-card" data-testid={`medterm-exam-item-${it.no}`}>
            <div className="medterm-mode-badge">
              문제 {it.no} · [{it.type}] · {it.difficulty}
              {correct === 1 && <span style={{ color: '#2E7D32', marginLeft: 8 }}>✓</span>}
              {correct === 0 && <span style={{ color: '#C62828', marginLeft: 8 }}>✕</span>}
            </div>
            <div className="medterm-meaning">{it.question}</div>

            {it.type === '객관식' && Array.isArray(it.body?.choices) && (
              <div>
                {it.body.choices.map((ch: string, idx: number) => {
                  const letter = String.fromCharCode(65 + idx);
                  return (
                    <label key={idx} style={{ display: 'block', padding: 6, cursor: isSubmittedOrGraded ? 'default' : 'pointer' }}>
                      <input
                        type="radio"
                        name={`q-${it.id}`}
                        checked={myResp === letter}
                        onChange={() => saveResponse(it.id, letter)}
                        disabled={isSubmittedOrGraded}
                        data-testid={`medterm-exam-choice-${it.no}-${letter}`}
                      />
                      &nbsp;{letter}. {ch}
                    </label>
                  );
                })}
              </div>
            )}

            {it.type === 'OX' && (
              <div>
                {['O', 'X'].map((v) => (
                  <label key={v} style={{ marginRight: 16, cursor: isSubmittedOrGraded ? 'default' : 'pointer' }}>
                    <input
                      type="radio"
                      name={`q-${it.id}`}
                      checked={myResp === v}
                      onChange={() => saveResponse(it.id, v)}
                      disabled={isSubmittedOrGraded}
                    />
                    &nbsp;{v}
                  </label>
                ))}
              </div>
            )}

            {(it.type === '단답형' || it.type === '용어분해' || it.type === '복수형') && (
              <input
                type="text"
                className="medterm-input"
                value={(myResp as string) || ''}
                onChange={(e) => saveResponse(it.id, e.target.value)}
                disabled={isSubmittedOrGraded}
                data-testid={`medterm-exam-input-${it.no}`}
              />
            )}

            {it.type === '매칭' && it.body?.items && it.body?.options && (
              <MatchingItem
                body={it.body}
                response={myResp as Record<string, string> | undefined}
                onChange={(v) => saveResponse(it.id, v)}
                disabled={isSubmittedOrGraded}
                no={it.no}
              />
            )}
          </article>
        );
      })}

      {!isSubmittedOrGraded && (
        <div className="medterm-actions">
          <button
            className="medterm-submit"
            onClick={submit}
            disabled={!allAnswered || submitting}
            data-testid="medterm-exam-submit"
          >
            {submitting ? '제출 중...' : `제출 (${Object.keys(responses).length}/${items.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

function MatchingItem({ body, response, onChange, disabled, no }: {
  body: { items: Record<string, string>; options: Record<string, string> };
  response?: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  disabled: boolean;
  no: number;
}) {
  const cur = response || {};
  return (
    <div>
      {Object.entries(body.items).map(([key, label]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4 }}>
          <span style={{ minWidth: 100 }}>({key}) {label}</span>
          <select
            value={cur[key] || ''}
            onChange={(e) => onChange({ ...cur, [key]: e.target.value })}
            disabled={disabled}
            data-testid={`medterm-exam-match-${no}-${key}`}
          >
            <option value="">선택</option>
            {Object.entries(body.options).map(([ok, ov]) => (
              <option key={ok} value={ok}>({ok}) {ov}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
