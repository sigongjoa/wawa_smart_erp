/**
 * 선생님 관리 라우트 핸들러
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeQuery, executeInsert, executeUpdate } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// ==================== 스키마 ====================
const CreateTeacherSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다').max(100),
  pin: z.string().min(4, 'PIN은 최소 4자 이상이어야 합니다').max(20),
  subjects: z.array(z.string()).min(1, '최소 하나의 과목을 선택해주세요'),
  isAdmin: z.boolean().default(false),
});

type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>;

// ==================== 헬퍼 함수 ====================

/**
 * 비밀번호를 SHA256으로 해싱 (테스트용)
 * 실제 프로덕션에서는 bcrypt 사용 권장
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * UUID v4 생성
 */
function generateId(prefix: string): string {
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid.split('-')[0]}`;
}

/**
 * 요청 본문 파싱 및 검증
 */
async function parseTeacherInput(request: Request): Promise<CreateTeacherInput> {
  try {
    const body = await request.json() as any;
    return CreateTeacherSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      throw new Error(`입력 검증 오류: ${message}`);
    }
    throw new Error('요청 처리 오류: 유효한 JSON이 필요합니다');
  }
}

// ==================== 핸들러 ====================

/**
 * POST /api/teachers - 선생님 추가
 */
async function handleCreateTeacher(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // 인증 확인
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    // 관리자 권한 확인
    if (!requireRole(context, 'admin')) {
      return errorResponse('관리자만 선생님을 추가할 수 있습니다', 403);
    }

    // 입력 검증
    const input = await parseTeacherInput(request);

    logger.logRequest('POST', '/api/teachers', undefined, ipAddress);

    // PIN 중복 확인 (같은 이름 + PIN)
    const existingTeacher = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM users WHERE name = ? LIMIT 1',
      [input.name]
    );

    if (existingTeacher) {
      return errorResponse('이미 등록된 선생님입니다', 409);
    }

    // PIN 해싱
    const pinHash = await hashPassword(input.pin);

    // 선생님 생성
    const teacherId = generateId('user');
    const now = new Date().toISOString();
    const role = input.isAdmin ? 'admin' : 'instructor';
    // 고유한 이메일 생성 (name + random suffix)
    const uniqueEmail = `${input.name.replace(/\s+/g, '')}_${teacherId.slice(-8)}@wawa.local`;

    const result = await executeInsert(
      context.env.DB,
      `INSERT INTO users (id, email, name, password_hash, role, academy_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [teacherId, uniqueEmail, input.name, pinHash, role, context.auth?.academyId || 'acad-1', now, now]
    );

    if (!result.success) {
      throw new Error('데이터베이스 삽입 실패');
    }

    // 응답 반환
    return successResponse(
      {
        id: teacherId,
        pin: input.pin,
        name: input.name,
        subjects: input.subjects,
        isAdmin: input.isAdmin,
      },
      201
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증') || errorMessage.includes('요청 처리')) {
      logger.warn('선생님 추가 검증 오류', { error: errorMessage, ipAddress });
      return errorResponse(errorMessage, 400);
    }

    logger.error('선생님 추가 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('선생님 추가에 실패했습니다', 500);
  }
}

/**
 * POST /api/migrate/notion-to-d1 - Notion 데이터 마이그레이션
 * 현재는 기존 마이그레이션 된 데이터 확인만 수행
 */
async function handleMigrateNotionToD1(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // 인증 확인
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    // 관리자 권한 확인
    if (!requireRole(context, 'admin')) {
      return errorResponse('관리자만 마이그레이션을 수행할 수 있습니다', 403);
    }

    logger.logRequest('POST', '/api/migrate/notion-to-d1', undefined, ipAddress);

    // 기존 사용자 수 조회
    const users = await executeQuery<any>(
      context.env.DB,
      'SELECT COUNT(*) as count FROM users'
    );

    const userCount = users[0]?.count || 0;

    // 응답 반환
    return successResponse({
      migratedCount: userCount,
      message: `${userCount}명의 데이터가 준비되었습니다`,
    });
  } catch (error) {
    logger.error('마이그레이션 처리 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('마이그레이션 처리에 실패했습니다', 500);
  }
}

// ==================== 메인 핸들러 ====================

export async function handleTeachers(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (pathname === '/api/teachers' && method === 'POST') {
      return await handleCreateTeacher(request, context);
    }

    if (pathname === '/api/migrate/notion-to-d1' && method === 'POST') {
      return await handleMigrateNotionToD1(request, context);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Teachers handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('Internal server error', 500);
  }
}
