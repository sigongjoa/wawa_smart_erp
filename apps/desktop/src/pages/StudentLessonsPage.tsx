import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  LessonItem,
  LessonItemCreateInput,
  LessonItemPatch,
  LessonItemStatus,
  LessonItemKind,
  LessonFileRole,
  Curriculum,
  CurriculumDetail,
  Student,
} from '../api';
import { toast, useConfirm } from '../components/Toast';
import Modal from '../components/Modal';
import './StudentLessonsPage.css';
import './CurriculumPage.css';

const STATUS_LABEL: Record<LessonItemStatus, string> = {
  todo: '미시작',
  in_progress: '진행중',
  done: '완료',
};

const STATUS_CHIP_CLASS: Record<LessonItemStatus, string> = {
  todo: '',
  in_progress: 'lessons-chip--info',
  done: 'lessons-chip--success',
};

const KIND_LABEL: Record<LessonItemKind, string> = {
  unit: '단원',
  type: '유형',
  free: '자료',
};

const ROLE_LABEL: Record<LessonFileRole, string> = {
  main: '본편',
  answer: '정답',
  solution: '해설',
  extra: '부자료',
};

type UnderstandingStage = 'low' | 'mid' | 'high' | 'none';

function understandingStage(v: number | null): UnderstandingStage {
  if (v == null) return 'none';
  if (v < 40) return 'low';
  if (v < 70) return 'mid';
  return 'high';
}

function understandingColor(v: number | null): string {
  switch (understandingStage(v)) {
    case 'low': return 'var(--danger)';
    case 'mid': return 'var(--warning)';
    case 'high': return 'var(--success)';
    default: return 'var(--bg-tertiary)';
  }
}

const STAGE_LABEL: Record<UnderstandingStage, string> = {
  low: '위험',
  mid: '보통',
  high: '양호',
  none: '미평가',
};

export default function StudentLessonsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [items, setItems] = useState<LessonItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [createSource, setCreateSource] = useState<'manual' | 'exam_prep'>('manual');
  const [draft, setDraft] = useState<Partial<LessonItemCreateInput>>({});
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const curriculumItems = useMemo(() => items.filter((i) => i.source === 'curriculum'), [items]);
  const otherItems = useMemo(() => items.filter((i) => i.source !== 'curriculum'), [items]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  const loadStudents = useCallback(async () => {
    try {
      const rows = await api.getStudents('mine');
      setStudents(rows);
      if (rows.length > 0) setSelectedStudent((prev) => prev || rows[0].id);
    } catch {
      setStudents([]);
    }
  }, []);

  const loadItems = useCallback(async () => {
    if (!selectedStudent) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await api.listLessonItems({ studentId: selectedStudent });
      setItems(rows);
      setSelectedId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
    } catch (err) {
      toast.error('불러오기 실패: ' + (err as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStudent]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const handleCreate = async () => {
    if (!selectedStudent) return;
    if (!draft.title && !draft.unit_name) {
      toast.error('제목 또는 단원명을 입력하세요');
      return;
    }
    try {
      const created = await api.createLessonItem({
        student_id: selectedStudent,
        kind: draft.kind ?? 'unit',
        textbook: draft.textbook || null,
        unit_name: draft.unit_name || null,
        title: draft.title || null,
        purpose: draft.purpose || null,
        topic: draft.topic || null,
        description: draft.description || null,
        understanding: draft.understanding ?? null,
        source: createSource,
      });
      setItems((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setShowCreate(false);
      setDraft({});
      toast.success('생성 완료');
    } catch (err) {
      toast.error('생성 실패: ' + (err as Error).message);
    }
  };

  const patch = async (id: string, p: LessonItemPatch) => {
    try {
      const updated = await api.updateLessonItem(id, p);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (err) {
      toast.error('저장 실패: ' + (err as Error).message);
      return null;
    }
  };

  const handleArchive = async (id: string) => {
    const ok = await confirmDialog('이 항목을 보관 처리할까요?');
    if (!ok) return;
    try {
      await api.archiveLessonItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast.success('보관 완료');
    } catch (err) {
      toast.error('실패: ' + (err as Error).message);
    }
  };

  const handleUpload = async (file: File, role: LessonFileRole) => {
    if (!selected) return;
    try {
      await api.uploadLessonItemFile(selected.id, file, role);
      toast.success('업로드 완료');
      loadItems();
    } catch (err) {
      toast.error('업로드 실패: ' + (err as Error).message);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!selected) return;
    const ok = await confirmDialog('파일을 삭제할까요?');
    if (!ok) return;
    try {
      await api.deleteLessonItemFile(selected.id, fileId);
      loadItems();
    } catch (err) {
      toast.error('실패: ' + (err as Error).message);
    }
  };

  const [shareCopied, setShareCopied] = useState(false);
  const handleShare = async () => {
    if (!selected) return;
    try {
      const r = await api.createLessonItemParentShare(selected.id);
      const url = `${window.location.origin}/#${r.path}`;
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      toast.success('학부모 링크 복사됨 (30일 유효)');
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      toast.error('실패: ' + (err as Error).message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">학생 학습 기록</h1>
          <p className="page-subtitle">진도·자료·학부모 노출을 한 화면에서 관리합니다.</p>
        </div>
        <div className="lessons-toolbar">
          <label className="sr-only" htmlFor="lessons-student">학생 선택</label>
          <select
            id="lessons-student"
            className="input lessons-student-select"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            {students.length === 0 && <option value="">담당 학생 없음</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.grade ? ` (${s.grade})` : ''}
              </option>
            ))}
          </select>
          <button
            className="btn btn-ghost"
            disabled={!selectedStudent}
            onClick={() => setShowApply(true)}
          >
            + 커리큘럼 적용
          </button>
          <button
            className="btn btn-primary"
            disabled={!selectedStudent}
            onClick={() => { setCreateSource('exam_prep'); setShowCreate(true); setDraft({ kind: 'free' }); }}
          >
            + 시험대비·자료
          </button>
        </div>
      </div>

      <div className="lessons-grid">
        {/* 좌: 리스트 */}
        <div className="lessons-list-panel" role="region" aria-label="학습 항목 목록">
          <div className="lessons-list-header" aria-live="polite">
            {loading ? '불러오는 중…' : `${items.length}개 항목`}
          </div>
          <div className="lessons-list-scroll">
            {items.length === 0 && !loading ? (
              <div className="empty-state">
                <div className="empty-state-title">항목이 없습니다</div>
                <div className="empty-state-desc">+ 커리큘럼 적용 또는 + 시험대비·자료로 시작하세요.</div>
              </div>
            ) : (
              <>
                <LessonSectionHeader
                  label={`📚 이번 학기 진도 (${curriculumItems.length})`}
                  onCreate={() => setShowApply(true)}
                  createLabel="+ 적용"
                  hidden={curriculumItems.length === 0}
                />
                {curriculumItems.map((it) => (
                  <LessonListItem key={it.id} item={it} active={it.id === selectedId} onSelect={() => setSelectedId(it.id)} />
                ))}
                <LessonSectionHeader
                  label={`📝 시험대비·기타 (${otherItems.length})`}
                  onCreate={() => { setCreateSource('exam_prep'); setShowCreate(true); setDraft({ kind: 'free' }); }}
                  createLabel="+ 추가"
                  hidden={otherItems.length === 0}
                />
                {otherItems.map((it) => (
                  <LessonListItem key={it.id} item={it} active={it.id === selectedId} onSelect={() => setSelectedId(it.id)} />
                ))}
              </>
            )}
          </div>
        </div>

        {/* 우: 상세 */}
        <div className="lessons-detail" role="region" aria-label="선택 항목 상세">
          {!selected ? (
            <div className="empty-state">
              <div className="empty-state-title">항목을 선택하세요</div>
              <div className="empty-state-desc">왼쪽 목록에서 항목을 선택하면 상세를 볼 수 있습니다.</div>
            </div>
          ) : (
            <DetailPanel
              key={selected.id}
              item={selected}
              onPatch={(p) => patch(selected.id, p)}
              onUpload={handleUpload}
              onDeleteFile={handleDeleteFile}
              onShare={handleShare}
              shareCopied={shareCopied}
              onArchive={() => handleArchive(selected.id)}
            />
          )}
        </div>
      </div>

      {/* 생성 모달 */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <Modal.Header>새 학습 항목</Modal.Header>
          <Modal.Body>
            <div className="lessons-form">
              <label>
                <span className="lessons-form-field-label">유형</span>
                <select
                  className="input"
                  value={draft.kind ?? 'unit'}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as LessonItemKind })}
                >
                  <option value="unit">단원 (진도)</option>
                  <option value="type">유형 (진도)</option>
                  <option value="free">자료 (단원 무관)</option>
                </select>
              </label>
              {(draft.kind ?? 'unit') !== 'free' && (
                <>
                  <label>
                    <span className="lessons-form-field-label">교재</span>
                    <input
                      className="input"
                      placeholder="예: 쎈 중2-1"
                      value={draft.textbook ?? ''}
                      onChange={(e) => setDraft({ ...draft, textbook: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className="lessons-form-field-label">단원/유형명</span>
                    <input
                      className="input"
                      placeholder="예: 이차함수의 그래프"
                      value={draft.unit_name ?? ''}
                      onChange={(e) => setDraft({ ...draft, unit_name: e.target.value })}
                    />
                  </label>
                </>
              )}
              <label>
                <span className="lessons-form-field-label">자료 제목 (선택)</span>
                <input
                  className="input"
                  placeholder="예: 이차함수 오답 보강"
                  value={draft.title ?? ''}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <label>
                <span className="lessons-form-field-label">제작 사유 (선택)</span>
                <input
                  className="input"
                  placeholder="예: 오답 보강, 심화"
                  value={draft.purpose ?? ''}
                  onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
                />
              </label>
              <label>
                <span className="lessons-form-field-label">설명 (선택)</span>
                <textarea
                  className="input lessons-textarea"
                  rows={3}
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
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

      {showApply && selectedStudent && (
        <ApplyCurriculumModal
          studentId={selectedStudent}
          onClose={() => setShowApply(false)}
          onApplied={() => { setShowApply(false); loadItems(); }}
        />
      )}

      {ConfirmDialog}
    </div>
  );
}

// ─── 좌측 섹션 헤더 ─────────────────────────────────

function LessonSectionHeader({
  label, onCreate, createLabel, hidden,
}: { label: string; onCreate: () => void; createLabel: string; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <div
      style={{
        padding: 'var(--sp-2) var(--sp-3)',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-secondary)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span>{label}</span>
      <button className="btn btn-sm btn-ghost" onClick={onCreate}>{createLabel}</button>
    </div>
  );
}

// ─── 좌측 리스트 항목 ───────────────────────────────

function LessonListItem({
  item,
  active,
  onSelect,
}: {
  item: LessonItem;
  active: boolean;
  onSelect: () => void;
}) {
  const stage = understandingStage(item.understanding);
  const statusChipClass = STATUS_CHIP_CLASS[item.status];
  const titleText = item.title || item.unit_name || '(제목 없음)';
  return (
    <button
      className="lessons-list-item"
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
    >
      <div className="lessons-list-meta">
        <span className="lessons-chip">{KIND_LABEL[item.kind]}</span>
        <span className={`lessons-chip ${statusChipClass}`}>{STATUS_LABEL[item.status]}</span>
        {item.visible_to_parent && <span className="lessons-chip lessons-chip--parent">학부모공개</span>}
        {item.files.length > 0 && <span className="lessons-chip">📎 {item.files.length}</span>}
      </div>
      <div className="lessons-list-title">{titleText}</div>
      {item.textbook && <div className="lessons-list-sub">{item.textbook}</div>}
      {item.understanding != null && (
        <div className="lessons-list-progress" aria-hidden="true">
          <div
            className="lessons-list-progress-bar"
            style={{ width: `${item.understanding}%`, background: understandingColor(item.understanding) }}
          />
        </div>
      )}
      <span className="sr-only">
        {item.understanding != null ? `이해도 ${item.understanding}점, ${STAGE_LABEL[stage]}` : '이해도 미평가'}
      </span>
    </button>
  );
}

// ─── 우측 상세 패널 ───────────────────────────────

interface DetailPanelProps {
  item: LessonItem;
  onPatch: (p: LessonItemPatch) => Promise<LessonItem | null>;
  onUpload: (file: File, role: LessonFileRole) => void;
  onDeleteFile: (fileId: string) => void;
  onShare: () => void;
  shareCopied: boolean;
  onArchive: () => void;
}

function DetailPanel({ item, onPatch, onUpload, onDeleteFile, onShare, shareCopied, onArchive }: DetailPanelProps) {
  const [understanding, setUnderstanding] = useState<number>(item.understanding ?? 0);
  const [note, setNote] = useState<string>(item.note ?? '');
  const [savedHint, setSavedHint] = useState<string>('');
  const noteTimer = useRef<number | null>(null);

  useEffect(() => {
    setUnderstanding(item.understanding ?? 0);
    setNote(item.note ?? '');
    setSavedHint('');
  }, [item.id, item.understanding, item.note]);

  const flashSaved = (msg = '저장됨 · 방금') => {
    setSavedHint(msg);
    window.clearTimeout(noteTimer.current ?? 0);
    noteTimer.current = window.setTimeout(() => setSavedHint(''), 2000);
  };

  const stage = understandingStage(understanding);
  const titleText = item.title || item.unit_name || '(제목 없음)';

  return (
    <div className="lessons-detail-stack">
      <div className="lessons-detail-head">
        <div>
          <div className="lessons-detail-eyebrow">
            {KIND_LABEL[item.kind]}{item.textbook ? ` · ${item.textbook}` : ''}
          </div>
          <h2 className="lessons-detail-title">{titleText}</h2>
        </div>
        <button className="btn btn-sm lessons-archive-btn" onClick={onArchive} aria-label="이 항목 보관">
          보관
        </button>
      </div>

      {/* 진도/이해도 */}
      {item.kind !== 'free' && (
        <section className="lessons-section" aria-labelledby="lessons-understanding-label">
          <div id="lessons-understanding-label" className="lessons-section-label">이해도</div>
          <div className="lessons-slider-row">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={understanding}
              aria-label="이해도"
              aria-valuetext={`${understanding}점, ${STAGE_LABEL[stage]}`}
              onChange={(e) => setUnderstanding(Number(e.target.value))}
              onMouseUp={async () => { await onPatch({ understanding }); flashSaved(); }}
              onTouchEnd={async () => { await onPatch({ understanding }); flashSaved(); }}
              onKeyUp={async (e) => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                  await onPatch({ understanding }); flashSaved();
                }
              }}
            />
            <span
              className="lessons-slider-value"
              style={{ color: understandingColor(understanding) }}
              aria-hidden="true"
            >
              {understanding}
            </span>
          </div>
          <div className="lessons-slider-stage" aria-hidden="true">{STAGE_LABEL[stage]}</div>
          <div className="lessons-status-group" role="group" aria-label="진행 상태">
            {(['todo', 'in_progress', 'done'] as LessonItemStatus[]).map((s) => (
              <button
                key={s}
                className={'btn btn-sm' + (item.status === s ? ' btn-primary' : '')}
                aria-pressed={item.status === s}
                onClick={async () => { await onPatch({ status: s }); flashSaved(); }}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 메모 */}
      <section aria-labelledby="lessons-note-label">
        <div id="lessons-note-label" className="lessons-section-label">메모</div>
        <textarea
          className="input lessons-textarea"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={async () => {
            if (note !== (item.note ?? '')) {
              const r = await onPatch({ note });
              if (r) flashSaved();
            }
          }}
        />
        <div
          className={`lessons-autosave-hint${savedHint ? ' lessons-autosave-hint--saved' : ''}`}
          aria-live="polite"
        >
          {savedHint || (note !== (item.note ?? '') ? '입력 후 다른 곳을 클릭하면 저장됩니다' : '')}
        </div>
      </section>

      {/* 자료 메타 */}
      {(item.purpose || item.topic || item.description) && (
        <section className="lessons-meta-block" aria-label="자료 메타">
          {item.purpose && <div>제작 사유: {item.purpose}</div>}
          {item.topic && <div>주제: {item.topic}</div>}
          {item.description && <p>{item.description}</p>}
        </section>
      )}

      {/* 첨부 파일 */}
      <section className="lessons-section" aria-labelledby="lessons-files-label">
        <div className="lessons-section-row">
          <div id="lessons-files-label" className="lessons-section-label">첨부 파일 ({item.files.length})</div>
          <FileUploadButton onUpload={onUpload} />
        </div>
        {item.files.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--sp-3)' }}>
            <div className="empty-state-desc">파일이 없습니다.</div>
          </div>
        ) : (
          <ul className="lessons-files">
            {item.files.map((f) => (
              <li key={f.id} className="lessons-file-row">
                <span className="lessons-file-role">{ROLE_LABEL[f.file_role]}</span>
                <div className="lessons-file-info">
                  <div className="lessons-file-name">{f.file_name}</div>
                  <div className="lessons-file-meta">{(f.size_bytes / 1024).toFixed(0)} KB · v{f.version}</div>
                </div>
                <a
                  href={api.lessonItemFileDownloadUrl(f.id)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-sm btn-ghost"
                  aria-label={`${f.file_name} 다운로드`}
                >⬇</a>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => onDeleteFile(f.id)}
                  aria-label={`${f.file_name} 삭제`}
                >✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 학부모 공개 */}
      <section className="lessons-section" aria-labelledby="lessons-parent-label">
        <div id="lessons-parent-label" className="lessons-section-label">학부모 공개</div>
        <label className="lessons-parent-row">
          <input
            type="checkbox"
            checked={item.visible_to_parent}
            onChange={async (e) => { await onPatch({ visible_to_parent: e.target.checked }); flashSaved(); }}
          />
          학부모에게 보이기
        </label>
        <label className="lessons-parent-row" data-disabled={!item.visible_to_parent}>
          <input
            type="checkbox"
            checked={item.parent_can_download}
            disabled={!item.visible_to_parent}
            onChange={async (e) => { await onPatch({ parent_can_download: e.target.checked }); flashSaved(); }}
          />
          다운로드 허용
        </label>
        <button
          className="btn btn-sm lessons-parent-share-btn"
          disabled={!item.visible_to_parent}
          onClick={onShare}
        >
          {shareCopied ? '✓ 복사됨' : '🔗 학부모 링크 복사'}
        </button>
      </section>
    </div>
  );
}

// ─── 파일 업로드 버튼 (역할 선택) ─────────────────

// ─── 커리큘럼 적용 모달 ─────────────────────────────

function ApplyCurriculumModal({
  studentId, onClose, onApplied,
}: { studentId: string; onClose: () => void; onApplied: () => void }) {
  const [list, setList] = useState<Curriculum[]>([]);
  const [selectedCurr, setSelectedCurr] = useState<string>('');
  const [detail, setDetail] = useState<CurriculumDetail | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [alreadyApplied, setAlreadyApplied] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState({ term: '', grade: '' });

  useEffect(() => {
    api.listCurricula({ term: filter.term || undefined, grade: filter.grade || undefined })
      .then((rows) => {
        setList(rows);
        if (rows.length > 0 && !selectedCurr) setSelectedCurr(rows[0].id);
      })
      .catch(() => setList([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    if (!selectedCurr) { setDetail(null); return; }
    Promise.all([
      api.getCurriculum(selectedCurr),
      // 학생이 이미 가진 curriculum_item_id 셋 조회 → 모달에서 disabled 표시
      api.listLessonItems({ studentId, source: 'curriculum' }).catch(() => []),
    ]).then(([d, existing]) => {
      setDetail(d);
      const applied = new Set<string>(
        existing.filter((i) => i.curriculum_item_id).map((i) => i.curriculum_item_id as string)
      );
      setAlreadyApplied(applied);
      // 기본: 아직 적용 안 된 항목만 체크
      const next: Record<string, boolean> = {};
      for (const it of d.items) next[it.id] = !applied.has(it.id);
      setPicked(next);
    }).catch(() => setDetail(null));
  }, [selectedCurr, studentId]);

  const pickedCount = Object.values(picked).filter(Boolean).length;

  const handleApply = async () => {
    if (!detail) return;
    const ids = Object.keys(picked).filter((k) => picked[k]);
    if (ids.length === 0) {
      toast.error('적용할 항목을 선택하세요');
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.applyCurriculum({
        student_id: studentId,
        curriculum_id: detail.id,
        item_ids: ids,
      }) as { created: number; skipped?: string[]; total: number };
      const skipCount = r.skipped?.length ?? Math.max(0, r.total - r.created);
      const msg = skipCount > 0
        ? `${r.created}개 적용 · ${skipCount}개는 이미 적용됨`
        : `${r.created}개 항목 적용됨`;
      toast.success(msg);
      onApplied();
    } catch (err) {
      toast.error('실패: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <Modal.Header>커리큘럼 적용</Modal.Header>
      <Modal.Body>
        {list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">사용 가능한 카탈로그가 없습니다</div>
            <div className="empty-state-desc">먼저 커리큘럼 페이지에서 카탈로그를 만드세요.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div className="curr-toolbar">
              <select className="input" value={selectedCurr} onChange={(e) => setSelectedCurr(e.target.value)}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.term} · {c.grade} · {c.subject} — {c.title}
                  </option>
                ))}
              </select>
            </div>
            {detail && (
              <>
                <div className="curr-apply-summary">
                  <span>총 {detail.items.length}개 항목</span>
                  <span>{pickedCount}개 선택됨</span>
                </div>
                <div className="curr-apply-list" role="group" aria-label="적용할 항목">
                  {detail.items
                    .slice()
                    .sort((a, b) => a.order_idx - b.order_idx)
                    .map((it) => {
                      const applied = alreadyApplied.has(it.id);
                      return (
                        <label
                          key={it.id}
                          className="curr-apply-row"
                          data-applied={applied || undefined}
                        >
                          <input
                            type="checkbox"
                            checked={!!picked[it.id]}
                            disabled={applied}
                            onChange={(e) => setPicked({ ...picked, [it.id]: e.target.checked })}
                          />
                          <div style={{ flex: 1 }}>
                            <strong>{it.unit_name}</strong>
                            <div className="meta">
                              {it.kind === 'unit' ? '단원' : '유형'}
                              {it.textbook ? ` · ${it.textbook}` : ''}
                              {it.default_purpose ? ` · ${it.default_purpose}` : ''}
                              {applied ? ' · 이미 적용됨' : ''}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      // 전체 선택은 이미 적용된 건 제외
                      const next: Record<string, boolean> = {};
                      for (const it of detail.items) next[it.id] = !alreadyApplied.has(it.id);
                      setPicked(next);
                    }}
                  >전체 선택</button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setPicked({})}
                  >전체 해제</button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>취소</button>
        <button
          className="btn btn-primary"
          onClick={handleApply}
          disabled={submitting || pickedCount === 0 || !detail}
        >
          {submitting ? '적용 중…' : `${pickedCount}개 적용`}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

function FileUploadButton({ onUpload }: { onUpload: (file: File, role: LessonFileRole) => void }) {
  const [role, setRole] = useState<LessonFileRole>('main');
  return (
    <div className="lessons-upload-row">
      <label className="sr-only" htmlFor="lessons-upload-role">파일 역할</label>
      <select
        id="lessons-upload-role"
        className="input lessons-upload-role-select"
        value={role}
        onChange={(e) => setRole(e.target.value as LessonFileRole)}
      >
        <option value="main">본편</option>
        <option value="answer">정답</option>
        <option value="solution">해설</option>
        <option value="extra">부자료</option>
      </select>
      <span className="btn btn-sm btn-primary lessons-upload-button">
        + 업로드
        <input
          type="file"
          aria-label="파일 선택"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f, role);
            e.target.value = '';
          }}
        />
      </span>
    </div>
  );
}
