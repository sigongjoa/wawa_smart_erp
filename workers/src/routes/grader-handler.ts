/**
 * 성적 및 시험 관리 라우트 핸들러
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeQuery, executeInsert, executeUpdate, executeDelete } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { getAcademyId } from '@/utils/context';
import { handleRouteError } from '@/utils/error-handler';
import { generatePrefixedId } from '@/utils/id';
import { z } from 'zod';

// SEC-EXAM-M3: 텍스트 위생화 — C0/C1 제어문자 제거 + trim
function sanitizeText(v: any): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}
function sanitizeNullable(v: any): string | null {
  const cleaned = sanitizeText(v);
  return cleaned === '' ? null : cleaned;
}

// ==================== 스키마 ====================
// SEC-EXAM-M4: 길이 캡 + L2: score 상한
const MAX_NAME_LEN = 200;
const MAX_COMMENTS_LEN = 2000;
const MAX_SCORE = 1000;

const CreateExamSchema = z.object({
  name: z.string().min(1, '시험명은 필수입니다').max(MAX_NAME_LEN, `시험명은 ${MAX_NAME_LEN}자 이내`),
  exam_month: z.string().regex(/^\d{4}-\d{2}$/, '시험 월은 YYYY-MM 형식이어야 합니다'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '시험 날짜는 YYYY-MM-DD 형식이어야 합니다'),
  total_score: z.number().min(0).max(MAX_SCORE).optional(),
  is_active: z.boolean().default(false),
  // 리포트 유형 — 'monthly'(기본) / 'midterm' / 'final'
  exam_type: z.enum(['monthly', 'midterm', 'final']).default('monthly'),
  // 정기고사 학기 — 'YYYY-N' (midterm/final 일 때만 필수)
  term: z.string().regex(/^\d{4}-\d$/, '학기는 YYYY-N 형식이어야 합니다').optional(),
}).refine(
  (data) => data.exam_type === 'monthly' || !!data.term,
  { message: '정기고사(midterm/final)는 term이 필수입니다', path: ['term'] },
);

const CreateGradeSchema = z.object({
  student_id: z.string().min(1, '학생 ID는 필수입니다').max(64),
  exam_id: z.string().min(1, '시험 ID는 필수입니다').max(64),
  score: z.number().min(0, '점수는 0 이상이어야 합니다').max(MAX_SCORE, `점수는 ${MAX_SCORE} 이하`),
  comments: z.string().max(MAX_COMMENTS_LEN, `코멘트는 ${MAX_COMMENTS_LEN}자 이내`).optional(),
});

type CreateExamInput = z.infer<typeof CreateExamSchema>;
type CreateGradeInput = z.infer<typeof CreateGradeSchema>;

// ==================== 헬퍼 함수 ====================

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

    // SEC-EXAM-M3: name 위생화 (이미 max는 schema에서 처리)
    const cleanName = sanitizeText(input.name);
    if (!cleanName) return errorResponse('시험명은 비울 수 없습니다', 400);

    const examId = generatePrefixedId('exam');
    const now = new Date().toISOString();

    // 기존 활성 시험이 있으면 비활성화
    if (input.is_active) {
      await executeUpdate(
        context.env.DB,
        'UPDATE exams SET is_active = 0 WHERE academy_id = ?',
        [getAcademyId(context)]
      );
    }

    const result = await executeInsert(
      context.env.DB,
      `INSERT INTO exams (id, academy_id, class_id, name, exam_month, date, total_score, is_active, exam_type, term, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        examId,
        getAcademyId(context),
        null, // class_id - can be null for academy-wide exams (after 005 migration)
        cleanName,
        input.exam_month,
        input.date,
        input.total_score || null,
        input.is_active ? 1 : 0,
        input.exam_type,
        input.term || null,
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
        name: cleanName,
        exam_month: input.exam_month,
        date: input.date,
        total_score: input.total_score,
        is_active: input.is_active,
        exam_type: input.exam_type,
        term: input.term || null,
      },
      201
    );
  } catch (error) {
    return handleRouteError(error, '시험 생성', { ipAddress });
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
      [getAcademyId(context)]
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
      [getAcademyId(context)]
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
      [examId, getAcademyId(context)]
    );

    if (!exam) {
      return errorResponse('시험을 찾을 수 없습니다', 404);
    }

    // 활성화 상태 변경 시 다른 시험 비활성화
    if (input.is_active && !exam.is_active) {
      await executeUpdate(
        context.env.DB,
        'UPDATE exams SET is_active = 0 WHERE academy_id = ? AND id != ?',
        [getAcademyId(context), examId]
      );
    }

    // SEC-EXAM-M3: name 위생화
    const cleanName = sanitizeText(input.name);
    if (!cleanName) return errorResponse('시험명은 비울 수 없습니다', 400);

    const now = new Date().toISOString();
    const result = await executeUpdate(
      context.env.DB,
      `UPDATE exams
       SET name = ?, exam_month = ?, date = ?, total_score = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [
        cleanName,
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
    return handleRouteError(error, '시험 수정');
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
      [examId, getAcademyId(context)]
    );

    if (!exam) {
      return errorResponse('시험을 찾을 수 없습니다', 404);
    }

    const result = await executeDelete(
      context.env.DB,
      'DELETE FROM exams WHERE id = ? AND academy_id = ?',
      [examId, getAcademyId(context)]
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

    // SEC-EXAM-H1: 학생 academy 격리 — input.student_id가 같은 학원 소속인지 검증.
    // 누락 시 cross-tenant 성적 위조 가능.
    const student = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM students WHERE id = ? AND academy_id = ?',
      [input.student_id, getAcademyId(context)]
    );
    if (!student) {
      return errorResponse('학생을 찾을 수 없습니다', 404);
    }

    // 시험 정보 조회
    const exam = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM exams WHERE id = ? AND academy_id = ?',
      [input.exam_id, getAcademyId(context)]
    );

    if (!exam) {
      return errorResponse('시험을 찾을 수 없습니다', 404);
    }

    // SEC-EXAM-M3: comments 위생화
    const cleanComments = input.comments !== undefined ? sanitizeNullable(input.comments) : undefined;

    // 활성 설정 제약 확인
    //   - 월말평가(monthly): exam_settings.active_exam_month 와 exam.exam_month 가 일치해야 함
    //   - 정기고사(midterm/final): exam_review_settings 의 (active_term, active_exam_type) 과 일치해야 함
    const examType = exam.exam_type || 'monthly';

    if (examType === 'monthly') {
      const examSettings = await executeFirst<any>(
        context.env.DB,
        'SELECT active_exam_month FROM exam_settings WHERE academy_id = ?',
        [getAcademyId(context)]
      );

      if (examSettings && examSettings.active_exam_month) {
        if (exam.exam_month !== examSettings.active_exam_month) {
          return errorResponse(
            `설정된 시험 월(${examSettings.active_exam_month})이 아닙니다. 해당 월의 성적만 입력 가능합니다`,
            400
          );
        }
      }
    } else {
      // 정기고사
      const reviewSettings = await executeFirst<any>(
        context.env.DB,
        'SELECT active_term, active_exam_type FROM exam_review_settings WHERE academy_id = ?',
        [getAcademyId(context)]
      );

      if (reviewSettings && reviewSettings.active_term && reviewSettings.active_exam_type) {
        if (exam.term !== reviewSettings.active_term || examType !== reviewSettings.active_exam_type) {
          return errorResponse(
            `설정된 정기고사(${reviewSettings.active_term} ${reviewSettings.active_exam_type})가 아닙니다`,
            400
          );
        }
      }
    }

    // UPSERT: 기존 성적이 있으면 UPDATE, 없으면 INSERT
    const now = new Date().toISOString();
    const year_month = exam.exam_month || new Date().toISOString().slice(0, 7);

    const existing = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM grades WHERE student_id = ? AND exam_id = ?',
      [input.student_id, input.exam_id]
    );

    let gradeId: string;

    if (existing) {
      // UPDATE — 전달된 필드만 업데이트 (comments가 undefined면 기존 값 유지)
      gradeId = existing.id;
      const setClauses = ['score = ?', 'graded_at = ?', 'graded_by = ?'];
      const params: any[] = [input.score, now, context.auth?.userId || 'unknown'];

      if (cleanComments !== undefined) {
        setClauses.splice(1, 0, 'comments = ?');
        params.splice(1, 0, cleanComments);
      }

      params.push(gradeId);
      const result = await executeUpdate(
        context.env.DB,
        `UPDATE grades SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
      if (!result) {
        throw new Error('성적 수정 실패');
      }
    } else {
      // INSERT
      gradeId = generatePrefixedId('grade');
      const result = await executeInsert(
        context.env.DB,
        `INSERT INTO grades (id, student_id, exam_id, score, comments, year_month, graded_at, graded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gradeId,
          input.student_id,
          input.exam_id,
          input.score,
          cleanComments ?? null,
          year_month,
          now,
          context.auth?.userId || 'unknown',
          now,
        ]
      );
      if (!result.success) {
        throw new Error('성적 저장 실패');
      }
    }

    return successResponse(
      {
        id: gradeId,
        student_id: input.student_id,
        exam_id: input.exam_id,
        score: input.score,
        comments: cleanComments ?? null,
        year_month,
        updated: !!existing,
      },
      existing ? 200 : 201
    );
  } catch (error) {
    return handleRouteError(error, '성적 저장', { ipAddress });
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
