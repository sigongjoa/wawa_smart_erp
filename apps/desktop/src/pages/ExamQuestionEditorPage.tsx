import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ExamQuestionDto } from '../api';
import { errorMessage } from '../utils/errors';

function blank(n: number): ExamQuestionDto {
  return {
    questionNo: n,
    prompt: '',
    choices: ['', '', '', '', ''],
    correctChoice: 1,
    points: 1,
    category: null,
  };
}

export default function ExamQuestionEditorPage() {
  const { paperId = '' } = useParams<{ paperId: string }>();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const backTo = sp.get('back') || '/exams';
  const paperTitleQ = sp.get('title') || '';

  const [questions, setQuestions] = useState<ExamQuestionDto[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [subject, setSubject] = useState('english');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = await api.getExamPaperQuestions(paperId);
        if (cancelled) return;
        if (qs.length === 0) {
          setQuestions([blank(1)]);
        } else {
          setQuestions(
            qs.map(q => ({
              questionNo: q.questionNo,
              prompt: q.prompt,
              choices: (q.choices && q.choices.length === 5)
                ? q.choices
                : [...(q.choices || []), '', '', '', '', ''].slice(0, 5),
              correctChoice: q.correctChoice,
              points: q.points ?? 1,
              category: q.category ?? null,
            }))
          );
        }
      } catch (e: unknown) {
        setMsg({ kind: 'err', text: '불러오기 실패: ' + errorMessage(e, '') });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paperId]);

  const updateQ = useCallback((idx: number, patch: Partial<ExamQuestionDto>) => {
    setQuestions(qs => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }, []);

  const updateChoice = useCallback((qIdx: number, cIdx: number, value: string) => {
    setQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q;
      const next = [...q.choices];
      next[cIdx] = value;
      return { ...q, choices: next };
    }));
  }, []);

  const addQuestion = useCallback(() => {
    setQuestions(qs => [...qs, blank(qs.length + 1)]);
  }, []);

  const removeQuestion = useCallback((idx: number) => {
    setQuestions(qs => qs
      .filter((_, i) => i !== idx)
      .map((q, i) => ({ ...q, questionNo: i + 1 })));
  }, []);

  const handleSave = useCallback(async () => {
    const invalid = questions.find(q =>
      !q.prompt.trim() ||
      q.choices.some(c => !c.trim()) ||
      !q.correctChoice ||
      q.correctChoice < 1 || q.correctChoice > 5
    );
    if (invalid) {
      setMsg({ kind: 'err', text: `Q${invalid.questionNo} 미완성 (지문/보기5개/정답 확인)` });
      return;
    }
    setSaving(true);
    try {
      await api.patchExamPaperMeta(paperId, { subject, durationMinutes });
      await api.putExamPaperQuestions(paperId, questions);
      setMsg({ kind: 'ok', text: `${questions.length}문항 저장됨` });
    } catch (e: unknown) {
      setMsg({ kind: 'err', text: '저장 실패: ' + errorMessage(e, '') });
    } finally {
      setSaving(false);
    }
  }, [paperId, subject, durationMinutes, questions]);

  const readyCount = useMemo(() => questions.filter(q =>
    q.prompt.trim() && q.choices.every(c => c.trim())
  ).length, [questions]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>불러오는 중...</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <button
          onClick={() => navigate(backTo)}
          style={{ background: 'transparent', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 14 }}
        >← 돌아가기</button>
      </div>
      <h1 style={{ fontSize: 22, margin: '4px 0 20px', color: '#1a202c' }}>
        문제 입력 {paperTitleQ && <span style={{ color: '#4a5568', fontWeight: 400 }}>— {paperTitleQ}</span>}
      </h1>

      <div style={{
        background: '#f7fafc', borderRadius: 10, padding: 16, marginBottom: 16,
        display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <label style={{ fontSize: 14 }}>
          과목:&nbsp;
          <select value={subject} onChange={e => setSubject(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6 }}>
            <option value="english">영어</option>
            <option value="math" disabled>수학 (v2)</option>
            <option value="korean" disabled>국어 (v2)</option>
          </select>
        </label>
        <label style={{ fontSize: 14 }}>
          제한 시간:&nbsp;
          <input
            type="number"
            value={durationMinutes}
            onChange={e => setDurationMinutes(Number(e.target.value) || 50)}
            min={10}
            max={180}
            style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e0' }}
          /> 분
        </label>
        <span style={{ fontSize: 13, color: '#4a5568' }}>
          · {readyCount}/{questions.length} 완성
        </span>
      </div>

      <datalist id="exam-category-suggest">
        <option value="어법" />
        <option value="독해" />
        <option value="어휘" />
        <option value="문장구조" />
        <option value="듣기" />
        <option value="작문" />
      </datalist>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {questions.map((q, qIdx) => (
          <div key={qIdx} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <strong style={{ color: '#2d3a8c', fontSize: 16 }}>Q{q.questionNo}</strong>
              <label style={{ fontSize: 13, color: '#4a5568' }}>
                점수:&nbsp;
                <input
                  type="number"
                  value={q.points ?? 1}
                  step={0.5}
                  onChange={e => updateQ(qIdx, { points: Number(e.target.value) || 1 })}
                  style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e0' }}
                />
              </label>
              <label style={{ fontSize: 13, color: '#4a5568' }}>
                유형:&nbsp;
                <input
                  type="text"
                  value={q.category ?? ''}
                  list="exam-category-suggest"
                  placeholder="예: 어법/독해"
                  onChange={e => updateQ(qIdx, { category: e.target.value || null })}
                  style={{ width: 130, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e0' }}
                />
              </label>
              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={() => removeQuestion(qIdx)}
                  style={{
                    background: '#fed7d7', color: '#c53030', border: 'none',
                    padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                  }}
                >삭제</button>
              </div>
            </div>

            <textarea
              value={q.prompt}
              onChange={e => updateQ(qIdx, { prompt: e.target.value })}
              placeholder="문제 지문…"
              rows={3}
              style={{
                width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e0',
                fontSize: 14, fontFamily: 'inherit', resize: 'vertical', marginBottom: 10,
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {q.choices.map((c, cIdx) => {
                const n = cIdx + 1;
                const isCorrect = q.correctChoice === n;
                return (
                  <div key={cIdx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => updateQ(qIdx, { correctChoice: n })}
                      title="정답으로 설정"
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: isCorrect ? '#00c4a3' : '#e2e8f0',
                        color: isCorrect ? '#fff' : '#4a5568',
                        border: 'none', cursor: 'pointer',
                        fontWeight: 700, fontSize: 13, flexShrink: 0,
                      }}
                    >{n}</button>
                    <input
                      value={c}
                      onChange={e => updateChoice(qIdx, cIdx, e.target.value)}
                      placeholder={`보기 ${n}`}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 6,
                        border: `1px solid ${isCorrect ? '#00c4a3' : '#cbd5e0'}`,
                        background: isCorrect ? '#e8faf6' : '#fff',
                        fontSize: 14,
                      }}
                    />
                  </div>
                );
              })}
              <div style={{ fontSize: 12, color: '#4a5568', marginTop: 4 }}>
                ← 번호 버튼을 눌러 정답 설정 (현재: {q.correctChoice})
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addQuestion}
        style={{
          marginTop: 12, padding: '10px 20px', borderRadius: 8,
          background: '#eef0f8', color: '#2d3a8c', border: '1px dashed #2d3a8c',
          cursor: 'pointer', fontWeight: 600,
        }}
      >+ 문제 추가</button>

      {msg && (
        <div style={{
          marginTop: 16, padding: 10, borderRadius: 8,
          background: msg.kind === 'ok' ? 'var(--success-surface)' : 'var(--danger-surface)',
          color: msg.kind === 'ok' ? 'var(--success-text)' : 'var(--danger-text)',
          fontSize: 14,
        }}>{msg.text}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, position: 'sticky', bottom: 0, paddingBottom: 10 }}>
        <button
          onClick={() => navigate(backTo)}
          style={{
            flex: 1, padding: '12px', borderRadius: 10,
            background: '#fff', border: '1px solid #cbd5e0', color: '#4a5568',
            cursor: 'pointer', fontWeight: 600,
          }}
        >취소</button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 2, padding: '12px', borderRadius: 10,
            background: saving ? '#cbd5e0' : '#2d3a8c', color: '#fff',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: 15,
          }}
        >{saving ? '저장 중…' : `저장 (${questions.length}문항)`}</button>
      </div>
    </div>
  );
}
