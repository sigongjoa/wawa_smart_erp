import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, OrderingProblem, SubmitResult, getImageUrl } from '../api';
import KaTeX from '../components/KaTeX';

interface StepItem {
  id: string;
  content: string;
  content_image: string | null;
}

function SortableStep({ item, idx }: { item: StepItem; idx: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="ordering-step" {...attributes} {...listeners}>
      <span className="ordering-step-handle">☰</span>
      <span className="ordering-step-num">{idx + 1}</span>
      <div className="ordering-step-content">
        {item.content_image ? (
          <img src={getImageUrl(item.content_image)} alt="step" className="ordering-step-img" />
        ) : (
          <KaTeX content={item.content} />
        )}
      </div>
    </div>
  );
}

export default function ProofOrderingPage() {
  const navigate = useNavigate();
  const { proofId } = useParams<{ proofId: string }>();
  const [problem, setProblem] = useState<OrderingProblem | null>(null);
  const [items, setItems] = useState<StepItem[]>([]);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(new Date().toISOString());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  useEffect(() => {
    if (!proofId) return;
    api.getOrdering(proofId)
      .then(p => { setProblem(p); setItems(p.steps); })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [proofId, navigate]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems(prev => {
      const oldIdx = prev.findIndex(i => i.id === active.id);
      const newIdx = prev.findIndex(i => i.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  const handleSubmit = async () => {
    if (!proofId) return;
    setSubmitting(true);
    try {
      const answers = items.map(i => i.id);
      const res = await api.submitProof(proofId, { mode: 'ordering', answers, start_time: startTime });
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
    api.getOrdering(proofId!)
      .then(p => { setProblem(p); setItems(p.steps); })
      .catch((err) => alert('문제 재로드 실패: ' + (err?.message || '')))
      .finally(() => setLoading(false));
  };

  if (loading) return <div className="page-center"><div className="loading">문제 생성 중...</div></div>;
  if (!problem) return null;

  return (
    <div className="proof-play-page">
      <header className="play-header">
        <button className="btn-ghost" onClick={() => navigate('/')}>← 홈</button>
        <span>순서배치</span>
      </header>

      <div className="proof-play-title">
        <h2>{problem.proof.title}</h2>
        <span className="proof-play-meta">
          {problem.proof.grade} · {'★'.repeat(problem.proof.difficulty)} · {problem.total_steps}단계
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
          <p className="proof-play-instruction">올바른 순서로 배치하세요</p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="ordering-list">
                {items.map((item, idx) => (
                  <SortableStep key={item.id} item={item} idx={idx} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

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

          {/* 단계별 결과 */}
          <div className="proof-result-steps">
            {result.detail.results?.map((r: any, i: number) => (
              <div key={i} className={`proof-result-step ${r.correct ? 'correct' : 'wrong'}`}>
                <span>Step {r.position}</span>
                <span>{r.correct ? 'O' : 'X'}</span>
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
