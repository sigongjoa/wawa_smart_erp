/**
 * 학부모 공개 — 이미지 숙제 조회 & 파일 프록시
 *
 *  GET /api/parent-homework/:targetId?token=        → 과제 + 제출 + 피드백
 *  GET /api/parent-homework/:targetId/file/:key?token= → R2 객체 (target 소속 파일만)
 *
 * 공통: 토큰 검증 (type='homework'), JWT 불필요.
 */

import { RequestContext } from '@/types';
import { executeFirst, executeQuery } from '@/utils/db';
import { errorResponse, successResponse, notFoundResponse } from '@/utils/response';
import { verifyShareToken, resolveShareSecret } from '@/utils/share-token';

function mapVerifyError(reason: string): { status: number; message: string } {
  if (reason === 'expired') return { status: 410, message: '링크가 만료되었습니다' };
  return { status: 401, message: '유효하지 않은 링크입니다' };
}

async function loadTarget(db: D1Database, targetId: string) {
  return executeFirst<any>(
    db,
    `SELECT t.id, t.assignment_id, t.student_id, t.academy_id, t.status,
            t.last_submitted_at, t.last_reviewed_at, t.assigned_at,
            a.title as assignment_title, a.instructions, a.due_at,
            a.attached_file_key, a.attached_file_name, a.status as assignment_status,
            gs.name as student_name, gs.grade as student_grade
     FROM assignment_targets t
     JOIN assignments a ON a.id = t.assignment_id
     LEFT JOIN gacha_students gs ON gs.id = t.student_id
     WHERE t.id = ?`,
    [targetId]
  );
}

export async function handleParentHomework(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (method !== 'GET') return errorResponse('Method not allowed', 405);

  const secret = resolveShareSecret(context.env as any);
  if (!secret) return errorResponse('서버 설정 오류: 공유 링크 비밀키가 없습니다', 500);

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return errorResponse('token이 필요합니다', 400);

  const fileMatch = pathname.match(/^\/api\/parent-homework\/([^/]+)\/file\/(.+)$/);
  const detailMatch = pathname.match(/^\/api\/parent-homework\/([^/]+)$/);

  // ─── 파일 프록시 ───
  if (fileMatch) {
    const targetId = fileMatch[1];
    const rawKey = decodeURIComponent(fileMatch[2]);

    const verify = await verifyShareToken(token, targetId, 'homework', secret);
    if (!verify.ok) {
      const err = mapVerifyError(verify.reason);
      return errorResponse(err.message, err.status);
    }

    const target = await loadTarget(context.env.DB, targetId);
    if (!target) return notFoundResponse();
    if (target.assignment_status === 'closed') {
      return errorResponse('이 과제 공유 링크는 더 이상 사용할 수 없습니다', 410);
    }

    // R2 키 형식 검증 + 학원 범위 매칭
    if (!/^assignments\/[A-Za-z0-9\-_/.]+$/.test(rawKey) || rawKey.includes('..')) {
      return errorResponse('유효하지 않은 파일 경로', 400);
    }
    if (!rawKey.includes(`/${target.academy_id}/`)) {
      return errorResponse('권한이 없습니다', 403);
    }

    // 키가 해당 target 의 submission.files 또는 response.file_key 에 속해야 함
    const allowedKeys = new Set<string>();
    if (target.attached_file_key) allowedKeys.add(target.attached_file_key);

    const subs = await executeQuery<{ files: string | null }>(
      context.env.DB,
      `SELECT files FROM assignment_submissions WHERE target_id = ?`,
      [targetId]
    );
    for (const s of subs) {
      try {
        const arr = JSON.parse(s.files || '[]');
        if (Array.isArray(arr)) {
          for (const f of arr) {
            if (f && typeof f.key === 'string') allowedKeys.add(f.key);
          }
        }
      } catch { /* ignore */ }
    }

    const resps = await executeQuery<{ file_key: string | null }>(
      context.env.DB,
      `SELECT file_key FROM assignment_responses WHERE target_id = ? AND file_key IS NOT NULL`,
      [targetId]
    );
    for (const r of resps) {
      if (r.file_key) allowedKeys.add(r.file_key);
    }

    if (!allowedKeys.has(rawKey)) {
      return errorResponse('이 파일은 이 링크로 조회할 수 없습니다', 403);
    }

    const obj = await context.env.BUCKET.get(rawKey);
    if (!obj) return notFoundResponse();
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${rawKey.split('/').pop()}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  }

  // ─── 상세 조회 ───
  if (detailMatch) {
    const targetId = detailMatch[1];
    const verify = await verifyShareToken(token, targetId, 'homework', secret);
    if (!verify.ok) {
      const err = mapVerifyError(verify.reason);
      return errorResponse(err.message, err.status);
    }

    const target = await loadTarget(context.env.DB, targetId);
    if (!target) return notFoundResponse();
    if (target.assignment_status === 'closed') {
      return errorResponse('이 과제 공유 링크는 더 이상 사용할 수 없습니다', 410);
    }

    const submissions = await executeQuery<any>(
      context.env.DB,
      `SELECT id, submitted_at, note, files
       FROM assignment_submissions
       WHERE target_id = ?
       ORDER BY submitted_at DESC`,
      [targetId]
    );
    const responses = await executeQuery<any>(
      context.env.DB,
      `SELECT r.id, r.comment, r.file_key, r.file_name, r.action, r.created_at,
              u.name as teacher_name
       FROM assignment_responses r
       LEFT JOIN users u ON u.id = r.teacher_id
       WHERE r.target_id = ?
       ORDER BY r.created_at DESC`,
      [targetId]
    );

    const parsedSubs = submissions.map((s) => ({
      id: s.id,
      submitted_at: s.submitted_at,
      note: s.note,
      files: (() => { try { return JSON.parse(s.files || '[]'); } catch { return []; } })(),
    }));

    return successResponse({
      student: {
        name: target.student_name,
        grade: target.student_grade,
      },
      assignment: {
        title: target.assignment_title,
        instructions: target.instructions,
        due_at: target.due_at,
        attached_file_key: target.attached_file_key,
        attached_file_name: target.attached_file_name,
      },
      target: {
        id: target.id,
        status: target.status,
        assigned_at: target.assigned_at,
        last_submitted_at: target.last_submitted_at,
        last_reviewed_at: target.last_reviewed_at,
      },
      submissions: parsedSubs,
      responses,
    });
  }

  return errorResponse('Not found', 404);
}
