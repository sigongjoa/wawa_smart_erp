/**
 * 학습자료 아카이브 핸들러
 *
 * 스태프 (JWT):
 *   GET    /api/archives                          목록 (필터: subject, grade, purpose, q)
 *   POST   /api/archives                          생성 (메타)
 *   GET    /api/archives/:id                      상세 (+ files + distributions)
 *   PATCH  /api/archives/:id                      메타 수정
 *   DELETE /api/archives/:id                      soft-archive (archived_at 세팅)
 *   POST   /api/archives/:id/files                multipart — 파일 업로드 (role 지정)
 *   DELETE /api/archives/:id/files/:fileId        파일 삭제 (R2 + DB)
 *   POST   /api/archives/:id/distribute           배포 대상 추가
 *   DELETE /api/archives/:id/distributions/:distId 배포 취소
 *   GET    /api/archives/:id/log                  열람/다운로드 로그
 *   POST   /api/archives/:id/share                학부모 링크 발급 (HMAC)
 *   GET    /api/archives/download/:fileId         스태프 다운로드
 *
 * 학생 (PlayAuth, /api/play/):
 *   GET    /api/play/archives                     내게 배포된 교재 목록
 *   GET    /api/play/archives/:id/download/:fileId 파일 다운로드
 *
 * 학부모 (HMAC 공개, /api/parent-archives/):
 *   GET    /api/parent-archives/:studentId?token=
 *   GET    /api/parent-archives/:studentId/download/:fileId?token=
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeUpdate } from '@/utils/db';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  createdResponse,
} from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { generateId } from '@/utils/id';
import { logger } from '@/utils/logger';
import { parsePagination, toPagedResult } from '@/utils/pagination';

// ─────────────── 타입 ───────────────

interface ArchiveRow {
  id: string;
  academy_id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  purpose: string;
  description: string | null;
  tags: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface ArchiveFileRow {
  id: string;
  archive_id: string;
  r2_key: string;
  file_name: string;
  file_role: string;
  mime_type: string | null;
  size_bytes: number;
  version: number;
  uploaded_by: string;
  uploaded_at: string;
}

interface ArchiveDistributionRow {
  id: string;
  archive_id: string;
  academy_id: string;
  scope: string;
  scope_id: string | null;
  can_download: number;
  distributed_by: string;
  distributed_at: string;
  expires_at: string | null;
}

interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

// ─────────────── 상수 ───────────────

const ALLOWED_ROLES = ['main', 'answer', 'solution', 'extra'] as const;
const ALLOWED_SCOPES = ['student', 'class', 'academy'] as const;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB (교재 PDF 대응)

// ─────────────── HMAC 토큰 (parent-report 패턴 재사용) ───────────────

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlEncodeStr(str: string): string {
  return b64urlEncode(new TextEncoder().encode(str));
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}
async function signArchiveToken(studentId: string, expiresAtMs: number, secret: string): Promise<string> {
  const payload = `${studentId}|archives|${expiresAtMs}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return `${b64urlEncodeStr(payload)}.${b64urlEncode(sig)}`;
}
async function verifyArchiveToken(
  token: string,
  expectedStudentId: string,
  secret: string
): Promise<{ ok: boolean; reason?: string }> {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  let payload: string;
  try {
    payload = new TextDecoder().decode(b64urlDecode(parts[0]));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const [sid, kind, expStr] = payload.split('|');
  if (!sid || kind !== 'archives' || !expStr) return { ok: false, reason: 'malformed' };
  if (sid !== expectedStudentId) return { ok: false, reason: 'mismatch' };
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return { ok: false, reason: 'expired' };
  const key = await hmacKey(secret);
  const sig = b64urlDecode(parts[1]);
  const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload));
  return ok ? { ok: true } : { ok: false, reason: 'bad_signature' };
}
function resolveSecret(env: RequestContext['env']): string | null {
  return env.PARENT_REPORT_SECRET || env.JWT_SECRET || null;
}

// ─────────────── 권한: 학생 아카이브 열람 가능 여부 ───────────────

async function listArchivesForStudent(
  db: D1Database,
  academyId: string,
  studentId: string
): Promise<(ArchiveRow & { distribution_can_download: number; distributed_at: string })[]> {
  const nowIso = new Date().toISOString();
  const sql = `
    SELECT DISTINCT m.*,
           d.can_download AS distribution_can_download,
           d.distributed_at AS distributed_at
    FROM material_archives m
    JOIN archive_distributions d ON d.archive_id = m.id
    LEFT JOIN class_students cs ON cs.student_id = ?
    WHERE m.academy_id = ? AND m.archived_at IS NULL
      AND (
        (d.scope = 'student' AND d.scope_id = ?) OR
        (d.scope = 'class'   AND d.scope_id = cs.class_id) OR
        (d.scope = 'academy')
      )
      AND (d.expires_at IS NULL OR d.expires_at > ?)
    ORDER BY d.distributed_at DESC, m.created_at DESC
  `;
  return executeQuery<ArchiveRow & { distribution_can_download: number; distributed_at: string }>(
    db,
    sql,
    [studentId, academyId, studentId, nowIso]
  );
}

async function canStudentAccessFile(
  db: D1Database,
  academyId: string,
  studentId: string,
  fileId: string
): Promise<{ ok: boolean; reason?: string; file?: ArchiveFileRow; archive?: ArchiveRow }> {
  const file = await executeFirst<ArchiveFileRow>(
    db,
    'SELECT * FROM archive_files WHERE id = ?',
    [fileId]
  );
  if (!file) return { ok: false, reason: 'file_not_found' };

  const archive = await executeFirst<ArchiveRow>(
    db,
    'SELECT * FROM material_archives WHERE id = ? AND academy_id = ? AND archived_at IS NULL',
    [file.archive_id, academyId]
  );
  if (!archive) return { ok: false, reason: 'archive_not_found' };

  const nowIso = new Date().toISOString();
  const dist = await executeFirst<{ can_download: number }>(
    db,
    `SELECT d.can_download
     FROM archive_distributions d
     LEFT JOIN class_students cs ON cs.student_id = ?
     WHERE d.archive_id = ?
       AND (d.expires_at IS NULL OR d.expires_at > ?)
       AND (
         (d.scope = 'student' AND d.scope_id = ?) OR
         (d.scope = 'class'   AND d.scope_id = cs.class_id) OR
         (d.scope = 'academy')
       )
     LIMIT 1`,
    [studentId, archive.id, nowIso, studentId]
  );
  if (!dist) return { ok: false, reason: 'no_distribution' };
  if (!dist.can_download) return { ok: false, reason: 'download_disabled' };

  return { ok: true, file, archive };
}

// ─────────────── 파일 R2 key 생성 ───────────────

function buildR2Key(academyId: string, archiveId: string, role: string, ext: string): string {
  const safeExt = (ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  return `archives/${academyId}/${archiveId}/${role}-${Date.now()}-${generateId()}.${safeExt}`;
}

async function logAccess(
  db: D1Database,
  archiveId: string,
  fileId: string | null,
  accessorType: 'student' | 'parent' | 'staff',
  accessorId: string | null,
  action: 'view' | 'download',
  ipHash: string | null
): Promise<void> {
  try {
    await executeUpdate(
      db,
      `INSERT INTO archive_access_log (id, archive_id, file_id, accessor_type, accessor_id, action, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), archiveId, fileId, accessorType, accessorId, action, ipHash]
    );
  } catch (err) {
    logger.warn('archive access log failed', { err: err instanceof Error ? err.message : String(err) });
  }
}

async function hashIp(ip: string): Promise<string> {
  const buf = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return b64urlEncode(new Uint8Array(hash)).slice(0, 16);
}

// ─────────────── 메인 핸들러 ───────────────

export async function handleArchive(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    const db = context.env.DB;
    const url = new URL(request.url);

    // ─── 학생: /api/play/archives/* (PlayAuth) ───
    if (pathname.startsWith('/api/play/archives')) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) return unauthorizedResponse();
      const token = authHeader.slice(7);
      const auth = (await context.env.KV.get(`play:${token}`, 'json')) as PlayAuth | null;
      if (!auth) return unauthorizedResponse();

      // GET /api/play/archives
      if (method === 'GET' && pathname === '/api/play/archives') {
        const rows = await listArchivesForStudent(db, auth.academyId, auth.studentId);
        const ids = rows.map((r) => r.id);
        const files = ids.length
          ? await executeQuery<ArchiveFileRow>(
              db,
              `SELECT id, archive_id, file_name, file_role, mime_type, size_bytes, version, uploaded_at, r2_key, uploaded_by
               FROM archive_files WHERE archive_id IN (${ids.map(() => '?').join(',')})`,
              ids
            )
          : [];
        const filesByArchive = new Map<string, ArchiveFileRow[]>();
        for (const f of files) {
          if (!filesByArchive.has(f.archive_id)) filesByArchive.set(f.archive_id, []);
          filesByArchive.get(f.archive_id)!.push(f);
        }
        return successResponse(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            subject: r.subject,
            grade: r.grade,
            topic: r.topic,
            purpose: r.purpose,
            description: r.description,
            tags: r.tags ? safeJsonArray(r.tags) : [],
            can_download: !!r.distribution_can_download,
            distributed_at: r.distributed_at,
            created_at: r.created_at,
            files: (filesByArchive.get(r.id) || []).map((f) => ({
              id: f.id,
              file_name: f.file_name,
              file_role: f.file_role,
              size_bytes: f.size_bytes,
              version: f.version,
            })),
          }))
        );
      }

      // GET /api/play/archives/:archiveId/download/:fileId
      const dlMatch = pathname.match(/^\/api\/play\/archives\/([^/]+)\/download\/([^/]+)$/);
      if (method === 'GET' && dlMatch) {
        const [, archiveId, fileId] = dlMatch;
        const access = await canStudentAccessFile(db, auth.academyId, auth.studentId, fileId);
        if (!access.ok || !access.file) {
          return access.reason === 'download_disabled'
            ? forbiddenResponse()
            : notFoundResponse();
        }
        if (access.file.archive_id !== archiveId) return notFoundResponse();

        const object = await context.env.BUCKET.get(access.file.r2_key);
        if (!object) return notFoundResponse();

        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        await logAccess(db, archiveId, fileId, 'student', auth.studentId, 'download', await hashIp(ip));

        return new Response(object.body, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType || access.file.mime_type || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(access.file.file_name)}"`,
            'Cache-Control': 'private, max-age=300',
          },
        });
      }

      return errorResponse('Not found', 404);
    }

    // ─── 학부모: /api/parent-archives/* (HMAC) ───
    if (pathname.startsWith('/api/parent-archives/')) {
      const secret = resolveSecret(context.env);
      if (!secret) return errorResponse('서버 설정 오류', 500);

      const viewMatch = pathname.match(/^\/api\/parent-archives\/([^/]+)$/);
      const dlMatch = pathname.match(/^\/api\/parent-archives\/([^/]+)\/download\/([^/]+)$/);

      if (method === 'GET' && viewMatch) {
        const studentId = viewMatch[1];
        const token = url.searchParams.get('token');
        if (!token) return errorResponse('token이 필요합니다', 400);
        const v = await verifyArchiveToken(token, studentId, secret);
        if (!v.ok) {
          return errorResponse(
            v.reason === 'expired' ? '링크가 만료되었습니다' : '유효하지 않은 링크입니다',
            401
          );
        }

        const student = await executeFirst<{ id: string; name: string; academy_id: string; grade: string | null; school: string | null }>(
          db,
          'SELECT id, name, academy_id, grade, school FROM students WHERE id = ?',
          [studentId]
        );
        if (!student) return notFoundResponse();

        const rows = await listArchivesForStudent(db, student.academy_id, studentId);
        const ids = rows.map((r) => r.id);
        const files = ids.length
          ? await executeQuery<ArchiveFileRow>(
              db,
              `SELECT id, archive_id, file_name, file_role, mime_type, size_bytes, version, uploaded_at, r2_key, uploaded_by
               FROM archive_files WHERE archive_id IN (${ids.map(() => '?').join(',')})`,
              ids
            )
          : [];
        const filesByArchive = new Map<string, ArchiveFileRow[]>();
        for (const f of files) {
          if (!filesByArchive.has(f.archive_id)) filesByArchive.set(f.archive_id, []);
          filesByArchive.get(f.archive_id)!.push(f);
        }

        return successResponse({
          student: { id: student.id, name: student.name, grade: student.grade, school: student.school },
          archives: rows.map((r) => ({
            id: r.id,
            title: r.title,
            subject: r.subject,
            grade: r.grade,
            topic: r.topic,
            purpose: r.purpose,
            description: r.description,
            tags: r.tags ? safeJsonArray(r.tags) : [],
            can_download: !!r.distribution_can_download,
            distributed_at: r.distributed_at,
            created_at: r.created_at,
            files: (filesByArchive.get(r.id) || []).map((f) => ({
              id: f.id,
              file_name: f.file_name,
              file_role: f.file_role,
              size_bytes: f.size_bytes,
              version: f.version,
            })),
          })),
        });
      }

      if (method === 'GET' && dlMatch) {
        const [, studentId, fileId] = dlMatch;
        const token = url.searchParams.get('token');
        if (!token) return errorResponse('token이 필요합니다', 400);
        const v = await verifyArchiveToken(token, studentId, secret);
        if (!v.ok) {
          return errorResponse(
            v.reason === 'expired' ? '링크가 만료되었습니다' : '유효하지 않은 링크입니다',
            401
          );
        }

        const student = await executeFirst<{ academy_id: string }>(
          db,
          'SELECT academy_id FROM students WHERE id = ?',
          [studentId]
        );
        if (!student) return notFoundResponse();

        const access = await canStudentAccessFile(db, student.academy_id, studentId, fileId);
        if (!access.ok || !access.file) {
          return access.reason === 'download_disabled'
            ? forbiddenResponse()
            : notFoundResponse();
        }

        const object = await context.env.BUCKET.get(access.file.r2_key);
        if (!object) return notFoundResponse();

        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        await logAccess(db, access.archive!.id, fileId, 'parent', await hashIp(ip), 'download', await hashIp(ip));

        return new Response(object.body, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType || access.file.mime_type || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(access.file.file_name)}"`,
            'Cache-Control': 'private, max-age=300',
          },
        });
      }

      return errorResponse('Not found', 404);
    }

    // ─── 스태프: /api/archives/* (JWT 필수) ───
    if (!requireAuth(context)) return unauthorizedResponse();
    const academyId = getAcademyId(context);
    const userId = getUserId(context);

    // GET /api/archives/download/:fileId — 스태프 본인 다운로드 (자기 학원 파일)
    const staffDlMatch = pathname.match(/^\/api\/archives\/download\/([^/]+)$/);
    if (method === 'GET' && staffDlMatch) {
      const fileId = staffDlMatch[1];
      const file = await executeFirst<ArchiveFileRow & { _academy_id: string }>(
        db,
        `SELECT af.*, m.academy_id AS _academy_id
         FROM archive_files af JOIN material_archives m ON m.id = af.archive_id
         WHERE af.id = ?`,
        [fileId]
      );
      if (!file || file._academy_id !== academyId) return notFoundResponse();
      const object = await context.env.BUCKET.get(file.r2_key);
      if (!object) return notFoundResponse();
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      await logAccess(db, file.archive_id, fileId, 'staff', userId, 'download', await hashIp(ip));
      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || file.mime_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(file.file_name)}"`,
          'Cache-Control': 'private, max-age=300',
        },
      });
    }

    // GET /api/archives — 목록
    if (method === 'GET' && pathname === '/api/archives') {
      const subject = url.searchParams.get('subject');
      const grade = url.searchParams.get('grade');
      const purpose = url.searchParams.get('purpose');
      const q = url.searchParams.get('q');
      const includeArchived = url.searchParams.get('includeArchived') === '1';

      const conds: string[] = ['m.academy_id = ?'];
      const params: unknown[] = [academyId];
      if (!includeArchived) conds.push('m.archived_at IS NULL');
      if (subject) { conds.push('m.subject = ?'); params.push(subject); }
      if (grade) { conds.push('m.grade = ?'); params.push(grade); }
      if (purpose) { conds.push('m.purpose = ?'); params.push(purpose); }
      if (q) {
        conds.push('(m.title LIKE ? OR m.topic LIKE ? OR m.description LIKE ?)');
        const like = `%${q}%`;
        params.push(like, like, like);
      }

      const pg = parsePagination(url, { defaultLimit: 100, maxLimit: 500 });
      const sql = `
        SELECT m.*,
               (SELECT COUNT(*) FROM archive_files af WHERE af.archive_id = m.id) AS file_count,
               (SELECT COUNT(*) FROM archive_distributions d WHERE d.archive_id = m.id) AS dist_count,
               (SELECT COUNT(*) FROM archive_access_log al WHERE al.archive_id = m.id AND al.action = 'download') AS download_count
        FROM material_archives m
        WHERE ${conds.join(' AND ')}
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const rows = await executeQuery<ArchiveRow & { file_count: number; dist_count: number; download_count: number }>(
        db, sql, [...params, pg.limit, pg.offset]
      );
      const normalized = rows.map((r) => ({ ...r, tags: r.tags ? safeJsonArray(r.tags) : [] }));
      return successResponse(toPagedResult(normalized, pg));
    }

    // POST /api/archives — 생성
    if (method === 'POST' && pathname === '/api/archives') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const title = String(body.title || '').trim();
      const purpose = String(body.purpose || '').trim();
      if (!title) return errorResponse('title은 필수입니다', 400);
      if (!purpose) return errorResponse('purpose(제작 사유)는 필수입니다', 400);

      const id = generateId();
      const tagsJson = Array.isArray(body.tags) ? JSON.stringify(body.tags) : null;

      await executeUpdate(
        db,
        `INSERT INTO material_archives
         (id, academy_id, title, subject, grade, topic, purpose, description, tags, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          academyId,
          title,
          body.subject ? String(body.subject) : null,
          body.grade ? String(body.grade) : null,
          body.topic ? String(body.topic) : null,
          purpose,
          body.description ? String(body.description) : null,
          tagsJson,
          userId,
        ]
      );
      return createdResponse({ id });
    }

    // PATCH /api/archives/:id — 메타 수정
    const idOnlyMatch = pathname.match(/^\/api\/archives\/([^/]+)$/);
    if (method === 'PATCH' && idOnlyMatch) {
      const id = idOnlyMatch[1];
      const existing = await executeFirst<ArchiveRow>(
        db,
        'SELECT * FROM material_archives WHERE id = ? AND academy_id = ?',
        [id, academyId]
      );
      if (!existing) return notFoundResponse();

      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const updates: string[] = [];
      const params: unknown[] = [];
      const mapField = (key: string, col: string) => {
        if (body[key] !== undefined) {
          updates.push(`${col} = ?`);
          params.push(body[key] === null ? null : String(body[key]).trim());
        }
      };
      mapField('title', 'title');
      mapField('subject', 'subject');
      mapField('grade', 'grade');
      mapField('topic', 'topic');
      mapField('purpose', 'purpose');
      mapField('description', 'description');
      if (body.tags !== undefined) {
        updates.push('tags = ?');
        params.push(Array.isArray(body.tags) ? JSON.stringify(body.tags) : null);
      }
      if (updates.length === 0) return errorResponse('변경할 필드가 없습니다', 400);
      updates.push("updated_at = datetime('now')");
      params.push(id);
      await executeUpdate(db, `UPDATE material_archives SET ${updates.join(', ')} WHERE id = ?`, params);
      return successResponse({ ok: true });
    }

    // DELETE /api/archives/:id — soft archive
    if (method === 'DELETE' && idOnlyMatch) {
      const id = idOnlyMatch[1];
      const existing = await executeFirst<ArchiveRow>(
        db,
        'SELECT * FROM material_archives WHERE id = ? AND academy_id = ?',
        [id, academyId]
      );
      if (!existing) return notFoundResponse();
      await executeUpdate(
        db,
        "UPDATE material_archives SET archived_at = datetime('now') WHERE id = ?",
        [id]
      );
      return successResponse({ ok: true });
    }

    // GET /api/archives/:id — 상세
    if (method === 'GET' && idOnlyMatch) {
      const id = idOnlyMatch[1];
      const archive = await executeFirst<ArchiveRow>(
        db,
        'SELECT * FROM material_archives WHERE id = ? AND academy_id = ?',
        [id, academyId]
      );
      if (!archive) return notFoundResponse();
      const files = await executeQuery<ArchiveFileRow>(
        db,
        'SELECT * FROM archive_files WHERE archive_id = ? ORDER BY file_role, version DESC',
        [id]
      );
      const distributions = await executeQuery<ArchiveDistributionRow & { target_name: string | null }>(
        db,
        `SELECT d.*,
                CASE d.scope
                  WHEN 'student' THEN (SELECT name FROM students WHERE id = d.scope_id)
                  WHEN 'class'   THEN (SELECT name FROM classes WHERE id = d.scope_id)
                  WHEN 'academy' THEN (SELECT name FROM academies WHERE id = d.academy_id)
                END AS target_name
         FROM archive_distributions d
         WHERE d.archive_id = ?
         ORDER BY d.distributed_at DESC`,
        [id]
      );
      return successResponse({
        ...archive,
        tags: archive.tags ? safeJsonArray(archive.tags) : [],
        files,
        distributions,
      });
    }

    // POST /api/archives/:id/files — 파일 업로드
    const uploadMatch = pathname.match(/^\/api\/archives\/([^/]+)\/files$/);
    if (method === 'POST' && uploadMatch) {
      const archiveId = uploadMatch[1];
      const archive = await executeFirst<ArchiveRow>(
        db,
        'SELECT * FROM material_archives WHERE id = ? AND academy_id = ?',
        [archiveId, academyId]
      );
      if (!archive) return notFoundResponse();

      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) return errorResponse('파일이 필요합니다', 400);
      if (file.size > MAX_FILE_SIZE) return errorResponse('파일 크기가 20MB를 초과합니다', 413);

      const rawRole = String(formData.get('role') || 'main');
      const role = (ALLOWED_ROLES as readonly string[]).includes(rawRole) ? rawRole : 'main';

      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const key = buildR2Key(academyId, archiveId, role, ext);
      const buffer = await file.arrayBuffer();
      await context.env.BUCKET.put(key, buffer, {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });

      // 같은 role의 기존 최대 버전 + 1
      const latest = await executeFirst<{ max_v: number | null }>(
        db,
        'SELECT MAX(version) AS max_v FROM archive_files WHERE archive_id = ? AND file_role = ?',
        [archiveId, role]
      );
      const version = (latest?.max_v || 0) + 1;

      const fileId = generateId();
      await executeUpdate(
        db,
        `INSERT INTO archive_files
         (id, archive_id, r2_key, file_name, file_role, mime_type, size_bytes, version, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fileId, archiveId, key, file.name, role, file.type || null, file.size, version, userId]
      );

      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      logger.logAudit('ARCHIVE_FILE_UPLOAD', 'Archive', archiveId, userId, { fileId, role, size: file.size }, ip);

      return createdResponse({
        id: fileId,
        archive_id: archiveId,
        file_name: file.name,
        file_role: role,
        size_bytes: file.size,
        version,
        mime_type: file.type,
      });
    }

    // DELETE /api/archives/:id/files/:fileId
    const fileDelMatch = pathname.match(/^\/api\/archives\/([^/]+)\/files\/([^/]+)$/);
    if (method === 'DELETE' && fileDelMatch) {
      const [, archiveId, fileId] = fileDelMatch;
      const file = await executeFirst<ArchiveFileRow & { _academy_id: string }>(
        db,
        `SELECT af.*, m.academy_id AS _academy_id
         FROM archive_files af JOIN material_archives m ON m.id = af.archive_id
         WHERE af.id = ? AND af.archive_id = ?`,
        [fileId, archiveId]
      );
      if (!file || file._academy_id !== academyId) return notFoundResponse();

      try {
        await context.env.BUCKET.delete(file.r2_key);
      } catch (err) {
        logger.warn('R2 delete failed', { err: err instanceof Error ? err.message : String(err), key: file.r2_key });
      }
      await executeUpdate(db, 'DELETE FROM archive_files WHERE id = ?', [fileId]);
      return successResponse({ ok: true });
    }

    // POST /api/archives/:id/distribute
    const distMatch = pathname.match(/^\/api\/archives\/([^/]+)\/distribute$/);
    if (method === 'POST' && distMatch) {
      const archiveId = distMatch[1];
      const archive = await executeFirst<ArchiveRow>(
        db,
        'SELECT * FROM material_archives WHERE id = ? AND academy_id = ?',
        [archiveId, academyId]
      );
      if (!archive) return notFoundResponse();

      const body = (await request.json().catch(() => ({}))) as {
        scope?: string;
        scope_id?: string | null;
        can_download?: boolean;
        expires_at?: string | null;
      };
      const scope = String(body.scope || '');
      if (!(ALLOWED_SCOPES as readonly string[]).includes(scope)) {
        return errorResponse('scope는 student|class|academy 중 하나여야 합니다', 400);
      }
      if (scope !== 'academy' && !body.scope_id) {
        return errorResponse('scope_id가 필요합니다', 400);
      }

      // 테넌시 검증: scope_id가 동일 학원 소속인지
      if (scope === 'student') {
        const s = await executeFirst<{ academy_id: string }>(
          db,
          'SELECT academy_id FROM students WHERE id = ?',
          [body.scope_id]
        );
        if (!s || s.academy_id !== academyId) return errorResponse('학생을 찾을 수 없습니다', 404);
      } else if (scope === 'class') {
        const c = await executeFirst<{ academy_id: string }>(
          db,
          'SELECT academy_id FROM classes WHERE id = ?',
          [body.scope_id]
        );
        if (!c || c.academy_id !== academyId) return errorResponse('반을 찾을 수 없습니다', 404);
      }

      const id = generateId();
      await executeUpdate(
        db,
        `INSERT INTO archive_distributions
         (id, archive_id, academy_id, scope, scope_id, can_download, distributed_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          archiveId,
          academyId,
          scope,
          scope === 'academy' ? null : body.scope_id,
          body.can_download === false ? 0 : 1,
          userId,
          body.expires_at || null,
        ]
      );
      return createdResponse({ id });
    }

    // DELETE /api/archives/:id/distributions/:distId
    const distDelMatch = pathname.match(/^\/api\/archives\/([^/]+)\/distributions\/([^/]+)$/);
    if (method === 'DELETE' && distDelMatch) {
      const [, archiveId, distId] = distDelMatch;
      const existing = await executeFirst<ArchiveDistributionRow>(
        db,
        'SELECT * FROM archive_distributions WHERE id = ? AND archive_id = ? AND academy_id = ?',
        [distId, archiveId, academyId]
      );
      if (!existing) return notFoundResponse();
      await executeUpdate(db, 'DELETE FROM archive_distributions WHERE id = ?', [distId]);
      return successResponse({ ok: true });
    }

    // GET /api/archives/:id/log
    const logMatch = pathname.match(/^\/api\/archives\/([^/]+)\/log$/);
    if (method === 'GET' && logMatch) {
      const archiveId = logMatch[1];
      const archive = await executeFirst<ArchiveRow>(
        db,
        'SELECT * FROM material_archives WHERE id = ? AND academy_id = ?',
        [archiveId, academyId]
      );
      if (!archive) return notFoundResponse();

      const rows = await executeQuery<{
        id: string;
        archive_id: string;
        file_id: string | null;
        accessor_type: string;
        accessor_id: string | null;
        action: string;
        accessed_at: string;
        accessor_name: string | null;
      }>(
        db,
        `SELECT al.*,
                CASE al.accessor_type
                  WHEN 'student' THEN (SELECT name FROM students WHERE id = al.accessor_id)
                  WHEN 'staff'   THEN (SELECT name FROM users WHERE id = al.accessor_id)
                  ELSE NULL
                END AS accessor_name
         FROM archive_access_log al
         WHERE al.archive_id = ?
         ORDER BY al.accessed_at DESC
         LIMIT 500`,
        [archiveId]
      );
      return successResponse(rows);
    }

    // POST /api/archives/:id/share — 학부모 HMAC 링크 발급
    const shareMatch = pathname.match(/^\/api\/archives\/([^/]+)\/share$/);
    if (method === 'POST' && shareMatch) {
      const archiveId = shareMatch[1];
      const archive = await executeFirst<ArchiveRow>(
        db,
        'SELECT * FROM material_archives WHERE id = ? AND academy_id = ?',
        [archiveId, academyId]
      );
      if (!archive) return notFoundResponse();

      const body = (await request.json().catch(() => ({}))) as { studentId?: string; days?: number };
      if (!body.studentId) return errorResponse('studentId가 필요합니다', 400);

      const student = await executeFirst<{ academy_id: string }>(
        db,
        'SELECT academy_id FROM students WHERE id = ?',
        [body.studentId]
      );
      if (!student || student.academy_id !== academyId) return errorResponse('학생을 찾을 수 없습니다', 404);

      const secret = resolveSecret(context.env);
      if (!secret) return errorResponse('서버 설정 오류', 500);
      const days = Math.max(1, Math.min(180, Math.round(body.days ?? 30)));
      const expiresAtMs = Date.now() + days * 24 * 3600 * 1000;
      const token = await signArchiveToken(body.studentId, expiresAtMs, secret);
      const origin = request.headers.get('origin') || '';
      const base = origin || (context.env as RequestContext['env'] & { APP_BASE_URL?: string }).APP_BASE_URL || '';
      const path = `/#/parent/archives/${body.studentId}?token=${encodeURIComponent(token)}`;
      return successResponse({
        url: base ? `${base}${path}` : path,
        path,
        token,
        expires_at: new Date(expiresAtMs).toISOString(),
      });
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('archive handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('자료 처리 실패', 500);
  }
}

function safeJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
