import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { parentApi, ParentApiError } from '../api/parent';
import { ParentGateView, useParentToken } from '../components/ParentTokenGate';
import './ParentHomeworkPage.css';

interface SubmissionFile {
  key: string;
  name: string;
  size?: number;
  mime?: string;
}

interface Submission {
  id: string;
  submitted_at: string;
  note: string | null;
  files: SubmissionFile[];
}

interface Response {
  id: string;
  comment: string | null;
  file_key: string | null;
  file_name: string | null;
  action: 'accept' | 'needs_resubmit' | string;
  created_at: string;
  teacher_name: string | null;
}

interface ViewData {
  student: { name: string; grade: string | null };
  assignment: {
    title: string;
    instructions: string | null;
    due_at: string | null;
    attached_file_key: string | null;
    attached_file_name: string | null;
  };
  target: {
    id: string;
    status: string;
    assigned_at: string;
    last_submitted_at: string | null;
    last_reviewed_at: string | null;
  };
  submissions: Submission[];
  responses: Response[];
}

function isImageFile(f: SubmissionFile): boolean {
  if (f.mime && f.mime.startsWith('image/')) return true;
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext);
}

export default function ParentHomeworkPage() {
  const { targetId } = useParams<{ targetId: string }>();
  const token = useParentToken();

  const [data, setData] = useState<ViewData | null>(null);
  const [error, setError] = useState<Error | ParentApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);

  useEffect(() => {
    if (!targetId || !token) {
      setError(new ParentApiError('TOKEN_MISSING', '유효하지 않은 링크입니다.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    parentApi
      .getHomework<ViewData>(targetId, token)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => setLoading(false));
  }, [targetId, token]);

  const fileUrl = (key: string) =>
    parentApi.homeworkFileUrl(targetId || '', key, token);

  const events = useMemo(() => {
    if (!data) return [] as Array<
      | { kind: 'sub'; at: string; data: Submission }
      | { kind: 'res'; at: string; data: Response }
    >;
    const arr: Array<
      | { kind: 'sub'; at: string; data: Submission }
      | { kind: 'res'; at: string; data: Response }
    > = [
      ...data.submissions.map((s) => ({ kind: 'sub' as const, at: s.submitted_at, data: s })),
      ...data.responses.map((r) => ({ kind: 'res' as const, at: r.created_at, data: r })),
    ];
    arr.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return arr;
  }, [data]);

  if (loading || error || !data) {
    return <ParentGateView loading={loading} error={error}>{null}</ParentGateView>;
  }

  return (
    <div className="phw-page">
      <div className="phw-shell">
        {/* 헤더 */}
        <header className="phw-header">
          <div className="phw-header-meta">
            {data.student.name}{data.student.grade ? ` · ${data.student.grade}` : ''}
          </div>
          <h1 className="phw-header-title">
            {data.assignment.title}
          </h1>
          <div className="phw-header-dates">
            {data.assignment.due_at && (
              <span>마감 {new Date(data.assignment.due_at).toLocaleDateString('ko-KR')}</span>
            )}
            {data.target.last_submitted_at && (
              <span>제출 {new Date(data.target.last_submitted_at).toLocaleDateString('ko-KR')}</span>
            )}
            {data.target.last_reviewed_at && (
              <span>검토 {new Date(data.target.last_reviewed_at).toLocaleDateString('ko-KR')}</span>
            )}
          </div>
          {data.assignment.instructions && (
            <div className="phw-instructions">
              {data.assignment.instructions}
            </div>
          )}
        </header>

        {/* 타임라인 */}
        {events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-desc">아직 제출 기록이 없습니다.</div>
          </div>
        ) : (
          <div className="phw-timeline">
            {events.map((ev, idx) => {
              if (ev.kind === 'sub') {
                const s = ev.data;
                const images = s.files.filter(isImageFile);
                const others = s.files.filter((f) => !isImageFile(f));
                return (
                  <section
                    key={idx}
                    className="phw-card phw-card-sub"
                  >
                    <div className="phw-card-label">
                      학생 제출 · {new Date(s.submitted_at).toLocaleString('ko-KR')}
                    </div>
                    {s.note && (
                      <div className="phw-note">
                        {s.note}
                      </div>
                    )}
                    {images.length > 0 && (
                      <div className={`phw-image-grid${others.length ? ' phw-image-grid-gap' : ''}`}>
                        {images.map((f, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setLightbox({ src: fileUrl(f.key), name: f.name })}
                            className="phw-image-btn"
                            aria-label={`${f.name} 크게 보기`}
                          >
                            <img
                              src={fileUrl(f.key)}
                              alt={f.name}
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    {others.length > 0 && (
                      <div className="phw-file-list">
                        {others.map((f, i) => (
                          <a
                            key={i}
                            href={fileUrl(f.key)}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            className="phw-file-link"
                          >
                            {f.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </section>
                );
              }
              const r = ev.data;
              const isResubmit = r.action === 'needs_resubmit';
              return (
                <section
                  key={idx}
                  className={`phw-card ${isResubmit ? 'phw-card-res-resubmit' : 'phw-card-res-accept'}`}
                >
                  <div className="phw-card-label">
                    {r.teacher_name || '선생님'} 피드백 · {new Date(r.created_at).toLocaleString('ko-KR')}
                    {isResubmit && (
                      <span className="phw-card-resubmit-tag">[재제출 요청]</span>
                    )}
                  </div>
                  {r.comment && (
                    <div className={`phw-comment${r.file_key ? ' phw-comment-gap' : ''}`}>
                      {r.comment}
                    </div>
                  )}
                  {r.file_key && (
                    <a
                      href={fileUrl(r.file_key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="phw-file-link phw-file-link-inline"
                    >
                      {r.file_name || '첨삭본 열기'}
                    </a>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <footer className="phw-footer">
          와와 학원 · 이 페이지는 보호된 링크로만 열람할 수 있습니다.
        </footer>
      </div>

      {lightbox && (
        <Lightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function Lightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
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
      className="phw-lightbox"
    >
      <img
        src={src}
        alt={name}
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="닫기"
        className="phw-lightbox-close with-icon"
      >
        <X size={20} />
      </button>
    </div>
  );
}
