import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '';

type FileRole = 'main' | 'answer' | 'solution' | 'extra';

const ROLE_LABEL: Record<FileRole, string> = {
  main: '본편',
  answer: '정답',
  solution: '해설',
  extra: '부자료',
};

interface ArchiveFile {
  id: string;
  file_name: string;
  file_role: FileRole;
  size_bytes: number;
  version: number;
}

interface ArchiveItem {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  purpose: string;
  description: string | null;
  tags: string[];
  can_download: boolean;
  distributed_at: string;
  created_at: string;
  files: ArchiveFile[];
}

interface ViewResponse {
  student: { id: string; name: string; grade: string | null; school: string | null };
  archives: ArchiveItem[];
}

export default function ParentArchivePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [data, setData] = useState<ViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ subject: '', purpose: '' });

  useEffect(() => {
    if (!studentId || !token) {
      setError('유효하지 않은 링크입니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_BASE}/api/parent-archives/${studentId}?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || '불러오기에 실패했습니다');
        setData(json?.data ?? json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '오류가 발생했습니다'))
      .finally(() => setLoading(false));
  }, [studentId, token]);

  const subjects = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.archives.map((a) => a.subject).filter(Boolean))) as string[];
  }, [data]);
  const purposes = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.archives.map((a) => a.purpose)));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.archives.filter((a) => {
      if (filter.subject && a.subject !== filter.subject) return false;
      if (filter.purpose && a.purpose !== filter.purpose) return false;
      return true;
    });
  }, [data, filter]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>불러오는 중…</div>;
  }
  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🔒</div>
          <h2 style={{ margin: '12px 0' }}>접근할 수 없습니다</h2>
          <p style={{ color: '#666' }}>{error || '링크가 올바르지 않거나 만료되었습니다.'}</p>
          <p style={{ color: '#999', fontSize: 13, marginTop: 16 }}>학원에 문의해 새 링크를 요청해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7fb', padding: '24px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <header style={{ background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, color: '#999' }}>학습자료 공유함</div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 22 }}>{data.student.name} 학생 자료</h1>
          <div style={{ color: '#666', fontSize: 13 }}>
            {[data.student.grade, data.student.school].filter(Boolean).join(' · ') || '—'}
          </div>
        </header>

        {data.archives.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <select
              value={filter.subject}
              onChange={(e) => setFilter({ ...filter, subject: e.target.value })}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}
            >
              <option value="">과목 전체</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filter.purpose}
              onChange={(e) => setFilter({ ...filter, purpose: e.target.value })}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}
            >
              <option value="">제작 사유 전체</option>
              {purposes.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}

        <main style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ background: '#fff', padding: 40, borderRadius: 12, textAlign: 'center', color: '#999' }}>
              공유된 자료가 없습니다.
            </div>
          ) : (
            filtered.map((a) => (
              <article key={a.id} style={{ background: '#fff', padding: 18, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 17 }}>{a.title}</h2>
                  <span style={{ background: '#eef', color: '#447', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{a.purpose}</span>
                </div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                  {[a.subject, a.grade, a.topic].filter(Boolean).join(' · ') || '—'}
                </div>
                {a.description && (
                  <p style={{ marginTop: 8, fontSize: 14, color: '#333', whiteSpace: 'pre-wrap' }}>{a.description}</p>
                )}
                {a.tags.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {a.tags.map((t) => (
                      <span key={t} style={{ background: '#f0f0f4', color: '#666', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>#{t}</span>
                    ))}
                  </div>
                )}

                {a.files.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {a.files.map((f) => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f7f7fb', borderRadius: 8 }}>
                        <span style={{ background: '#fff', color: '#447', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          {ROLE_LABEL[f.file_role]}
                        </span>
                        <div style={{ flex: 1, fontSize: 13 }}>
                          <div>{f.file_name}</div>
                          <div style={{ fontSize: 11, color: '#999' }}>{(f.size_bytes / 1024).toFixed(0)} KB · v{f.version}</div>
                        </div>
                        {a.can_download ? (
                          <a
                            href={`${API_BASE}/api/parent-archives/${studentId}/download/${encodeURIComponent(f.id)}?token=${encodeURIComponent(token)}`}
                            style={{ background: '#4a5cff', color: '#fff', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontSize: 13 }}
                          >
                            다운로드
                          </a>
                        ) : (
                          <span style={{ color: '#999', fontSize: 12 }}>열람 전용</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 10, fontSize: 11, color: '#bbb' }}>
                  공유일: {new Date(a.distributed_at).toLocaleDateString('ko-KR')}
                </div>
              </article>
            ))
          )}
        </main>

        <footer style={{ marginTop: 24, textAlign: 'center', color: '#aaa', fontSize: 12 }}>
          본 링크는 학원에서 발급한 임시 링크입니다. 문제가 있으시면 학원으로 연락 주세요.
        </footer>
      </div>
    </div>
  );
}
