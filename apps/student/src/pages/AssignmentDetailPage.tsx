import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, AssignmentDetail } from '../api';
import './AssignmentDetailPage.css';

const STATUS_LABEL: Record<string, string> = {
  assigned: '제출 전',
  submitted: '검토 대기 중',
  reviewed: '검토 중',
  needs_resubmit: '재제출 필요',
  completed: '완료',
};

export default function AssignmentDetailPage() {
  const { targetId } = useParams<{ targetId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [files, setFiles] = useState<Array<{ key: string; name: string; size: number; mime?: string }>>([]);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = () => {
    if (!targetId) return;
    api.getAssignmentDetail(targetId)
      .then(setData)
      .catch((e) => setError(e.message || '로딩 실패'));
  };

  useEffect(() => { load(); }, [targetId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        const prepared = await maybeConvertHeic(file);
        const res = await api.uploadAssignmentFile(prepared);
        setFiles((prev) => [...prev, { key: res.key, name: res.fileName, size: res.fileSize, mime: res.contentType }]);
      }
    } catch (err: any) {
      setFeedback({ kind: 'err', text: err.message || '업로드 실패' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // iPhone HEIC 업로드 시 JPEG 변환 (Chrome/학부모 페이지 호환성)
  async function maybeConvertHeic(file: File): Promise<File> {
    const isHeic =
      (file.type && file.type.includes('heic')) ||
      file.name.toLowerCase().endsWith('.heic');
    if (!isHeic) return file;
    try {
      const { default: heic2any } = await import('heic2any');
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      const converted = Array.isArray(blob) ? blob[0] : blob;
      const baseName = file.name.replace(/\.heic$/i, '.jpg');
      return new File([converted], baseName, { type: 'image/jpeg' });
    } catch {
      // 변환 실패 시 원본 업로드 (Safari 에서는 렌더 가능)
      return file;
    }
  }

  const removeFile = (key: string) => {
    setFiles((prev) => prev.filter((f) => f.key !== key));
  };

  const handleSubmit = async () => {
    if (!targetId || files.length === 0) {
      setFeedback({ kind: 'err', text: '제출할 파일을 1개 이상 첨부해주세요' });
      return;
    }
    setSubmitting(true);
    try {
      await api.submitAssignment(targetId, { note: note.trim() || null, files });
      setFeedback({ kind: 'ok', text: '제출되었어요!' });
      setFiles([]); setNote('');
      load();
    } catch (err: any) {
      setFeedback({ kind: 'err', text: err.message || '제출 실패' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!data && !error) {
    return (
      <div className="ad">
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 2, color: 'var(--ink-40)', textTransform: 'uppercase' }}>
          LOADING…
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="ad">
        <button type="button" className="ad-back" onClick={() => navigate('/assignments')}>
          <span aria-hidden="true">←</span> LIST
        </button>
        <div className="ad-error">{error}</div>
      </div>
    );
  }

  const { target, submissions, responses } = data;
  const isOverdue = target.due_at && new Date(target.due_at).getTime() < Date.now();
  const canSubmit = target.status !== 'completed'
    && target.assignment_status === 'published'
    && !isOverdue;

  const timeline = [
    ...submissions.map((s) => ({ kind: 'sub' as const, at: s.submitted_at, data: s })),
    ...responses.map((r) => ({ kind: 'res' as const, at: r.created_at, data: r })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const statusClass = `ad-badge--${target.status}`;

  return (
    <div className="ad">
      <button type="button" className="ad-back" onClick={() => navigate('/assignments')}>
        <span aria-hidden="true">←</span> LIST
      </button>

      {feedback && (
        <div
          className={`ad-feedback ad-feedback--${feedback.kind}`}
          role={feedback.kind === 'err' ? 'alert' : 'status'}
          onClick={() => setFeedback(null)}
        >
          {feedback.text}
        </div>
      )}

      {/* 헤더 */}
      <header className="ad-head">
        <div className="ad-head-meta">
          <span className={`ad-badge ${statusClass}`}>
            {STATUS_LABEL[target.status]}
          </span>
          {target.due_at && (
            <span className="ad-due" data-overdue={!!isOverdue}>
              DUE · {new Date(target.due_at).toLocaleString('ko-KR', {
                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
        </div>
        <h1 className="ad-title">{target.title}</h1>
      </header>

      {/* 지시문 */}
      {target.instructions && (
        <section className="ad-section">
          <h3 className="ad-section-title">지시 사항</h3>
          <div className="ad-instructions">{target.instructions}</div>
        </section>
      )}

      {/* 첨부 */}
      {target.attached_file_key && (
        <section className="ad-section">
          <h3 className="ad-section-title">첨부</h3>
          <a
            href={api.assignmentFileUrl(target.attached_file_key)}
            target="_blank"
            rel="noreferrer"
            className="ad-attached"
          >
            <span>{target.attached_file_name || '첨부 파일'}</span>
            <span className="ad-attached-label">OPEN →</span>
          </a>
        </section>
      )}

      {/* 제출 영역 */}
      {canSubmit && (
        <section className="ad-section">
          <h3 className="ad-section-title">
            {target.status === 'needs_resubmit' ? '재제출' : '제출'}
          </h3>

          <label htmlFor="assignment-file-input" className="ad-dropzone" data-busy={uploading}>
            <span className="ad-dropzone-kicker">UPLOAD</span>
            <span className="ad-dropzone-title">
              {uploading ? '업로드 중…' : '사진 · PDF 선택'}
            </span>
            <span className="ad-dropzone-hint">여러 장 동시 선택 가능</span>
          </label>
          <input
            id="assignment-file-input"
            type="file"
            onChange={handleFile}
            disabled={uploading}
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.heic,image/*"
            className="ad-file-input"
          />

          {files.length > 0 && (
            <div className="ad-files">
              {files.map((f) => (
                <div key={f.key} className="ad-file">
                  <span className="ad-file-name">{f.name}</span>
                  <span className="ad-file-size">{(f.size / 1024).toFixed(0)} KB</span>
                  <button type="button" className="ad-file-remove" onClick={() => removeFile(f.key)}>
                    REMOVE
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            className="ad-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모 (선택) — 선생님께 하고 싶은 말"
            rows={2}
            maxLength={2000}
          />

          <button
            type="button"
            className="ad-submit"
            onClick={handleSubmit}
            disabled={submitting || uploading || files.length === 0}
          >
            {submitting ? 'SENDING' : 'SUBMIT'}
            <span className="ad-submit-arrow" aria-hidden="true">→</span>
          </button>
        </section>
      )}

      {!canSubmit && target.status !== 'completed' && (
        <section className="ad-section">
          <div className="ad-blocked">
            {isOverdue ? '기한이 지나 제출 불가'
              : target.assignment_status !== 'published' ? '과제가 닫혔음'
              : '지금 제출할 수 없음'}
          </div>
        </section>
      )}

      {/* 타임라인 */}
      <section className="ad-section">
        <h3 className="ad-section-title">진행 로그</h3>
        {timeline.length === 0 ? (
          <div className="ad-timeline-empty">NO ACTIVITY YET</div>
        ) : (
          <div className="ad-timeline">
            {timeline.map((ev, idx) => {
              if (ev.kind === 'sub') {
                const s = ev.data;
                return (
                  <div key={idx} className="ad-event" data-kind="sub">
                    <span className="ad-event-bar" />
                    <div className="ad-event-body">
                      <div className="ad-event-meta">
                        <span className="ad-event-meta-tag">SUBMIT</span>
                        <span>{new Date(s.submitted_at).toLocaleString('ko-KR')}</span>
                      </div>
                      {s.note && <div className="ad-event-note">{s.note}</div>}
                      {s.files.length > 0 && s.files.map((f, i) => (
                        <a key={i} href={api.assignmentFileUrl(f.key)} target="_blank" rel="noreferrer" className="ad-event-file">
                          {f.name}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              }
              const r = ev.data;
              const isResubmit = r.action === 'needs_resubmit';
              return (
                <div key={idx} className="ad-event" data-kind="res" data-resubmit={isResubmit}>
                  <span className="ad-event-bar" />
                  <div className="ad-event-body">
                    <div className="ad-event-meta">
                      <span className={`ad-event-meta-tag${isResubmit ? ' ad-event-meta-tag--danger' : ''}`}>
                        {isResubmit ? 'RESUBMIT' : 'FEEDBACK'}
                      </span>
                      <span>{r.teacher_name || '선생님'} · {new Date(r.created_at).toLocaleString('ko-KR')}</span>
                    </div>
                    {r.comment && <div className="ad-event-note">{r.comment}</div>}
                    {r.file_key && (
                      <a href={api.assignmentFileUrl(r.file_key)} target="_blank" rel="noreferrer" className="ad-event-file">
                        {r.file_name || '첨삭본'}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
