import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, StudentArchiveItem } from '../api';
import { useAuthStore } from '../store';

type FileRole = 'main' | 'answer' | 'solution' | 'extra';
const ROLE_LABEL: Record<FileRole, string> = {
  main: '본편',
  answer: '정답',
  solution: '해설',
  extra: '부자료',
};

export default function MyArchivePage() {
  const navigate = useNavigate();
  const auth = useAuthStore((s) => s.auth);
  const [items, setItems] = useState<StudentArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');

  useEffect(() => {
    api
      .listArchives()
      .then((data) => setItems(data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const subjects = useMemo(
    () => Array.from(new Set(items.map((i) => i.subject).filter(Boolean))) as string[],
    [items]
  );
  const filtered = subject ? items.filter((i) => i.subject === subject) : items;

  const isNew = (dt: string) => Date.now() - new Date(dt).getTime() < 7 * 24 * 3600 * 1000;

  const token = localStorage.getItem('play_token');

  return (
    <div className="page-container" style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 20 }}>←</button>
        </div>
        <h1 style={{ margin: 0, fontSize: 18 }}>{auth?.student?.name || '내'} 자료함</h1>
        <div style={{ width: 32 }} />
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#999' }}>
          공유된 자료가 없습니다.
        </div>
      ) : (
        <>
          {subjects.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
              <button
                onClick={() => setSubject('')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: '1px solid #ddd',
                  background: subject === '' ? '#4a5cff' : '#fff',
                  color: subject === '' ? '#fff' : '#333',
                  whiteSpace: 'nowrap',
                }}
              >
                전체
              </button>
              {subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: '1px solid #ddd',
                    background: subject === s ? '#4a5cff' : '#fff',
                    color: subject === s ? '#fff' : '#333',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((a) => (
              <article key={a.id} style={{ background: '#fff', padding: 14, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <h2 style={{ margin: 0, fontSize: 15 }}>
                    {a.title}
                    {isNew(a.distributed_at) && (
                      <span style={{ marginLeft: 6, background: '#ff4757', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>NEW</span>
                    )}
                  </h2>
                  <span style={{ background: '#eef', color: '#447', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                    {a.purpose}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {[a.subject, a.grade, a.topic].filter(Boolean).join(' · ') || '—'}
                </div>
                {a.description && (
                  <p style={{ fontSize: 13, color: '#444', marginTop: 6, whiteSpace: 'pre-wrap' }}>{a.description}</p>
                )}
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {a.files.map((f) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, background: '#f7f7fb', borderRadius: 8 }}>
                      <span style={{ background: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, color: '#447', fontWeight: 600 }}>
                        {ROLE_LABEL[f.file_role]}
                      </span>
                      <div style={{ flex: 1, fontSize: 12 }}>
                        <div>{f.file_name}</div>
                        <div style={{ fontSize: 10, color: '#999' }}>{(f.size_bytes / 1024).toFixed(0)} KB</div>
                      </div>
                      {a.can_download && token ? (
                        <a
                          href={`${api.archiveDownloadUrl(a.id, f.id)}?t=${encodeURIComponent(token)}`}
                          onClick={(e) => {
                            // fetch 인증이 Bearer 헤더 방식이라 단순 <a> 링크로는 인증 실패
                            // → 클릭 시 fetch → Blob 다운로드
                            e.preventDefault();
                            downloadBlob(api.archiveDownloadUrl(a.id, f.id), f.file_name);
                          }}
                          style={{ background: '#4a5cff', color: '#fff', padding: '6px 10px', borderRadius: 6, textDecoration: 'none', fontSize: 12 }}
                        >
                          받기
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: '#999' }}>열람 전용</span>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

async function downloadBlob(url: string, fileName: string) {
  const token = localStorage.getItem('play_token');
  try {
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error('다운로드 실패');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (err) {
    alert(err instanceof Error ? err.message : '다운로드 실패');
  }
}
