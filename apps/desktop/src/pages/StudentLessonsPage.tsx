import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  getAccessToken,
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
import FilePreviewModal from '../components/FilePreviewModal';
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

// DB enum (main/answer/solution/extra)은 유지하고 표기만 사용자 흐름에 맞게 매핑.
// 학원에서 한 자료 = 문제(본편) + 답지 + 해설 + 교안(부자료) 세트로 운영.
const ROLE_LABEL: Record<LessonFileRole, string> = {
  main: '문제',
  answer: '답지',
  solution: '해설',
  extra: '교안',
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

  const [shareCopied, setShareCopied] = useState(false);
  const [previewFile, setPreviewFile] = useState<LessonItem['files'][number] | null>(null);

  // 검색·정렬·보관 토글
  const [searchQ, setSearchQ] = useState('');
  type SortMode = 'updated' | 'order' | 'understanding_low' | 'understanding_high' | 'status';
  const [sortMode, setSortMode] = useState<SortMode>('updated');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  // 검색·정렬 적용된 list
  const visibleItems = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const filtered = q
      ? items.filter((i) => {
          const fields = [i.title, i.unit_name, i.textbook, i.topic, i.purpose, i.description];
          return fields.some((f) => f && f.toLowerCase().includes(q));
        })
      : items;
    const sorted = filtered.slice();
    switch (sortMode) {
      case 'order':
        sorted.sort((a, b) => a.order_idx - b.order_idx);
        break;
      case 'understanding_low':
        sorted.sort((a, b) => (a.understanding ?? 999) - (b.understanding ?? 999));
        break;
      case 'understanding_high':
        sorted.sort((a, b) => (b.understanding ?? -1) - (a.understanding ?? -1));
        break;
      case 'status': {
        const order: Record<string, number> = { todo: 0, in_progress: 1, done: 2 };
        sorted.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
        break;
      }
      case 'updated':
      default:
        sorted.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
        break;
    }
    return sorted;
  }, [items, searchQ, sortMode]);

  const curriculumItems = useMemo(() => visibleItems.filter((i) => i.source === 'curriculum'), [visibleItems]);
  const otherItems = useMemo(() => visibleItems.filter((i) => i.source !== 'curriculum'), [visibleItems]);

  // 학생 검색 필터
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.grade ?? '').toLowerCase().includes(q) ||
      (s.school ?? '').toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

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
      const rows = await api.listLessonItems({
        studentId: selectedStudent,
        includeArchived,
      });
      setItems(rows);
      setSelectedId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
    } catch (err) {
      toast.error('불러오기 실패: ' + (err as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, includeArchived]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { loadItems(); }, [loadItems]);

  // 생성 가능 여부 — 진도면 단원명 필수, 자료/시험대비면 제목 필수
  const draftKind = draft.kind ?? 'unit';
  const canCreate = draftKind === 'free'
    ? !!(draft.title && draft.title.trim())
    : !!(draft.unit_name && draft.unit_name.trim());

  const handleCreate = async () => {
    if (!selectedStudent || !canCreate) return;
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
      // includeArchived가 true면 화면에 남기되 archived_at 갱신
      if (includeArchived) loadItems();
      else {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (selectedId === id) setSelectedId(null);
      }
      toast.success('보관 완료');
    } catch (err) {
      toast.error('실패: ' + (err as Error).message);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const restored = await api.restoreLessonItem(id);
      setItems((prev) => prev.map((i) => (i.id === id ? restored : i)));
      toast.success('복원됨');
    } catch (err) {
      toast.error('복원 실패: ' + (err as Error).message);
    }
  };

  const handleDuplicate = async (targetStudentId?: string) => {
    if (!selected) return;
    try {
      const dup = await api.duplicateLessonItem(selected.id,
        targetStudentId && targetStudentId !== selected.student_id ? { student_id: targetStudentId } : undefined
      );
      if (!targetStudentId || targetStudentId === selected.student_id) {
        setItems((prev) => [dup, ...prev]);
        setSelectedId(dup.id);
        toast.success('복제 완료');
      } else {
        toast.success(`${students.find((s) => s.id === targetStudentId)?.name ?? '대상 학생'}에게 복제됨`);
      }
      setDuplicateOpen(false);
    } catch (err) {
      toast.error('복제 실패: ' + (err as Error).message);
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

  const handleRenameFile = async (fileId: string, newName: string) => {
    if (!selected) return;
    try {
      const r = await api.renameLessonItemFile(selected.id, fileId, newName);
      // 부분 업데이트 — 전체 재호출 대신 파일 이름만 갱신
      setItems((prev) => prev.map((it) =>
        it.id !== selected.id
          ? it
          : {
              ...it,
              files: it.files.map((f) =>
                f.id === fileId ? { ...f, file_name: r.file_name } : f
              ),
            }
      ));
      toast.success('이름 변경됨');
    } catch (err) {
      toast.error('실패: ' + (err as Error).message);
    }
  };

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
          <label className="sr-only" htmlFor="lessons-student-search">학생 검색</label>
          <input
            id="lessons-student-search"
            type="search"
            className="input lessons-student-search"
            placeholder="학생 검색…"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            aria-label="학생 검색"
          />
          <label className="sr-only" htmlFor="lessons-student">학생 선택</label>
          <select
            id="lessons-student"
            className="input lessons-student-select"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            {filteredStudents.length === 0 && <option value="">{students.length === 0 ? '담당 학생 없음' : '검색 결과 없음'}</option>}
            {filteredStudents.map((s) => (
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
            {loading
              ? '불러오는 중…'
              : `${visibleItems.length}개 항목${searchQ ? ` (전체 ${items.length}개 중)` : ''}`}
          </div>
          <div className="lessons-list-controls">
            <input
              type="search"
              className="input lessons-list-search"
              placeholder="검색 (제목/단원/교재…)"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              aria-label="항목 검색"
            />
            <select
              className="input lessons-list-sort"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="정렬"
            >
              <option value="updated">최근 업데이트순</option>
              <option value="order">순서(order_idx)</option>
              <option value="understanding_low">이해도 낮은순</option>
              <option value="understanding_high">이해도 높은순</option>
              <option value="status">상태별</option>
            </select>
            <label className="lessons-list-archive-toggle">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              보관 포함
            </label>
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
                  <LessonListItem
                    key={it.id} item={it}
                    active={it.id === selectedId}
                    onSelect={() => setSelectedId(it.id)}
                    onRestore={() => handleRestore(it.id)}
                  />
                ))}
                <LessonSectionHeader
                  label={`📝 시험대비·기타 (${otherItems.length})`}
                  onCreate={() => { setCreateSource('exam_prep'); setShowCreate(true); setDraft({ kind: 'free' }); }}
                  createLabel="+ 추가"
                  hidden={otherItems.length === 0}
                />
                {otherItems.map((it) => (
                  <LessonListItem
                    key={it.id} item={it}
                    active={it.id === selectedId}
                    onSelect={() => setSelectedId(it.id)}
                    onRestore={() => handleRestore(it.id)}
                  />
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
              onRenameFile={handleRenameFile}
              onPreviewFile={(f) => setPreviewFile(f)}
              onShare={handleShare}
              shareCopied={shareCopied}
              onArchive={() => handleArchive(selected.id)}
              onDuplicate={() => setDuplicateOpen(true)}
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
                    <span className="lessons-form-field-label">
                      단원/유형명 <span style={{ color: 'var(--danger)' }}>*</span>
                    </span>
                    <input
                      className="input"
                      autoFocus
                      placeholder="예: 이차함수의 그래프"
                      value={draft.unit_name ?? ''}
                      onChange={(e) => setDraft({ ...draft, unit_name: e.target.value })}
                    />
                  </label>
                </>
              )}
              <label>
                <span className="lessons-form-field-label">
                  자료 제목 {draftKind === 'free' && <span style={{ color: 'var(--danger)' }}>*</span>}
                </span>
                <input
                  className="input"
                  autoFocus={draftKind === 'free'}
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
            {!canCreate && (
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)' }}>
                {draftKind === 'free' ? '제목을 입력하세요' : '단원/유형명을 입력하세요'}
              </span>
            )}
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>취소</button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!canCreate}
            >
              생성
            </button>
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

      {duplicateOpen && selected && (
        <DuplicateLessonModal
          item={selected}
          students={students}
          onClose={() => setDuplicateOpen(false)}
          onDuplicate={handleDuplicate}
        />
      )}

      {previewFile && (
        <FilePreviewModal
          fileName={previewFile.file_name}
          mimeType={previewFile.mime_type}
          previewUrl={`${api.lessonItemFileDownloadUrl(previewFile.id)}?inline=1`}
          downloadUrl={api.lessonItemFileDownloadUrl(previewFile.id)}
          authMode="jwt"
          authToken={getAccessToken() ?? undefined}
          onClose={() => setPreviewFile(null)}
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
  onRestore,
}: {
  item: LessonItem;
  active: boolean;
  onSelect: () => void;
  onRestore?: () => void;
}) {
  const stage = understandingStage(item.understanding);
  const statusChipClass = STATUS_CHIP_CLASS[item.status];
  const titleText = item.title || item.unit_name || '(제목 없음)';
  const isArchived = !!(item as LessonItem & { archived_at?: string | null }).archived_at;
  return (
    <div className="lessons-list-item-wrap" data-archived={isArchived || undefined}>
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
        {isArchived && <span className="lessons-chip lessons-chip--archived">보관됨</span>}
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
    {isArchived && onRestore && (
      <button
        type="button"
        className="lessons-list-restore"
        onClick={(e) => { e.stopPropagation(); onRestore(); }}
        aria-label={`${titleText} 복원`}
      >
        복원
      </button>
    )}
    </div>
  );
}

// ─── 우측 상세 패널 ───────────────────────────────

interface DetailPanelProps {
  item: LessonItem;
  onPatch: (p: LessonItemPatch) => Promise<LessonItem | null>;
  onUpload: (file: File, role: LessonFileRole) => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => Promise<void>;
  onPreviewFile: (file: LessonItem['files'][number]) => void;
  onShare: () => void;
  shareCopied: boolean;
  onArchive: () => void;
  onDuplicate: () => void;
}

function DetailPanel({ item, onPatch, onUpload, onDeleteFile, onRenameFile, onPreviewFile, onShare, shareCopied, onArchive, onDuplicate }: DetailPanelProps) {
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
        <div className="lessons-detail-head-main">
          <div className="lessons-detail-eyebrow">
            <EditableField
              kind="select"
              value={item.kind}
              options={[
                { value: 'unit', label: '단원' },
                { value: 'type', label: '유형' },
                { value: 'free', label: '자료' },
              ]}
              ariaLabel="유형 변경"
              displayClass="lessons-detail-eyebrow-chip"
              onSave={async (v) => { await onPatch({ kind: v as LessonItemKind }); flashSaved(); }}
            />
            {item.kind !== 'free' && (
              <>
                <span className="lessons-detail-eyebrow-sep">·</span>
                <EditableField
                  kind="text"
                  value={item.textbook ?? ''}
                  placeholder="교재 (예: 쎈 중2-1)"
                  ariaLabel="교재 변경"
                  displayClass="lessons-detail-eyebrow-textbook"
                  onSave={async (v) => { await onPatch({ textbook: v.trim() || null }); flashSaved(); }}
                />
              </>
            )}
          </div>
          <EditableField
            kind="text"
            value={titleText}
            placeholder={item.kind === 'free' ? '자료 제목' : '단원/유형명'}
            ariaLabel={item.kind === 'free' ? '자료 제목 변경' : '단원/유형명 변경'}
            displayClass="lessons-detail-title"
            onSave={async (v) => {
              const trimmed = v.trim();
              if (!trimmed) return;
              if (item.kind === 'free') {
                await onPatch({ title: trimmed });
              } else {
                await onPatch({ unit_name: trimmed });
              }
              flashSaved();
            }}
          />
        </div>
        <div className="lessons-detail-head-actions">
          <button className="btn btn-sm" onClick={onDuplicate} aria-label="이 항목 복제">
            복제
          </button>
          <button className="btn btn-sm lessons-archive-btn" onClick={onArchive} aria-label="이 항목 보관">
            보관
          </button>
        </div>
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

      {/* 자료 메타 — 인라인 편집, 빈 값도 placeholder로 노출 */}
      <section className="lessons-meta-block" aria-label="자료 메타">
        <div className="lessons-meta-row">
          <span className="lessons-meta-label">제작 사유</span>
          <EditableField
            kind="text"
            value={item.purpose ?? ''}
            placeholder="예: 오답 보강, 심화"
            ariaLabel="제작 사유 변경"
            displayClass="lessons-meta-value"
            onSave={async (v) => { await onPatch({ purpose: v.trim() || null }); flashSaved(); }}
          />
        </div>
        <div className="lessons-meta-row">
          <span className="lessons-meta-label">주제</span>
          <EditableField
            kind="text"
            value={item.topic ?? ''}
            placeholder="예: 이차함수"
            ariaLabel="주제 변경"
            displayClass="lessons-meta-value"
            onSave={async (v) => { await onPatch({ topic: v.trim() || null }); flashSaved(); }}
          />
        </div>
        <div className="lessons-meta-row lessons-meta-row--block">
          <span className="lessons-meta-label">설명</span>
          <EditableField
            kind="textarea"
            value={item.description ?? ''}
            placeholder="자료에 대한 설명을 적으세요"
            ariaLabel="설명 변경"
            displayClass="lessons-meta-value lessons-meta-value--block"
            onSave={async (v) => { await onPatch({ description: v.trim() || null }); flashSaved(); }}
          />
        </div>
      </section>

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
              <FileRow
                key={f.id}
                file={f}
                onDelete={() => onDeleteFile(f.id)}
                onRename={(newName) => onRenameFile(f.id, newName)}
                onPreview={() => onPreviewFile(f)}
              />
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

// ─── 항목 복제 모달 ─────────────────────────────

function DuplicateLessonModal({
  item, students, onClose, onDuplicate,
}: {
  item: LessonItem;
  students: Student[];
  onClose: () => void;
  onDuplicate: (targetStudentId?: string) => Promise<void> | void;
}) {
  const [target, setTarget] = useState<string>(item.student_id);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, search]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onDuplicate(target === item.student_id ? undefined : target);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <Modal.Header>항목 복제</Modal.Header>
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            원본: <strong>{item.title || item.unit_name || '(제목 없음)'}</strong>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            메타(제목·단원명·교재·사유 등)는 복제됩니다. 첨부 파일·이해도·메모·학부모 노출은 초기화됩니다.
          </div>
          <label>
            <span className="lessons-form-field-label">대상 학생 검색</span>
            <input
              className="input"
              autoFocus
              type="search"
              placeholder="학생 이름…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            <span className="lessons-form-field-label">대상 학생 선택</span>
            <select
              className="input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {filtered.length === 0 && <option value="">검색 결과 없음</option>}
              {filtered.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.grade ? ` (${s.grade})` : ''}
                  {s.id === item.student_id ? ' — 같은 학생' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>취소</button>
        <button className="btn btn-primary" onClick={submit} disabled={submitting || !target}>
          {submitting ? '복제 중…' : '복제'}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── 인라인 편집 가능 필드 (text / textarea / select) ───────

type EditableFieldProps =
  | {
      kind: 'text' | 'textarea';
      value: string;
      placeholder?: string;
      ariaLabel: string;
      displayClass?: string;
      onSave: (newValue: string) => Promise<void> | void;
    }
  | {
      kind: 'select';
      value: string;
      options: Array<{ value: string; label: string }>;
      placeholder?: undefined;
      ariaLabel: string;
      displayClass?: string;
      onSave: (newValue: string) => Promise<void> | void;
    };

function EditableField(props: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.value);

  useEffect(() => {
    setDraft(props.value);
  }, [props.value]);

  const commit = async () => {
    if (draft !== props.value) {
      await props.onSave(draft);
    }
    setEditing(false);
  };

  if (props.kind === 'select') {
    // select는 항상 편집 모드 (드롭다운 자체)
    return (
      <select
        className="input lessons-editable-select"
        value={props.value}
        aria-label={props.ariaLabel}
        onChange={async (e) => { await props.onSave(e.target.value); }}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (editing) {
    if (props.kind === 'textarea') {
      return (
        <textarea
          className="input lessons-editable-textarea"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(props.value);
              setEditing(false);
            }
          }}
          aria-label={props.ariaLabel}
          placeholder={props.placeholder}
          rows={3}
        />
      );
    }
    return (
      <input
        className="input lessons-editable-input"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(props.value);
            setEditing(false);
          }
        }}
        aria-label={props.ariaLabel}
        placeholder={props.placeholder}
      />
    );
  }

  const isEmpty = !props.value || props.value.trim() === '';
  return (
    <button
      type="button"
      className={`lessons-editable-display ${props.displayClass ?? ''}${isEmpty ? ' is-empty' : ''}`}
      onClick={() => setEditing(true)}
      aria-label={`${props.ariaLabel} (현재값: ${isEmpty ? '비어있음' : props.value})`}
      title="클릭하여 편집"
    >
      {isEmpty ? (props.placeholder ?? '클릭하여 입력') : props.value}
    </button>
  );
}

// ─── 파일 행 — 인라인 이름 편집 + 다운로드 + 삭제 ───

interface FileRowProps {
  file: LessonItem['files'][number];
  onDelete: () => void;
  onRename: (newName: string) => Promise<void> | void;
  onPreview: () => void;
}

function FileRow({ file, onDelete, onRename, onPreview }: FileRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.file_name);

  useEffect(() => { setDraft(file.file_name); }, [file.file_name]);

  const commit = async () => {
    const v = draft.trim();
    if (!v || v === file.file_name) {
      setEditing(false);
      setDraft(file.file_name);
      return;
    }
    await onRename(v);
    setEditing(false);
  };

  return (
    <li className="lessons-file-row">
      <span className="lessons-file-role">{ROLE_LABEL[file.file_role]}</span>
      <div className="lessons-file-info">
        {editing ? (
          <input
            className="input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setDraft(file.file_name);
                setEditing(false);
              }
            }}
            aria-label={`${file.file_name} 이름 변경`}
          />
        ) : (
          <button
            type="button"
            className="lessons-file-name lessons-file-name-edit"
            onClick={() => setEditing(true)}
            aria-label={`${file.file_name} 이름 편집`}
            title="클릭하여 이름 편집"
          >
            {file.file_name}
          </button>
        )}
        <div className="lessons-file-meta">
          {(file.size_bytes / 1024).toFixed(0)} KB · v{file.version}
        </div>
      </div>
      {!editing && (
        <>
          <button
            className="btn btn-sm btn-ghost"
            onClick={onPreview}
            aria-label={`${file.file_name} 미리보기`}
            title="미리보기"
          >👁</button>
          <a
            href={api.lessonItemFileDownloadUrl(file.id)}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-sm btn-ghost"
            aria-label={`${file.file_name} 다운로드`}
          >⬇</a>
          <button
            className="btn btn-sm btn-ghost"
            onClick={onDelete}
            aria-label={`${file.file_name} 삭제`}
          >✕</button>
        </>
      )}
    </li>
  );
}

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
        <option value="main">문제</option>
        <option value="answer">답지</option>
        <option value="solution">해설</option>
        <option value="extra">교안</option>
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
