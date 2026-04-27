import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '';

type FileRole = 'main' | 'answer' | 'solution' | 'extra';

const ROLE_LABEL: Record<FileRole, string> = {
  main: '본편',
  answer: '정답',
  solution: '해설',
  extra: '부자료',
};

interface LessonItemFile {
  id: string;
  file_name: string;
  file_role: FileRole;
  size_bytes: number;
  version: number;
}

interface LessonItem {
  id: string;
  title: string | null;
  unit_name: string | null;
  textbook: string | null;
  kind: string;
  purpose: string | null;
  topic: string | null;
  description: string | null;
  status: string;
  understanding: number | null;
  parent_can_download: boolean;
  updated_at: string;
  files: LessonItemFile[];
}

interface ViewResponse {
  student: { id: string; name: string; grade: string | null; school: string | null };
  items: LessonItem[];
}

export default function ParentLessonsPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [data, setData] = useState<ViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId || !token) {
      setError('유효하지 않은 링크입니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(
      `${API_BASE}/api/parent/students/${studentId}/lessons?token=${encodeURIComponent(token)}`
    )
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || '불러오기에 실패했습니다');
        setData(json?.data ?? json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '오류가 발생했습니다'))
      .finally(() => setLoading(false));
  }, [studentId, token]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>불러오는 중…</div>;
  }
  if (error || !data) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          style={{
            background: '#fff',
            padding: 32,
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            maxWidth: 420,
            textAlign: 'center',
          }}
        >
          <h2 style={{ margin: '12px 0' }}>접근할 수 없습니다</h2>
          <p style={{ color: '#666' }}>{error || '링크가 올바르지 않거나 만료되었습니다.'}</p>
          <p style={{ color: '#999', fontSize: 13, marginTop: 16 }}>
            학원에 문의해 새 링크를 요청해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7fb', padding: '24px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <header
          style={{
            background: '#fff',
            padding: 20,
            borderRadius: 12,
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: 13, color: '#999' }}>학습 기록</div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 22 }}>{data.student.name} 학생</h1>
          <div style={{ color: '#666', fontSize: 13 }}>
            {[data.student.grade, data.student.school].filter(Boolean).join(' · ') || '—'}
          </div>
        </header>

        <main style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.items.length === 0 ? (
            <div
              style={{
                background: '#fff',
                padding: 40,
                borderRadius: 12,
                textAlign: 'center',
                color: '#999',
              }}
            >
              공유된 자료가 없습니다.
            </div>
          ) : (
            data.items.map((it) => (
              <article
                key={it.id}
                style={{
                  background: '#fff',
                  padding: 18,
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 17 }}>
                    {it.title || it.unit_name || '학습 항목'}
                  </h2>
                  {it.purpose && (
                    <span
                      style={{
                        background: '#eef',
                        color: '#447',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 12,
                      }}
                    >
                      {it.purpose}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                  {[it.textbook, it.unit_name, it.topic].filter(Boolean).join(' · ') || '—'}
                </div>
                {it.understanding != null && (
                  <div style={{ marginTop: 8, fontSize: 13, color: '#444' }}>
                    이해도: <strong>{it.understanding}</strong> / 100
                  </div>
                )}
                {it.description && (
                  <p
                    style={{ marginTop: 8, fontSize: 14, color: '#333', whiteSpace: 'pre-wrap' }}
                  >
                    {it.description}
                  </p>
                )}

                {it.files.length > 0 && (
                  <div
                    style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
                  >
                    {it.files.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          background: '#f7f7fb',
                          borderRadius: 8,
                        }}
                      >
                        <span
                          style={{
                            background: '#fff',
                            color: '#447',
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
                          <div style={{ fontSize: 11, color: '#999' }}>
                            {(f.size_bytes / 1024).toFixed(0)} KB · v{f.version}
                          </div>
                        </div>
                        {it.parent_can_download ? (
                          <a
                            href={`${API_BASE}/api/parent/students/${studentId}/lessons/${encodeURIComponent(
                              f.id
                            )}/download?token=${encodeURIComponent(token)}`}
                            style={{
                              background: '#4a5cff',
                              color: '#fff',
                              padding: '6px 12px',
                              borderRadius: 6,
                              textDecoration: 'none',
                              fontSize: 13,
                            }}
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
                  업데이트: {new Date(it.updated_at).toLocaleDateString('ko-KR')}
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
