import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { parentApi, ParentApiError } from '../api/parent';
import { ParentGateView, useParentToken } from '../components/ParentTokenGate';

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
    <div style={{ minHeight: '100vh', background: '#fafbfc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* 헤더 */}
        <header style={{
          background: '#fff', border: '2px solid #1a1d24', borderRadius: 12,
          padding: 20, marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
            {data.student.name}{data.student.grade ? ` · ${data.student.grade}` : ''}
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1d24' }}>
            {data.assignment.title}
          </h1>
          <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#4b5563' }}>
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
            <div style={{
              marginTop: 12, padding: 12, background: '#f3f4f6', borderRadius: 8,
              fontSize: 13, whiteSpace: 'pre-wrap', color: '#374151',
            }}>
              {data.assignment.instructions}
            </div>
          )}
        </header>

        {/* 타임라인 */}
        {events.length === 0 ? (
          <div style={{
            background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12,
            padding: 32, textAlign: 'center', color: '#6b7280',
          }}>
            아직 제출 기록이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map((ev, idx) => {
              if (ev.kind === 'sub') {
                const s = ev.data;
                const images = s.files.filter(isImageFile);
                const others = s.files.filter((f) => !isImageFile(f));
                return (
                  <section
                    key={idx}
                    style={{
                      background: '#fff', borderRadius: 12,
                      border: '1.5px solid #e5e7eb', borderLeft: '4px solid #2563eb',
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>
                      학생 제출 · {new Date(s.submitted_at).toLocaleString('ko-KR')}
                    </div>
                    {s.note && (
                      <div style={{ fontSize: 14, marginBottom: 10, color: '#374151', whiteSpace: 'pre-wrap' }}>
                        {s.note}
                      </div>
                    )}
                    {images.length > 0 && (
                      <div style={{
                        display: 'grid', gap: 8, marginBottom: others.length ? 10 : 0,
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      }}>
                        {images.map((f, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setLightbox({ src: fileUrl(f.key), name: f.name })}
                            style={{
                              padding: 0, border: '2px solid #e5e7eb', borderRadius: 8,
                              overflow: 'hidden', cursor: 'pointer', background: '#fff',
                              aspectRatio: '1 / 1',
                            }}
                            aria-label={`${f.name} 크게 보기`}
                          >
                            <img
                              src={fileUrl(f.key)}
                              alt={f.name}
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    {others.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {others.map((f, i) => (
                          <a
                            key={i}
                            href={fileUrl(f.key)}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            style={{
                              fontSize: 13, color: '#2563eb', textDecoration: 'none',
                              padding: '6px 10px', border: '1.5px solid #dbeafe',
                              borderRadius: 6, background: '#eff6ff',
                            }}
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
                  style={{
                    background: '#fff', borderRadius: 12,
                    border: '1.5px solid #e5e7eb',
                    borderLeft: `4px solid ${isResubmit ? '#dc2626' : '#16a34a'}`,
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>
                    {r.teacher_name || '선생님'} 피드백 · {new Date(r.created_at).toLocaleString('ko-KR')}
                    {isResubmit && (
                      <span style={{ marginLeft: 8, color: '#dc2626' }}>[재제출 요청]</span>
                    )}
                  </div>
                  {r.comment && (
                    <div style={{ fontSize: 14, color: '#1f2937', whiteSpace: 'pre-wrap', marginBottom: r.file_key ? 10 : 0 }}>
                      {r.comment}
                    </div>
                  )}
                  {r.file_key && (
                    <a
                      href={fileUrl(r.file_key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      style={{
                        display: 'inline-block', fontSize: 13, color: '#2563eb',
                        textDecoration: 'none', padding: '6px 10px',
                        border: '1.5px solid #dbeafe', borderRadius: 6, background: '#eff6ff',
                      }}
                    >
                      {r.file_name || '첨삭본 열기'}
                    </a>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <footer style={{ marginTop: 24, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
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
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, cursor: 'zoom-out',
      }}
    >
      <img
        src={src}
        alt={name}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', border: '4px solid #fff' }}
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="닫기"
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 44, height: 44, borderRadius: 22,
          background: '#fff', border: '2px solid #000',
          fontSize: 20, fontWeight: 700, cursor: 'pointer',
        }}
      >×</button>
    </div>
  );
}
