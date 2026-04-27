import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  Curriculum,
  CurriculumDetail,
  CurriculumItem,
  CurriculumCreateInput,
  CurriculumItemInput,
} from '../api';
import Modal from '../components/Modal';
import { toast, useConfirm } from '../components/Toast';
import './CurriculumPage.css';

const COMMON_TERMS = ['2026-1', '2026-여름', '2026-2', '2026-겨울'];
const COMMON_GRADES = ['초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const COMMON_SUBJECTS = ['수학', '영어', '국어', '과학', '사회'];

export default function CurriculumPage() {
  const [list, setList] = useState<Curriculum[]>([]);
  const [filter, setFilter] = useState({ term: '', grade: '', subject: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CurriculumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<CurriculumCreateInput>({
    term: COMMON_TERMS[0], grade: '중1', subject: '수학', title: '', description: '',
  });
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();
  // 신규 빈 행 (DB 미저장) — unit_name 입력 후 onBlur에서 INSERT
  const [pendingDraft, setPendingDraft] = useState<{ unit_name: string } | null>(null);
  const [savedHint, setSavedHint] = useState<string>('');
  const hintTimer = useRef<number | null>(null);
  const flashSaved = () => {
    setSavedHint('저장됨 · 방금');
    window.clearTimeout(hintTimer.current ?? 0);
    hintTimer.current = window.setTimeout(() => setSavedHint(''), 2000);
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.listCurricula({
        term: filter.term || undefined,
        grade: filter.grade || undefined,
        subject: filter.subject || undefined,
      });
      setList(rows);
      if (rows.length > 0 && !rows.some((r) => r.id === selectedId)) {
        setSelectedId(rows[0].id);
      } else if (rows.length === 0) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (err) {
      toast.error('불러오기 실패: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter, selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await api.getCurriculum(id);
      setDetail(d);
    } catch (err) {
      toast.error('상세 불러오기 실패: ' + (err as Error).message);
    }
  }, []);

  useEffect(() => { loadList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);

  const handleCreate = async () => {
    if (!draft.title.trim()) {
      toast.error('제목을 입력하세요');
      return;
    }
    try {
      const c = await api.createCurriculum({
        term: draft.term.trim(),
        grade: draft.grade.trim(),
        subject: draft.subject.trim(),
        title: draft.title.trim(),
        description: draft.description?.trim() || null,
      });
      setShowCreate(false);
      setDraft({ term: COMMON_TERMS[0], grade: '중1', subject: '수학', title: '', description: '' });
      setSelectedId(c.id);
      loadList();
      toast.success('카탈로그 생성');
    } catch (err) {
      toast.error('생성 실패: ' + (err as Error).message);
    }
  };

  const handleArchive = async () => {
    if (!detail) return;
    const ok = await confirmDialog(`"${detail.title}" 카탈로그를 보관할까요?`);
    if (!ok) return;
    try {
      await api.archiveCurriculum(detail.id);
      toast.success('보관 완료');
      setSelectedId(null);
      setDetail(null);
      loadList();
    } catch (err) {
      toast.error('실패: ' + (err as Error).message);
    }
  };

  // 빈 행 추가 — 사용자가 unit_name 입력 후 onBlur에서 실제 INSERT
  const handleAddDraft = () => {
    if (!detail || pendingDraft) return;
    setPendingDraft({ unit_name: '' });
  };

  const handleSaveDraft = async (unit_name: string) => {
    if (!detail) return;
    const trimmed = unit_name.trim();
    if (!trimmed) {
      setPendingDraft(null);
      return;
    }
    const order = (detail.items.length + 1) * 10;
    try {
      const it = await api.addCurriculumItem(detail.id, {
        unit_name: trimmed,
        kind: 'type',
        order_idx: order,
      });
      setDetail({ ...detail, items: [...detail.items, it] });
      setPendingDraft(null);
      flashSaved();
    } catch (err) {
      toast.error('실패: ' + (err as Error).message);
    }
  };

  const handlePatchItem = async (item: CurriculumItem, patch: Partial<CurriculumItemInput>) => {
    if (!detail) return;
    try {
      await api.updateCurriculumItem(detail.id, item.id, patch);
      setDetail({
        ...detail,
        items: detail.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)),
      });
      flashSaved();
    } catch (err) {
      toast.error('실패: ' + (err as Error).message);
    }
  };

  // 항목 순서 ↑↓ — sort by order_idx 후 swap
  const handleMoveItem = async (item: CurriculumItem, direction: -1 | 1) => {
    if (!detail) return;
    const sorted = detail.items.slice().sort((a, b) => a.order_idx - b.order_idx);
    const idx = sorted.findIndex((i) => i.id === item.id);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[targetIdx];
    try {
      await api.reorderCurriculumItems(detail.id, [
        { id: a.id, order_idx: b.order_idx },
        { id: b.id, order_idx: a.order_idx },
      ]);
      setDetail({
        ...detail,
        items: detail.items.map((i) => {
          if (i.id === a.id) return { ...i, order_idx: b.order_idx };
          if (i.id === b.id) return { ...i, order_idx: a.order_idx };
          return i;
        }),
      });
      flashSaved();
    } catch (err) {
      toast.error('순서 변경 실패: ' + (err as Error).message);
    }
  };

  const handleDeleteItem = async (item: CurriculumItem) => {
    if (!detail) return;
    const ok = await confirmDialog(`"${item.unit_name}" 삭제할까요?`);
    if (!ok) return;
    try {
      await api.deleteCurriculumItem(detail.id, item.id);
      setDetail({ ...detail, items: detail.items.filter((i) => i.id !== item.id) });
    } catch (err) {
      toast.error('실패: ' + (err as Error).message);
    }
  };

  const filteredEmpty = list.length === 0 && !loading;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">커리큘럼 관리</h1>
          <p className="curr-page-subtitle">
            학기/학년/과목별 카탈로그를 만들어 학생에게 일괄 적용합니다.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + 새 카탈로그
        </button>
      </div>

      <div className="curr-toolbar" role="region" aria-label="필터">
        <select className="input" value={filter.term} onChange={(e) => setFilter({ ...filter, term: e.target.value })}>
          <option value="">학기 전체</option>
          {COMMON_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input" value={filter.grade} onChange={(e) => setFilter({ ...filter, grade: e.target.value })}>
          <option value="">학년 전체</option>
          {COMMON_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="input" value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })}>
          <option value="">과목 전체</option>
          {COMMON_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="curr-grid">
        {/* 좌: 카탈로그 목록 */}
        <div className="curr-list-panel" role="region" aria-label="카탈로그 목록">
          <div className="curr-list-header">{loading ? '불러오는 중…' : `${list.length}개`}</div>
          {filteredEmpty ? (
            <div className="empty-state">
              <div className="empty-state-title">카탈로그가 없습니다</div>
              <div className="empty-state-desc">우측 상단 + 새 카탈로그로 시작하세요.</div>
            </div>
          ) : (
            list.map((c) => (
              <button
                key={c.id}
                className="curr-list-item"
                aria-current={c.id === selectedId ? 'true' : undefined}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="curr-list-meta">{c.term} · {c.grade} · {c.subject}</div>
                <div className="curr-list-title">{c.title}</div>
                <div className="curr-list-counts">
                  항목 {c.item_count ?? 0} · 사용 학생 {c.student_count ?? 0}명
                </div>
              </button>
            ))
          )}
        </div>

        {/* 우: 상세 + 항목 편집 */}
        <div className="curr-detail" role="region" aria-label="카탈로그 상세">
          {!detail ? (
            <div className="empty-state">
              <div className="empty-state-title">카탈로그를 선택하세요</div>
              <div className="empty-state-desc">왼쪽 목록에서 카탈로그를 선택하면 항목을 편집할 수 있습니다.</div>
            </div>
          ) : (
            <div className="curr-detail-stack">
              <div className="curr-detail-head">
                <div>
                  <div className="curr-detail-eyebrow">
                    {detail.term} · {detail.grade} · {detail.subject}
                  </div>
                  <h2 className="curr-detail-title">{detail.title}</h2>
                  {detail.description && (
                    <p className="curr-detail-description">{detail.description}</p>
                  )}
                </div>
                <button
                  className="btn btn-sm curr-archive-btn"
                  onClick={handleArchive}
                  aria-label="이 카탈로그 보관"
                >
                  보관
                </button>
              </div>

              <section aria-labelledby="curr-items-title">
                <div className="curr-section-head">
                  <h3 id="curr-items-title" className="curr-section-title">
                    카탈로그 항목 ({detail.items.length})
                  </h3>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleAddDraft}
                    disabled={!!pendingDraft}
                  >
                    + 항목 추가
                  </button>
                </div>
                <div
                  className={`curr-autosave-hint${savedHint ? ' curr-autosave-hint--saved' : ''}`}
                  aria-live="polite"
                >
                  {savedHint || (pendingDraft ? '단원/유형명 입력 후 다른 곳을 클릭하면 저장됩니다' : '')}
                </div>
                {detail.items.length === 0 && !pendingDraft ? (
                  <div className="empty-state">
                    <div className="empty-state-desc">+ 항목 추가로 시작하세요.</div>
                  </div>
                ) : (
                  <table className="curr-items-table">
                    <thead>
                      <tr>
                        <th className="curr-item-reorder">순서</th>
                        <th>유형</th>
                        <th>교재</th>
                        <th>단원/유형명</th>
                        <th>기본 사유</th>
                        <th className="curr-item-actions">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items
                        .slice()
                        .sort((a, b) => a.order_idx - b.order_idx)
                        .map((it, idx, arr) => (
                          <tr key={it.id}>
                            <td className="curr-item-reorder">
                              <button
                                className="curr-item-reorder-btn"
                                disabled={idx === 0}
                                onClick={() => handleMoveItem(it, -1)}
                                aria-label={`${it.unit_name} 위로 이동`}
                              >↑</button>
                              <button
                                className="curr-item-reorder-btn"
                                disabled={idx === arr.length - 1}
                                onClick={() => handleMoveItem(it, 1)}
                                aria-label={`${it.unit_name} 아래로 이동`}
                                style={{ marginLeft: 4 }}
                              >↓</button>
                            </td>
                            <td>
                              <select
                                className="input"
                                value={it.kind}
                                onChange={(e) => handlePatchItem(it, { kind: e.target.value as 'unit' | 'type' })}
                              >
                                <option value="type">유형</option>
                                <option value="unit">단원</option>
                              </select>
                            </td>
                            <td>
                              <input
                                className="input"
                                defaultValue={it.textbook ?? ''}
                                placeholder="-"
                                onBlur={(e) => {
                                  const v = e.target.value.trim() || null;
                                  if (v !== it.textbook) handlePatchItem(it, { textbook: v });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className="input"
                                defaultValue={it.unit_name}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v && v !== it.unit_name) handlePatchItem(it, { unit_name: v });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className="input"
                                defaultValue={it.default_purpose ?? ''}
                                placeholder="진도, 심화"
                                onBlur={(e) => {
                                  const v = e.target.value.trim() || null;
                                  if (v !== it.default_purpose) handlePatchItem(it, { default_purpose: v });
                                }}
                              />
                            </td>
                            <td className="curr-item-actions">
                              <button
                                className="btn btn-sm curr-archive-btn"
                                onClick={() => handleDeleteItem(it)}
                                aria-label={`${it.unit_name} 삭제`}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      {pendingDraft && (
                        <tr>
                          <td className="curr-item-reorder">—</td>
                          <td>유형</td>
                          <td>—</td>
                          <td>
                            <input
                              className="input"
                              autoFocus
                              placeholder="예: 이차함수의 그래프"
                              defaultValue=""
                              onBlur={(e) => handleSaveDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setPendingDraft(null);
                              }}
                            />
                          </td>
                          <td>—</td>
                          <td className="curr-item-actions">
                            <button
                              className="btn btn-sm curr-archive-btn"
                              onClick={() => setPendingDraft(null)}
                              aria-label="새 항목 취소"
                            >
                              취소
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <Modal.Header>새 카탈로그</Modal.Header>
          <Modal.Body>
            <div className="curr-form">
              <div className="curr-form-row">
                <label>
                  <span className="curr-form-field-label">학기</span>
                  <select className="input" value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value })}>
                    {COMMON_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label>
                  <span className="curr-form-field-label">학년</span>
                  <select className="input" value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value })}>
                    {COMMON_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
                <label>
                  <span className="curr-form-field-label">과목</span>
                  <select className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}>
                    {COMMON_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span className="curr-form-field-label">제목</span>
                <input
                  className="input"
                  placeholder={`${draft.term} ${draft.grade} ${draft.subject}`}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <label>
                <span className="curr-form-field-label">설명 (선택)</span>
                <textarea
                  className="input"
                  rows={2}
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </label>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleCreate}>생성</button>
          </Modal.Footer>
        </Modal>
      )}

      {ConfirmDialog}
    </div>
  );
}
