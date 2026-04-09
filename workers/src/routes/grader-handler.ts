/**
 * 성적 및 시험 관리 라우트 핸들러
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeQuery, executeInsert, executeUpdate, executeDelete } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// ==================== 스키마 ====================
const CreateExamSchema = z.object({
  name: z.string().min(1, '시험명은 필수입니다'),
  exam_month: z.string().regex(/^\d{4}-\d{2}$/, '시험 월은 YYYY-MM 형식이어야 합니다'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '시험 날짜는 YYYY-MM-DD 형식이어야 합니다'),
  total_score: z.number().optional(),
  is_active: z.boolean().default(false),
});

const CreateGradeSchema = z.object({
  student_id: z.string().min(1, '학생 ID는 필수입니다'),
  exam_id: z.string().min(1, '시험 ID는 필수입니다'),
  score: z.number().min(0, '점수는 0 이상이어야 합니다'),
  comments: z.string().optional(),
});

type CreateExamInput = z.infer<typeof CreateExamSchema>;
type CreateGradeInput = z.infer<typeof CreateGradeSchema>;

// ==================== 헬퍼 함수 ====================

function generateId(prefix: string): string {
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid.split('-')[0]}`;
}

async function parseExamInput(request: Request): Promise<CreateExamInput> {
  try {
    const body = await request.json() as any;
    return CreateExamSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      throw new Error(`입력 검증 오류: ${message}`);
    }
    throw new Error('요청 처리 오류: 유효한 JSON이 필요합니다');
  }
}

async function parseGradeInput(request: Request): Promise<CreateGradeInput> {
  try {
    const body = await request.json() as any;
    return CreateGradeSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      throw new Error(`입력 검증 오류: ${message}`);
    }
    throw new Error('요청 처리 오류: 유효한 JSON이 필요합니다');
  }
}

// ==================== Exam 핸들러 ====================

/**
 * POST /api/grader/exams - 시험 생성
 */
async function handleCreateExam(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    if (!requireRole(context, 'instructor', 'admin')) {
      return errorResponse('강사 이상의 권한이 필요합니다', 403);
    }

    const input = await parseExamInput(request);

    logger.logRequest('POST', '/api/grader/exams', undefined, ipAddress);

    const examId = generateId('exam');
    const now = new Date().toISOString();

    // 기존 활성 시험이 있으면 비활성화
    if (input.is_active) {
      await executeUpdate(
        context.env.DB,
        'UPDATE exams SET is_active = 0 WHERE academy_id = ?',
        [context.auth?.academyId || 'acad-1']
      );
    }

    const result = await executeInsert(
      context.env.DB,
      `INSERT INTO exams (id, academy_id, class_id, name, exam_month, date, total_score, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        examId,
        context.auth?.academyId || 'acad-1',
        null, // class_id - can be null for academy-wide exams (after 005 migration)
        input.name,
        input.exam_month,
        input.date,
        input.total_score || null,
        input.is_active ? 1 : 0,
        now,
        now,
      ]
    );

    if (!result.success) {
      throw new Error('데이터베이스 삽입 실패');
    }

    return successResponse(
      {
        id: examId,
        name: input.name,
        exam_month: input.exam_month,
        date: input.date,
        total_score: input.total_score,
        is_active: input.is_active,
      },
      201
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증') || errorMessage.includes('요청 처리')) {
      logger.warn('시험 생성 검증 오류', { error: errorMessage, ipAddress });
      return errorResponse(errorMessage, 400);
    }

    logger.error('시험 생성 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('시험 생성에 실패했습니다', 500);
  }
}

/**
 * GET /api/grader/exams - 시험 목록 조회
 */
async function handleGetExams(context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const exams = await executeQuery<any>(
      context.env.DB,
      'SELECT * FROM exams WHERE academy_id = ? ORDER BY date DESC',
      [context.auth?.academyId || 'acad-1']
    );

    return successResponse(exams);
  } catch (error) {
    logger.error('시험 목록 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('시험 목록 조회에 실패했습니다', 500);
  }
}

/**
 * GET /api/grader/exams/current - 현재 활성 시험 조회
 */
async function handleGetCurrentExam(context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const exam = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM exams WHERE academy_id = ? AND is_active = 1 LIMIT 1',
      [context.auth?.academyId || 'acad-1']
    );

    if (!exam) {
      return errorResponse('활성 시험이 없습니다', 404);
    }

    return successResponse(exam);
  } catch (error) {
    logger.error('현재 시험 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('현재 시험 조회에 실패했습니다', 500);
  }
}

/**
 * PATCH /api/grader/exams/:id - 시험 수정
 */
async function handleUpdateExam(
  request: Request,
  context: RequestContext,
  examId: string
): Promise<Response> {
  try {
    if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
      return unauthorizedResponse();
    }

    const input = await parseExamInput(request);

    const exam = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM exams WHERE id = ? AND academy_id = ?',
      [examId, context.auth?.academyId || 'acad-1']
    );

    if (!exam) {
      return errorResponse('시험을 찾을 수 없습니다', 404);
    }

    // 활성화 상태 변경 시 다른 시험 비활성화
    if (input.is_active && !exam.is_active) {
      await executeUpdate(
        context.env.DB,
        'UPDATE exams SET is_active = 0 WHERE academy_id = ? AND id != ?',
        [context.auth?.academyId || 'acad-1', examId]
      );
    }

    const now = new Date().toISOString();
    const result = await executeUpdate(
      context.env.DB,
      `UPDATE exams
       SET name = ?, exam_month = ?, date = ?, total_score = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.name,
        input.exam_month,
        input.date,
        input.total_score || null,
        input.is_active ? 1 : 0,
        now,
        examId,
      ]
    );

    if (!result) {
      throw new Error('시험 수정 실패');
    }

    return successResponse({ id: examId, ...input });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증')) {
      return errorResponse(errorMessage, 400);
    }

    logger.error('시험 수정 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('시험 수정에 실패했습니다', 500);
  }
}

/**
 * DELETE /api/grader/exams/:id - 시험 삭제
 */
async function handleDeleteExam(
  context: RequestContext,
  examId: string
): Promise<Response> {
  try {
    if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
      return unauthorizedResponse();
    }

    const exam = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM exams WHERE id = ? AND academy_id = ?',
      [examId, context.auth?.academyId || 'acad-1']
    );

    if (!exam) {
      return errorResponse('시험을 찾을 수 없습니다', 404);
    }

    const result = await executeDelete(
      context.env.DB,
      'DELETE FROM exams WHERE id = ?',
      [examId]
    );

    if (!result) {
      throw new Error('시험 삭제 실패');
    }

    return successResponse({ id: examId, deleted: true });
  } catch (error) {
    logger.error('시험 삭제 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('시험 삭제에 실패했습니다', 500);
  }
}

// ==================== Grade 핸들러 ====================

/**
 * POST /api/grader/grades - 성적 저장 (설정된 exam_month에만 입력 가능)
 */
async function handleCreateGrade(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
      return unauthorizedResponse();
    }

    const input = await parseGradeInput(request);

    logger.logRequest('POST', '/api/grader/grades', undefined, ipAddress);

    // 시험 정보 조회
    const exam = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM exams WHERE id = ? AND academy_id = ?',
      [input.exam_id, context.auth?.academyId || 'acad-1']
    );

    if (!exam) {
      return errorResponse('시험을 찾을 수 없습니다', 404);
    }

    // 설정된 활성 시험 월 조회 (exam_settings 테이블)
    const examSettings = await executeFirst<any>(
      context.env.DB,
      'SELECT active_exam_month FROM exam_settings WHERE academy_id = ?',
      [context.auth?.academyId || 'acad-1']
    );

    // 활성 시험 월이 설정되어 있으면 그 월만 입력 가능
    if (examSettings && examSettings.active_exam_month) {
      if (exam.exam_month !== examSettings.active_exam_month) {
        return errorResponse(
          `설정된 시험 월(${examSettings.active_exam_month})이 아닙니다. 해당 월의 성적만 입력 가능합니다`,
          400
        );
      }
    }

    // 성적 저장
    const gradeId = generateId('grade');
    const now = new Date().toISOString();
    const year_month = exam.exam_month || new Date().toISOString().slice(0, 7);

    const result = await executeInsert(
      context.env.DB,
      `INSERT INTO grades (id, student_id, exam_id, score, comments, year_month, graded_at, graded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gradeId,
        input.student_id,
        input.exam_id,
        input.score,
        input.comments || null,
        year_month,
        now,
        context.auth?.userId || 'unknown',
        now,
      ]
    );

    if (!result.success) {
      throw new Error('성적 저장 실패');
    }

    return successResponse(
      {
        id: gradeId,
        student_id: input.student_id,
        exam_id: input.exam_id,
        score: input.score,
        year_month,
      },
      201
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증')) {
      return errorResponse(errorMessage, 400);
    }

    logger.error('성적 저장 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('성적 저장에 실패했습니다', 500);
  }
}

// ==================== 메인 핸들러 ====================

export async function handleGrader(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/grader/exams/current (먼저 확인하기 - 더 구체적)
    if (pathname === '/api/grader/exams/current' && method === 'GET') {
      return await handleGetCurrentExam(context);
    }

    // /api/grader/exams
    if (pathname === '/api/grader/exams') {
      if (method === 'POST') return await handleCreateExam(request, context);
      if (method === 'GET') return await handleGetExams(context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/grader/exams/:id
    const examIdMatch = pathname.match(/^\/api\/grader\/exams\/([^/]+)$/);
    if (examIdMatch) {
      const examId = examIdMatch[1];
      if (method === 'PATCH') return await handleUpdateExam(request, context, examId);
      if (method === 'DELETE') return await handleDeleteExam(context, examId);
      return errorResponse('Method not allowed', 405);
    }

    // /api/grader/grades
    if (pathname === '/api/grader/grades') {
      if (method === 'POST') return await handleCreateGrade(request, context);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Grader handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('Internal server error', 500);
  }
}
