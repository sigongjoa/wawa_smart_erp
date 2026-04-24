/**
 * 과제 회수·첨삭 (선생님/admin)
 * - assignments: 과제 발행
 * - assignment_targets: 학생별 인스턴스
 * - assignment_submissions: 학생 제출 (학생 측에서 INSERT)
 * - assignment_responses: 선생님 회신 (코멘트 + 선택적 첨삭본)
 */

import { z } from 'zod';
import { RequestContext } from '@/types';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse, createdResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { executeQuery, executeFirst, executeUpdate } from '@/utils/db';
import { generatePrefixedId } from '@/utils/id';
import { logger } from '@/utils/logger';
import { signShareToken, resolveShareSecret, checkShareRateLimit } from '@/utils/share-token';

const KIND = ['perf_eval', 'exam_paper', 'general'] as const;
const STATUS = ['published', 'closed'] as const;
const TARGET_STATUS = ['assigned', 'submitted', 'reviewed', 'needs_resubmit', 'completed'] as const;

const CreateAssignmentSchema = z.object({
  title: z.string().min(1).max(200),
  instructions: z.string().max(5000).optional().nullable(),
  kind: z.enum(KIND).default('general'),
  due_at: z.string().datetime().optional().nullable(),
  attached_file_key: z.string().max(500).optional().nullable(),
  attached_file_name: z.string().max(300).optional().nullable(),
  student_ids: z.array(z.string().min(1)).min(1).max(500),
});

const UpdateAssignmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  instructions: z.string().max(5000).optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  status: z.enum(STATUS).optional(),
});

const RespondSchema = z.object({
  submission_id: z.string().optional().nullable(),
  comment: z.string().max(5000).optional().nullable(),
  file_key: z.string().max(500).optional().nullable(),
  file_name: z.string().max(300).optional().nullable(),
  action: z.enum(['accept', 'needs_resubmit']).default('accept'),
}).refine((d) => (d.comment && d.comment.trim().length > 0) || d.file_key, {
  message: '코멘트 또는 첨삭 파일 중 하나는 필요합니다',
});

const TargetStatusSchema = z.object({
  status: z.enum(TARGET_STATUS),
});

// ── 파일 ACL: assignment 파일 키는 모두 academy_id 검증 ──
function isValidR2Key(key: string): boolean {
  return /^assignments\/[A-Za-z0-9\-_/.]+$/.test(key) && !key.includes('..');
}

async function getAssignment(context: RequestContext, id: string) {
  return executeFirst<any>(
    context.env.DB,
    'SELECT * FROM assignments WHERE id = ? AND academy_id = ?',
    [id, getAcademyId(context)]
  );
}

async function getTarget(context: RequestContext, targetId: string) {
  return executeFirst<any>(
    context.env.DB,
    `SELECT t.*, a.title as assignment_title, a.kind, a.due_at, a.instructions, a.attached_file_key, a.attached_file_name,
            gs.name as student_name, gs.grade as student_grade
     FROM assignment_targets t
     JOIN assignments a ON a.id = t.assignment_id
     LEFT JOIN gacha_students gs ON gs.id = t.student_id
     WHERE t.id = ? AND t.academy_id = ?`,
    [targetId, getAcademyId(context)]
  );
}

export async function handleAssignments(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (!requireAuth(context)) return unauthorizedResponse();
    const academyId = getAcademyId(context);
    const userId = getUserId(context);
    const role = context.auth!.role;

    // ── 파일 업로드: POST /api/assignments/upload (teacher attach / response) ──
    if (method === 'POST' && pathname === '/api/assignments/upload') {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) return errorResponse('파일이 필요합니다', 400);
      const purpose = (formData.get('purpose') as string) || 'attachment';
      if (!['attachment', 'response'].includes(purpose)) {
        return errorResponse('purpose는 attachment 또는 response여야 합니다', 400);
      }
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) return errorResponse('파일 크기가 10MB를 초과합니다', 413);

      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = `assignments/${academyId}/${purpose}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const buffer = await file.arrayBuffer();
      await context.env.BUCKET.put(key, buffer, {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });
      logger.logAudit('ASSIGNMENT_FILE_UPLOAD', 'AssignmentFile', key, userId, { purpose, size: file.size });
      return createdResponse({
        key,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
      });
    }

    // ── 파일 다운로드: GET /api/assignments/file/:key ──
    if (method === 'GET' && pathname.startsWith('/api/assignments/file/')) {
      const key = decodeURIComponent(pathname.replace('/api/assignments/file/', ''));
      if (!isValidR2Key(key)) return errorResponse('유효하지 않은 파일 경로', 400);
      // ACL: 키에 academy_id 포함 + 본인 학원 매칭
      if (!key.includes(`/${academyId}/`)) {
        return errorResponse('권한이 없습니다', 403);
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

    // ── 인박스: GET /api/assignments/inbox ──
    // 회신 대기(=submitted) 타깃 목록. teacher: 본인 발행 과제만, admin: 전체
    if (method === 'GET' && pathname === '/api/assignments/inbox') {
      const params: any[] = [academyId];
      let where = `t.academy_id = ? AND t.status IN ('submitted','needs_resubmit')`;
      if (role !== 'admin') {
        where += ` AND a.created_by = ?`;
        params.push(userId);
      }
      const rows = await executeQuery<any>(
        context.env.DB,
        `SELECT t.id as target_id, t.assignment_id, t.student_id, t.status, t.last_submitted_at,
                a.title, a.kind, a.due_at, a.created_by,
                gs.name as student_name, gs.grade as student_grade
         FROM assignment_targets t
         JOIN assignments a ON a.id = t.assignment_id
         LEFT JOIN gacha_students gs ON gs.id = t.student_id
         WHERE ${where}
         ORDER BY t.last_submitted_at DESC NULLS LAST
         LIMIT 200`,
        params
      );
      return successResponse(rows);
    }

    // ── 통계: GET /api/assignments/stats ──
    if (method === 'GET' && pathname === '/api/assignments/stats') {
      const stats = await executeFirst<any>(
        context.env.DB,
        `SELECT
           SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned_count,
           SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as inbox_count,
           SUM(CASE WHEN status = 'needs_resubmit' THEN 1 ELSE 0 END) as resubmit_count,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
           COUNT(*) as total_count
         FROM assignment_targets
         WHERE academy_id = ?`,
        [academyId]
      );
      return successResponse(stats || {});
    }

    // ── 목록: GET /api/assignments ──
    if (method === 'GET' && pathname === '/api/assignments') {
      const url = new URL(request.url);
      const statusFilter = url.searchParams.get('status');
      const kindFilter = url.searchParams.get('kind');
      const mine = url.searchParams.get('mine') === '1';

      const params: any[] = [academyId];
      let where = `academy_id = ?`;
      if (statusFilter && (STATUS as readonly string[]).includes(statusFilter)) {
        where += ` AND status = ?`;
        params.push(statusFilter);
      }
      if (kindFilter && (KIND as readonly string[]).includes(kindFilter)) {
        where += ` AND kind = ?`;
        params.push(kindFilter);
      }
      if (mine) {
        where += ` AND created_by = ?`;
        params.push(userId);
      }
      const rows = await executeQuery<any>(
        context.env.DB,
        `SELECT a.*,
                (SELECT COUNT(*) FROM assignment_targets t WHERE t.assignment_id = a.id) as target_count,
                (SELECT COUNT(*) FROM assignment_targets t WHERE t.assignment_id = a.id AND t.status = 'submitted') as submitted_count,
                (SELECT COUNT(*) FROM assignment_targets t WHERE t.assignment_id = a.id AND t.status = 'completed') as completed_count
         FROM assignments a
         WHERE ${where}
         ORDER BY a.created_at DESC
         LIMIT 200`,
        params
      );
      return successResponse(rows);
    }

    // ── 발행: POST /api/assignments ──
    if (method === 'POST' && pathname === '/api/assignments') {
      const body = await request.json();
      const data = CreateAssignmentSchema.parse(body);

      // student_ids 전부 본인 학원 소속 검증
      const placeholders = data.student_ids.map(() => '?').join(',');
      const validStudents = await executeQuery<{ id: string }>(
        context.env.DB,
        `SELECT id FROM gacha_students WHERE academy_id = ? AND id IN (${placeholders})`,
        [academyId, ...data.student_ids]
      );
      const validIds = new Set(validStudents.map((s) => s.id));
      const invalidIds = data.student_ids.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        return errorResponse(`잘못된 학생 ID: ${invalidIds.join(', ')}`, 400);
      }

      const assignmentId = generatePrefixedId('asn');
      await executeUpdate(
        context.env.DB,
        `INSERT INTO assignments (id, academy_id, created_by, title, instructions, kind, due_at, attached_file_key, attached_file_name, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
        [
          assignmentId, academyId, userId,
          data.title, data.instructions ?? null,
          data.kind, data.due_at ?? null,
          data.attached_file_key ?? null, data.attached_file_name ?? null,
        ]
      );

      // bulk insert targets
      for (const studentId of data.student_ids) {
        const targetId = generatePrefixedId('atg');
        await executeUpdate(
          context.env.DB,
          `INSERT INTO assignment_targets (id, assignment_id, student_id, academy_id, status)
           VALUES (?, ?, ?, ?, 'assigned')`,
          [targetId, assignmentId, studentId, academyId]
        );
      }

      logger.logAudit('ASSIGNMENT_CREATE', 'Assignment', assignmentId, userId, {
        title: data.title, kind: data.kind, target_count: data.student_ids.length,
      });
      return createdResponse({ id: assignmentId, target_count: data.student_ids.length });
    }

    // ── 단건: GET /api/assignments/:id ──
    const idDetailMatch = pathname.match(/^\/api\/assignments\/([^/]+)$/);
    if (idDetailMatch && method === 'GET') {
      const id = idDetailMatch[1];
      const a = await getAssignment(context, id);
      if (!a) return notFoundResponse();
      const targets = await executeQuery<any>(
        context.env.DB,
        `SELECT t.*, gs.name as student_name, gs.grade as student_grade,
                (SELECT COUNT(*) FROM assignment_submissions s WHERE s.target_id = t.id) as submission_count,
                (SELECT COUNT(*) FROM assignment_responses r WHERE r.target_id = t.id) as response_count
         FROM assignment_targets t
         LEFT JOIN gacha_students gs ON gs.id = t.student_id
         WHERE t.assignment_id = ?
         ORDER BY t.last_submitted_at DESC NULLS LAST, gs.name ASC`,
        [id]
      );
      return successResponse({ ...a, targets });
    }

    // ── 수정: PATCH /api/assignments/:id ──
    if (idDetailMatch && method === 'PATCH') {
      const id = idDetailMatch[1];
      const a = await getAssignment(context, id);
      if (!a) return notFoundResponse();
      if (a.created_by !== userId && role !== 'admin') {
        return errorResponse('본인이 발행한 과제만 수정할 수 있습니다', 403);
      }
      const body = await request.json();
      const data = UpdateAssignmentSchema.parse(body);
      const fields: string[] = [];
      const params: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        if (v === undefined) continue;
        fields.push(`${k} = ?`);
        params.push(v);
      }
      if (fields.length === 0) return successResponse(a);
      fields.push(`updated_at = datetime('now')`);
      params.push(id, academyId);
      await executeUpdate(
        context.env.DB,
        `UPDATE assignments SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`,
        params
      );
      const updated = await getAssignment(context, id);
      logger.logAudit('ASSIGNMENT_UPDATE', 'Assignment', id, userId, data);
      return successResponse(updated);
    }

    // ── 닫기(soft) / 완전삭제(hard): DELETE /api/assignments/:id[?hard=1] ──
    if (idDetailMatch && method === 'DELETE') {
      const id = idDetailMatch[1];
      const a = await getAssignment(context, id);
      if (!a) return notFoundResponse();
      if (a.created_by !== userId && role !== 'admin') {
        return errorResponse('본인이 발행한 과제만 삭제할 수 있습니다', 403);
      }
      const hard = new URL(request.url).searchParams.get('hard') === '1';
      if (hard) {
        // targets 조회 → 자식 삭제 (CASCADE 미설정이라 수동 cascade)
        const targets = await executeQuery<{ id: string }>(
          context.env.DB,
          `SELECT id FROM assignment_targets WHERE assignment_id = ? AND academy_id = ?`,
          [id, academyId]
        );
        for (const t of targets) {
          await executeUpdate(
            context.env.DB,
            `DELETE FROM assignment_responses WHERE target_id = ? AND academy_id = ?`,
            [t.id, academyId]
          );
          await executeUpdate(
            context.env.DB,
            `DELETE FROM assignment_submissions WHERE target_id = ? AND academy_id = ?`,
            [t.id, academyId]
          );
        }
        await executeUpdate(
          context.env.DB,
          `DELETE FROM assignment_targets WHERE assignment_id = ? AND academy_id = ?`,
          [id, academyId]
        );
        await executeUpdate(
          context.env.DB,
          `DELETE FROM assignments WHERE id = ? AND academy_id = ?`,
          [id, academyId]
        );
        logger.logAudit('ASSIGNMENT_HARD_DELETE', 'Assignment', id, userId, { target_count: targets.length });
        return successResponse({ message: '과제가 완전 삭제되었습니다' });
      }
      await executeUpdate(
        context.env.DB,
        `UPDATE assignments SET status = 'closed', updated_at = datetime('now') WHERE id = ? AND academy_id = ?`,
        [id, academyId]
      );
      logger.logAudit('ASSIGNMENT_CLOSE', 'Assignment', id, userId);
      return successResponse({ message: '과제가 닫혔습니다' });
    }

    // ── target detail: GET /api/assignments/targets/:targetId ──
    const targetMatch = pathname.match(/^\/api\/assignments\/targets\/([^/]+)$/);
    if (targetMatch && method === 'GET') {
      const targetId = targetMatch[1];
      const t = await getTarget(context, targetId);
      if (!t) return notFoundResponse();
      const submissions = await executeQuery<any>(
        context.env.DB,
        `SELECT * FROM assignment_submissions WHERE target_id = ? ORDER BY submitted_at DESC`,
        [targetId]
      );
      const responses = await executeQuery<any>(
        context.env.DB,
        `SELECT r.*, u.name as teacher_name
         FROM assignment_responses r
         LEFT JOIN users u ON u.id = r.teacher_id
         WHERE r.target_id = ? ORDER BY r.created_at DESC`,
        [targetId]
      );
      // files JSON 파싱
      const parsedSubs = submissions.map((s) => ({
        ...s,
        files: (() => { try { return JSON.parse(s.files || '[]'); } catch { return []; } })(),
      }));
      return successResponse({ target: t, submissions: parsedSubs, responses });
    }

    // ── 회신: POST /api/assignments/targets/:targetId/respond ──
    const respondMatch = pathname.match(/^\/api\/assignments\/targets\/([^/]+)\/respond$/);
    if (respondMatch && method === 'POST') {
      const targetId = respondMatch[1];
      const t = await getTarget(context, targetId);
      if (!t) return notFoundResponse();
      const body = await request.json();
      const data = RespondSchema.parse(body);

      const responseId = generatePrefixedId('arsp');
      await executeUpdate(
        context.env.DB,
        `INSERT INTO assignment_responses (id, target_id, submission_id, teacher_id, academy_id, comment, file_key, file_name, action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          responseId, targetId, data.submission_id ?? null, userId, academyId,
          data.comment ?? null, data.file_key ?? null, data.file_name ?? null, data.action,
        ]
      );

      // target.status 업데이트
      const newStatus = data.action === 'accept' ? 'completed' : 'needs_resubmit';
      await executeUpdate(
        context.env.DB,
        `UPDATE assignment_targets
         SET status = ?, last_reviewed_at = datetime('now')
         WHERE id = ? AND academy_id = ?`,
        [newStatus, targetId, academyId]
      );
      logger.logAudit('ASSIGNMENT_RESPOND', 'AssignmentTarget', targetId, userId, { action: data.action });
      return createdResponse({ id: responseId, target_status: newStatus });
    }

    // ── 학부모 공유 링크 발급: POST /api/assignments/targets/:targetId/parent-share ──
    const parentShareMatch = pathname.match(/^\/api\/assignments\/targets\/([^/]+)\/parent-share$/);
    if (parentShareMatch && method === 'POST') {
      const targetId = parentShareMatch[1];
      const t = await getTarget(context, targetId);
      if (!t) return notFoundResponse();

      // 피드백이 1개 이상 있는 경우만 공유 허용 (빈 공유 방지)
      const fb = await executeFirst<{ n: number }>(
        context.env.DB,
        `SELECT COUNT(*) AS n FROM assignment_responses WHERE target_id = ?`,
        [targetId]
      );
      if (!fb || fb.n === 0) {
        return errorResponse('피드백이 1회 이상 작성된 후 공유할 수 있습니다', 400);
      }

      const secret = resolveShareSecret(context.env as any);
      if (!secret) return errorResponse('서버 설정 오류: 공유 링크 비밀키가 없습니다', 500);

      const allowed = await checkShareRateLimit(context.env.KV, userId, 'homework');
      if (!allowed) {
        return errorResponse('공유 링크 발급 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.', 429);
      }

      const body = (await request.json().catch(() => ({}))) as { days?: number };
      const days = Math.max(1, Math.min(60, Math.round(body.days ?? 14)));
      const expiresAtMs = Date.now() + days * 24 * 3600 * 1000;
      const token = await signShareToken(targetId, 'homework', expiresAtMs, secret);

      const origin = request.headers.get('origin') || '';
      const base = origin || (context.env as any).APP_BASE_URL || '';
      const path = `/#/parent-homework/${targetId}?token=${encodeURIComponent(token)}`;
      const fullUrl = base ? `${base}${path}` : path;

      logger.logAudit('HOMEWORK_PARENT_SHARE', 'AssignmentTarget', targetId, userId, { days });
      return successResponse({
        url: fullUrl,
        path,
        token,
        expires_at: new Date(expiresAtMs).toISOString(),
      });
    }

    // ── target 삭제(hard): DELETE /api/assignments/targets/:targetId ──
    const targetDeleteMatch = pathname.match(/^\/api\/assignments\/targets\/([^/]+)$/);
    if (targetDeleteMatch && method === 'DELETE') {
      const targetId = targetDeleteMatch[1];
      const t = await getTarget(context, targetId);
      if (!t) return notFoundResponse();
      // 본인 발행 과제이거나 admin 인 경우만
      const parent = await executeFirst<{ created_by: string }>(
        context.env.DB,
        `SELECT created_by FROM assignments WHERE id = ? AND academy_id = ?`,
        [t.assignment_id, academyId]
      );
      if (role !== 'admin' && parent?.created_by !== userId) {
        return errorResponse('본인이 발행한 과제의 대상만 삭제할 수 있습니다', 403);
      }
      await executeUpdate(
        context.env.DB,
        `DELETE FROM assignment_responses WHERE target_id = ? AND academy_id = ?`,
        [targetId, academyId]
      );
      await executeUpdate(
        context.env.DB,
        `DELETE FROM assignment_submissions WHERE target_id = ? AND academy_id = ?`,
        [targetId, academyId]
      );
      await executeUpdate(
        context.env.DB,
        `DELETE FROM assignment_targets WHERE id = ? AND academy_id = ?`,
        [targetId, academyId]
      );
      logger.logAudit('ASSIGNMENT_TARGET_DELETE', 'AssignmentTarget', targetId, userId);
      return successResponse({ message: '대상이 삭제되었습니다' });
    }

    // ── target 상태 강제 변경: PATCH /api/assignments/targets/:targetId/status ──
    const targetStatusMatch = pathname.match(/^\/api\/assignments\/targets\/([^/]+)\/status$/);
    if (targetStatusMatch && method === 'PATCH') {
      const targetId = targetStatusMatch[1];
      const t = await getTarget(context, targetId);
      if (!t) return notFoundResponse();
      const body = await request.json();
      const data = TargetStatusSchema.parse(body);
      await executeUpdate(
        context.env.DB,
        `UPDATE assignment_targets SET status = ? WHERE id = ? AND academy_id = ?`,
        [data.status, targetId, academyId]
      );
      logger.logAudit('ASSIGNMENT_TARGET_STATUS', 'AssignmentTarget', targetId, userId, { status: data.status });
      return successResponse({ message: '상태가 변경되었습니다', status: data.status });
    }

    return errorResponse('Not found', 404);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return errorResponse(`입력 검증 오류: ${error.errors?.[0]?.message || 'invalid'}`, 400);
    }
    logger.error('assignments-handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse(error?.message || '처리 실패', 500);
  }
}
