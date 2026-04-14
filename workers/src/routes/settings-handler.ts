/**
 * 설정 라우트 핸들러
 * 시험 월 설정 등 학원 전체 설정 관리
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { getAcademyId } from '@/utils/context';
import { handleRouteError } from '@/utils/error-handler';
import { generatePrefixedId } from '@/utils/id';
import { z } from 'zod';

// ==================== 과목별 exam 자동 생성 ====================
/**
 * 학원에서 수강 중인 모든 과목에 대해 해당 기간의 exam 레코드를 보장.
 * 이미 존재하는 과목은 건너뛴다 (멱등).
 */
async function ensureExamsForAllSubjects(
  db: D1Database,
  academyId: string,
  params:
    | { type: 'monthly'; yearMonth: string }
    | { type: 'midterm' | 'final'; term: string }
): Promise<void> {
  // 1) 학원 수강 과목 union — students.subjects (JSON) 파싱
  const studentRows = await db.prepare(
    `SELECT subjects FROM students WHERE academy_id = ? AND status = 'active'`
  ).bind(academyId).all<{ subjects: string | null }>();
  const subjectSet = new Set<string>();
  for (const row of studentRows.results || []) {
    try {
      const arr = row.subjects ? JSON.parse(row.subjects) : [];
      if (Array.isArray(arr)) {
        for (const s of arr) {
          if (typeof s === 'string' && s.length > 0) subjectSet.add(s);
        }
      }
    } catch { /* skip malformed */ }
  }
  const subjects = [...subjectSet];

  if (subjects.length === 0) return;

  // 2) 기존 exam 조회
  const existingRes = params.type === 'monthly'
    ? await db.prepare(
        `SELECT name FROM exams
         WHERE academy_id = ? AND exam_month = ?
           AND (exam_type IS NULL OR exam_type = 'monthly')`
      ).bind(academyId, params.yearMonth).all<{ name: string }>()
    : await db.prepare(
        `SELECT name FROM exams
         WHERE academy_id = ? AND exam_type = ? AND term = ?`
      ).bind(academyId, params.type, params.term).all<{ name: string }>();

  const extractSubject = (n: string | null): string | null => {
    if (!n) return null;
    const m = n.match(/\(([^)]+)\)\s*$/);
    if (m) return m[1];
    const parts = n.split(' - ');
    if (parts.length > 1) return parts[parts.length - 1].trim();
    return null;
  };
  const existing = new Set(
    (existingRes.results || []).map((r) => extractSubject(r.name)).filter((s): s is string => !!s)
  );

  // 3) 누락 과목만 INSERT
  const now = new Date().toISOString();
  for (const subject of subjects) {
    if (existing.has(subject)) continue;
    const id = generatePrefixedId('exam');

    if (params.type === 'monthly') {
      const [y, m] = params.yearMonth.split('-');
      const name = `${y}년 ${parseInt(m, 10)}월 월말평가 - ${subject}`;
      await db.prepare(
        `INSERT INTO exams (id, academy_id, class_id, name, exam_month, date, total_score, is_active, exam_type, term, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, 100, 0, 'monthly', NULL, ?, ?)`
      ).bind(id, academyId, name, params.yearMonth, `${params.yearMonth}-15`, now, now).run();
    } else {
      const typeLabel = params.type === 'midterm' ? '중간고사' : '기말고사';
      const name = `${params.term} ${typeLabel} - ${subject}`;
      const [y, sem] = params.term.split('-');
      const monthGuess = params.type === 'midterm'
        ? (sem === '1' ? '04' : '10')
        : (sem === '1' ? '06' : '12');
      const examMonth = `${y}-${monthGuess}`;
      await db.prepare(
        `INSERT INTO exams (id, academy_id, class_id, name, exam_month, date, total_score, is_active, exam_type, term, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, 100, 0, ?, ?, ?, ?)`
      ).bind(id, academyId, name, examMonth, `${examMonth}-15`, params.type, params.term, now, now).run();
    }
  }
}

// ==================== 스키마 ====================
const SetActiveExamMonthSchema = z.object({
  activeExamMonth: z.string().regex(/^\d{4}-\d{2}$/, '시험 월은 YYYY-MM 형식이어야 합니다'),
});

type SetActiveExamMonthInput = z.infer<typeof SetActiveExamMonthSchema>;

const SetActiveExamReviewSchema = z.object({
  activeTerm: z.string().regex(/^\d{4}-\d$/, '학기는 YYYY-N 형식이어야 합니다'),
  activeExamType: z.enum(['midterm', 'final'], {
    errorMap: () => ({ message: 'activeExamType은 midterm|final 중 하나여야 합니다' }),
  }),
});

type SetActiveExamReviewInput = z.infer<typeof SetActiveExamReviewSchema>;

// ==================== 헬퍼 함수 ====================

async function parseSetActiveExamMonthInput(request: Request): Promise<SetActiveExamMonthInput> {
  try {
    const body = await request.json() as any;
    return SetActiveExamMonthSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      throw new Error(`입력 검증 오류: ${message}`);
    }
    throw new Error('요청 처리 오류: 유효한 JSON이 필요합니다');
  }
}

async function parseSetActiveExamReviewInput(request: Request): Promise<SetActiveExamReviewInput> {
  try {
    const body = await request.json() as any;
    return SetActiveExamReviewSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      throw new Error(`입력 검증 오류: ${message}`);
    }
    throw new Error('요청 처리 오류: 유효한 JSON이 필요합니다');
  }
}

// ==================== Exam Settings 핸들러 ====================

/**
 * GET /api/settings/active-exam-month - 활성 시험 월 조회
 */
async function handleGetActiveExamMonth(context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const setting = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM exam_settings WHERE academy_id = ?',
      [getAcademyId(context)]
    );

    if (!setting) {
      return errorResponse('아직 시험 월이 설정되지 않았습니다', 404);
    }

    return successResponse({
      academyId: setting.academy_id,
      activeExamMonth: setting.active_exam_month,
      updatedBy: setting.updated_by,
      updatedAt: setting.updated_at,
    });
  } catch (error) {
    logger.error('시험 월 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('시험 월 조회에 실패했습니다', 500);
  }
}

/**
 * POST /api/settings/active-exam-month - 활성 시험 월 설정
 */
async function handleSetActiveExamMonth(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // 관리자 권한 확인
    if (!requireAuth(context) || !requireRole(context, 'admin')) {
      return unauthorizedResponse();
    }

    const input = await parseSetActiveExamMonthInput(request);

    logger.logRequest('POST', '/api/settings/active-exam-month', undefined, ipAddress);

    const now = new Date().toISOString();
    const academyId = getAcademyId(context);

    // 기존 설정 확인
    const existing = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM exam_settings WHERE academy_id = ?',
      [academyId]
    );

    if (existing) {
      // 기존 설정 업데이트
      const result = await executeUpdate(
        context.env.DB,
        `UPDATE exam_settings
         SET active_exam_month = ?, updated_by = ?, updated_at = ?
         WHERE academy_id = ?`,
        [
          input.activeExamMonth,
          context.auth?.userId || 'unknown',
          now,
          academyId,
        ]
      );

      if (!result) {
        throw new Error('시험 월 업데이트 실패');
      }

      await ensureExamsForAllSubjects(context.env.DB, academyId, { type: 'monthly', yearMonth: input.activeExamMonth });

      return successResponse(
        {
          academyId,
          activeExamMonth: input.activeExamMonth,
          updatedBy: context.auth?.userId || 'unknown',
          updatedAt: now,
        },
        200
      );
    } else {
      // 신규 설정 생성
      const settingId = generatePrefixedId('setting');

      const result = await executeInsert(
        context.env.DB,
        `INSERT INTO exam_settings (id, academy_id, active_exam_month, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          settingId,
          academyId,
          input.activeExamMonth,
          context.auth?.userId || 'unknown',
          now,
          now,
        ]
      );

      if (!result.success) {
        throw new Error('시험 월 저장 실패');
      }

      await ensureExamsForAllSubjects(context.env.DB, academyId, { type: 'monthly', yearMonth: input.activeExamMonth });

      return successResponse(
        {
          academyId,
          activeExamMonth: input.activeExamMonth,
          updatedBy: context.auth?.userId || 'unknown',
          updatedAt: now,
        },
        201
      );
    }
  } catch (error) {
    return handleRouteError(error, '시험 월 설정', { ipAddress });
  }
}

// ==================== Exam Review Settings 핸들러 (정기고사) ====================

/**
 * GET /api/settings/active-exam-review - 활성 정기고사 (학기 + 유형) 조회
 */
async function handleGetActiveExamReview(context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const setting = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM exam_review_settings WHERE academy_id = ?',
      [getAcademyId(context)]
    );

    if (!setting) {
      return errorResponse('아직 활성 정기고사가 설정되지 않았습니다', 404);
    }

    return successResponse({
      academyId: setting.academy_id,
      activeTerm: setting.active_term,
      activeExamType: setting.active_exam_type,
      updatedBy: setting.updated_by,
      updatedAt: setting.updated_at,
    });
  } catch (error) {
    logger.error('활성 정기고사 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('활성 정기고사 조회에 실패했습니다', 500);
  }
}

/**
 * POST /api/settings/active-exam-review - 활성 정기고사 설정
 */
async function handleSetActiveExamReview(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    if (!requireAuth(context) || !requireRole(context, 'admin')) {
      return unauthorizedResponse();
    }

    const input = await parseSetActiveExamReviewInput(request);

    logger.logRequest('POST', '/api/settings/active-exam-review', undefined, ipAddress);

    const now = new Date().toISOString();
    const academyId = getAcademyId(context);

    const existing = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM exam_review_settings WHERE academy_id = ?',
      [academyId]
    );

    if (existing) {
      const result = await executeUpdate(
        context.env.DB,
        `UPDATE exam_review_settings
         SET active_term = ?, active_exam_type = ?, updated_by = ?, updated_at = ?
         WHERE academy_id = ?`,
        [
          input.activeTerm,
          input.activeExamType,
          context.auth?.userId || 'unknown',
          now,
          academyId,
        ]
      );

      if (!result) {
        throw new Error('활성 정기고사 업데이트 실패');
      }

      await ensureExamsForAllSubjects(context.env.DB, academyId, { type: input.activeExamType, term: input.activeTerm });

      return successResponse({
        academyId,
        activeTerm: input.activeTerm,
        activeExamType: input.activeExamType,
        updatedBy: context.auth?.userId || 'unknown',
        updatedAt: now,
      });
    } else {
      const settingId = generatePrefixedId('review-setting');

      const result = await executeInsert(
        context.env.DB,
        `INSERT INTO exam_review_settings (id, academy_id, active_term, active_exam_type, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          settingId,
          academyId,
          input.activeTerm,
          input.activeExamType,
          context.auth?.userId || 'unknown',
          now,
          now,
        ]
      );

      if (!result.success) {
        throw new Error('활성 정기고사 저장 실패');
      }

      await ensureExamsForAllSubjects(context.env.DB, academyId, { type: input.activeExamType, term: input.activeTerm });

      return successResponse(
        {
          academyId,
          activeTerm: input.activeTerm,
          activeExamType: input.activeExamType,
          updatedBy: context.auth?.userId || 'unknown',
          updatedAt: now,
        },
        201
      );
    }
  } catch (error) {
    return handleRouteError(error, '활성 정기고사 설정', { ipAddress });
  }
}

// ==================== 메인 핸들러 ====================

export async function handleSettings(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/settings/active-exam-month
    if (pathname === '/api/settings/active-exam-month') {
      if (method === 'GET') return await handleGetActiveExamMonth(context);
      if (method === 'POST') return await handleSetActiveExamMonth(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/settings/active-exam-review
    if (pathname === '/api/settings/active-exam-review') {
      if (method === 'GET') return await handleGetActiveExamReview(context);
      if (method === 'POST') return await handleSetActiveExamReview(request, context);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Settings handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('Internal server error', 500);
  }
}
