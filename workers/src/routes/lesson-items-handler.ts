/**
 * 학생별 학습 기록 (진도 + 자료 + 학부모 노출 통합)
 *
 * 스태프 (JWT):
 *   GET    /api/lesson-items?student_id=&textbook=&kind=&q=  목록
 *   POST   /api/lesson-items                                 생성
 *   GET    /api/lesson-items/:id                             상세 (+ files)
 *   PATCH  /api/lesson-items/:id                             수정 (이해도/상태/노트/메타/노출)
 *   DELETE /api/lesson-items/:id                             soft archive
 *   POST   /api/lesson-items/:id/files                       multipart 파일 업로드
 *   DELETE /api/lesson-items/:id/files/:fileId               파일 삭제 (R2 + DB)
 *   POST   /api/lesson-items/reorder                         order_idx 일괄 변경
 *   POST   /api/lesson-items/:id/share                       학부모 링크 발급 (HMAC)
 *   GET    /api/lesson-items/download/:fileId                스태프 다운로드
 *   POST   /api/lesson-items/from-coverage                   커버리지 셀에서 처방 생성
 *
 * 학부모 (HMAC, /api/parent/students/:studentId/lessons):
 *   GET    /api/parent/students/:studentId/lessons?token=
 *   GET    /api/parent/students/:studentId/lessons/:fileId/download?token=
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeUpdate } from '@/utils/db';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  createdResponse,
} from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { generateId } from '@/utils/id';
import { logger } from '@/utils/logger';
import {
  signShareToken,
  verifyShareToken,
  resolveShareSecret,
  checkShareRateLimit,
} from '@/utils/share-token';

// ─────────────── 타입 ───────────────

interface LessonItemRow {
  id: string;
  academy_id: string;
  student_id: string;
  textbook: string | null;
  unit_name: string | null;
  kind: string;
  order_idx: number;
  understanding: number | null;
  status: string;
  note: string | null;
  title: string | null;
  purpose: string | null;
  topic: string | null;
  description: string | null;
  tags: string | null;
  coverage_category: string | null;
  visible_to_parent: number;
  parent_can_download: number;
  curriculum_item_id: string | null;
  source: string;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  archived_at: string | null;
}

interface LessonItemFileRow {
  id: string;
  lesson_item_id: string;
  r2_key: string;
  file_name: string;
  file_role: string;
  mime_type: string | null;
  size_bytes: number;
  version: number;
  uploaded_by: string;
  uploaded_at: string;
}

const ALLOWED_ROLES = ['main', 'answer', 'solution', 'extra'] as const;
const ALLOWED_KINDS = ['unit', 'type', 'free'] as const;
const ALLOWED_STATUS = ['todo', 'in_progress', 'done'] as const;
const ALLOWED_SOURCES_USER = ['manual', 'exam_prep'] as const; // 사용자가 POST에서 직접 지정 가능
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일
const SHARE_RATE_LIMIT = 20; // 시간당 학부모 링크 발급 상한 (per teacher)

// 텍스트 필드 길이 상한 — D1 row를 비대화시켜 GET 응답 폭증·메모리 DoS 막기
const FIELD_MAX_LEN = {
  textbook: 128,
  unit_name: 256,
  title: 256,
  purpose: 64,
  topic: 128,
  description: 8192,
  note: 4096,
  coverage_category: 128,
} as const;
const TAGS_MAX_JSON_LEN = 1024;
const TAG_MAX_LEN = 32;
const TAGS_MAX_COUNT = 16;

interface FieldError {
  field: string;
  reason: string;
}

/** 텍스트 필드 검증. body[key]가 있으면 string|null이어야 하고 길이 한도 이내. */
function validateTextField(body: Record<string, any>, key: keyof typeof FIELD_MAX_LEN): FieldError | null {
  if (!(key in body)) return null;
  const v = body[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return { field: key, reason: 'must be string or null' };
  if (v.length > FIELD_MAX_LEN[key]) {
    return { field: key, reason: `max length ${FIELD_MAX_LEN[key]} (got ${v.length})` };
  }
  return null;
}

/** understanding 0~100 정수 또는 null */
function validateUnderstanding(body: Record<string, any>): FieldError | null {
  if (!('understanding' in body)) return null;
  const v = body.understanding;
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return { field: 'understanding', reason: 'must be number 0~100' };
  if (v < 0 || v > 100) return { field: 'understanding', reason: 'out of range (0~100)' };
  return null;
}

/** tags: string[]만 허용, 개수/길이/직렬화 크기 제한 */
function validateTags(body: Record<string, any>): FieldError | null {
  if (!('tags' in body)) return null;
  const v = body.tags;
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v)) return { field: 'tags', reason: 'must be array' };
  if (v.length > TAGS_MAX_COUNT) return { field: 'tags', reason: `max ${TAGS_MAX_COUNT} tags` };
  for (const t of v) {
    if (typeof t !== 'string') return { field: 'tags', reason: 'all entries must be string' };
    if (t.length > TAG_MAX_LEN) return { field: 'tags', reason: `tag max length ${TAG_MAX_LEN}` };
  }
  if (JSON.stringify(v).length > TAGS_MAX_JSON_LEN) return { field: 'tags', reason: 'serialized too large' };
  return null;
}

/** 모든 텍스트/숫자 필드 일괄 검증. 첫 에러를 반환. */
function validateBody(body: Record<string, any>): FieldError | null {
  for (const key of Object.keys(FIELD_MAX_LEN) as (keyof typeof FIELD_MAX_LEN)[]) {
    const e = validateTextField(body, key);
    if (e) return e;
  }
  return validateUnderstanding(body) || validateTags(body);
}

function fieldErrorResponse(e: FieldError): Response {
  return errorResponse(`${e.field}: ${e.reason}`, 400);
}

// ─────────────── 헬퍼 ───────────────

async function teacherOwnsStudent(
  db: D1Database,
  teacherId: string,
  studentId: string
): Promise<boolean> {
  const row = await executeFirst<{ n: number }>(
    db,
    'SELECT 1 AS n FROM student_teachers WHERE teacher_id = ? AND student_id = ? LIMIT 1',
    [teacherId, studentId]
  );
  return !!row;
}

function safeJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function buildR2Key(academyId: string, itemId: string, role: string, ext: string): string {
  const safeExt = (ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  return `lessons/${academyId}/${itemId}/${role}-${Date.now()}-${generateId()}.${safeExt}`;
}

function rowToItem(row: LessonItemRow, files: LessonItemFileRow[] = []) {
  return {
    id: row.id,
    academy_id: row.academy_id,
    student_id: row.student_id,
    textbook: row.textbook,
    unit_name: row.unit_name,
    kind: row.kind,
    order_idx: row.order_idx,
    understanding: row.understanding,
    status: row.status,
    note: row.note,
    title: row.title,
    purpose: row.purpose,
    topic: row.topic,
    description: row.description,
    tags: safeJsonArray(row.tags),
    coverage_category: row.coverage_category,
    visible_to_parent: !!row.visible_to_parent,
    parent_can_download: !!row.parent_can_download,
    curriculum_item_id: row.curriculum_item_id,
    source: row.source,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
    files: files
      .filter((f) => f.lesson_item_id === row.id)
      .map((f) => ({
        id: f.id,
        file_name: f.file_name,
        file_role: f.file_role,
        mime_type: f.mime_type,
        size_bytes: f.size_bytes,
        version: f.version,
        uploaded_at: f.uploaded_at,
      })),
  };
}

// ─────────────── 메인 핸들러 ───────────────

export async function handleLessonItems(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    const db = context.env.DB;

    // ─── 학부모: /api/parent/students/:studentId/lessons/* (HMAC) ───
    const parentMatch = pathname.match(
      /^\/api\/parent\/students\/([^/]+)\/lessons(?:\/([^/]+)\/download)?$/
    );
    if (parentMatch) {
      const [, studentId, fileIdForDownload] = parentMatch;
      const url = new URL(request.url);
      const token = url.searchParams.get('token') || '';
      const secret = resolveShareSecret(context.env);
      if (!secret) return errorResponse('share secret not configured', 500);
      const verify = await verifyShareToken(token, studentId, 'lessons', secret);
      if (!verify.ok) return errorResponse(`token ${verify.reason}`, 401);

      const student = await executeFirst<{
        id: string;
        name: string;
        grade: string | null;
        school: string | null;
        academy_id: string;
      }>(db, 'SELECT id, name, grade, school, academy_id FROM students WHERE id = ?', [studentId]);
      if (!student) return notFoundResponse();

      // GET 다운로드 / 미리보기
      if (method === 'GET' && fileIdForDownload) {
        const file = await executeFirst<LessonItemFileRow & { _vis: number; _can: number; _sid: string }>(
          db,
          `SELECT f.*, i.visible_to_parent AS _vis, i.parent_can_download AS _can, i.student_id AS _sid
           FROM lesson_item_files f
           JOIN student_lesson_items i ON i.id = f.lesson_item_id
           WHERE f.id = ? AND i.archived_at IS NULL`,
          [fileIdForDownload]
        );
        if (!file || file._sid !== studentId || !file._vis) return notFoundResponse();
        if (!file._can) return errorResponse('다운로드가 허용되지 않은 자료입니다', 403);
        const obj = await context.env.BUCKET.get(file.r2_key);
        if (!obj) return notFoundResponse();
        const inline = url.searchParams.get('inline') === '1';
        return new Response(obj.body, {
          headers: {
            'Content-Type': file.mime_type || 'application/octet-stream',
            'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.file_name)}"`,
            'Cache-Control': inline ? 'private, max-age=300' : 'no-cache',
          },
        });
      }

      // GET 목록
      if (method === 'GET') {
        const items = await executeQuery<LessonItemRow>(
          db,
          `SELECT * FROM student_lesson_items
            WHERE student_id = ? AND visible_to_parent = 1 AND archived_at IS NULL
            ORDER BY updated_at DESC`,
          [studentId]
        );
        const ids = items.map((i) => i.id);
        const files = ids.length
          ? await executeQuery<LessonItemFileRow>(
              db,
              `SELECT * FROM lesson_item_files
                WHERE lesson_item_id IN (${ids.map(() => '?').join(',')})
                ORDER BY file_role, version DESC`,
              ids
            )
          : [];
        return successResponse({
          student: {
            id: student.id,
            name: student.name,
            grade: student.grade,
            school: student.school,
          },
          items: items.map((i) => rowToItem(i, files)),
        });
      }
      return errorResponse('Not found', 404);
    }

    // ─── 스태프: /api/lesson-items/* (JWT) ───
    if (!requireAuth(context)) return unauthorizedResponse();
    const academyId = getAcademyId(context);
    const userId = getUserId(context);
    const role = context.auth!.role;
    const isAdmin = role === 'admin';

    // GET /api/lesson-items
    if (method === 'GET' && pathname === '/api/lesson-items') {
      const url = new URL(request.url);
      const studentId = url.searchParams.get('student_id');
      const textbook = url.searchParams.get('textbook');
      const kind = url.searchParams.get('kind');
      const sourceFilter = url.searchParams.get('source');
      const q = url.searchParams.get('q');
      const includeArchived = url.searchParams.get('include_archived') === '1';

      const params: any[] = [academyId];
      let sql = 'SELECT * FROM student_lesson_items WHERE academy_id = ?';
      if (!includeArchived) sql += ' AND archived_at IS NULL';
      if (studentId) {
        if (!isAdmin && !(await teacherOwnsStudent(db, userId, studentId))) {
          return errorResponse('해당 학생에 대한 권한이 없습니다', 403);
        }
        sql += ' AND student_id = ?';
        params.push(studentId);
      } else if (!isAdmin) {
        // 비관리자가 전체 목록 조회 시 본인 담당 학생으로 제한
        sql += ` AND student_id IN (
          SELECT student_id FROM student_teachers WHERE teacher_id = ?
        )`;
        params.push(userId);
      }
      if (textbook) {
        sql += ' AND textbook = ?';
        params.push(textbook);
      }
      if (kind) {
        sql += ' AND kind = ?';
        params.push(kind);
      }
      if (sourceFilter) {
        sql += ' AND source = ?';
        params.push(sourceFilter);
      }
      if (q) {
        sql += ' AND (title LIKE ? OR unit_name LIKE ? OR description LIKE ?)';
        const like = `%${q}%`;
        params.push(like, like, like);
      }
      sql += ' ORDER BY order_idx ASC, updated_at DESC';

      const rows = await executeQuery<LessonItemRow>(db, sql, params);
      const ids = rows.map((r) => r.id);
      const files = ids.length
        ? await executeQuery<LessonItemFileRow>(
            db,
            `SELECT * FROM lesson_item_files
              WHERE lesson_item_id IN (${ids.map(() => '?').join(',')})`,
            ids
          )
        : [];
      return successResponse(rows.map((r) => rowToItem(r, files)));
    }

    // POST /api/lesson-items
    if (method === 'POST' && pathname === '/api/lesson-items') {
      const body = (await request.json().catch(() => ({}))) as {
        student_id?: string;
        textbook?: string | null;
        unit_name?: string | null;
        kind?: string;
        order_idx?: number;
        understanding?: number | null;
        status?: string;
        note?: string | null;
        title?: string | null;
        purpose?: string | null;
        topic?: string | null;
        description?: string | null;
        tags?: string[];
        coverage_category?: string | null;
        visible_to_parent?: boolean;
        parent_can_download?: boolean;
      };
      if (!body.student_id) return errorResponse('student_id는 필수입니다', 400);
      if (!isAdmin && !(await teacherOwnsStudent(db, userId, body.student_id))) {
        return errorResponse('해당 학생에 대한 권한이 없습니다', 403);
      }
      const validationError = validateBody(body);
      if (validationError) return fieldErrorResponse(validationError);
      const kind = body.kind && (ALLOWED_KINDS as readonly string[]).includes(body.kind)
        ? body.kind
        : 'unit';
      const status = body.status && (ALLOWED_STATUS as readonly string[]).includes(body.status)
        ? body.status
        : 'todo';
      // source: 'manual' (직접 추가) | 'exam_prep' (시험대비) — UI 분기용
      const rawSource = (body as { source?: string }).source;
      const source = rawSource && (ALLOWED_SOURCES_USER as readonly string[]).includes(rawSource)
        ? rawSource : 'manual';
      const id = generateId();
      await executeUpdate(
        db,
        `INSERT INTO student_lesson_items
         (id, academy_id, student_id, textbook, unit_name, kind, order_idx,
          understanding, status, note,
          title, purpose, topic, description, tags, coverage_category,
          visible_to_parent, parent_can_download, source,
          created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          academyId,
          body.student_id,
          body.textbook ?? null,
          body.unit_name ?? null,
          kind,
          body.order_idx ?? 0,
          body.understanding ?? null,
          status,
          body.note ?? null,
          body.title ?? null,
          body.purpose ?? null,
          body.topic ?? null,
          body.description ?? null,
          body.tags ? JSON.stringify(body.tags) : null,
          body.coverage_category ?? null,
          body.visible_to_parent ? 1 : 0,
          body.parent_can_download === false ? 0 : 1,
          source,
          userId,
          userId,
        ]
      );
      const row = await executeFirst<LessonItemRow>(
        db,
        'SELECT * FROM student_lesson_items WHERE id = ?',
        [id]
      );
      return createdResponse(rowToItem(row!));
    }

    // POST /api/lesson-items/reorder
    if (method === 'POST' && pathname === '/api/lesson-items/reorder') {
      const body = (await request.json().catch(() => ({}))) as {
        items?: Array<{ id: string; order_idx: number }>;
      };
      if (!Array.isArray(body.items)) return errorResponse('items 배열이 필요합니다', 400);
      for (const it of body.items) {
        await executeUpdate(
          db,
          `UPDATE student_lesson_items SET order_idx = ?, updated_by = ?, updated_at = datetime('now')
           WHERE id = ? AND academy_id = ?`,
          [it.order_idx, userId, it.id, academyId]
        );
      }
      return successResponse({ ok: true });
    }

    // POST /api/lesson-items/apply-curriculum
    // body: { student_id, curriculum_id, item_ids?: string[] }  // item_ids 없으면 전체 적용
    if (method === 'POST' && pathname === '/api/lesson-items/apply-curriculum') {
      const body = (await request.json().catch(() => ({}))) as {
        student_id?: string;
        curriculum_id?: string;
        item_ids?: string[];
      };
      if (!body.student_id || !body.curriculum_id) {
        return errorResponse('student_id, curriculum_id 필수', 400);
      }
      if (!isAdmin && !(await teacherOwnsStudent(db, userId, body.student_id))) {
        return errorResponse('해당 학생에 대한 권한이 없습니다', 403);
      }
      // 학생 상태 검증
      const studentRow = await executeFirst<{ status: string }>(
        db, 'SELECT status FROM students WHERE id = ? AND academy_id = ?',
        [body.student_id, academyId]
      );
      if (!studentRow) return errorResponse('학생을 찾을 수 없습니다', 404);
      if (studentRow.status === 'inactive' || studentRow.status === 'graduated') {
        return errorResponse(`비활성 학생(${studentRow.status})에는 적용할 수 없습니다`, 400);
      }
      // 카탈로그 검증 (academy 격리)
      const curriculum = await executeFirst<{ id: string }>(
        db,
        'SELECT id FROM curricula WHERE id = ? AND academy_id = ? AND archived_at IS NULL',
        [body.curriculum_id, academyId]
      );
      if (!curriculum) return errorResponse('커리큘럼을 찾을 수 없습니다', 404);

      // 카탈로그 항목 로드
      let items: Array<{
        id: string; textbook: string | null; unit_name: string;
        kind: string; order_idx: number; description: string | null;
        default_purpose: string | null;
      }> = [];
      if (body.item_ids && body.item_ids.length > 0) {
        const marks = body.item_ids.map(() => '?').join(',');
        items = await executeQuery(
          db,
          `SELECT id, textbook, unit_name, kind, order_idx, description, default_purpose
           FROM curriculum_items
           WHERE curriculum_id = ? AND id IN (${marks})`,
          [body.curriculum_id, ...body.item_ids]
        );
      } else {
        items = await executeQuery(
          db,
          `SELECT id, textbook, unit_name, kind, order_idx, description, default_purpose
           FROM curriculum_items WHERE curriculum_id = ? ORDER BY order_idx`,
          [body.curriculum_id]
        );
      }
      if (items.length === 0) return successResponse({ created: 0, skipped: [], total: 0 });

      // unit_name 길이 검증 (카탈로그가 어떻게 들어오든 학생 row 보호)
      for (const it of items) {
        if (it.unit_name.length > FIELD_MAX_LEN.unit_name) {
          return errorResponse(`카탈로그 항목 unit_name 길이 초과 (${it.id})`, 400);
        }
      }

      // batch INSERT OR IGNORE — 멱등성 + 정확한 created 카운트 + skipped 추적
      // deterministic id로 같은 (curriculum_item, student) 중복 차단
      const stmts = items.map((it) => {
        const id = `sli-curr-${it.id}-${body.student_id}`;
        return db.prepare(
          `INSERT OR IGNORE INTO student_lesson_items
           (id, academy_id, student_id, textbook, unit_name, kind, order_idx,
            description, purpose, source, curriculum_item_id,
            status, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'curriculum', ?, 'todo', ?, ?)`
        ).bind(
          id, academyId, body.student_id,
          it.textbook, it.unit_name, it.kind, it.order_idx,
          it.description, it.default_purpose,
          it.id, userId, userId
        );
      });
      const results = await db.batch(stmts);
      let created = 0;
      const skipped: string[] = [];
      results.forEach((r, idx) => {
        const changes = (r as any)?.meta?.changes ?? 0;
        if (changes > 0) created++;
        else skipped.push(items[idx].id);
      });
      return successResponse({ created, skipped, total: items.length });
    }

    // POST /api/lesson-items/from-coverage
    if (method === 'POST' && pathname === '/api/lesson-items/from-coverage') {
      const body = (await request.json().catch(() => ({}))) as {
        student_id?: string;
        category?: string;
        title?: string;
        purpose?: string;
      };
      if (!body.student_id || !body.category) {
        return errorResponse('student_id, category가 필요합니다', 400);
      }
      if (typeof body.category !== 'string' || body.category.length > FIELD_MAX_LEN.coverage_category) {
        return errorResponse(`category: max length ${FIELD_MAX_LEN.coverage_category}`, 400);
      }
      if (body.title && (typeof body.title !== 'string' || body.title.length > FIELD_MAX_LEN.title)) {
        return errorResponse(`title: max length ${FIELD_MAX_LEN.title}`, 400);
      }
      if (body.purpose && (typeof body.purpose !== 'string' || body.purpose.length > FIELD_MAX_LEN.purpose)) {
        return errorResponse(`purpose: max length ${FIELD_MAX_LEN.purpose}`, 400);
      }
      if (!isAdmin && !(await teacherOwnsStudent(db, userId, body.student_id))) {
        return errorResponse('해당 학생에 대한 권한이 없습니다', 403);
      }
      const studentRow = await executeFirst<{ status: string }>(
        db, 'SELECT status FROM students WHERE id = ? AND academy_id = ?',
        [body.student_id, academyId]
      );
      if (!studentRow) return errorResponse('학생을 찾을 수 없습니다', 404);
      if (studentRow.status === 'inactive' || studentRow.status === 'graduated') {
        return errorResponse(`비활성 학생(${studentRow.status})에는 항목을 추가할 수 없습니다`, 400);
      }
      const id = generateId();
      await executeUpdate(
        db,
        `INSERT INTO student_lesson_items
         (id, academy_id, student_id, kind, status,
          title, purpose, coverage_category,
          visible_to_parent, parent_can_download,
          source,
          created_by, updated_by)
         VALUES (?, ?, ?, 'free', 'todo', ?, ?, ?, 0, 1, 'coverage_prescription', ?, ?)`,
        [
          id,
          academyId,
          body.student_id,
          body.title ?? `${body.category} 보강`,
          body.purpose ?? '오답 보강',
          body.category,
          userId,
          userId,
        ]
      );
      const row = await executeFirst<LessonItemRow>(
        db,
        'SELECT * FROM student_lesson_items WHERE id = ?',
        [id]
      );
      return createdResponse(rowToItem(row!));
    }

    // GET /api/lesson-items/download/:fileId — 스태프 다운로드
    const downloadMatch = pathname.match(/^\/api\/lesson-items\/download\/([^/]+)$/);
    if (method === 'GET' && downloadMatch) {
      const fileId = downloadMatch[1];
      const file = await executeFirst<LessonItemFileRow & { _academy: string }>(
        db,
        `SELECT f.*, i.academy_id AS _academy
         FROM lesson_item_files f
         JOIN student_lesson_items i ON i.id = f.lesson_item_id
         WHERE f.id = ?`,
        [fileId]
      );
      if (!file || file._academy !== academyId) return notFoundResponse();
      const obj = await context.env.BUCKET.get(file.r2_key);
      if (!obj) return notFoundResponse();
      const url2 = new URL(request.url);
      const inline = url2.searchParams.get('inline') === '1';
      return new Response(obj.body, {
        headers: {
          'Content-Type': file.mime_type || 'application/octet-stream',
          'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.file_name)}"`,
          'Cache-Control': inline ? 'private, max-age=300' : 'no-cache',
        },
      });
    }

    // /:id 와 /:id/files, /:id/files/:fileId, /:id/share
    const idShareMatch = pathname.match(/^\/api\/lesson-items\/([^/]+)\/share$/);
    const idFilesMatch = pathname.match(/^\/api\/lesson-items\/([^/]+)\/files$/);
    const idFileDelMatch = pathname.match(/^\/api\/lesson-items\/([^/]+)\/files\/([^/]+)$/);
    const idOnlyMatch = pathname.match(/^\/api\/lesson-items\/([^/]+)$/);

    async function loadItem(id: string): Promise<LessonItemRow | null> {
      return await executeFirst<LessonItemRow>(
        db,
        'SELECT * FROM student_lesson_items WHERE id = ? AND academy_id = ?',
        [id, academyId]
      );
    }
    async function ensureCanWrite(item: LessonItemRow): Promise<Response | null> {
      if (!isAdmin && !(await teacherOwnsStudent(db, userId, item.student_id))) {
        return errorResponse('해당 학생에 대한 권한이 없습니다', 403);
      }
      return null;
    }

    // GET /api/lesson-items/:id
    if (method === 'GET' && idOnlyMatch) {
      const item = await loadItem(idOnlyMatch[1]);
      if (!item) return notFoundResponse();
      const files = await executeQuery<LessonItemFileRow>(
        db,
        'SELECT * FROM lesson_item_files WHERE lesson_item_id = ? ORDER BY file_role, version DESC',
        [item.id]
      );
      return successResponse(rowToItem(item, files));
    }

    // PATCH /api/lesson-items/:id
    if (method === 'PATCH' && idOnlyMatch) {
      const item = await loadItem(idOnlyMatch[1]);
      if (!item) return notFoundResponse();
      const guard = await ensureCanWrite(item);
      if (guard) return guard;
      const body = (await request.json().catch(() => ({}))) as Record<string, any>;
      const validationError = validateBody(body);
      if (validationError) return fieldErrorResponse(validationError);

      const updates: string[] = [];
      const params: any[] = [];
      const setIf = (key: string, col = key) => {
        if (key in body) {
          updates.push(`${col} = ?`);
          params.push(body[key]);
        }
      };
      setIf('textbook');
      setIf('unit_name');
      if ('kind' in body && (ALLOWED_KINDS as readonly string[]).includes(body.kind)) {
        updates.push('kind = ?');
        params.push(body.kind);
      }
      setIf('order_idx');
      setIf('understanding');
      if ('status' in body && (ALLOWED_STATUS as readonly string[]).includes(body.status)) {
        updates.push('status = ?');
        params.push(body.status);
      }
      setIf('note');
      setIf('title');
      setIf('purpose');
      setIf('topic');
      setIf('description');
      if ('tags' in body) {
        updates.push('tags = ?');
        params.push(Array.isArray(body.tags) ? JSON.stringify(body.tags) : null);
      }
      setIf('coverage_category');
      if ('visible_to_parent' in body) {
        updates.push('visible_to_parent = ?');
        params.push(body.visible_to_parent ? 1 : 0);
      }
      if ('parent_can_download' in body) {
        updates.push('parent_can_download = ?');
        params.push(body.parent_can_download ? 1 : 0);
      }
      // 보관 복원: archived_at = null 허용 (다른 값은 무시)
      if ('archived_at' in body && body.archived_at === null) {
        updates.push('archived_at = NULL');
      }
      if (updates.length === 0) return successResponse({ ok: true });
      updates.push('updated_by = ?', "updated_at = datetime('now')");
      params.push(userId, item.id);
      await executeUpdate(
        db,
        `UPDATE student_lesson_items SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      const fresh = await loadItem(item.id);
      return successResponse(rowToItem(fresh!));
    }

    // DELETE /api/lesson-items/:id (soft archive)
    if (method === 'DELETE' && idOnlyMatch) {
      const item = await loadItem(idOnlyMatch[1]);
      if (!item) return notFoundResponse();
      const guard = await ensureCanWrite(item);
      if (guard) return guard;
      await executeUpdate(
        db,
        "UPDATE student_lesson_items SET archived_at = datetime('now') WHERE id = ?",
        [item.id]
      );
      return successResponse({ ok: true });
    }

    // POST /api/lesson-items/:id/files
    if (method === 'POST' && idFilesMatch) {
      const item = await loadItem(idFilesMatch[1]);
      if (!item) return notFoundResponse();
      const guard = await ensureCanWrite(item);
      if (guard) return guard;

      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) return errorResponse('파일이 필요합니다', 400);
      if (file.size > MAX_FILE_SIZE) return errorResponse('파일 크기가 20MB를 초과합니다', 413);

      const rawRole = String(formData.get('role') || 'main');
      const fileRole = (ALLOWED_ROLES as readonly string[]).includes(rawRole) ? rawRole : 'main';
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const key = buildR2Key(academyId, item.id, fileRole, ext);
      const buffer = await file.arrayBuffer();
      await context.env.BUCKET.put(key, buffer, {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });

      const latest = await executeFirst<{ max_v: number | null }>(
        db,
        'SELECT MAX(version) AS max_v FROM lesson_item_files WHERE lesson_item_id = ? AND file_role = ?',
        [item.id, fileRole]
      );
      const version = (latest?.max_v || 0) + 1;
      const fileId = generateId();
      await executeUpdate(
        db,
        `INSERT INTO lesson_item_files
         (id, lesson_item_id, r2_key, file_name, file_role, mime_type, size_bytes, version, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fileId, item.id, key, file.name, fileRole, file.type || null, file.size, version, userId]
      );
      return createdResponse({
        id: fileId,
        lesson_item_id: item.id,
        file_name: file.name,
        file_role: fileRole,
        size_bytes: file.size,
        version,
        mime_type: file.type,
      });
    }

    // PATCH /api/lesson-items/:id/files/:fileId — 파일명 변경
    if (method === 'PATCH' && idFileDelMatch) {
      const [, itemId, fileId] = idFileDelMatch;
      const item = await loadItem(itemId);
      if (!item) return notFoundResponse();
      const guard = await ensureCanWrite(item);
      if (guard) return guard;
      const file = await executeFirst<LessonItemFileRow>(
        db,
        'SELECT * FROM lesson_item_files WHERE id = ? AND lesson_item_id = ?',
        [fileId, itemId]
      );
      if (!file) return notFoundResponse();
      const body = (await request.json().catch(() => ({}))) as { file_name?: string };
      if (typeof body.file_name !== 'string') return errorResponse('file_name 필수', 400);
      const trimmed = body.file_name.trim();
      if (trimmed.length === 0) return errorResponse('file_name 비어있을 수 없음', 400);
      if (trimmed.length > 256) return errorResponse('file_name max length 256', 400);
      // 제어문자/슬래시 제거 (R2 키와 무관, 표시 전용 이름)
      const sanitized = trimmed.replace(/[ -\\/]/g, '');
      if (!sanitized) return errorResponse('file_name에 표시 가능 문자 없음', 400);
      await executeUpdate(
        db,
        'UPDATE lesson_item_files SET file_name = ? WHERE id = ?',
        [sanitized, fileId]
      );
      return successResponse({ ok: true, file_name: sanitized });
    }

    // DELETE /api/lesson-items/:id/files/:fileId
    if (method === 'DELETE' && idFileDelMatch) {
      const [, itemId, fileId] = idFileDelMatch;
      const item = await loadItem(itemId);
      if (!item) return notFoundResponse();
      const guard = await ensureCanWrite(item);
      if (guard) return guard;
      const file = await executeFirst<LessonItemFileRow>(
        db,
        'SELECT * FROM lesson_item_files WHERE id = ? AND lesson_item_id = ?',
        [fileId, itemId]
      );
      if (!file) return notFoundResponse();
      try {
        await context.env.BUCKET.delete(file.r2_key);
      } catch (err) {
        logger.warn('R2 delete failed', {
          err: err instanceof Error ? err.message : String(err),
          key: file.r2_key,
        });
      }
      await executeUpdate(db, 'DELETE FROM lesson_item_files WHERE id = ?', [fileId]);
      return successResponse({ ok: true });
    }

    // POST /api/lesson-items/:id/duplicate — 메타 복제 (파일 제외)
    // body: { student_id?: string } — 다른 학생에게 복제 가능, 기본은 같은 학생
    const idDuplicateMatch = pathname.match(/^\/api\/lesson-items\/([^/]+)\/duplicate$/);
    if (method === 'POST' && idDuplicateMatch) {
      const item = await loadItem(idDuplicateMatch[1]);
      if (!item) return notFoundResponse();
      const guard = await ensureCanWrite(item);
      if (guard) return guard;
      const body = (await request.json().catch(() => ({}))) as { student_id?: string };
      const targetStudentId = body.student_id || item.student_id;
      // 다른 학생일 경우 권한·상태 검증
      if (targetStudentId !== item.student_id) {
        if (!isAdmin && !(await teacherOwnsStudent(db, userId, targetStudentId))) {
          return errorResponse('대상 학생에 대한 권한이 없습니다', 403);
        }
        const target = await executeFirst<{ status: string }>(
          db, 'SELECT status FROM students WHERE id = ? AND academy_id = ?',
          [targetStudentId, academyId]
        );
        if (!target) return errorResponse('대상 학생을 찾을 수 없습니다', 404);
        if (target.status === 'inactive' || target.status === 'graduated') {
          return errorResponse(`비활성 학생(${target.status})에는 복제할 수 없습니다`, 400);
        }
      }
      const newId = generateId();
      // 메타만 복제. 이해도/메모/학부모노출/source/curriculum_item_id는 초기화.
      await executeUpdate(
        db,
        `INSERT INTO student_lesson_items
         (id, academy_id, student_id, textbook, unit_name, kind, order_idx,
          title, purpose, topic, description, tags, coverage_category,
          status, source,
          created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'todo', 'manual', ?, ?)`,
        [
          newId, academyId, targetStudentId,
          item.textbook, item.unit_name, item.kind, item.order_idx,
          item.title, item.purpose, item.topic, item.description, item.tags, item.coverage_category,
          userId, userId,
        ]
      );
      const row = await executeFirst<LessonItemRow>(
        db, 'SELECT * FROM student_lesson_items WHERE id = ?', [newId]
      );
      return createdResponse(rowToItem(row!));
    }

    // POST /api/lesson-items/:id/share — 학부모 링크
    if (method === 'POST' && idShareMatch) {
      const item = await loadItem(idShareMatch[1]);
      if (!item) return notFoundResponse();
      const guard = await ensureCanWrite(item);
      if (guard) return guard;
      // 시간당 발급 상한 — 무한 토큰 발급 + 후일 회수 불가 위험 차단
      const allowed = await checkShareRateLimit(context.env.KV, userId, 'lessons', SHARE_RATE_LIMIT);
      if (!allowed) {
        return errorResponse(`학부모 링크 발급 한도 초과 (시간당 ${SHARE_RATE_LIMIT}회)`, 429);
      }
      const secret = resolveShareSecret(context.env);
      if (!secret) return errorResponse('share secret not configured', 500);
      const expiresAt = Date.now() + SHARE_TTL_MS;
      const token = await signShareToken(item.student_id, 'lessons', expiresAt, secret);
      const path = `/parent/student/${item.student_id}?token=${encodeURIComponent(token)}`;
      return successResponse({
        student_id: item.student_id,
        path,
        token,
        expires_at: new Date(expiresAt).toISOString(),
      });
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error(
      'lesson-items handler error',
      error instanceof Error ? error : new Error(String(error))
    );
    return errorResponse('학습기록 처리 실패', 500);
  }
}
