/**
 * 시험지(중간/기말/수행평가) 관리 핸들러
 * GET /api/exam-papers                    목록 (필터: examType, school, grade, year, semester)
 * GET /api/exam-papers/:id                상세 + 배포 학생
 * POST /api/exam-papers/upload            파일 업로드 (R2)
 * POST /api/exam-papers                   메타 저장 + 자동 배포
 * PATCH /api/exam-papers/:id              메타 수정
 * DELETE /api/exam-papers/:id             삭제 (배포 cascade)
 * POST /api/exam-papers/:id/distribute    수동 재배포
 * GET /api/exam-papers/preview-students?school=&grade=   배포 대상 미리보기
 * DELETE /api/exam-papers/:paperId/distributions/:studentId   개별 제외
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { generateId } from '@/utils/id';

interface PaperRow {
  id: string;
  academy_id: string;
  title: string;
  exam_type: string;
  subject: string | null;
  school: string | null;
  grade: string | null;
  exam_year: number | null;
  semester: number | null;
  file_key: string | null;
  file_name: string | null;
  file_size: number | null;
  content_type: string | null;
  memo: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  distribution_count?: number;
}

const ALLOWED_EXAM_TYPES = ['midterm', 'final', 'performance'] as const;

async function autoDistribute(
  db: D1Database,
  paperId: string,
  academyId: string,
  school: string | null,
  grade: string | null,
  excludeIds: string[] = []
): Promise<number> {
  if (!school || !grade) return 0;

  const placeholders = excludeIds.length ? excludeIds.map(() => '?').join(',') : null;
  const sql = `
    SELECT id FROM students
    WHERE academy_id = ? AND school = ? AND grade = ? AND status = 'active'
    ${placeholders ? `AND id NOT IN (${placeholders})` : ''}
  `;
  const params: any[] = [academyId, school, grade, ...excludeIds];
  const matched = await executeQuery<{ id: string }>(db, sql, params);

  let count = 0;
  for (const s of matched) {
    try {
      await executeInsert(
        db,
        `INSERT OR IGNORE INTO paper_handout_distributions
         (id, paper_id, student_id, academy_id, source)
         VALUES (?, ?, ?, ?, 'auto')`,
        [generateId(), paperId, s.id, academyId]
      );
      count++;
    } catch {
      // UNIQUE 중복은 무시
    }
  }
  return count;
}

export async function handleExamPaper(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const db = context.env.DB;
  const userId = context.auth!.userId;
  const academyId = context.auth!.academyId;

  // GET /api/exam-papers/preview-students?school=&grade=
  if (method === 'GET' && pathname === '/api/exam-papers/preview-students') {
    const url = new URL(request.url);
    const school = url.searchParams.get('school') || '';
    const grade = url.searchParams.get('grade') || '';
    if (!school || !grade) return successResponse([]);

    const rows = await executeQuery<{ id: string; name: string; grade: string; school: string }>(
      db,
      `SELECT id, name, grade, school FROM students
       WHERE academy_id = ? AND school = ? AND grade = ? AND status = 'active'
       ORDER BY name`,
      [academyId, school, grade]
    );
    return successResponse(rows);
  }

  // GET /api/exam-papers
  if (method === 'GET' && pathname === '/api/exam-papers') {
    const url = new URL(request.url);
    const examType = url.searchParams.get('examType');
    const school = url.searchParams.get('school');
    const grade = url.searchParams.get('grade');
    const year = url.searchParams.get('year');
    const semester = url.searchParams.get('semester');

    let sql = `
      SELECT p.*, (
        SELECT COUNT(*) FROM paper_handout_distributions d WHERE d.paper_id = p.id
      ) AS distribution_count
      FROM paper_handouts p
      WHERE p.academy_id = ?
    `;
    const params: any[] = [academyId];

    if (examType) { sql += ' AND p.exam_type = ?'; params.push(examType); }
    if (school) { sql += ' AND p.school = ?'; params.push(school); }
    if (grade) { sql += ' AND p.grade = ?'; params.push(grade); }
    if (year) { sql += ' AND p.exam_year = ?'; params.push(Number(year)); }
    if (semester) { sql += ' AND p.semester = ?'; params.push(Number(semester)); }

    sql += ' ORDER BY p.created_at DESC';
    const rows = await executeQuery<PaperRow>(db, sql, params);
    return successResponse(rows);
  }

  // POST /api/exam-papers/upload — 파일 업로드
  if (method === 'POST' && pathname === '/api/exam-papers/upload') {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return errorResponse('파일이 필요합니다', 400);

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) return errorResponse('파일 크기가 20MB를 초과합니다', 413);

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return errorResponse('PDF 또는 이미지 파일만 허용됩니다', 400);
    }

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `exam-papers/${academyId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = await file.arrayBuffer();
    await context.env.BUCKET.put(key, buffer, {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });

    return successResponse({
      key,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
    }, 201);
  }

  // GET /api/exam-papers/file/:key  (파일 다운로드, academy 스코프 체크)
  if (method === 'GET' && pathname.startsWith('/api/exam-papers/file/')) {
    const key = decodeURIComponent(pathname.replace('/api/exam-papers/file/', ''));
    if (!key || key.includes('..') || key.startsWith('/')) return errorResponse('유효하지 않은 경로', 400);
    if (!key.startsWith(`exam-papers/${academyId}/`)) return unauthorizedResponse();

    const obj = await context.env.BUCKET.get(key);
    if (!obj) return notFoundResponse();

    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=300',
      },
    });
  }

  // POST /api/exam-papers — 메타 저장 + 자동 배포
  if (method === 'POST' && pathname === '/api/exam-papers') {
    const body = await request.json() as any;
    const {
      title, examType, subject, school, grade,
      examYear, semester, fileKey, fileName, fileSize, contentType,
      memo, autoDistribute: auto = true, excludeStudentIds = [],
    } = body;

    if (!title?.trim()) return errorResponse('제목은 필수입니다', 400);
    if (!ALLOWED_EXAM_TYPES.includes(examType)) return errorResponse('유효하지 않은 시험 유형', 400);

    const id = generateId();
    await executeInsert(
      db,
      `INSERT INTO paper_handouts
       (id, academy_id, title, exam_type, subject, school, grade,
        exam_year, semester, file_key, file_name, file_size, content_type, memo, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, academyId, title.trim(), examType,
        subject || null, school || null, grade || null,
        examYear || null, semester || null,
        fileKey || null, fileName || null, fileSize || null, contentType || null,
        memo?.trim() || '', userId,
      ]
    );

    let distributed = 0;
    if (auto && school && grade) {
      distributed = await autoDistribute(db, id, academyId, school, grade, excludeStudentIds);
    }

    return successResponse({ id, distributed }, 201);
  }

  // GET /api/exam-papers/:id
  const getOneMatch = pathname.match(/^\/api\/exam-papers\/([^/]+)$/);
  if (method === 'GET' && getOneMatch) {
    const id = getOneMatch[1];
    const paper = await executeFirst<PaperRow>(
      db,
      `SELECT * FROM paper_handouts WHERE id = ? AND academy_id = ?`,
      [id, academyId]
    );
    if (!paper) return notFoundResponse();

    const distributions = await executeQuery<any>(
      db,
      `SELECT d.*, s.name as student_name, s.school as student_school, s.grade as student_grade
       FROM paper_handout_distributions d
       JOIN students s ON s.id = d.student_id
       WHERE d.paper_id = ?
       ORDER BY s.name`,
      [id]
    );

    return successResponse({ ...paper, distributions });
  }

  // PATCH /api/exam-papers/:id
  if (method === 'PATCH' && getOneMatch) {
    const id = getOneMatch[1];
    const existing = await executeFirst<PaperRow>(
      db, `SELECT * FROM paper_handouts WHERE id = ? AND academy_id = ?`, [id, academyId]
    );
    if (!existing) return notFoundResponse();

    const body = await request.json() as any;
    const updates: string[] = [];
    const params: any[] = [];

    const fields: Array<[string, string]> = [
      ['title', 'title'], ['examType', 'exam_type'], ['subject', 'subject'],
      ['school', 'school'], ['grade', 'grade'],
      ['examYear', 'exam_year'], ['semester', 'semester'], ['memo', 'memo'],
    ];
    for (const [k, col] of fields) {
      if (body[k] !== undefined) {
        if (k === 'examType' && !ALLOWED_EXAM_TYPES.includes(body[k])) {
          return errorResponse('유효하지 않은 시험 유형', 400);
        }
        updates.push(`${col} = ?`);
        params.push(typeof body[k] === 'string' ? body[k].trim() || null : body[k]);
      }
    }
    if (updates.length === 0) return errorResponse('변경할 필드가 없습니다', 400);

    updates.push(`updated_at = datetime('now')`);
    params.push(id);
    await executeUpdate(db, `UPDATE paper_handouts SET ${updates.join(', ')} WHERE id = ?`, params);

    return successResponse({ success: true });
  }

  // DELETE /api/exam-papers/:id
  if (method === 'DELETE' && getOneMatch) {
    const id = getOneMatch[1];
    const existing = await executeFirst<PaperRow>(
      db, `SELECT * FROM paper_handouts WHERE id = ? AND academy_id = ?`, [id, academyId]
    );
    if (!existing) return notFoundResponse();

    if (existing.file_key) {
      try { await context.env.BUCKET.delete(existing.file_key); } catch { /* ignore */ }
    }
    await executeUpdate(db, `DELETE FROM paper_handouts WHERE id = ?`, [id]);
    return successResponse({ success: true });
  }

  // POST /api/exam-papers/:id/distribute  (수동 재배포)
  const distributeMatch = pathname.match(/^\/api\/exam-papers\/([^/]+)\/distribute$/);
  if (method === 'POST' && distributeMatch) {
    const id = distributeMatch[1];
    const paper = await executeFirst<PaperRow>(
      db, `SELECT * FROM paper_handouts WHERE id = ? AND academy_id = ?`, [id, academyId]
    );
    if (!paper) return notFoundResponse();

    const body = await request.json().catch(() => ({})) as any;
    const excludeIds: string[] = body.excludeStudentIds || [];

    const count = await autoDistribute(db, id, academyId, paper.school, paper.grade, excludeIds);
    return successResponse({ distributed: count });
  }

  // DELETE /api/exam-papers/:paperId/distributions/:studentId
  const removeDistMatch = pathname.match(/^\/api\/exam-papers\/([^/]+)\/distributions\/([^/]+)$/);
  if (method === 'DELETE' && removeDistMatch) {
    const [, paperId, studentId] = removeDistMatch;
    const paper = await executeFirst<{ id: string }>(
      db, `SELECT id FROM paper_handouts WHERE id = ? AND academy_id = ?`, [paperId, academyId]
    );
    if (!paper) return notFoundResponse();

    await executeUpdate(
      db,
      `DELETE FROM paper_handout_distributions WHERE paper_id = ? AND student_id = ?`,
      [paperId, studentId]
    );
    return successResponse({ success: true });
  }

  return errorResponse('Not found', 404);
}
