import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import './ParentLessonsPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

type FileRole = 'main' | 'answer' | 'solution' | 'extra';

const ROLE_LABEL: Record<FileRole, string> = {
  main: '문제',
  answer: '답지',
  solution: '해설',
  extra: '교안',
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
    return <div className="parent-lessons-loading">불러오는 중…</div>;
  }
  if (error || !data) {
    return (
      <div className="parent-lessons-error-shell">
        <div className="parent-lessons-error-card">
          <h2>접근할 수 없습니다</h2>
          <p className="desc">{error || '링크가 올바르지 않거나 만료되었습니다.'}</p>
          <p className="hint">학원에 문의해 새 링크를 요청해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="parent-lessons-page">
      <div className="parent-lessons-shell">
        <header className="parent-lessons-header">
          <div className="parent-lessons-eyebrow">학습 기록</div>
          <h1 className="parent-lessons-title">{data.student.name} 학생</h1>
          <div className="parent-lessons-subtitle">
            {[data.student.grade, data.student.school].filter(Boolean).join(' · ') || '—'}
          </div>
        </header>

        <main className="parent-lessons-list">
          {data.items.length === 0 ? (
            <div className="parent-lessons-empty">공유된 자료가 없습니다.</div>
          ) : (
            data.items.map((it) => (
              <article key={it.id} className="parent-lessons-card">
                <div className="parent-lessons-card-head">
                  <h2 className="parent-lessons-card-title">
                    {it.title || it.unit_name || '학습 항목'}
                  </h2>
                  {it.purpose && <span className="parent-lessons-purpose">{it.purpose}</span>}
                </div>
                <div className="parent-lessons-meta">
                  {[it.textbook, it.unit_name, it.topic].filter(Boolean).join(' · ') || '—'}
                </div>
                {it.understanding != null && (
                  <div className="parent-lessons-understanding">
                    이해도: <strong>{it.understanding}</strong> / 100
                  </div>
                )}
                {it.description && (
                  <p className="parent-lessons-description">{it.description}</p>
                )}

                {it.files.length > 0 && (
                  <ul className="parent-lessons-files">
                    {it.files.map((f) => (
                      <li key={f.id} className="parent-lessons-file-row">
                        <span className="parent-lessons-file-role">{ROLE_LABEL[f.file_role]}</span>
                        <div className="parent-lessons-file-info">
                          <div className="parent-lessons-file-name">{f.file_name}</div>
                          <div className="parent-lessons-file-meta">
                            {(f.size_bytes / 1024).toFixed(0)} KB · v{f.version}
                          </div>
                        </div>
                        {it.parent_can_download ? (
                          <a
                            href={`${API_BASE}/api/parent/students/${studentId}/lessons/${encodeURIComponent(f.id)}/download?token=${encodeURIComponent(token)}`}
                            className="parent-lessons-download"
                            aria-label={`${f.file_name} 다운로드`}
                          >
                            다운로드
                          </a>
                        ) : (
                          <span className="parent-lessons-download-disabled">열람 전용</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="parent-lessons-card-footer">
                  업데이트: {new Date(it.updated_at).toLocaleDateString('ko-KR')}
                </div>
              </article>
            ))
          )}
        </main>

        <footer className="parent-lessons-footer">
          본 링크는 학원에서 발급한 임시 링크입니다. 문제가 있으시면 학원으로 연락 주세요.
        </footer>
      </div>
    </div>
  );
}
