import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  ArchiveListItem,
  ArchiveDetail,
  ArchiveFileRole,
  ArchiveScope,
  ArchiveAccessLogItem,
  Student,
} from '../api';
import { toast, useConfirm } from '../components/Toast';

type PurposePreset =
  | '중간고사 대비'
  | '기말고사 대비'
  | '오답 보강'
  | '심화'
  | '특강'
  | '숙제'
  | '기타';

const PURPOSE_PRESETS: PurposePreset[] = [
  '중간고사 대비',
  '기말고사 대비',
  '오답 보강',
  '심화',
  '특강',
  '숙제',
  '기타',
];

const FILE_ROLE_LABEL: Record<ArchiveFileRole, string> = {
  main: '본편',
  answer: '정답',
  solution: '해설',
  extra: '부자료',
};

const SCOPE_LABEL: Record<ArchiveScope, string> = {
  student: '학생',
  class: '반',
  academy: '학원 전체',
};

export default function ArchivePage() {
  const [archives, setArchives] = useState<ArchiveListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ subject: '', grade: '', purpose: '', q: '' });
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listArchives({
        subject: filter.subject || undefined,
        grade: filter.grade || undefined,
        purpose: filter.purpose || undefined,
        q: filter.q || undefined,
        includeArchived: showArchived,
      });
      setArchives(data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '불러오기 실패');
      setArchives([]);
    } finally {
      setLoading(false);
    }
  }, [filter, showArchived]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([
          api.getStudents('all').catch(() => []),
          api.getClasses().catch(() => []),
        ]);
        setStudents(s || []);
        setClasses((c || []).map((x: any) => ({ id: x.id, name: x.name || x.id })));
      } catch { /* noop */ }
    })();
  }, []);

  const subjects = useMemo(
    () => Array.from(new Set(archives.map((a) => a.subject).filter(Boolean))) as string[],
    [archives]
  );
  const grades = useMemo(
    () => Array.from(new Set(archives.map((a) => a.grade).filter(Boolean))) as string[],
    [archives]
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">자료 아카이브</h1>
          <p className="page-subtitle">제작한 교재를 기록하고 학생/학부모에게 배포합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          + 새 교재
        </button>
      </div>

      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
        <input
          type="search"
          placeholder="제목/주제/설명 검색"
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          className="input"
          style={{ minWidth: 220 }}
        />
        <select className="input" value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })}>
          <option value="">과목 전체</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={filter.grade} onChange={(e) => setFilter({ ...filter, grade: e.target.value })}>
          <option value="">학년 전체</option>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="input" value={filter.purpose} onChange={(e) => setFilter({ ...filter, purpose: e.target.value })}>
          <option value="">제작 사유 전체</option>
          {PURPOSE_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          아카이브 포함
        </label>
      </div>

      {loading ? (
        <div className="page-loading">불러오는 중…</div>
      ) : archives.length === 0 ? (
        <div className="empty-state" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          등록된 교재가 없습니다. 오른쪽 상단 <strong>+ 새 교재</strong>로 시작하세요.
        </div>
      ) : (
        <div className="archive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {archives.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className="card"
              style={{ textAlign: 'left', padding: 16, borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{a.title}</div>
                {a.archived_at && <span className="badge" style={{ background: 'var(--color-bg-muted)' }}>보관</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {[a.subject, a.grade, a.topic].filter(Boolean).join(' · ') || '—'}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="badge badge-primary">{a.purpose}</span>
                {a.tags.slice(0, 3).map((t) => (
                  <span key={t} className="badge" style={{ background: 'var(--color-bg-muted)' }}>#{t}</span>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', gap: 12 }}>
                <span>📎 {a.file_count}</span>
                <span>📤 {a.dist_count}</span>
                <span>⬇ {a.download_count}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                {new Date(a.created_at).toLocaleDateString('ko-KR')}
              </div>
            </button>
          ))}
        </div>
      )}

      {createOpen && (
        <ArchiveCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            setSelectedId(id);
            load();
          }}
        />
      )}

      {selectedId && (
        <ArchiveDetailDrawer
          id={selectedId}
          students={students}
          classes={classes}
          onClose={() => { setSelectedId(null); load(); }}
          onArchived={async () => {
            if (!(await confirm('이 교재를 보관 처리하시겠습니까? (학생/학부모에게 보이지 않습니다)'))) return;
            try {
              await api.archiveArchive(selectedId);
              toast.success('보관 처리되었습니다.');
              setSelectedId(null);
              load();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : '보관 실패');
            }
          }}
        />
      )}

      {ConfirmDialog}
    </div>
  );
}

// ─────────────── 생성 모달 ───────────────

function ArchiveCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    title: '',
    subject: '',
    grade: '',
    topic: '',
    purpose: PURPOSE_PRESETS[0] as string,
    description: '',
    tagsText: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) return toast.error('제목을 입력하세요.');
    if (!form.purpose.trim()) return toast.error('제작 사유를 입력하세요.');
    setSaving(true);
    try {
      const tags = form.tagsText.split(',').map((t) => t.trim()).filter(Boolean);
      const { id } = await api.createArchive({
        title: form.title.trim(),
        purpose: form.purpose.trim(),
        subject: form.subject.trim() || null,
        grade: form.grade.trim() || null,
        topic: form.topic.trim() || null,
        description: form.description.trim() || null,
        tags,
      });
      toast.success('교재가 생성되었습니다.');
      onCreated(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '생성 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2>새 교재 등록</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label>
            제목 <span style={{ color: 'crimson' }}>*</span>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 2026 1학기 중간 대비 - 이차함수" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label>
              과목
              <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="수학" />
            </label>
            <label>
              학년
              <input className="input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="중3" />
            </label>
          </div>
          <label>
            주제
            <input className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="이차함수, 관계대명사 …" />
          </label>
          <label>
            제작 사유 <span style={{ color: 'crimson' }}>*</span>
            <select className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {PURPOSE_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>
            태그 (쉼표로 구분)
            <input className="input" value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} placeholder="시험대비, 2026-1" />
          </label>
          <label>
            설명
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="내부 메모 — 학부모/학생에게도 노출됩니다." />
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? '저장 중…' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────── 상세 Drawer ───────────────

function ArchiveDetailDrawer({
  id,
  students,
  classes,
  onClose,
  onArchived,
}: {
  id: string;
  students: Student[];
  classes: { id: string; name: string }[];
  onClose: () => void;
  onArchived: () => void;
}) {
  const [detail, setDetail] = useState<ArchiveDetail | null>(null);
  const [tab, setTab] = useState<'files' | 'distribute' | 'log'>('files');
  const [log, setLog] = useState<ArchiveAccessLogItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.getArchive(id);
      setDetail(d);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '불러오기 실패');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'log') return;
    api.getArchiveLog(id).then(setLog).catch(() => setLog([]));
  }, [id, tab]);

  if (!detail) {
    return (
      <div className="drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="drawer" style={{ width: '100%', maxWidth: 680, padding: 16 }}>불러오는 중…</div>
      </div>
    );
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>, role: ArchiveFileRole) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadArchiveFile(id, file, role);
      toast.success('업로드 완료');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="drawer-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer" style={{ width: '100%', maxWidth: 720, background: 'var(--color-surface)', height: '100%', overflowY: 'auto', padding: 20, boxShadow: '-4px 0 20px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>{detail.title}</h2>
            <div style={{ color: 'var(--color-text-muted)', marginTop: 4, fontSize: 13 }}>
              {[detail.subject, detail.grade, detail.topic].filter(Boolean).join(' · ') || '—'} · {detail.purpose}
            </div>
            {detail.description && (
              <div style={{ marginTop: 8, fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--color-text)' }}>{detail.description}</div>
            )}
            {detail.tags.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {detail.tags.map((t) => <span key={t} className="badge" style={{ background: 'var(--color-bg-muted)' }}>#{t}</span>)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {!detail.archived_at && (
              <button className="btn btn-danger" onClick={onArchived}>보관</button>
            )}
            <button className="btn" onClick={onClose}>닫기</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginTop: 16, borderBottom: '1px solid var(--color-border)' }}>
          {(['files', 'distribute', 'log'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: tab === t ? 'var(--color-primary)' : 'var(--color-text)',
                cursor: 'pointer',
                fontWeight: tab === t ? 600 : 400,
              }}
            >
              {t === 'files' ? '파일' : t === 'distribute' ? '배포' : '로그'}
            </button>
          ))}
        </div>

        {tab === 'files' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {(Object.keys(FILE_ROLE_LABEL) as ArchiveFileRole[]).map((r) => (
                <label key={r} className="btn" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                  {FILE_ROLE_LABEL[r]} 업로드
                  <input type="file" hidden disabled={uploading} onChange={(e) => onFile(e, r)} />
                </label>
              ))}
            </div>
            {detail.files.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', padding: 16, textAlign: 'center' }}>
                업로드된 파일이 없습니다.
              </div>
            ) : (
              <table className="table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr><th>역할</th><th>파일명</th><th>버전</th><th>크기</th><th></th></tr>
                </thead>
                <tbody>
                  {detail.files.map((f) => (
                    <tr key={f.id}>
                      <td><span className="badge badge-primary">{FILE_ROLE_LABEL[f.file_role]}</span></td>
                      <td>{f.file_name}</td>
                      <td>v{f.version}</td>
                      <td>{(f.size_bytes / 1024).toFixed(0)} KB</td>
                      <td style={{ display: 'flex', gap: 4 }}>
                        <a className="btn btn-sm" href={api.archiveFileDownloadUrl(f.id)} target="_blank" rel="noreferrer">↓</a>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={async () => {
                            if (!confirm('이 파일을 삭제할까요?')) return;
                            try {
                              await api.deleteArchiveFile(id, f.id);
                              await load();
                              toast.success('삭제되었습니다');
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : '삭제 실패');
                            }
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'distribute' && (
          <DistributeTab id={id} detail={detail} students={students} classes={classes} onRefresh={load} />
        )}

        {tab === 'log' && (
          <div style={{ marginTop: 12 }}>
            {log.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', padding: 16, textAlign: 'center' }}>아직 열람 기록이 없습니다.</div>
            ) : (
              <table className="table" style={{ width: '100%', fontSize: 13 }}>
                <thead><tr><th>시각</th><th>대상</th><th>동작</th></tr></thead>
                <tbody>
                  {log.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.accessed_at).toLocaleString('ko-KR')}</td>
                      <td>
                        <span className="badge" style={{ background: row.accessor_type === 'parent' ? 'var(--color-accent-soft)' : 'var(--color-bg-muted)' }}>
                          {row.accessor_type === 'parent' ? '학부모' : row.accessor_type === 'student' ? '학생' : '스태프'}
                        </span>{' '}
                        {row.accessor_name || '—'}
                      </td>
                      <td>{row.action === 'download' ? '다운로드' : '열람'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────── 배포 탭 ───────────────

function DistributeTab({
  id,
  detail,
  students,
  classes,
  onRefresh,
}: {
  id: string;
  detail: ArchiveDetail;
  students: Student[];
  classes: { id: string; name: string }[];
  onRefresh: () => Promise<void>;
}) {
  const [scope, setScope] = useState<ArchiveScope>('student');
  const [scopeId, setScopeId] = useState('');
  const [canDownload, setCanDownload] = useState(true);
  const [expires, setExpires] = useState('');
  const [shareStudent, setShareStudent] = useState('');

  const add = async () => {
    if (scope !== 'academy' && !scopeId) return toast.error('대상을 선택하세요.');
    try {
      await api.distributeArchive(id, {
        scope,
        scope_id: scope === 'academy' ? null : scopeId,
        can_download: canDownload,
        expires_at: expires || null,
      });
      setScopeId('');
      setExpires('');
      await onRefresh();
      toast.success('배포되었습니다.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '배포 실패');
    }
  };

  const revoke = async (distId: string) => {
    if (!confirm('이 배포를 취소할까요?')) return;
    try {
      await api.revokeArchiveDistribution(id, distId);
      await onRefresh();
      toast.success('배포가 취소되었습니다.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '취소 실패');
    }
  };

  const issueParentLink = async () => {
    if (!shareStudent) return toast.error('학부모 공유할 학생을 선택하세요.');
    try {
      const res = await api.createArchiveParentShare(id, shareStudent, 30);
      await navigator.clipboard.writeText(res.url).catch(() => {});
      toast.success(`링크 생성됨 (${new Date(res.expires_at).toLocaleDateString('ko-KR')}까지) — 클립보드 복사됨`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '링크 발급 실패');
    }
  };

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: 12, background: 'var(--color-bg-muted)', borderRadius: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>새 배포 추가</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'center' }}>
          <label>대상 범위</label>
          <select className="input" value={scope} onChange={(e) => { setScope(e.target.value as ArchiveScope); setScopeId(''); }}>
            <option value="student">학생</option>
            <option value="class">반</option>
            <option value="academy">학원 전체</option>
          </select>
          {scope === 'student' && (
            <>
              <label>학생</label>
              <select className="input" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                <option value="">선택…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.grade || ''})</option>)}
              </select>
            </>
          )}
          {scope === 'class' && (
            <>
              <label>반</label>
              <select className="input" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                <option value="">선택…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          )}
          <label>다운로드 허용</label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={canDownload} onChange={(e) => setCanDownload(e.target.checked)} />
            학생이 파일을 내려받을 수 있음
          </label>
          <label>만료일</label>
          <input className="input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={add}>배포</button>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>현재 배포 현황</div>
        {detail.distributions.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', padding: 12 }}>배포된 곳이 없습니다.</div>
        ) : (
          <table className="table" style={{ width: '100%', fontSize: 13 }}>
            <thead><tr><th>범위</th><th>대상</th><th>다운로드</th><th>만료</th><th>배포일</th><th></th></tr></thead>
            <tbody>
              {detail.distributions.map((d) => (
                <tr key={d.id}>
                  <td><span className="badge">{SCOPE_LABEL[d.scope]}</span></td>
                  <td>{d.target_name || '—'}</td>
                  <td>{d.can_download ? '허용' : '열람만'}</td>
                  <td>{d.expires_at ? new Date(d.expires_at).toLocaleDateString('ko-KR') : '무기한'}</td>
                  <td>{new Date(d.distributed_at).toLocaleDateString('ko-KR')}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => revoke(d.id)}>취소</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ padding: 12, background: 'var(--color-bg-muted)', borderRadius: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>학부모 공유 링크 (30일)</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          해당 학생에게 배포된 전체 자료를 학부모가 열람할 수 있는 링크를 생성합니다. (HMAC 서명, 로그인 불필요)
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select className="input" value={shareStudent} onChange={(e) => setShareStudent(e.target.value)} style={{ flex: 1 }}>
            <option value="">학생 선택…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.grade || ''})</option>)}
          </select>
          <button className="btn btn-primary" onClick={issueParentLink}>링크 생성 + 복사</button>
        </div>
      </div>
    </div>
  );
}
