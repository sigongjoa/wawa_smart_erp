import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, AssignmentDetail } from '../api';

const STATUS_LABEL: Record<string, string> = {
  assigned: '제출 전',
  submitted: '검토 대기 중',
  reviewed: '검토 중',
  needs_resubmit: '재제출 필요',
  completed: '완료',
};

const STATUS_COLOR: Record<string, string> = {
  assigned: '#f59e0b',
  submitted: '#2563eb',
  reviewed: '#7c3aed',
  needs_resubmit: '#dc2626',
  completed: '#16a34a',
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
      alert(err.message || '업로드 실패');
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
      alert('제출할 파일을 1개 이상 첨부해주세요');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitAssignment(targetId, { note: note.trim() || null, files });
      alert('제출되었어요!');
      setFiles([]); setNote('');
      load();
    } catch (err: any) {
      alert(err.message || '제출 실패');
    } finally {
      setSubmitting(false);
    }
  };

  if (!data && !error) {
    return <div className="page-center"><div className="loading">불러오는 중...</div></div>;
  }
  if (error || !data) {
    return (
      <div style={{ padding: 20 }}>
        <button className="btn-ghost" onClick={() => navigate('/assignments')}>← 목록</button>
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, marginTop: 12 }}>
          {error}
        </div>
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

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <button className="btn-ghost" onClick={() => navigate('/assignments')} style={{ marginBottom: 12 }}>← 목록</button>

      {/* 헤더 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{
          background: STATUS_COLOR[target.status], color: '#fff',
          fontSize: 11, padding: '2px 10px', borderRadius: 12,
        }}>
          {STATUS_LABEL[target.status]}
        </span>
        {target.due_at && (
          <span style={{ fontSize: 12, color: isOverdue ? '#dc2626' : '#666' }}>
            마감 {new Date(target.due_at).toLocaleString('ko-KR')}
          </span>
        )}
      </div>
      <h1 style={{ margin: '4px 0 10px', fontSize: 20 }}>{target.title}</h1>

      {/* 지시문 */}
      {target.instructions && (
        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, fontSize: 14, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
          {target.instructions}
        </div>
      )}

      {/* 첨부 (선생님이 올린 양식/시험지) */}
      {target.attached_file_key && (
        <a
          href={api.assignmentFileUrl(target.attached_file_key)}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#eff6ff', padding: '10px 12px', borderRadius: 8,
            fontSize: 14, color: '#2563eb', textDecoration: 'none', marginBottom: 12,
            border: '1px solid #dbeafe',
          }}
        >
{target.attached_file_name || '첨부 파일 다운로드'}
        </a>
      )}

      {/* 제출 영역 */}
      {canSubmit && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>
            {target.status === 'needs_resubmit' ? '재제출하기' : '제출하기'}
          </h3>

          <div style={{ marginBottom: 10 }}>
            <label
              htmlFor="assignment-file-input"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '14px 12px',
                background: uploading ? '#e5e7eb' : '#f3f4f6',
                border: '2px dashed #9ca3af', borderRadius: 10,
                fontSize: 15, fontWeight: 600, color: '#374151',
                cursor: uploading ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box',
              }}
            >
              <span>{uploading ? '업로드 중...' : '사진·PDF 파일 선택 / 사진 찍기'}</span>
            </label>
            <input
              id="assignment-file-input"
              type="file"
              onChange={handleFile}
              disabled={uploading}
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.heic,image/*"
              style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
            />
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, textAlign: 'center' }}>
              여러 장 한 번에 선택할 수 있어요
            </div>
          </div>

          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {files.map((f) => (
                <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: 6, background: '#f9fafb', borderRadius: 4 }}>
                  <span>{f.name} <span style={{ color: '#888' }}>({(f.size / 1024).toFixed(0)} KB)</span></span>
                  <button type="button" onClick={() => removeFile(f.key)} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13 }}>제거</button>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모 (선택) — 선생님께 하고 싶은 말"
            rows={2}
            maxLength={2000}
            style={{ width: '100%', padding: 8, fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 6, resize: 'vertical', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }}
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading || files.length === 0}
            style={{
              width: '100%', padding: 12, background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
              cursor: submitting || files.length === 0 ? 'not-allowed' : 'pointer',
              opacity: submitting || files.length === 0 ? 0.6 : 1,
            }}
          >
            {submitting ? '제출 중...' : '제출하기'}
          </button>
        </div>
      )}

      {!canSubmit && target.status !== 'completed' && (
        <div style={{ background: '#fef3c7', color: '#92400e', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {isOverdue ? '기한이 지나 더 이상 제출할 수 없어요.' :
           target.assignment_status !== 'published' ? '이 과제는 닫혔어요.' :
           '지금 제출할 수 없어요.'}
        </div>
      )}

      {/* 타임라인 */}
      <h3 style={{ margin: '16px 0 8px', fontSize: 15 }}>진행 내역</h3>
      {timeline.length === 0 ? (
        <p style={{ fontSize: 13, color: '#888' }}>아직 활동이 없어요.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {timeline.map((ev, idx) => {
            if (ev.kind === 'sub') {
              const s = ev.data;
              return (
                <div key={idx} style={{ background: '#eff6ff', padding: 10, borderRadius: 8, borderLeft: '3px solid #2563eb' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    내가 제출 · {new Date(s.submitted_at).toLocaleString('ko-KR')}
                  </div>
                  {s.note && <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{s.note}</div>}
                  {s.files.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
                      {s.files.map((f, i) => (
                        <a key={i} href={api.assignmentFileUrl(f.key)} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: '#2563eb' }}>
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
              <div key={idx} style={{ background: isResubmit ? '#fef2f2' : '#f0fdf4', padding: 10, borderRadius: 8, borderLeft: `3px solid ${isResubmit ? '#dc2626' : '#16a34a'}` }}>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {r.teacher_name || '선생님'} 회신 · {new Date(r.created_at).toLocaleString('ko-KR')}
                  {isResubmit && <span style={{ marginLeft: 6, color: '#dc2626', fontWeight: 600 }}>[재제출 요청]</span>}
                </div>
                {r.comment && <div style={{ fontSize: 14, marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.comment}</div>}
                {r.file_key && (
                  <a href={api.assignmentFileUrl(r.file_key)} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: '#2563eb' }}>
          {r.file_name || '첨삭본'}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
