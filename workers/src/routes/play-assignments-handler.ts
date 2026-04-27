/**
 * 학생용 과제 핸들러 (PIN 인증, /api/play/assignments)
 * gacha-play-handler와 동일한 PlayAuth(KV play:* 토큰) 사용
 */

import { z } from 'zod';
import { RequestContext } from '@/types';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse, createdResponse } from '@/utils/response';
import { executeQuery, executeFirst, executeUpdate } from '@/utils/db';
import { generatePrefixedId } from '@/utils/id';
import { logger } from '@/utils/logger';
import { parsePagination } from '@/utils/pagination';
import { paginatedList } from '@/utils/paginatedList';

interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

async function getPlayAuth(context: RequestContext): Promise<PlayAuth | null> {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const data = await context.env.KV.get(`play:${token}`, 'json') as PlayAuth | null;
  return data;
}

const SubmitSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
  files: z.array(z.object({
    key: z.string().min(1).max(500),
    name: z.string().min(1).max(300),
    size: z.number().int().nonnegative(),
    mime: z.string().max(120).optional().nullable(),
  })).min(1).max(20),
});

function isValidR2Key(key: string): boolean {
  return /^assignments\/[A-Za-z0-9\-_/.]+$/.test(key) && !key.includes('..');
}

export async function handlePlayAssignments(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    const auth = await getPlayAuth(context);
    if (!auth) return unauthorizedResponse();

    // ── 파일 업로드: POST /api/play/assignments/upload ──
    if (method === 'POST' && pathname === '/api/play/assignments/upload') {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) return errorResponse('파일이 필요합니다', 400);
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) return errorResponse('파일 크기가 10MB를 초과합니다', 413);

      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = `assignments/${auth.academyId}/submission/${auth.studentId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const buffer = await file.arrayBuffer();
      await context.env.BUCKET.put(key, buffer, {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });
      return createdResponse({
        key,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
      });
    }

    // ── 파일 다운로드: GET /api/play/assignments/file/:key ──
    if (method === 'GET' && pathname.startsWith('/api/play/assignments/file/')) {
      const key = decodeURIComponent(pathname.replace('/api/play/assignments/file/', ''));
      if (!isValidR2Key(key)) return errorResponse('유효하지 않은 파일 경로', 400);
      // ACL: academy 매칭 + (학생이 올린 본인 파일) 또는 (본인 target에 속한 응답·첨부)
      if (!key.includes(`/${auth.academyId}/`)) {
        return errorResponse('권한이 없습니다', 403);
      }

      // 본인 업로드 (submission/:studentId/...)
      const ownSubmissionPrefix = `assignments/${auth.academyId}/submission/${auth.studentId}/`;
      if (!key.startsWith(ownSubmissionPrefix)) {
        // 첨부/응답: 본인 target에 연결된 키인지 확인
        const attachmentMatch = await executeFirst<{ count: number }>(
          context.env.DB,
          `SELECT COUNT(*) as count FROM assignment_targets t
             JOIN assignments a ON a.id = t.assignment_id
            WHERE t.student_id = ? AND a.attached_file_key = ?`,
          [auth.studentId, key]
        );
        const responseMatch = await executeFirst<{ count: number }>(
          context.env.DB,
          `SELECT COUNT(*) as count FROM assignment_responses r
             JOIN assignment_targets t ON t.id = r.target_id
            WHERE t.student_id = ? AND r.file_key = ?`,
          [auth.studentId, key]
        );
        if ((attachmentMatch?.count || 0) === 0 && (responseMatch?.count || 0) === 0) {
          return errorResponse('권한이 없습니다', 403);
        }
      }

      const obj = await context.env.BUCKET.get(key);
      if (!obj) return notFoundResponse();
      return new Response(obj.body, {
        headers: {
          'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${key.split('/').pop()}"`,
          'Cache-Control': 'private, max-age=300',
        },
      });
    }

    // ── 목록: GET /api/play/assignments ──
    if (method === 'GET' && pathname === '/api/play/assignments') {
      const pg = parsePagination(new URL(request.url), { defaultLimit: 50, maxLimit: 200 });
      const result = await paginatedList<any>({
        db: context.env.DB,
        table: 'assignment_targets t',
        selectColumns: `t.id as target_id, t.assignment_id, t.status, t.assigned_at, t.last_submitted_at, t.last_reviewed_at,
                        a.title, a.kind, a.due_at, a.instructions,
                        a.attached_file_key, a.attached_file_name, a.status as assignment_status,
                        (SELECT COUNT(*) FROM assignment_responses r WHERE r.target_id = t.id) as response_count,
                        (SELECT MAX(created_at) FROM assignment_responses r WHERE r.target_id = t.id) as latest_response_at`,
        join: 'JOIN assignments a ON a.id = t.assignment_id',
        baseFilters: [
          { sql: 't.student_id = ?', param: auth.studentId },
          { sql: 't.academy_id = ?', param: auth.academyId },
          { sql: "a.status = 'published'" },
        ],
        countsBy: { column: 't.status', values: ['needs_resubmit', 'assigned', 'submitted', 'reviewed'] },
        orderBy: `CASE t.status WHEN 'needs_resubmit' THEN 0 WHEN 'assigned' THEN 1 WHEN 'submitted' THEN 2 WHEN 'reviewed' THEN 3 ELSE 4 END,
                  a.due_at ASC, t.assigned_at DESC`,
        pagination: pg,
      });
      return successResponse(result);
    }

    // ── 단건: GET /api/play/assignments/:targetId ──
    const detailMatch = pathname.match(/^\/api\/play\/assignments\/([^/]+)$/);
    if (detailMatch && method === 'GET') {
      const targetId = detailMatch[1];
      const t = await executeFirst<any>(
        context.env.DB,
        `SELECT t.*, a.title, a.kind, a.due_at, a.instructions,
                a.attached_file_key, a.attached_file_name, a.status as assignment_status
         FROM assignment_targets t
         JOIN assignments a ON a.id = t.assignment_id
         WHERE t.id = ? AND t.student_id = ?`,
        [targetId, auth.studentId]
      );
      if (!t) return notFoundResponse();

      const submissions = await executeQuery<any>(
        context.env.DB,
        `SELECT * FROM assignment_submissions WHERE target_id = ? ORDER BY submitted_at DESC`,
        [targetId]
      );
      const responses = await executeQuery<any>(
        context.env.DB,
        `SELECT r.id, r.comment, r.file_key, r.file_name, r.action, r.created_at,
                u.name as teacher_name
         FROM assignment_responses r
         LEFT JOIN users u ON u.id = r.teacher_id
         WHERE r.target_id = ? ORDER BY r.created_at DESC`,
        [targetId]
      );

      const parsedSubs = submissions.map((s) => ({
        ...s,
        files: (() => { try { return JSON.parse(s.files || '[]'); } catch { return []; } })(),
      }));

      return successResponse({ target: t, submissions: parsedSubs, responses });
    }

    // ── 제출: POST /api/play/assignments/:targetId/submit ──
    const submitMatch = pathname.match(/^\/api\/play\/assignments\/([^/]+)\/submit$/);
    if (submitMatch && method === 'POST') {
      const targetId = submitMatch[1];
      const t = await executeFirst<any>(
        context.env.DB,
        `SELECT t.*, a.due_at, a.status as assignment_status
         FROM assignment_targets t
         JOIN assignments a ON a.id = t.assignment_id
         WHERE t.id = ? AND t.student_id = ?`,
        [targetId, auth.studentId]
      );
      if (!t) return notFoundResponse();
      if (t.assignment_status !== 'published') {
        return errorResponse('이 과제는 더 이상 제출할 수 없습니다', 400);
      }
      if (t.due_at && new Date(t.due_at) < new Date()) {
        return errorResponse('마감 시간이 지났습니다', 400);
      }
      if (t.status === 'completed') {
        return errorResponse('이미 완료된 과제입니다', 400);
      }

      const body = await request.json();
      const data = SubmitSchema.parse(body);

      // 파일들이 본인 업로드 prefix인지 검증
      const ownPrefix = `assignments/${auth.academyId}/submission/${auth.studentId}/`;
      for (const f of data.files) {
        if (!f.key.startsWith(ownPrefix) || !isValidR2Key(f.key)) {
          return errorResponse(`잘못된 파일 키: ${f.name}`, 400);
        }
      }

      const submissionId = generatePrefixedId('asub');
      await executeUpdate(
        context.env.DB,
        `INSERT INTO assignment_submissions (id, target_id, student_id, academy_id, note, files)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [submissionId, targetId, auth.studentId, auth.academyId, data.note ?? null, JSON.stringify(data.files)]
      );
      await executeUpdate(
        context.env.DB,
        `UPDATE assignment_targets
         SET status = 'submitted', last_submitted_at = datetime('now')
         WHERE id = ?`,
        [targetId]
      );
      logger.logAudit('PLAY_ASSIGNMENT_SUBMIT', 'AssignmentSubmission', submissionId, auth.studentId, {
        target_id: targetId, file_count: data.files.length,
      });
      return createdResponse({ id: submissionId, status: 'submitted' });
    }

    return errorResponse('Not found', 404);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return errorResponse(`입력 검증 오류: ${error.errors?.[0]?.message || 'invalid'}`, 400);
    }
    logger.error('play-assignments error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse(error?.message || '처리 실패', 500);
  }
}
