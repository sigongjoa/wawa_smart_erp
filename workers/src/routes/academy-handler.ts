/**
 * 학원 관리 + 선생님 초대 라우트 핸들러
 */

import { RequestContext } from '@/types';
import { executeFirst, executeQuery, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';
import { invalidateTenantCache } from '@/middleware/tenant';
import { getAcademyId } from '@/utils/context';
import { logger } from '@/utils/logger';
import { hashPin } from '@/utils/crypto';
import { parsePagination, toPagedResult } from '@/utils/pagination';
import { inviteAcceptRateLimit } from '@/middleware/rateLimit';
import { z } from 'zod';

// ==================== 스키마 ====================

const UpdateAcademySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  logo_url: z.string().url().optional().nullable(),
});

const InviteSchema = z.object({
  role: z.enum(['instructor', 'admin']).default('instructor'),
  expiresInDays: z.number().min(1).max(30).default(7),
});

const AcceptInviteSchema = z.object({
  code: z.string().min(6).max(6),
  name: z.string().min(1, '이름은 필수입니다').max(50),
  pin: z.string().min(4, 'PIN은 최소 4자 이상이어야 합니다').max(20),
});

/** 6자리 영문+숫자 초대 코드 생성 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외 (0,O,1,I)
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function handleAcademy(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // ── 학원 정보 조회/수정 (인증 필요) ──

    // GET /api/academy — 학원 정보 조회
    if (method === 'GET' && pathname === '/api/academy') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const academyId = getAcademyId(context);
      const academy = await executeFirst<any>(
        context.env.DB,
        'SELECT id, name, slug, phone, address, plan, max_students, max_teachers, logo_url, created_at FROM academies WHERE id = ?',
        [academyId]
      );

      if (!academy) return errorResponse('학원을 찾을 수 없습니다', 404);

      return successResponse(academy);
    }

    // PUT /api/academy — 학원 정보 수정 (admin만)
    if (method === 'PUT' && pathname === '/api/academy') {
      if (!requireAuth(context) || !requireRole(context, 'admin')) {
        return unauthorizedResponse();
      }

      const body = await request.json() as any;
      const input = UpdateAcademySchema.parse(body);
      const academyId = getAcademyId(context);

      const fields: string[] = [];
      const values: any[] = [];

      if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
      if (input.phone !== undefined) { fields.push('phone = ?'); values.push(input.phone); }
      if (input.address !== undefined) { fields.push('address = ?'); values.push(input.address); }
      if (input.logo_url !== undefined) { fields.push('logo_url = ?'); values.push(input.logo_url); }

      if (fields.length === 0) return errorResponse('수정할 필드가 없습니다', 400);

      fields.push("updated_at = datetime('now')");
      values.push(academyId);

      await executeUpdate(
        context.env.DB,
        `UPDATE academies SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      // 캐시 무효화 (in-memory + KV)
      invalidateTenantCache(academyId);
      try {
        await context.env.KV.delete(`academy:${academyId}:info`);
      } catch (err) {
        logger.warn('academy KV 무효화 실패', { academyId, error: err instanceof Error ? err.message : String(err) });
      }

      return successResponse({ message: '학원 정보가 수정되었습니다' });
    }

    // GET /api/academy/usage — 사용량 조회
    if (method === 'GET' && pathname === '/api/academy/usage') {
      if (!requireAuth(context)) return unauthorizedResponse();

      const academyId = getAcademyId(context);

      const [studentCount, teacherCount, academy] = await Promise.all([
        executeFirst<{ count: number }>(
          context.env.DB,
          "SELECT COUNT(*) as count FROM students WHERE academy_id = ? AND status = 'active'",
          [academyId]
        ),
        executeFirst<{ count: number }>(
          context.env.DB,
          "SELECT COUNT(*) as count FROM users WHERE academy_id = ? AND role IN ('instructor', 'admin')",
          [academyId]
        ),
        executeFirst<{ plan: string; max_students: number; max_teachers: number }>(
          context.env.DB,
          'SELECT plan, max_students, max_teachers FROM academies WHERE id = ?',
          [academyId]
        ),
      ]);

      return successResponse({
        students: { current: studentCount?.count || 0, max: academy?.max_students || 30 },
        teachers: { current: teacherCount?.count || 0, max: academy?.max_teachers || 3 },
        plan: academy?.plan || 'free',
      });
    }

    // ── 초대 관리 (admin만) ──

    // POST /api/academy/invite — 초대 코드 생성
    if (method === 'POST' && pathname === '/api/academy/invite') {
      if (!requireAuth(context) || !requireRole(context, 'admin')) {
        return unauthorizedResponse();
      }

      const body = await request.json() as any;
      const input = InviteSchema.parse(body);
      const academyId = getAcademyId(context);

      // 선생님 수 제한 체크
      const academy = await executeFirst<{ max_teachers: number }>(
        context.env.DB,
        'SELECT max_teachers FROM academies WHERE id = ?',
        [academyId]
      );
      const teacherCount = await executeFirst<{ count: number }>(
        context.env.DB,
        "SELECT COUNT(*) as count FROM users WHERE academy_id = ? AND role IN ('instructor', 'admin')",
        [academyId]
      );

      if (academy && teacherCount && teacherCount.count >= academy.max_teachers) {
        return errorResponse(
          `현재 요금제의 선생님 수 제한(${academy.max_teachers}명)에 도달했습니다`,
          403
        );
      }

      // 코드 생성 — INSERT OR IGNORE로 unique 충돌 시 자동 재시도 (TOCTOU 제거 — SEC-H3)
      const inviteId = `inv-${crypto.randomUUID().slice(0, 8)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);
      const expiresIso = expiresAt.toISOString();

      let code = '';
      let inserted = false;
      for (let i = 0; i < 8; i++) {
        const candidate = generateInviteCode();
        const result = await context.env.DB
          .prepare(
            `INSERT OR IGNORE INTO invitations (id, academy_id, code, role, created_by, expires_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(inviteId, academyId, candidate, input.role, context.auth!.userId, expiresIso)
          .run();
        if (result.success && (result.meta?.changes ?? 0) > 0) {
          code = candidate;
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        return errorResponse('초대 코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.', 503);
      }

      return successResponse({
        code,
        role: input.role,
        expiresAt: expiresAt.toISOString(),
        message: `초대 코드: ${code} (${input.expiresInDays}일간 유효)`,
      }, 201);
    }

    // GET /api/academy/invites — 초대 목록 조회 (?limit,offset)
    if (method === 'GET' && pathname === '/api/academy/invites') {
      if (!requireAuth(context) || !requireRole(context, 'admin')) {
        return unauthorizedResponse();
      }

      const academyId = getAcademyId(context);
      const pg = parsePagination(new URL(request.url), { defaultLimit: 50, maxLimit: 200 });

      const invites = await executeQuery<any>(
        context.env.DB,
        `SELECT i.*, u.name as created_by_name
         FROM invitations i
         LEFT JOIN users u ON i.created_by = u.id
         WHERE i.academy_id = ?
         ORDER BY i.created_at DESC
         LIMIT ? OFFSET ?`,
        [academyId, pg.limit, pg.offset]
      );

      const totalRow = await executeFirst<{ count: number }>(
        context.env.DB,
        'SELECT COUNT(*) as count FROM invitations WHERE academy_id = ?',
        [academyId]
      );

      return successResponse(toPagedResult(invites, pg, totalRow?.count));
    }

    // DELETE /api/academy/invites/:id — 대기 중인 초대 취소 (used_by가 비어있어야 함)
    const cancelMatch = pathname.match(/^\/api\/academy\/invites\/([^/]+)$/);
    if (cancelMatch && method === 'DELETE') {
      if (!requireAuth(context) || !requireRole(context, 'admin')) {
        return unauthorizedResponse();
      }
      const inviteId = cancelMatch[1];
      const academyId = getAcademyId(context);

      const invite = await executeFirst<any>(
        context.env.DB,
        `SELECT id, used_by FROM invitations WHERE id = ? AND academy_id = ?`,
        [inviteId, academyId]
      );
      if (!invite) return errorResponse('초대를 찾을 수 없습니다', 404);
      if (invite.used_by) return errorResponse('이미 사용된 초대는 취소할 수 없습니다', 400);

      await executeUpdate(
        context.env.DB,
        `UPDATE invitations SET expires_at = datetime('now', '-1 day') WHERE id = ?`,
        [inviteId]
      );
      return successResponse({ message: '초대가 취소되었습니다' });
    }

    // ── 초대 수락 (공개) ──

    // POST /api/invite/accept — 초대 코드로 선생님 계정 생성
    if (method === 'POST' && pathname === '/api/invite/accept') {
      // 코드 무차별 대입 방어 (SEC-H1)
      const blocked = await inviteAcceptRateLimit(context.env.KV, request);
      if (blocked) return blocked;

      const body = await request.json() as any;
      const input = AcceptInviteSchema.parse(body);

      // 초대 코드 조회
      const invite = await executeFirst<any>(
        context.env.DB,
        `SELECT * FROM invitations
         WHERE code = ? AND used_by IS NULL AND expires_at > datetime('now')`,
        [input.code]
      );

      if (!invite) {
        return errorResponse('유효하지 않거나 만료된 초대 코드입니다', 400);
      }

      // 같은 학원에 같은 이름이 이미 있는지 확인 — 응답 메시지는 일반화하여 열거 방지
      const existing = await executeFirst<{ id: string }>(
        context.env.DB,
        'SELECT id FROM users WHERE name = ? AND academy_id = ?',
        [input.name, invite.academy_id]
      );

      if (existing) {
        return errorResponse('계정 생성에 실패했습니다. 관리자에게 문의해주세요.', 409);
      }

      // 계정 생성 — 이메일은 userId 기반 (SEC-H2: 이름·테넌트 충돌·열거 방지)
      const userId = `user-${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      const hashedPin = await hashPin(input.pin);

      // 학원 메타 (응답용)
      const academy = await executeFirst<{ slug: string; name: string }>(
        context.env.DB,
        'SELECT slug, name FROM academies WHERE id = ?',
        [invite.academy_id]
      );
      const uniqueEmail = `${userId}@wawa.app`;

      await executeInsert(
        context.env.DB,
        `INSERT INTO users (id, email, name, password_hash, role, academy_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, uniqueEmail, input.name, hashedPin, invite.role, invite.academy_id, now, now]
      );

      // 초대 코드 사용 처리
      await executeUpdate(
        context.env.DB,
        'UPDATE invitations SET used_by = ? WHERE id = ?',
        [userId, invite.id]
      );

      logger.info(`초대 수락: ${input.name} → ${academy?.name} (${invite.role})`);

      return successResponse({
        userId,
        academyName: academy?.name,
        academySlug: academy?.slug,
        role: invite.role,
        message: '계정이 생성되었습니다. 로그인 페이지에서 학원코드와 이름, PIN으로 로그인하세요.',
      }, 201);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      return errorResponse(`입력 검증 오류: ${message}`, 400);
    }

    logger.error('학원 관리 처리 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('요청 처리 실패', 500);
  }
}
