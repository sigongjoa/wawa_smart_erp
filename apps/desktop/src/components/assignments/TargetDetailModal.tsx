import { useEffect, useState } from 'react';
import Modal from '../Modal';
import { api } from '../../api';
import { toast } from '../Toast';

interface Props {
  targetId: string;
  onClose: () => void;
  onChanged: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  assigned: '미제출',
  submitted: '검토 대기',
  reviewed: '검토 중',
  needs_resubmit: '재제출 요청',
  completed: '완료',
};

const STATUS_COLOR: Record<string, string> = {
  assigned: '#9ca3af',
  submitted: '#2563eb',
  reviewed: '#7c3aed',
  needs_resubmit: '#dc2626',
  completed: '#16a34a',
};

export default function TargetDetailModal({ targetId, onClose, onChanged }: Props) {
  const [data, setData] = useState<{ target: any; submissions: any[]; responses: any[] } | null>(null);
  const [comment, setComment] = useState('');
  const [respondFile, setRespondFile] = useState<{ key: string; fileName: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
            <span style={{ background: STATUS_COLOR[target.status] || '#888', color: '#fff', padding: '2px 10px', borderRadius: 12 }}>
              {STATUS_LABEL[target.status] || target.status}
            </span>
            {target.due_at && <span style={{ color: '#888' }}>마감: {new Date(target.due_at).toLocaleString('ko-KR')}</span>}
            {target.last_submitted_at && <span style={{ color: '#888' }}>최근 제출: {new Date(target.last_submitted_at).toLocaleString('ko-KR')}</span>}
          </div>

          {target.instructions && (
            <div style={{ background: '#f9fafb', padding: 10, borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {target.instructions}
            </div>
          )}
          {target.attached_file_key && (
            <div style={{ fontSize: 13 }}>
              📎 첨부:{' '}
              <a href={api.assignmentFileUrl(target.attached_file_key)} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                {target.attached_file_name || target.attached_file_key.split('/').pop()}
              </a>
            </div>
          )}

          {/* 타임라인 */}
          <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>제출·회신 타임라인</h4>
            {submissions.length === 0 && responses.length === 0 && (
              <p style={{ fontSize: 13, color: '#888' }}>아직 활동이 없습니다.</p>
            )}
            <Timeline submissions={submissions} responses={responses} />
          </div>

          {/* 회신 작성 */}
          {!isCompleted && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
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
                    <span style={{ fontSize: 13, color: '#2563eb' }}>📎 {respondFile.fileName}</span>
                    <button type="button" onClick={() => setRespondFile(null)} style={{ padding: '2px 8px', fontSize: 12, background: '#fff', border: '1px solid #fecaca', color: '#e53e3e', borderRadius: 4, cursor: 'pointer' }}>제거</button>
                  </>
                ) : (
                  <input type="file" onChange={handleFile} disabled={uploading} accept=".pdf,.png,.jpg,.jpeg" />
                )}
                {uploading && <span style={{ fontSize: 12, color: '#888' }}>업로드 중...</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => respond('needs_resubmit')}
                  style={{ color: '#dc2626', borderColor: '#fecaca' }}
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
        <button type="button" className="btn btn-secondary" onClick={onClose}>닫기</button>
      </Modal.Footer>
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
            <div key={idx} style={{ background: '#eff6ff', padding: 10, borderRadius: 6, borderLeft: '3px solid #2563eb' }}>
              <div style={{ fontSize: 12, color: '#888' }}>학생 제출 · {new Date(s.submitted_at).toLocaleString('ko-KR')}</div>
              {s.note && <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{s.note}</div>}
              {s.files && s.files.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {s.files.map((f: any, i: number) => (
                    <a key={i} href={api.assignmentFileUrl(f.key)} target="_blank" rel="noreferrer"
                       style={{ fontSize: 12, color: '#2563eb', background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #dbeafe' }}>
                      📎 {f.name}
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
          <div key={idx} style={{ background: isResubmit ? '#fef2f2' : '#f0fdf4', padding: 10, borderRadius: 6, borderLeft: `3px solid ${isResubmit ? '#dc2626' : '#16a34a'}` }}>
            <div style={{ fontSize: 12, color: '#888' }}>
              {r.teacher_name || '선생님'} 회신 · {new Date(r.created_at).toLocaleString('ko-KR')}
              {isResubmit && <span style={{ marginLeft: 6, color: '#dc2626', fontWeight: 600 }}>[재제출 요청]</span>}
            </div>
            {r.comment && <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.comment}</div>}
            {r.file_key && (
              <a href={api.assignmentFileUrl(r.file_key)} target="_blank" rel="noreferrer"
                 style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: '#2563eb', background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #dbeafe' }}>
                📎 {r.file_name || r.file_key.split('/').pop()}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
