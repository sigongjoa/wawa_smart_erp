import { useEffect, useState } from 'react';
import Modal from './Modal';

type AuthMode = 'jwt' | 'public';

interface FilePreviewModalProps {
  fileName: string;
  mimeType: string | null;
  /** 미리보기용 URL (inline=1 query 포함) */
  previewUrl: string;
  /** 강제 다운로드용 URL (Content-Disposition: attachment) */
  downloadUrl: string;
  /** jwt: Authorization 헤더로 fetch → blob URL 사용 (cross-origin 우회). public: previewUrl 직접 src */
  authMode: AuthMode;
  /** authMode='jwt'일 때 사용할 Bearer 토큰 */
  authToken?: string;
  onClose: () => void;
}

function isImage(mime: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith('image/') && mime !== 'image/svg+xml'; // SVG는 스크립트 위험으로 제외
}
function isVideo(mime: string | null): boolean {
  return !!mime && mime.startsWith('video/');
}
function isAudio(mime: string | null): boolean {
  return !!mime && mime.startsWith('audio/');
}
function isPdf(mime: string | null, fileName: string): boolean {
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return true;
  return fileName.toLowerCase().endsWith('.pdf');
}
function isPreviewable(mime: string | null, fileName: string): boolean {
  return isPdf(mime, fileName) || isImage(mime) || isVideo(mime) || isAudio(mime);
}

export default function FilePreviewModal({
  fileName,
  mimeType,
  previewUrl,
  downloadUrl,
  authMode,
  authToken,
  onClose,
}: FilePreviewModalProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(authMode === 'jwt');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPreviewable(mimeType, fileName)) {
      setLoading(false);
      return;
    }
    if (authMode === 'public') {
      setSrc(previewUrl);
      return;
    }
    // JWT 모드 — fetch + blob URL (cross-site cookie 차단 회피)
    let cancelled = false;
    let blobUrl: string | null = null;
    setLoading(true);
    fetch(previewUrl, {
      credentials: 'include',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`미리보기 불러오기 실패 (${res.status})`);
        const blob = await res.blob();
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '오류 발생');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [previewUrl, authMode, authToken, mimeType, fileName]);

  const previewable = isPreviewable(mimeType, fileName);

  return (
    <Modal onClose={onClose} className="file-preview-modal">
      <Modal.Header>
        <span className="file-preview-title">{fileName}</span>
      </Modal.Header>
      <Modal.Body>
        <div className="file-preview-frame-wrap">
          {!previewable ? (
            <div className="file-preview-unsupported">
              <div className="file-preview-unsupported-title">미리보기를 지원하지 않는 형식입니다</div>
              <div className="file-preview-unsupported-desc">
                {mimeType || '알 수 없는 형식'} · 다운로드해서 확인하세요.
              </div>
            </div>
          ) : loading ? (
            <div className="file-preview-loading">불러오는 중…</div>
          ) : error ? (
            <div className="file-preview-unsupported">
              <div className="file-preview-unsupported-title">미리보기 실패</div>
              <div className="file-preview-unsupported-desc">{error}</div>
            </div>
          ) : src ? (
            isPdf(mimeType, fileName) ? (
              <iframe className="file-preview-frame" src={src} title={fileName} />
            ) : isImage(mimeType) ? (
              <img className="file-preview-img" src={src} alt={fileName} />
            ) : isVideo(mimeType) ? (
              <video className="file-preview-video" src={src} controls />
            ) : isAudio(mimeType) ? (
              <audio className="file-preview-audio" src={src} controls />
            ) : null
          ) : null}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-ghost"
          download={fileName}
        >
          ⬇ 다운로드
        </a>
        <button className="btn btn-primary" onClick={onClose}>닫기</button>
      </Modal.Footer>
    </Modal>
  );
}
