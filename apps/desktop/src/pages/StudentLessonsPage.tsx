import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  LessonItem,
  LessonItemCreateInput,
  LessonItemPatch,
  LessonItemStatus,
  LessonItemKind,
  LessonFileRole,
  Student,
} from '../api';
import { toast, useConfirm } from '../components/Toast';

const STATUS_LABEL: Record<LessonItemStatus, string> = {
  todo: '미시작',
  in_progress: '진행중',
  done: '완료',
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

function understandingColor(v: number | null): string {
  if (v == null) return 'var(--bg-tertiary)';
  if (v < 40) return 'var(--danger)';
  if (v < 70) return 'var(--warning)';
  return 'var(--success)';
}

export default function StudentLessonsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [items, setItems] = useState<LessonItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<Partial<LessonItemCreateInput>>({});
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

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
      if (rows.length > 0 && !rows.some((r) => r.id === selectedId)) {
        setSelectedId(rows[0].id);
      } else if (rows.length === 0) {
        setSelectedId(null);
      }
    } catch (err) {
      toast.error('불러오기 실패: ' + (err as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, selectedId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudent]);

  // ── 항목 생성 ─────────────────
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

  // ── 항목 패치 ─────────────────
  const patch = async (id: string, p: LessonItemPatch) => {
    try {
      const updated = await api.updateLessonItem(id, p);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      toast.error('저장 실패: ' + (err as Error).message);
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

  // ── 파일 업로드 ─────────────────
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

  const handleShare = async () => {
    if (!selected) return;
    try {
      const r = await api.createLessonItemParentShare(selected.id);
      const url = `${window.location.origin}/#${r.path}`;
      await navigator.clipboard.writeText(url);
      toast.success('학부모 링크 복사됨 (30일 유효)');
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
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="input"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            style={{ minWidth: 180 }}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.grade ? ` (${s.grade})` : ''}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            disabled={!selectedStudent}
            onClick={() => setShowCreate(true)}
          >
            + 새 항목
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: 16,
          marginTop: 16,
          minHeight: 480,
        }}
      >
        {/* 좌: 리스트 */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-color)',
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            {loading ? '불러오는 중…' : `${items.length}개 항목`}
          </div>
          <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
            {items.length === 0 && !loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                항목이 없습니다.
              </div>
            ) : (
              items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setSelectedId(it.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    border: 'none',
                    borderBottom: '1px solid var(--border-color)',
                    background:
                      it.id === selectedId ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                    }}
                  >
                    <span>{KIND_LABEL[it.kind]}</span>
                    <span>·</span>
                    <span>{STATUS_LABEL[it.status]}</span>
                    {it.visible_to_parent && <span style={{ color: 'var(--success)' }}>· 학부모공개</span>}
                    {it.files.length > 0 && <span>· 📎 {it.files.length}</span>}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {it.title || it.unit_name || '(제목 없음)'}
                  </div>
                  {it.textbook && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {it.textbook}
                    </div>
                  )}
                  {it.understanding != null && (
                    <div
                      style={{
                        marginTop: 6,
                        height: 4,
                        background: 'var(--bg-tertiary)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${it.understanding}%`,
                          height: '100%',
                          background: understandingColor(it.understanding),
                        }}
                      />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* 우: 상세 */}
        <div
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: 20,
            background: 'var(--bg-primary)',
          }}
        >
          {!selected ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 60 }}>
              항목을 선택하세요.
            </div>
          ) : (
            <DetailPanel
              key={selected.id}
              item={selected}
              onPatch={(p) => patch(selected.id, p)}
              onUpload={handleUpload}
              onDeleteFile={handleDeleteFile}
              onShare={handleShare}
              onArchive={() => handleArchive(selected.id)}
            />
          )}
        </div>
      </div>

      {/* 생성 모달 */}
      {showCreate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setShowCreate(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-primary)',
              padding: 24,
              borderRadius: 12,
              minWidth: 420,
              maxWidth: 540,
            }}
          >
            <h3 style={{ marginTop: 0 }}>새 학습 항목</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>유형</div>
                <select
                  className="input"
                  value={draft.kind ?? 'unit'}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as LessonItemKind })}
                  style={{ width: '100%' }}
                >
                  <option value="unit">단원 (진도)</option>
                  <option value="type">유형 (진도)</option>
                  <option value="free">자료 (단원 무관)</option>
                </select>
              </label>
              {(draft.kind ?? 'unit') !== 'free' && (
                <>
                  <label>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>교재</div>
                    <input
                      className="input"
                      placeholder="예: 쎈 중2-1"
                      value={draft.textbook ?? ''}
                      onChange={(e) => setDraft({ ...draft, textbook: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>단원/유형명</div>
                    <input
                      className="input"
                      placeholder="예: 이차함수의 그래프"
                      value={draft.unit_name ?? ''}
                      onChange={(e) => setDraft({ ...draft, unit_name: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </label>
                </>
              )}
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>자료 제목 (선택)</div>
                <input
                  className="input"
                  placeholder="예: 이차함수 오답 보강"
                  value={draft.title ?? ''}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>제작 사유 (선택)</div>
                <input
                  className="input"
                  placeholder="예: 오답 보강, 심화"
                  value={draft.purpose ?? ''}
                  onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>설명 (선택)</div>
                <textarea
                  className="input"
                  rows={3}
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setShowCreate(false)}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleCreate}>
                생성
              </button>
            </div>
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}

// ─── 우측 상세 패널 ───────────────

interface DetailPanelProps {
  item: LessonItem;
  onPatch: (p: LessonItemPatch) => void;
  onUpload: (file: File, role: LessonFileRole) => void;
  onDeleteFile: (fileId: string) => void;
  onShare: () => void;
  onArchive: () => void;
}

function DetailPanel({ item, onPatch, onUpload, onDeleteFile, onShare, onArchive }: DetailPanelProps) {
  const [understanding, setUnderstanding] = useState<number>(item.understanding ?? 0);
  const [note, setNote] = useState<string>(item.note ?? '');

  useEffect(() => {
    setUnderstanding(item.understanding ?? 0);
    setNote(item.note ?? '');
  }, [item.id, item.understanding, item.note]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            {KIND_LABEL[item.kind]}
            {item.textbook ? ` · ${item.textbook}` : ''}
          </div>
          <h2 style={{ margin: 0 }}>{item.title || item.unit_name || '(제목 없음)'}</h2>
        </div>
        <button className="btn btn-sm" onClick={onArchive} style={{ color: 'var(--danger)' }}>
          보관
        </button>
      </div>

      {/* 진도/이해도 */}
      {item.kind !== 'free' && (
        <section style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>이해도</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={understanding}
              onChange={(e) => setUnderstanding(Number(e.target.value))}
              onMouseUp={() => onPatch({ understanding })}
              onTouchEnd={() => onPatch({ understanding })}
              style={{ flex: 1 }}
            />
            <span
              style={{
                minWidth: 56,
                textAlign: 'right',
                fontWeight: 600,
                color: understandingColor(understanding),
              }}
            >
              {understanding}
            </span>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            {(['todo', 'in_progress', 'done'] as LessonItemStatus[]).map((s) => (
              <button
                key={s}
                className={'btn btn-sm' + (item.status === s ? ' btn-primary' : '')}
                onClick={() => onPatch({ status: s })}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 메모 */}
      <section>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>메모</div>
        <textarea
          className="input"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (item.note ?? '')) onPatch({ note });
          }}
          style={{ width: '100%', resize: 'vertical' }}
        />
      </section>

      {/* 자료 메타 */}
      {(item.title || item.purpose || item.description) && (
        <section style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {item.purpose && <div>제작 사유: {item.purpose}</div>}
          {item.topic && <div>주제: {item.topic}</div>}
          {item.description && (
            <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{item.description}</div>
          )}
        </section>
      )}

      {/* 첨부 파일 */}
      <section style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>첨부 파일 ({item.files.length})</div>
          <FileUploadButton onUpload={onUpload} />
        </div>
        {item.files.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 12 }}>
            파일이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {item.files.map((f) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    background: 'var(--bg-primary)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {ROLE_LABEL[f.file_role]}
                </span>
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div>{f.file_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {(f.size_bytes / 1024).toFixed(0)} KB · v{f.version}
                  </div>
                </div>
                <a
                  href={api.lessonItemFileDownloadUrl(f.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm"
                >
                  ⬇
                </a>
                <button className="btn btn-sm" onClick={() => onDeleteFile(f.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 학부모 노출 */}
      <section style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>학부모 공개</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={item.visible_to_parent}
            onChange={(e) => onPatch({ visible_to_parent: e.target.checked })}
          />
          학부모에게 보이기
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={item.parent_can_download}
            disabled={!item.visible_to_parent}
            onChange={(e) => onPatch({ parent_can_download: e.target.checked })}
          />
          다운로드 허용
        </label>
        <button
          className="btn btn-sm"
          style={{ marginTop: 10 }}
          disabled={!item.visible_to_parent}
          onClick={onShare}
        >
          🔗 학부모 링크 복사
        </button>
      </section>
    </div>
  );
}

// ─── 파일 업로드 버튼 (역할 선택) ─────────────────

function FileUploadButton({ onUpload }: { onUpload: (file: File, role: LessonFileRole) => void }) {
  const [role, setRole] = useState<LessonFileRole>('main');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select
        className="input"
        value={role}
        onChange={(e) => setRole(e.target.value as LessonFileRole)}
        style={{ fontSize: 12, padding: '4px 6px' }}
      >
        <option value="main">본편</option>
        <option value="answer">정답</option>
        <option value="solution">해설</option>
        <option value="extra">부자료</option>
      </select>
      <label className="btn btn-sm btn-primary">
        + 업로드
        <input
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f, role);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}
