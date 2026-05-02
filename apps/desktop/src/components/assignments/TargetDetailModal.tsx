import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal';
import { api } from '../../api';
import { toast } from '../Toast';
import AssignmentStatusBadge from './AssignmentStatusBadge';

interface Props {
  targetId: string;
  onClose: () => void;
  onChanged: () => void;
}


interface SubmissionFile {
  key: string;
  name: string;
  size?: number;
  mime?: string;
}

function isImageFile(f: SubmissionFile): boolean {
  if (f.mime && f.mime.startsWith('image/')) return true;
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext);
}

export default function TargetDetailModal({ targetId, onClose, onChanged }: Props) {
  const [data, setData] = useState<{ target: any; submissions: any[]; responses: any[] } | null>(null);
  const [comment, setComment] = useState('');
  const [respondFile, setRespondFile] = useState<{ key: string; fileName: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const load = () => {
    api.getAssignmentTarget(targetId)
      .then(setData)
      .catch((err) => toast.error(err.message || '로딩 실패'));
  };

  useEffect(() => { load(); }, [targetId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadAssignmentFile(file, 'response');
      setRespondFile({ key: res.key, fileName: res.fileName });
    } catch (err: any) {
      toast.error(err.message || '업로드 실패');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const respond = async (action: 'accept' | 'needs_resubmit') => {
    if (!comment.trim() && !respondFile) {
      toast.error('코멘트나 첨삭 파일 중 하나는 필요합니다');
      return;
    }
    setSubmitting(true);
    try {
      await api.respondToTarget(targetId, {
        comment: comment.trim() || null,
        file_key: respondFile?.key || null,
        file_name: respondFile?.fileName || null,
        action,
        submission_id: data?.submissions[0]?.id || null,
      });
      toast.success(action === 'accept' ? '완료 처리되었습니다' : '재제출 요청되었습니다');
      setComment('');
      setRespondFile(null);
      load();
      onChanged();
    } catch (err: any) {
      toast.error(err.message || '회신 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const galleryImages = useMemo<SubmissionFile[]>(() => {
    if (!data) return [];
    const acc: SubmissionFile[] = [];
    for (const s of data.submissions) {
      for (const f of (s.files || []) as SubmissionFile[]) {
        if (isImageFile(f)) acc.push(f);
      }
    }
    return acc;
  }, [data]);

  const canShareWithParent = useMemo(() => {
    if (!data) return false;
    return data.responses.length > 0;
  }, [data]);

  if (!data) {
    return (
      <Modal onClose={onClose}>
        <Modal.Header>로딩 중...</Modal.Header>
        <Modal.Body><p style={{ padding: 16 }}>잠시만요...</p></Modal.Body>
      </Modal>
    );
  }

  const { target, submissions, responses } = data;
  const isCompleted = target.status === 'completed';

  return (
    <Modal onClose={onClose} className="modal-content--lg">
      <Modal.Header>
        {target.assignment_title} — {target.student_name}
      </Modal.Header>
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
            <AssignmentStatusBadge status={target.status} />
            {target.due_at && <span style={{ color: 'var(--text-tertiary)' }}>마감: {new Date(target.due_at).toLocaleString('ko-KR')}</span>}
            {target.last_submitted_at && <span style={{ color: 'var(--text-tertiary)' }}>최근 제출: {new Date(target.last_submitted_at).toLocaleString('ko-KR')}</span>}
          </div>

          {target.instructions && (
            <div style={{ background: 'var(--bg-tertiary)', padding: 10, borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {target.instructions}
            </div>
          )}
          {target.attached_file_key && (
            <div style={{ fontSize: 13 }}>
              첨부:{' '}
              <a href={api.assignmentFileUrl(target.attached_file_key)} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>
                {target.attached_file_name || target.attached_file_key.split('/').pop()}
              </a>
            </div>
          )}

          {/* 이미지 갤러리 */}
          {galleryImages.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: 12 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>제출 이미지 ({galleryImages.length})</h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 8,
              }}>
                {galleryImages.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightbox({ src: api.assignmentFileUrl(f.key), name: f.name })}
                    style={{
                      padding: 0, border: '2px solid #e5e7eb', borderRadius: 8,
                      overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-secondary)',
                      aspectRatio: '1 / 1',
                    }}
                    aria-label={`${f.name} 크게 보기`}
                  >
                    <img
                      src={api.assignmentFileUrl(f.key)}
                      alt={f.name}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 타임라인 */}
          <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: 12 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>제출·회신 타임라인</h4>
            {submissions.length === 0 && responses.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>아직 활동이 없습니다.</p>
            )}
            <Timeline submissions={submissions} responses={responses} />
          </div>

          {/* 회신 작성 */}
          {!isCompleted && (
            <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: 12 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>회신 작성</h4>
              <textarea
                className="input"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="피드백 코멘트를 적어주세요"
                rows={3}
                maxLength={5000}
                style={{ resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {respondFile ? (
                  <>
                    <span style={{ fontSize: 13, color: 'var(--info)' }}>{respondFile.fileName}</span>
                    <button type="button" onClick={() => setRespondFile(null)} style={{ padding: '2px 8px', fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--danger-surface)', color: 'var(--danger)', borderRadius: 4, cursor: 'pointer' }}>제거</button>
                  </>
                ) : (
                  <input type="file" onChange={handleFile} disabled={uploading} accept=".pdf,.png,.jpg,.jpeg" />
                )}
                {uploading && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>업로드 중...</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => respond('needs_resubmit')}
                  style={{ color: 'var(--danger-text)', borderColor: 'var(--danger-surface)' }}
                >
                  재제출 요청
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submitting}
                  onClick={() => respond('accept')}
                >
                  {submitting ? '처리 중...' : '완료 처리'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        {canShareWithParent && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShareOpen(true)}
          >
            학부모 공유
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onClose}>닫기</button>
      </Modal.Footer>

      {lightbox && (
        <ImageLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
      {shareOpen && (
        <ParentShareModal
          targetId={targetId}
          onClose={() => setShareOpen(false)}
        />
      )}
    </Modal>
  );
}

function Timeline({ submissions, responses }: { submissions: any[]; responses: any[] }) {
  const events = [
    ...submissions.map((s) => ({ kind: 'sub' as const, at: s.submitted_at, data: s })),
    ...responses.map((r) => ({ kind: 'res' as const, at: r.created_at, data: r })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.map((ev, idx) => {
        if (ev.kind === 'sub') {
          const s = ev.data;
          return (
            <div key={idx} style={{ background: 'var(--info-surface)', padding: 10, borderRadius: 6, borderLeft: '3px solid var(--info)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>학생 제출 · {new Date(s.submitted_at).toLocaleString('ko-KR')}</div>
              {s.note && <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{s.note}</div>}
              {s.files && s.files.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {s.files.map((f: any, i: number) => (
                    <a key={i} href={api.assignmentFileUrl(f.key)} target="_blank" rel="noreferrer"
                       style={{ fontSize: 12, color: 'var(--info)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--info-surface)' }}>
                      {f.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        }
        const r = ev.data;
        const isResubmit = r.action === 'needs_resubmit';
        return (
          <div key={idx} style={{ background: isResubmit ? 'var(--danger-surface)' : 'var(--success-surface)', padding: 10, borderRadius: 6, borderLeft: `3px solid ${isResubmit ? 'var(--danger)' : 'var(--success)'}` }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {r.teacher_name || '선생님'} 회신 · {new Date(r.created_at).toLocaleString('ko-KR')}
              {isResubmit && <span style={{ marginLeft: 6, color: 'var(--danger-text)', fontWeight: 600 }}>[재제출 요청]</span>}
            </div>
            {r.comment && <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.comment}</div>}
            {r.file_key && (
              <a href={api.assignmentFileUrl(r.file_key)} target="_blank" rel="noreferrer"
                 style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: 'var(--info)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--info-surface)' }}>
                {r.file_name || r.file_key.split('/').pop()}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImageLightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-label={`${name} 크게 보기`}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, cursor: 'zoom-out',
      }}
    >
      <img
        src={src}
        alt={name}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', border: '4px solid var(--bg-secondary)' }}
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="닫기"
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 44, height: 44, borderRadius: 22,
          background: 'var(--bg-secondary)', border: '2px solid #000',
          fontSize: 20, fontWeight: 700, cursor: 'pointer',
        }}
      >×</button>
    </div>
  );
}

function ParentShareModal({ targetId, onClose }: { targetId: string; onClose: () => void }) {
  const [days, setDays] = useState(14);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ url: string; expires_at: string } | null>(null);

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.createHomeworkParentShare(targetId, days);
      setResult({ url: res.url, expires_at: res.expires_at });
      try { await navigator.clipboard.writeText(res.url); toast.success('링크가 복사되었습니다'); }
      catch { /* ignore */ }
    } catch (err: any) {
      toast.error(err.message || '링크 생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.url); toast.success('복사되었습니다'); }
    catch { toast.error('복사 실패'); }
  };

  return (
    <Modal onClose={onClose}>
      <Modal.Header>학부모 공유 링크</Modal.Header>
      <Modal.Body>
        {!result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              이 과제의 제출물과 피드백을 학부모에게 읽기 전용으로 공유합니다.
            </p>
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>링크 유효 기간</span>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                style={{ padding: '8px 10px', fontSize: 14, border: '1.5px solid var(--border-primary)', borderRadius: 6 }}
              >
                <option value={7}>7일</option>
                <option value={14}>14일</option>
                <option value={30}>30일</option>
                <option value={60}>60일</option>
              </select>
            </label>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--success)' }}>링크가 생성되고 클립보드에 복사되었습니다.</div>
            <input
              readOnly
              value={result.url}
              onFocus={(e) => e.currentTarget.select()}
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1.5px solid var(--border-primary)', borderRadius: 6, fontFamily: 'monospace' }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              만료: {new Date(result.expires_at).toLocaleString('ko-KR')}
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {result ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={copy}>다시 복사</button>
            <button type="button" className="btn btn-primary" onClick={onClose}>완료</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="button" className="btn btn-primary" onClick={create} disabled={creating}>
              {creating ? '생성 중...' : '링크 생성'}
            </button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}
