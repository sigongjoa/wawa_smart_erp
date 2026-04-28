import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import FilePreviewModal from '../components/FilePreviewModal';
import { parentApi, ParentApiError } from '../api/parent';
import { ParentGateView, useParentToken } from '../components/ParentTokenGate';
import './ParentLessonsPage.css';

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
  mime_type?: string | null;
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
  const token = useParentToken();

  const [data, setData] = useState<ViewResponse | null>(null);
  const [error, setError] = useState<Error | ParentApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<LessonItemFile | null>(null);

  const fileUrl = (fileId: string, inline: boolean) =>
    parentApi.lessonFileUrl(studentId || '', fileId, token, inline);

  useEffect(() => {
    if (!studentId || !token) {
      setError(new ParentApiError('TOKEN_MISSING', '유효하지 않은 링크입니다.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    parentApi
      .getLessons<ViewResponse>(studentId, token)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => setLoading(false));
  }, [studentId, token]);

  if (loading || error || !data) {
    return <ParentGateView loading={loading} error={error}>{null}</ParentGateView>;
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
                        <button
                          type="button"
                          onClick={() => setPreviewFile(f)}
                          className="parent-lessons-preview"
                          aria-label={`${f.file_name} 미리보기`}
                          title="미리보기"
                        >
                          미리보기
                        </button>
                        {it.parent_can_download ? (
                          <a
                            href={fileUrl(f.id, false)}
                            className="parent-lessons-download"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
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

      {previewFile && (
        <FilePreviewModal
          fileName={previewFile.file_name}
          mimeType={previewFile.mime_type ?? null}
          previewUrl={fileUrl(previewFile.id, true)}
          downloadUrl={fileUrl(previewFile.id, false)}
          authMode="public"
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
