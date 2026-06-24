import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, MessageSquare, AlertTriangle, ExternalLink, Image as ImageIcon } from 'lucide-react';
import {
  askAiTeacherApi,
  type AskAIQueueItem,
  type AskAIConversationDetail,
  type AskAIQueueSort,
  type AskAITeacherDecision,
  type AskAIConfidence,
} from '../api';
import { useConfirm } from '../components/Toast';
import './TeacherAskAIQueuePage.css';

const CONFIDENCE_LABEL: Record<AskAIConfidence, string> = {
  high: 'AI 확신도 높음',
  medium: 'AI 확신도 보통',
  low: 'AI 확신도 낮음',
};

const CONFIDENCE_BARS: Record<AskAIConfidence, number> = { low: 1, medium: 2, high: 3 };
const CONFIDENCE_COLOR: Record<AskAIConfidence, string> = {
  high: 'var(--success)',
  medium: 'var(--warning)',
  low: 'var(--danger)',
};

const DECISION_LABEL: Record<AskAITeacherDecision, string> = {
  ok: '확인 완료',
  comment: '코멘트 남김',
  ai_wrong: 'AI 응답 부정확',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function groupByDay(items: AskAIQueueItem[]): Array<{ key: string; label: string; items: AskAIQueueItem[] }> {
  const today = new Date();
  const todayKey = today.toDateString();
  const yesterdayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toDateString();
  const groups = new Map<string, AskAIQueueItem[]>();
  for (const it of items) {
    const d = new Date(it.started_at);
    const key = d.toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  return Array.from(groups.entries()).map(([key, arr]) => {
    let label = '';
    if (key === todayKey) label = '오늘';
    else if (key === yesterdayKey) label = '어제';
    else {
      const d = new Date(key);
      label = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    }
    return { key, label, items: arr };
  });
}

export default function TeacherAskAIQueuePage() {
  const [items, setItems] = useState<AskAIQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsTeacherOnly, setNeedsTeacherOnly] = useState(false);
  const [uncommentedOnly, setUncommentedOnly] = useState(false);
  const [sort, setSort] = useState<AskAIQueueSort>('uncommented_first');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AskAIConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [applying, setApplying] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const reloadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await askAiTeacherApi.queue({ needs_teacher: needsTeacherOnly, uncommented: uncommentedOnly, sort });
      setItems(res.items);
      setError(null);
      // 자동 선택: 현재 선택이 결과에 없으면 첫번째로
      if (res.items.length > 0 && !res.items.some((i) => i.conversation_id === selectedId)) {
        setSelectedId(res.items[0].conversation_id);
      } else if (res.items.length === 0) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (e) {
      setError((e as Error).message || '큐를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [needsTeacherOnly, uncommentedOnly, sort, selectedId]);

  useEffect(() => { void reloadQueue(); }, [needsTeacherOnly, uncommentedOnly, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    askAiTeacherApi.getConversation(selectedId)
      .then((d) => { setDetail(d); setComment(''); setError(null); })
      .catch((e) => setError((e as Error).message || '대화를 불러오지 못했습니다'))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const summary = useMemo(() => ({
    total: items.length,
    uncommented: items.filter((i) => i.decision === null).length,
    needs_teacher: items.filter((i) => i.needs_teacher).length,
  }), [items]);

  const grouped = useMemo(() => groupByDay(items), [items]);

  const applyDecision = async (decision: AskAITeacherDecision) => {
    if (!detail) return;
    if (decision === 'comment' && !comment.trim()) {
      setError('코멘트를 입력해주세요');
      return;
    }
    if (decision === 'ai_wrong') {
      if (!(await confirm('AI 응답이 부정확하다고 표시할까요? 학습 데이터로 적재됩니다.'))) return;
    }
    setApplying(true);
    try {
      await askAiTeacherApi.applyDecision({
        conversation_id: detail.conversation.id,
        decision,
        comment: decision === 'comment' ? comment.trim() : undefined,
      });
      setComment('');
      // 큐와 상세 둘 다 새로고침
      void reloadQueue();
      const updated = await askAiTeacherApi.getConversation(detail.conversation.id);
      setDetail(updated);
    } catch (e) {
      setError((e as Error).message || '저장 실패');
    } finally {
      setApplying(false);
    }
  };

  const selected = items.find((i) => i.conversation_id === selectedId) ?? null;

  return (
    <div className="askai-q">
      <header className="askai-q-header">
        <div>
          <h1 className="askai-q-title">설명 AI · 강사 큐</h1>
          <p className="askai-q-sub">학생 질문을 검토하고 코멘트를 남깁니다 · 최근 7일</p>
        </div>
        <div className="askai-q-summary">
          <div className="askai-q-stat">
            <span className="askai-q-stat-label">총 대화</span>
            <span className="askai-q-stat-num">{summary.total}</span>
          </div>
          <div className="askai-q-stat">
            <span className="askai-q-stat-label">미코멘트</span>
            <span className="askai-q-stat-num">{summary.uncommented}</span>
          </div>
          <div className="askai-q-stat">
            <span className="askai-q-stat-label">검토 필요</span>
            <span className={`askai-q-stat-num${summary.needs_teacher > 0 ? ' askai-q-stat-num--warn' : ''}`}>
              {summary.needs_teacher}
            </span>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="askai-q-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="askai-q-shell">
        {/* 좌측 — 큐 목록 */}
        <aside className="askai-q-list-pane" aria-label="대화 큐">
          <div className="askai-q-filters">
            <button
              type="button"
              className={`askai-q-chip${!needsTeacherOnly && !uncommentedOnly ? ' askai-q-chip--on' : ''}`}
              onClick={() => { setNeedsTeacherOnly(false); setUncommentedOnly(false); }}
            >
              전체
            </button>
            <button
              type="button"
              className={`askai-q-chip${uncommentedOnly ? ' askai-q-chip--on' : ''}`}
              onClick={() => setUncommentedOnly((v) => !v)}
            >
              미코멘트만
            </button>
            <button
              type="button"
              className={`askai-q-chip${needsTeacherOnly ? ' askai-q-chip--on' : ''}`}
              onClick={() => setNeedsTeacherOnly((v) => !v)}
            >
              검토 필요만
            </button>
            <span className="askai-q-sep" aria-hidden />
            <select
              className="askai-q-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as AskAIQueueSort)}
              aria-label="정렬"
            >
              <option value="uncommented_first">미코멘트 먼저</option>
              <option value="needs_teacher_first">검토 필요 먼저</option>
              <option value="recent">시간순</option>
            </select>
          </div>

          <div className="askai-q-list" tabIndex={0}>
            {loading && <div className="askai-q-empty">불러오는 중…</div>}
            {!loading && items.length === 0 && (
              <div className="askai-q-empty">조건에 해당하는 대화가 없습니다</div>
            )}
            {grouped.map((g) => (
              <div key={g.key} className="askai-q-day-group">
                <div className="askai-q-day-label">{g.label}</div>
                {g.items.map((it) => {
                  const isSelected = it.conversation_id === selectedId;
                  return (
                    <button
                      key={it.conversation_id}
                      type="button"
                      className={`askai-q-slip${isSelected ? ' askai-q-slip--selected' : ''}`}
                      onClick={() => setSelectedId(it.conversation_id)}
                      style={{ ['--slip-color' as string]: CONFIDENCE_COLOR[it.confidence] }}
                    >
                      <span className="askai-q-slip-stripe" aria-hidden />
                      <div className="askai-q-slip-body">
                        <div className="askai-q-slip-row1">
                          <span className="askai-q-slip-name">{it.student_name}</span>
                          <span className="askai-q-slip-time">{formatDateTime(it.started_at)}</span>
                        </div>
                        <div className="askai-q-slip-row2">{it.unit}</div>
                        <div className="askai-q-slip-row3">
                          <ConfidenceMeter level={it.confidence} />
                          {it.needs_teacher && <span className="badge badge-warning">검토 필요</span>}
                          {it.decision === null
                            ? <span className="badge badge-neutral">미코멘트</span>
                            : <span className="badge badge-success">{DECISION_LABEL[it.decision]}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* 우측 — 상세 패널 */}
        <main className="askai-q-detail-pane" aria-label="대화 상세">
          {!selected && !detail && (
            <div className="askai-q-detail-empty">왼쪽 목록에서 대화를 선택하세요</div>
          )}
          {detailLoading && <div className="askai-q-detail-empty">불러오는 중…</div>}
          {detail && (
            <>
              <header className="askai-q-detail-bar">
                <div>
                  <span className="askai-q-detail-student">{detail.conversation.student_name}</span>
                  <span className="askai-q-detail-sep">·</span>
                  <span className="askai-q-detail-unit">{detail.conversation.unit_id ?? '미분류'}</span>
                  <span className="askai-q-detail-sep">·</span>
                  <span className="askai-q-detail-when">{new Date(detail.conversation.started_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </header>

              <div className="askai-q-detail-scroll">
                {/* 학생 질문 */}
                <article className="askai-q-question-card">
                  <div className="askai-q-question-avatar" aria-hidden>
                    {detail.conversation.student_name.slice(-1)}
                  </div>
                  <div>
                    <h2 className="askai-q-question-meta">
                      학생 질문
                      <small>{formatDateTime(detail.conversation.started_at)}</small>
                    </h2>
                    <p className="askai-q-question-text">{detail.conversation.message}</p>
                    {detail.conversation.attached_photos.length > 0 && (
                      <div className="askai-q-attachments">
                        {detail.conversation.attached_photos.map((p) => (
                          <span key={p} className="askai-q-att">
                            <ImageIcon size={12} aria-hidden />
                            사진 첨부
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>

                {/* AI 응답 */}
                <section className="askai-q-ai">
                  <header className="askai-q-ai-head">
                    <h3>AI 응답</h3>
                    <span className="askai-q-ai-conf">{CONFIDENCE_LABEL[detail.conversation.confidence]}</span>
                    {detail.conversation.needs_teacher && (
                      <span className="badge badge-warning">검토 필요</span>
                    )}
                    <span className="askai-q-ai-spacer" />
                    {detail.conversation.duration_ms != null && (
                      <span className="askai-q-ai-meta">
                        {Math.round(detail.conversation.duration_ms / 100) / 10}s · {detail.conversation.used_tokens ?? 0} tok
                      </span>
                    )}
                  </header>

                  <AIResponseBody response={detail.conversation.response} />
                </section>

                {/* 결정 이력 */}
                {detail.decisions.length > 0 && (
                  <section className="askai-q-decisions">
                    <h3 className="askai-q-decisions-label">강사 결정 이력</h3>
                    <ul className="askai-q-decisions-list">
                      {detail.decisions.map((d) => (
                        <li key={d.id} className="askai-q-decision-row">
                          <span className={`askai-q-decision-tag askai-q-decision-tag--${d.decision}`}>
                            {DECISION_LABEL[d.decision]}
                          </span>
                          {d.comment && <p className="askai-q-decision-comment">"{d.comment}"</p>}
                          <span className="askai-q-decision-when">
                            {new Date(d.applied_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {/* sticky action rail */}
              <div className="askai-q-action-rail">
                <div className="askai-q-action-card">
                  <textarea
                    className="askai-q-action-textarea"
                    placeholder="학생에게 남길 코멘트 (선택)…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={2000}
                    rows={3}
                  />
                  <div className="askai-q-action-buttons">
                    <button
                      type="button"
                      className="btn btn-present askai-q-action-btn with-icon"
                      onClick={() => applyDecision('ok')}
                      disabled={applying}
                    >
                      <Check size={16} aria-hidden />
                      확인 완료
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary askai-q-action-btn with-icon"
                      onClick={() => applyDecision('comment')}
                      disabled={applying || !comment.trim()}
                    >
                      <MessageSquare size={16} aria-hidden />
                      코멘트 남기기
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger askai-q-action-btn with-icon"
                      onClick={() => applyDecision('ai_wrong')}
                      disabled={applying}
                    >
                      <AlertTriangle size={16} aria-hidden />
                      AI 부정확
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {ConfirmDialog}
    </div>
  );
}

function ConfidenceMeter({ level }: { level: AskAIConfidence }) {
  const filled = CONFIDENCE_BARS[level];
  return (
    <span className="askai-q-conf" aria-label={CONFIDENCE_LABEL[level]}>
      <span className="askai-q-conf-bars">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`askai-q-conf-bar${i < filled ? ' askai-q-conf-bar--on' : ''}`}
            style={i < filled ? { background: CONFIDENCE_COLOR[level] } : undefined}
            aria-hidden
          />
        ))}
      </span>
      <span className="askai-q-conf-text">{CONFIDENCE_LABEL[level]}</span>
    </span>
  );
}

function AIResponseBody({ response }: { response: unknown }) {
  if (!response || typeof response !== 'object') {
    return <p className="askai-q-ai-empty">AI 응답 데이터를 표시할 수 없습니다.</p>;
  }
  const r = response as { steps?: Array<{ title?: string; body?: string; formula?: string }>; citations?: Array<{ unit?: string; source?: string; ref?: string }> };
  const steps = Array.isArray(r.steps) ? r.steps : [];
  const citations = Array.isArray(r.citations) ? r.citations : [];

  return (
    <>
      {steps.length === 0 ? (
        <p className="askai-q-ai-empty">단계별 응답이 없습니다.</p>
      ) : (
        <ol className="askai-q-ai-steps">
          {steps.map((s, i) => (
            <li key={i} className="askai-q-ai-step">
              <span className="askai-q-ai-step-num">{i + 1}</span>
              <div className="askai-q-ai-step-body">
                {s.title && <h4 className="askai-q-ai-step-title">{s.title}</h4>}
                {s.body && <p className="askai-q-ai-step-text">{s.body}</p>}
                {s.formula && <pre className="askai-q-ai-step-formula">{s.formula}</pre>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {citations.length > 0 && (
        <div className="askai-q-citations">
          <div className="askai-q-citations-label">학습 자료 인용</div>
          <ul>
            {citations.map((c, i) => (
              <li key={i}>
                {c.unit && <b>{c.unit}</b>}
                {c.source && <span> · {c.source}</span>}
                {c.ref && <span className="askai-q-citations-ref"> ({c.ref})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
