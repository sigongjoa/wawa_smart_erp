import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Proof, ProofDetail, ProofStep, ProofStepInput, GachaStudent } from '../api';
import { toast, useConfirm } from '../components/Toast';

const GRADE_OPTIONS = ['중1', '중2', '중3', '고1', '고2', '고3'];
const DIFFICULTY_OPTIONS = [1, 2, 3, 4, 5];

type Tab = 'mine' | 'shared';

interface BlankDef {
  position: number;
  length: number;
  answer: string;
}

interface EditStep {
  id?: string;
  content: string;
  content_image?: string;
  hint?: string;
  hasBlanks: boolean;
  blanks: BlankDef[];
}

export default function ProofEditorPage() {
  const [tab, setTab] = useState<Tab>('mine');
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [sharedProofs, setSharedProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 편집 상태
  const [editingProof, setEditingProof] = useState<ProofDetail | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isNew, setIsNew] = useState(false);

  // 편집 폼
  const [formTitle, setFormTitle] = useState('');
  const [formGrade, setFormGrade] = useState('');
  const [formChapter, setFormChapter] = useState('');
  const [formDifficulty, setFormDifficulty] = useState(1);
  const [formDescription, setFormDescription] = useState('');
  const [formDescImage, setFormDescImage] = useState<string | null>(null);
  const [formSteps, setFormSteps] = useState<EditStep[]>([]);
  const [saving, setSaving] = useState(false);

  // 배정
  const [assignProofId, setAssignProofId] = useState<string | null>(null);
  const [students, setStudents] = useState<GachaStudent[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // 미리보기
  const [previewProof, setPreviewProof] = useState<ProofDetail | null>(null);

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const loadMine = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (gradeFilter) params.grade = gradeFilter;
      const data = await api.getProofs(params);
      setProofs(data || []);
    } catch {
      setProofs([]);
    } finally {
      setLoading(false);
    }
  }, [gradeFilter]);

  const loadShared = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (gradeFilter) params.grade = gradeFilter;
      if (searchQuery) params.q = searchQuery;
      const data = await api.getSharedProofs(params);
      setSharedProofs(data || []);
    } catch {
      setSharedProofs([]);
    } finally {
      setLoading(false);
    }
  }, [gradeFilter, searchQuery]);

  useEffect(() => {
    if (tab === 'mine') loadMine();
    else loadShared();
  }, [tab, loadMine, loadShared]);

  useEffect(() => {
    api.getGachaStudents().then(setStudents).catch(() => {});
  }, []);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  // ── 편집기 열기 ──

  const openNewProof = () => {
    setIsNew(true);
    setEditingProof(null);
    setFormTitle(''); setFormGrade(''); setFormChapter('');
    setFormDifficulty(1); setFormDescription(''); setFormDescImage(null);
    setFormSteps([{ content: '', hasBlanks: false, blanks: [] }]);
    setShowEditor(true);
  };

  const openEditProof = async (proofId: string) => {
    try {
      const detail = await api.getProof(proofId);
      setEditingProof(detail);
      setIsNew(false);
      setFormTitle(detail.title);
      setFormGrade(detail.grade);
      setFormChapter(detail.chapter || '');
      setFormDifficulty(detail.difficulty);
      setFormDescription(detail.description || '');
      setFormDescImage(detail.description_image);
      setFormSteps(detail.steps.map(s => ({
        id: s.id,
        content: s.content,
        content_image: s.content_image || undefined,
        hint: s.hint || '',
        hasBlanks: !!s.blanks_json,
        blanks: s.blanks_json ? JSON.parse(s.blanks_json) : [],
      })));
      setShowEditor(true);
    } catch (err) {
      toast.error('불러오기 실패: ' + (err as Error).message);
    }
  };

  // ── 단계 편집 ──

  const addStep = () => {
    setFormSteps([...formSteps, { content: '', hasBlanks: false, blanks: [] }]);
  };

  const removeStep = (idx: number) => {
    setFormSteps(formSteps.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, changes: Partial<EditStep>) => {
    setFormSteps(formSteps.map((s, i) => i === idx ? { ...s, ...changes } : s));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= formSteps.length) return;
    const arr = [...formSteps];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setFormSteps(arr);
  };

  const addBlank = (stepIdx: number) => {
    const step = formSteps[stepIdx];
    const blanks = [...step.blanks, { position: 0, length: 1, answer: '' }];
    updateStep(stepIdx, { hasBlanks: true, blanks });
  };

  const updateBlank = (stepIdx: number, blankIdx: number, changes: Partial<BlankDef>) => {
    const step = formSteps[stepIdx];
    const blanks = step.blanks.map((b, i) => i === blankIdx ? { ...b, ...changes } : b);
    updateStep(stepIdx, { blanks });
  };

  const removeBlank = (stepIdx: number, blankIdx: number) => {
    const step = formSteps[stepIdx];
    const blanks = step.blanks.filter((_, i) => i !== blankIdx);
    updateStep(stepIdx, { blanks, hasBlanks: blanks.length > 0 });
  };

  // ── 이미지 업로드 ──

  const handleDescImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.uploadProofImage(file);
      setFormDescImage(result.key);
      toast.success('이미지 업로드 완료');
    } catch (err) {
      toast.error('업로드 실패: ' + (err as Error).message);
    }
  };

  const handleStepImageUpload = async (stepIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.uploadProofImage(file);
      updateStep(stepIdx, { content_image: result.key });
      toast.success('이미지 업로드 완료');
    } catch (err) {
      toast.error('업로드 실패: ' + (err as Error).message);
    }
  };

  // ── 저장 ──

  const handleSave = async () => {
    if (!formTitle.trim()) { toast.error('제목은 필수입니다'); return; }
    if (!formGrade) { toast.error('학년을 선택해주세요'); return; }
    if (formSteps.length === 0 || !formSteps[0].content.trim()) {
      toast.error('최소 1개 단계가 필요합니다'); return;
    }

    setSaving(true);
    try {
      const steps: ProofStepInput[] = formSteps.map(s => ({
        id: s.id,
        content: s.content,
        content_image: s.content_image,
        blanks_json: s.hasBlanks && s.blanks.length > 0 ? JSON.stringify(s.blanks) : undefined,
        hint: s.hint || undefined,
      }));

      if (isNew) {
        await api.createProof({
          title: formTitle.trim(),
          grade: formGrade,
          chapter: formChapter || undefined,
          difficulty: formDifficulty,
          description: formDescription || undefined,
          description_image: formDescImage || undefined,
          steps,
        });
        toast.success('증명 생성 완료');
      } else if (editingProof) {
        await api.updateProof(editingProof.id, {
          title: formTitle.trim(),
          grade: formGrade,
          chapter: formChapter || undefined,
          difficulty: formDifficulty,
          description: formDescription || undefined,
          description_image: formDescImage || undefined,
        });
        await api.updateProofSteps(editingProof.id, steps);
        toast.success('증명 수정 완료');
      }

      setShowEditor(false);
      loadMine();
    } catch (err) {
      toast.error('저장 실패: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── 삭제 / 공유 / 복사 ──

  const handleDelete = async (p: Proof) => {
    const ok = await confirmDialog(`"${p.title}" 증명을 삭제하시겠습니까?`);
    if (!ok) return;
    try {
      await api.deleteProof(p.id);
      toast.success('삭제 완료');
      loadMine();
    } catch (err) {
      toast.error('삭제 실패: ' + (err as Error).message);
    }
  };

  const handleShare = async (p: Proof) => {
    try {
      if (p.is_shared) {
        await api.unshareProof(p.id);
        toast.success('공유 해제');
      } else {
        await api.shareProof(p.id);
        toast.success('공유 마켓에 공개');
      }
      loadMine();
    } catch (err) {
      toast.error('공유 실패: ' + (err as Error).message);
    }
  };

  const handleCopy = async (p: Proof) => {
    try {
      const result = await api.copyProof(p.id);
      toast.success(`"${result.title}" 복사 완료`);
      setTab('mine');
      loadMine();
    } catch (err) {
      toast.error('복사 실패: ' + (err as Error).message);
    }
  };

  // ── 미리보기 ──

  const openPreview = async (proofId: string) => {
    try {
      const detail = await api.getProof(proofId);
      setPreviewProof(detail);
    } catch (err) {
      toast.error('불러오기 실패: ' + (err as Error).message);
    }
  };

  // ── 배정 ──

  const openAssign = (proofId: string) => {
    setAssignProofId(proofId);
    setSelectedStudents(new Set());
  };

  const handleAssign = async () => {
    if (!assignProofId || selectedStudents.size === 0) return;
    try {
      await api.assignProof(assignProofId, Array.from(selectedStudents));
      toast.success(`${selectedStudents.size}명에게 배정 완료`);
      setAssignProofId(null);
    } catch (err) {
      toast.error('배정 실패: ' + (err as Error).message);
    }
  };

  const difficultyStars = (d: number) => '★'.repeat(d) + '☆'.repeat(5 - d);

  return (
    <div className="gacha-page">
      {ConfirmDialog}

      <div className="gacha-page-header">
        <h1>증명 연습 관리</h1>
        <button className="btn-primary" onClick={openNewProof}>+ 새 증명 만들기</button>
      </div>

      {/* 탭 */}
      <div className="gacha-tabs">
        <button className={`gacha-tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>내 증명</button>
        <button className={`gacha-tab ${tab === 'shared' ? 'active' : ''}`} onClick={() => setTab('shared')}>공유 마켓</button>
      </div>

      {/* 필터 */}
      <div className="gacha-filters">
        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="gacha-select">
          <option value="">전체 학년</option>
          {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        {tab === 'shared' && (
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="gacha-search"
          />
        )}
      </div>

      {/* ── 편집기 ── */}
      {showEditor && (
        <div className="proof-editor">
          <h2>{isNew ? '새 증명 만들기' : '증명 수정'}</h2>

          <div className="proof-editor-meta">
            <input placeholder="증명 제목" value={formTitle} onChange={e => setFormTitle(e.target.value)} className="gacha-input proof-title-input" />
            <div className="gacha-form-row">
              <select value={formGrade} onChange={e => setFormGrade(e.target.value)}>
                <option value="">학년 선택</option>
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input placeholder="단원" value={formChapter} onChange={e => setFormChapter(e.target.value)} />
              <select value={formDifficulty} onChange={e => setFormDifficulty(Number(e.target.value))}>
                {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>난이도 {d} {difficultyStars(d)}</option>)}
              </select>
            </div>
            <textarea
              placeholder="문제 설명 (선택)"
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              rows={2}
              className="gacha-textarea"
            />
            <div className="gacha-form-row">
              <label className="proof-image-label">
                설명 이미지:
                <input type="file" accept="image/*" onChange={handleDescImageUpload} />
              </label>
              {formDescImage && (
                <div className="proof-image-preview">
                  <img src={`${API_BASE}/api/proof/image/${formDescImage}`} alt="desc" />
                  <button className="btn-sm btn-danger" onClick={() => setFormDescImage(null)}>제거</button>
                </div>
              )}
            </div>
          </div>

          {/* 단계 편집 */}
          <h3>단계 편집</h3>
          <div className="proof-steps-editor">
            {formSteps.map((step, idx) => (
              <div key={idx} className="proof-step-edit">
                <div className="proof-step-header">
                  <span className="proof-step-num">Step {idx + 1}</span>
                  <div className="proof-step-controls">
                    <button className="btn-sm" onClick={() => moveStep(idx, -1)} disabled={idx === 0} title="위로">&#9650;</button>
                    <button className="btn-sm" onClick={() => moveStep(idx, 1)} disabled={idx === formSteps.length - 1} title="아래로">&#9660;</button>
                    <button className="btn-sm btn-danger" onClick={() => removeStep(idx)} disabled={formSteps.length <= 1}>&#10005;</button>
                  </div>
                </div>

                <textarea
                  placeholder="단계 내용 (KaTeX: $\frac{a}{b}$)"
                  value={step.content}
                  onChange={e => updateStep(idx, { content: e.target.value })}
                  rows={2}
                  className="gacha-textarea"
                />

                <div className="proof-step-options">
                  <label className="proof-image-label">
                    이미지:
                    <input type="file" accept="image/*" onChange={e => handleStepImageUpload(idx, e)} />
                  </label>
                  {step.content_image && (
                    <div className="proof-image-preview proof-image-preview--small">
                      <img src={`${API_BASE}/api/proof/image/${step.content_image}`} alt="step" />
                      <button className="btn-sm btn-danger" onClick={() => updateStep(idx, { content_image: undefined })}>제거</button>
                    </div>
                  )}
                </div>

                <input
                  placeholder="힌트 (선택)"
                  value={step.hint || ''}
                  onChange={e => updateStep(idx, { hint: e.target.value })}
                  className="gacha-input"
                />

                {/* 빈칸 설정 */}
                <div className="proof-blanks">
                  <label>
                    <input
                      type="checkbox"
                      checked={step.hasBlanks}
                      onChange={e => {
                        if (!e.target.checked) updateStep(idx, { hasBlanks: false, blanks: [] });
                        else updateStep(idx, { hasBlanks: true });
                      }}
                    /> 빈칸 있음
                  </label>

                  {step.hasBlanks && (
                    <div className="proof-blanks-list">
                      {step.blanks.map((b, bi) => (
                        <div key={bi} className="proof-blank-item">
                          <input
                            type="number"
                            placeholder="시작 위치"
                            value={b.position}
                            onChange={e => updateBlank(idx, bi, { position: Number(e.target.value) })}
                            min={0}
                            className="proof-blank-input"
                          />
                          <input
                            type="number"
                            placeholder="길이"
                            value={b.length}
                            onChange={e => updateBlank(idx, bi, { length: Number(e.target.value) })}
                            min={1}
                            className="proof-blank-input"
                          />
                          <input
                            placeholder="정답"
                            value={b.answer}
                            onChange={e => updateBlank(idx, bi, { answer: e.target.value })}
                            className="proof-blank-answer"
                          />
                          <button className="btn-sm btn-danger" onClick={() => removeBlank(idx, bi)}>&#10005;</button>
                        </div>
                      ))}
                      <button className="btn-sm" onClick={() => addBlank(idx)}>+ 빈칸 추가</button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button className="btn-secondary proof-add-step" onClick={addStep}>+ 단계 추가</button>
          </div>

          <div className="proof-editor-actions">
            <button className="btn-secondary" onClick={() => setShowEditor(false)}>취소</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* ── 미리보기 모달 ── */}
      {previewProof && (
        <div className="gacha-modal-overlay" onClick={() => setPreviewProof(null)}>
          <div className="gacha-modal gacha-modal--wide" onClick={e => e.stopPropagation()}>
            <h2>{previewProof.title}</h2>
            <p>{previewProof.grade} {previewProof.chapter && `· ${previewProof.chapter}`} · {difficultyStars(previewProof.difficulty)}</p>
            {previewProof.description && <p className="proof-preview-desc">{previewProof.description}</p>}
            {previewProof.description_image && (
              <img src={`${API_BASE}/api/proof/image/${previewProof.description_image}`} alt="desc" className="proof-preview-img" />
            )}
            <div className="proof-preview-steps">
              {previewProof.steps.map((s, i) => (
                <div key={s.id} className="proof-preview-step">
                  <span className="proof-preview-step-num">Step {i + 1}</span>
                  <span className="proof-preview-step-content">{s.content}</span>
                  {s.content_image && (
                    <img src={`${API_BASE}/api/proof/image/${s.content_image}`} alt={`step ${i + 1}`} className="proof-preview-step-img" />
                  )}
                  {s.blanks_json && <span className="proof-preview-blank-badge">빈칸 {JSON.parse(s.blanks_json).length}개</span>}
                </div>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => setPreviewProof(null)}>닫기</button>
          </div>
        </div>
      )}

      {/* ── 배정 모달 ── */}
      {assignProofId && (
        <div className="gacha-modal-overlay" onClick={() => setAssignProofId(null)}>
          <div className="gacha-modal" onClick={e => e.stopPropagation()}>
            <h3>학생 배정</h3>
            <div className="proof-assign-list">
              {students.map(s => (
                <label key={s.id} className="proof-assign-student">
                  <input
                    type="checkbox"
                    checked={selectedStudents.has(s.id)}
                    onChange={e => {
                      const next = new Set(selectedStudents);
                      if (e.target.checked) next.add(s.id); else next.delete(s.id);
                      setSelectedStudents(next);
                    }}
                  />
                  {s.name} ({s.grade || '-'})
                </label>
              ))}
            </div>
            <div className="gacha-form-actions">
              <button className="btn-secondary" onClick={() => setAssignProofId(null)}>취소</button>
              <button className="btn-primary" onClick={handleAssign} disabled={selectedStudents.size === 0}>
                {selectedStudents.size}명 배정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 목록 ── */}
      {!showEditor && (
        loading ? (
          <div className="gacha-loading">불러오는 중...</div>
        ) : (
          <div className="proof-list">
            {(tab === 'mine' ? proofs : sharedProofs).map(p => (
              <div key={p.id} className="proof-card">
                <div className="proof-card-header">
                  <h3>{p.title}</h3>
                  {p.is_shared ? <span className="proof-shared-badge">공유됨</span> : null}
                </div>
                <div className="proof-card-meta">
                  <span>{p.grade}</span>
                  {p.chapter && <span>{p.chapter}</span>}
                  <span>{difficultyStars(p.difficulty)}</span>
                  <span>{p.step_count ?? 0}단계</span>
                  {p.share_count > 0 && <span>복사 {p.share_count}회</span>}
                </div>
                <div className="proof-card-actions">
                  <button className="btn-sm" onClick={() => openPreview(p.id)}>미리보기</button>
                  {tab === 'mine' ? (
                    <>
                      <button className="btn-sm" onClick={() => openEditProof(p.id)}>편집</button>
                      <button className="btn-sm" onClick={() => openAssign(p.id)}>배정</button>
                      <button className="btn-sm" onClick={() => handleShare(p)}>
                        {p.is_shared ? '공유 해제' : '공유'}
                      </button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(p)}>삭제</button>
                    </>
                  ) : (
                    <button className="btn-sm btn-primary" onClick={() => handleCopy(p)}>내 학원에 복사</button>
                  )}
                </div>
              </div>
            ))}
            {(tab === 'mine' ? proofs : sharedProofs).length === 0 && (
              <div className="gacha-empty">
                {tab === 'mine' ? '증명이 없습니다. 새 증명을 만들어보세요.' : '공유된 증명이 없습니다.'}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
