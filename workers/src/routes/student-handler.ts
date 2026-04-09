/**
 * 학생 라우트 핸들러
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeQuery, executeInsert, executeUpdate, executeDelete } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// ==================== 스키마 ====================
const CreateStudentSchema = z.object({
  name: z.string().min(1, '학생 이름은 필수입니다'),
  grade: z.string().min(1, '학년은 필수입니다'),
  class_id: z.string().optional(),
  contact: z.string().optional(),
  guardian_contact: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

// ==================== 헬퍼 함수 ====================

function generateId(prefix: string): string {
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid.split('-')[0]}`;
}

async function parseStudentInput(request: Request): Promise<CreateStudentInput> {
  try {
    const body = await request.json() as any;
    return CreateStudentSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      throw new Error(`입력 검증 오류: ${message}`);
    }
    throw new Error('요청 처리 오류: 유효한 JSON이 필요합니다');
  }
}

// ==================== Student 핸들러 ====================

/**
 * POST /api/student - 학생 추가
 */
async function handleCreateStudent(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
      return unauthorizedResponse();
    }

    const input = await parseStudentInput(request);

    logger.logRequest('POST', '/api/student', undefined, ipAddress);

    const studentId = generateId('student');
    const now = new Date().toISOString();
    const enrollmentDate = new Date().toISOString().split('T')[0]; // DATE 형식 (YYYY-MM-DD)

    const result = await executeInsert(
      context.env.DB,
      `INSERT INTO students (id, academy_id, name, class_id, contact, guardian_contact, enrollment_date, status, created_at, updated_at, grade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        context.auth?.academyId || 'acad-1',
        input.name,
        input.class_id || null,
        input.contact || null,
        input.guardian_contact || null,
        enrollmentDate,
        input.status,
        now,
        now,
        input.grade,
      ]
    );

    if (!result.success) {
      throw new Error('데이터베이스 삽입 실패');
    }

    return successResponse(
      {
        id: studentId,
        name: input.name,
        grade: input.grade,
        status: input.status,
      },
      201
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증') || errorMessage.includes('요청 처리')) {
      logger.warn('학생 추가 검증 오류', { error: errorMessage, ipAddress });
      return errorResponse(errorMessage, 400);
    }

    logger.error('학생 추가 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('학생 추가에 실패했습니다', 500);
  }
}

/**
 * GET /api/student - 학생 목록 조회
 */
async function handleGetStudents(context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const academyId = context.auth?.academyId || 'acad-1';
    const userId = context.auth?.userId;
    const role = context.auth?.role;
    const classId = context.request.url.split('?classId=')[1];

    let students: any[];

    if (role === 'instructor' && userId) {
      // instructor는 본인 담당 학생만 조회
      let query = `SELECT s.* FROM students s
        INNER JOIN student_teachers st ON s.id = st.student_id
        WHERE s.academy_id = ? AND st.teacher_id = ?`;
      let params: any[] = [academyId, userId];
      if (classId) {
        query += ' AND s.class_id = ?';
        params.push(classId);
      }
      query += ' ORDER BY s.name';
      students = await executeQuery<any>(context.env.DB, query, params);
    } else {
      // admin은 전체 조회
      let query = 'SELECT * FROM students WHERE academy_id = ? ORDER BY name';
      let params: any[] = [academyId];
      if (classId) {
        query = 'SELECT * FROM students WHERE academy_id = ? AND class_id = ? ORDER BY name';
        params = [academyId, classId];
      }
      students = await executeQuery<any>(context.env.DB, query, params);
    }

    // subjects 필드 파싱 (없으면 빈 배열 반환)
    const studentsWithSubjects = students.map(s => ({
      ...s,
      subjects: s.subjects ? JSON.parse(s.subjects) : []
    }));

    return successResponse(studentsWithSubjects);
  } catch (error) {
    logger.error('학생 목록 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('학생 목록 조회에 실패했습니다', 500);
  }
}

/**
 * GET /api/student/:id - 학생 상세 조회
 */
async function handleGetStudent(context: RequestContext, studentId: string): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const student = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM students WHERE id = ? AND academy_id = ?',
      [studentId, context.auth?.academyId || 'acad-1']
    );

    if (!student) {
      return errorResponse('학생을 찾을 수 없습니다', 404);
    }

    return successResponse(student);
  } catch (error) {
    logger.error('학생 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('학생 조회에 실패했습니다', 500);
  }
}

/**
 * PATCH /api/student/:id - 학생 정보 수정
 */
async function handleUpdateStudent(
  request: Request,
  context: RequestContext,
  studentId: string
): Promise<Response> {
  try {
    if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
      return unauthorizedResponse();
    }

    const input = await parseStudentInput(request);

    const student = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM students WHERE id = ? AND academy_id = ?',
      [studentId, context.auth?.academyId || 'acad-1']
    );

    if (!student) {
      return errorResponse('학생을 찾을 수 없습니다', 404);
    }

    const now = new Date().toISOString();
    const result = await executeUpdate(
      context.env.DB,
      `UPDATE students
       SET name = ?, grade = ?, class_id = ?, contact = ?, guardian_contact = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.name,
        input.grade,
        input.class_id || null,
        input.contact || null,
        input.guardian_contact || null,
        input.status,
        now,
        studentId,
      ]
    );

    if (!result) {
      throw new Error('학생 정보 수정 실패');
    }

    return successResponse({ id: studentId, ...input });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증')) {
      return errorResponse(errorMessage, 400);
    }

    logger.error('학생 수정 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('학생 수정에 실패했습니다', 500);
  }
}

/**
 * DELETE /api/student/:id - 학생 삭제
 */
async function handleDeleteStudent(
  context: RequestContext,
  studentId: string
): Promise<Response> {
  try {
    if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
      return unauthorizedResponse();
    }

    const student = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM students WHERE id = ? AND academy_id = ?',
      [studentId, context.auth?.academyId || 'acad-1']
    );

    if (!student) {
      return errorResponse('학생을 찾을 수 없습니다', 404);
    }

    const result = await executeDelete(
      context.env.DB,
      'DELETE FROM students WHERE id = ?',
      [studentId]
    );

    if (!result) {
      throw new Error('학생 삭제 실패');
    }

    return successResponse({ id: studentId, deleted: true });
  } catch (error) {
    logger.error('학생 삭제 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('학생 삭제에 실패했습니다', 500);
  }
}

// ==================== 메인 핸들러 ====================

export async function handleStudent(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/student
    if (pathname === '/api/student') {
      if (method === 'POST') return await handleCreateStudent(request, context);
      if (method === 'GET') return await handleGetStudents(context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id
    const studentIdMatch = pathname.match(/^\/api\/student\/([^/]+)$/);
    if (studentIdMatch) {
      const studentId = studentIdMatch[1];
      if (method === 'GET') return await handleGetStudent(context, studentId);
      if (method === 'PATCH') return await handleUpdateStudent(request, context, studentId);
      if (method === 'DELETE') return await handleDeleteStudent(context, studentId);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Student handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('Internal server error', 500);
  }
}
