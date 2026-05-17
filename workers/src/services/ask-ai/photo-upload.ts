/**
 * UC-03 — 사진 업로드 helper (R2)
 *
 * R2 PUT 자체는 핸들러 책임. 여기엔 순수 helper만:
 *   - key 생성 (학생/날짜 격리)
 *   - 파일 검증 (크기·MIME·path traversal)
 *   - 만료 날짜 (7일)
 */

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;  // 5MB
export const PHOTO_RETENTION_DAYS = 7;

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png',
  'image/heic', 'image/heif', 'image/webp',
]);

export interface MakeKeyOpts {
  student_id: string;
  today: string;          // YYYY-MM-DD
  uuid: string;
  filename: string;
}

export function makePhotoKey(opts: MakeKeyOpts): string {
  // path traversal 방어
  if (!/^[a-zA-Z0-9_-]+$/.test(opts.student_id)) {
    throw new Error(`invalid student_id (only [a-zA-Z0-9_-] allowed): ${opts.student_id}`);
  }
  const ext = extractExtension(opts.filename);
  return `students/${opts.student_id}/photos/${opts.today}/${opts.uuid}.${ext}`;
}

export function validatePhotoFile(file: { size: number; mime: string }): { allowed: boolean; reason?: string } {
  if (file.size <= 0) {
    return { allowed: false, reason: '빈 파일은 업로드 불가' };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { allowed: false, reason: `파일 크기 초과 — 최대 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB 시도)` };
  }
  if (!ALLOWED_MIMES.has(file.mime.toLowerCase())) {
    return { allowed: false, reason: `허용 안 된 파일 타입: ${file.mime} (이미지만)` };
  }
  return { allowed: true };
}

export function expirationDate(uploaded: string): string {
  const [y, m, d] = uploaded.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + PHOTO_RETENTION_DAYS);
  return dt.toISOString().slice(0, 10);
}

function extractExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return 'jpg';  // 기본
  return filename.slice(idx + 1).toLowerCase();
}
