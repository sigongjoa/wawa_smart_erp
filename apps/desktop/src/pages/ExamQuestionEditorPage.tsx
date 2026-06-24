import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ExamQuestionDto } from '../api';
import { Icon } from '../components/icons/Icon';
import { errorMessage } from '../utils/errors';
import './ExamQuestionEditorPage.css';

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

  if (loading) return <div className="loading-state"><span className="spinner" /> 불러오는 중...</div>;

  return (
    <div className="eqe-page">
      <div className="eqe-back-row">
        <button
          className="btn btn-ghost btn-sm with-icon"
          onClick={() => navigate(backTo)}
        ><Icon name="ArrowLeft" /> 돌아가기</button>
      </div>
      <h1 className="eqe-title">
        문제 입력 {paperTitleQ && <span className="eqe-title-sub">— {paperTitleQ}</span>}
      </h1>

      <div className="eqe-meta-bar">
        <label className="eqe-meta-label">
          과목:&nbsp;
          <select value={subject} onChange={e => setSubject(e.target.value)} className="eqe-select">
            <option value="english">영어</option>
            <option value="math" disabled>수학 (v2)</option>
            <option value="korean" disabled>국어 (v2)</option>
          </select>
        </label>
        <label className="eqe-meta-label">
          제한 시간:&nbsp;
          <input
            type="number"
            value={durationMinutes}
            onChange={e => setDurationMinutes(Number(e.target.value) || 50)}
            min={10}
            max={180}
            className="eqe-input-duration"
          /> 분
        </label>
        <span className="eqe-meta-count">
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

      <div className="eqe-list">
        {questions.map((q, qIdx) => (
          <div key={qIdx} className="eqe-card">
            <div className="eqe-card-head">
              <strong className="eqe-q-no">Q{q.questionNo}</strong>
              <label className="eqe-field-label">
                점수:&nbsp;
                <input
                  type="number"
                  value={q.points ?? 1}
                  step={0.5}
                  onChange={e => updateQ(qIdx, { points: Number(e.target.value) || 1 })}
                  className="eqe-input-points"
                />
              </label>
              <label className="eqe-field-label">
                유형:&nbsp;
                <input
                  type="text"
                  value={q.category ?? ''}
                  list="exam-category-suggest"
                  placeholder="예: 어법/독해"
                  onChange={e => updateQ(qIdx, { category: e.target.value || null })}
                  className="eqe-input-category"
                />
              </label>
              <div className="eqe-card-head-end">
                <button
                  className="btn btn-danger btn-sm with-icon"
                  onClick={() => removeQuestion(qIdx)}
                ><Icon name="Trash2" size={14} /> 삭제</button>
              </div>
            </div>

            <textarea
              value={q.prompt}
              onChange={e => updateQ(qIdx, { prompt: e.target.value })}
              placeholder="문제 지문…"
              rows={3}
              className="eqe-prompt"
            />

            <div className="eqe-choices">
              {q.choices.map((c, cIdx) => {
                const n = cIdx + 1;
                const isCorrect = q.correctChoice === n;
                return (
                  <div key={cIdx} className="eqe-choice-row">
                    <button
                      onClick={() => updateQ(qIdx, { correctChoice: n })}
                      title="정답으로 설정"
                      className={isCorrect ? 'eqe-choice-btn is-correct' : 'eqe-choice-btn'}
                    >{n}</button>
                    <input
                      value={c}
                      onChange={e => updateChoice(qIdx, cIdx, e.target.value)}
                      placeholder={`보기 ${n}`}
                      className={isCorrect ? 'eqe-choice-input is-correct' : 'eqe-choice-input'}
                    />
                  </div>
                );
              })}
              <div className="with-icon eqe-choice-hint">
                <Icon name="ArrowLeft" size={12} /> 번호 버튼을 눌러 정답 설정 (현재: {q.correctChoice})
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-ghost with-icon eqe-add-btn"
        onClick={addQuestion}
      ><Icon name="Plus" size={16} /> 문제 추가</button>

      {msg && (
        <div className={msg.kind === 'ok' ? 'eqe-msg is-ok' : 'eqe-msg is-err'}>{msg.text}</div>
      )}

      <div className="eqe-footer">
        <button
          className="btn btn-secondary eqe-footer-cancel"
          onClick={() => navigate(backTo)}
        >취소</button>
        <button
          className="btn btn-primary btn-lg eqe-footer-save"
          onClick={handleSave}
          disabled={saving}
        >{saving ? '저장 중…' : `저장 (${questions.length}문항)`}</button>
      </div>
    </div>
  );
}
