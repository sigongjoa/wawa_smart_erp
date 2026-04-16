/**
 * 학생 라우트 핸들러
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

// ==================== 헬퍼: 담당 학생 체크 ====================
async function teacherOwnsStudent(
  db: any,
  teacherId: string,
  studentId: string
): Promise<boolean> {
  const row = await executeFirst<{ n: number }>(
    db,
    'SELECT 1 AS n FROM student_teachers WHERE teacher_id = ? AND student_id = ? LIMIT 1',
    [teacherId, studentId]
  );
  return !!row;
}

// ==================== 헬퍼: 과목명 추출 ====================
function extractSubject(examName: string | null): string {
  if (!examName) return '기타';
  const parts = examName.split(' - ');
  return parts.length > 1 ? parts[parts.length - 1] : examName;
}

// ==================== 스키마 ====================
const CreateStudentSchema = z.object({
  name: z.string().min(1, '학생 이름은 필수입니다'),
  grade: z.string().min(1, '학년은 필수입니다'),
  school: z.string().nullable().optional(),
  class_id: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  guardian_contact: z.string().nullable().optional(),
  subjects: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const UpdateStudentSchema = CreateStudentSchema.partial();

type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

// ==================== 헬퍼 함수 ====================

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

    const studentId = generatePrefixedId('student');
    const now = new Date().toISOString();
    const enrollmentDate = new Date().toISOString().split('T')[0]; // DATE 형식 (YYYY-MM-DD)

    const subjectsJson = input.subjects && input.subjects.length > 0
      ? JSON.stringify(input.subjects)
      : null;

    const result = await executeInsert(
      context.env.DB,
      `INSERT INTO students (id, academy_id, name, class_id, contact, guardian_contact, enrollment_date, status, created_at, updated_at, grade, subjects, school)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        getAcademyId(context),
        input.name,
        input.class_id || null,
        input.contact || null,
        input.guardian_contact || null,
        enrollmentDate,
        input.status,
        now,
        now,
        input.grade,
        subjectsJson,
        input.school || null,
      ]
    );

    if (!result.success) {
      throw new Error('데이터베이스 삽입 실패');
    }

    // 생성한 사람을 담당 선생님으로 자동 매핑
    const userId = context.auth?.userId;
    if (userId) {
      await executeInsert(
        context.env.DB,
        'INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES (?, ?)',
        [studentId, userId]
      );
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
    return handleRouteError(error, '학생 추가', { ipAddress });
  }
}

/**
 * GET /api/student - 학생 목록 조회
 */
async function handleGetStudents(request: Request, context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const academyId = getAcademyId(context);
    const userId = context.auth?.userId;
    const role = context.auth?.role;
    const url = new URL(request.url);
    const classId = url.searchParams.get('classId');
    const scope = url.searchParams.get('scope');
    const isAdmin = role === 'admin';
    const showAll = isAdmin && scope === 'all';

    let students: any[];

    if (!showAll) {
      // instructor + admin(default) = 본인 담당만
      let query = `SELECT s.* FROM students s
        INNER JOIN student_teachers st ON s.id = st.student_id
        WHERE s.academy_id = ? AND st.teacher_id = ?`;
      const params: any[] = [academyId, userId];
      if (classId) { query += ' AND s.class_id = ?'; params.push(classId); }
      query += ' ORDER BY s.name';
      students = await executeQuery<any>(context.env.DB, query, params);
    } else {
      // admin + scope=all
      let query = 'SELECT * FROM students WHERE academy_id = ?';
      const params: any[] = [academyId];
      if (classId) { query += ' AND class_id = ?'; params.push(classId); }
      query += ' ORDER BY name';
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
      [studentId, getAcademyId(context)]
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

    const body = await request.json() as any;
    const input = UpdateStudentSchema.parse(body);

    const student = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM students WHERE id = ? AND academy_id = ?',
      [studentId, getAcademyId(context)]
    );
    if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);

    // instructor는 본인 담당 학생만 수정 가능 (admin은 전체)
    if (context.auth!.role !== 'admin') {
      if (!(await teacherOwnsStudent(context.env.DB, context.auth!.userId, studentId))) {
        return errorResponse('담당 학생만 수정할 수 있습니다', 403);
      }
    }

    const sets: string[] = [];
    const params: any[] = [];
    const mapField = (col: string, key: keyof UpdateStudentInput) => {
      if (input[key] !== undefined) {
        sets.push(`${col} = ?`);
        const v = input[key] as any;
        params.push(typeof v === 'string' ? (v.trim() || null) : v);
      }
    };
    mapField('name', 'name');
    mapField('grade', 'grade');
    mapField('school', 'school');
    mapField('class_id', 'class_id');
    mapField('contact', 'contact');
    mapField('guardian_contact', 'guardian_contact');
    mapField('status', 'status');
    if (input.subjects !== undefined) {
      sets.push('subjects = ?');
      params.push(JSON.stringify(input.subjects || []));
    }
    if (sets.length === 0) return errorResponse('수정할 필드가 없습니다', 400);

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(studentId);

    await executeUpdate(
      context.env.DB,
      `UPDATE students SET ${sets.join(', ')} WHERE id = ?`,
      params
    );

    return successResponse({ id: studentId, ...input });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('입력 검증 오류: ' + error.errors.map(e => e.message).join(', '), 400);
    }
    return handleRouteError(error, '학생 수정');
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
      [studentId, getAcademyId(context)]
    );

    if (!student) {
      return errorResponse('학생을 찾을 수 없습니다', 404);
    }

    // instructor는 본인 담당 학생만 삭제 가능 (admin은 전체)
    if (context.auth!.role !== 'admin') {
      if (!(await teacherOwnsStudent(context.env.DB, context.auth!.userId, studentId))) {
        return errorResponse('담당 학생만 삭제할 수 있습니다', 403);
      }
    }

    // 관련 데이터 정리
    await executeDelete(context.env.DB, 'DELETE FROM student_teachers WHERE student_id = ?', [studentId]);
    await executeDelete(context.env.DB, 'DELETE FROM enrollments WHERE student_id = ?', [studentId]);

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

// ==================== 프로필 통합 조회 ====================

/**
 * GET /api/student/:id/profile - 학생 기본 정보 + 담당 선생님
 */
async function handleGetStudentProfile(
  context: RequestContext,
  studentId: string
): Promise<Response> {
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const academyId = getAcademyId(context);

    const student = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM students WHERE id = ? AND academy_id = ?',
      [studentId, academyId]
    );

    if (!student) {
      return errorResponse('학생을 찾을 수 없습니다', 404);
    }

    // 담당 선생님 조회
    const teachers = await executeQuery<any>(
      context.env.DB,
      `SELECT u.id, u.name FROM student_teachers st
       JOIN users u ON st.teacher_id = u.id
       WHERE st.student_id = ? AND u.academy_id = ?`,
      [studentId, academyId]
    );

    return successResponse({
      ...student,
      subjects: student.subjects ? JSON.parse(student.subjects) : [],
      teachers,
    });
  } catch (error) {
    logger.error('학생 프로필 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('학생 프로필 조회에 실패했습니다', 500);
  }
}

/**
 * GET /api/student/:id/comments?months=12 - 월별 코멘트 히스토리
 */
async function handleGetStudentComments(
  request: Request,
  context: RequestContext,
  studentId: string
): Promise<Response> {
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const url = new URL(request.url);
    const months = parseInt(url.searchParams.get('months') || '12', 10);

    // 성적 + 코멘트 조회
    const grades = await executeQuery<any>(
      context.env.DB,
      `SELECT g.score, g.comments, g.year_month, e.name as exam_name
       FROM grades g
       LEFT JOIN exams e ON g.exam_id = e.id
       WHERE g.student_id = ?
       ORDER BY g.year_month DESC`,
      [studentId]
    );

    // 총평 조회 (reports 테이블)
    const reports = await executeQuery<any>(
      context.env.DB,
      `SELECT month, content FROM reports
       WHERE student_id = ?
       ORDER BY month DESC`,
      [studentId]
    );

    const reportMap = new Map<string, string>();
    for (const r of reports) {
      reportMap.set(r.month, r.content || '');
    }

    // 월별로 그룹핑
    const monthMap = new Map<string, { subject: string; score: number; comment: string }[]>();
    const allMonths = new Set<string>();

    for (const g of grades) {
      allMonths.add(g.year_month);
      if (!monthMap.has(g.year_month)) monthMap.set(g.year_month, []);
      monthMap.get(g.year_month)!.push({
        subject: extractSubject(g.exam_name),
        score: g.score,
        comment: g.comments || '',
      });
    }

    // 최근 N개월만 필터
    const sortedMonths = Array.from(allMonths).sort().reverse().slice(0, months);

    const result = sortedMonths.map((ym) => ({
      yearMonth: ym,
      scores: monthMap.get(ym) || [],
      totalComment: reportMap.get(ym) || '',
    }));

    return successResponse(result);
  } catch (error) {
    logger.error('코멘트 히스토리 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('코멘트 히스토리 조회에 실패했습니다', 500);
  }
}

/**
 * GET /api/student/:id/attendance?months=6 - 출결 요약
 */
async function handleGetStudentAttendance(
  request: Request,
  context: RequestContext,
  studentId: string
): Promise<Response> {
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const url = new URL(request.url);
    const months = parseInt(url.searchParams.get('months') || '6', 10);

    // N개월 전 날짜 계산
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceDate = since.toISOString().split('T')[0];

    // 출석 통계 (attendance 테이블)
    const stats = await executeQuery<any>(
      context.env.DB,
      `SELECT status, COUNT(*) as cnt FROM attendance
       WHERE student_id = ? AND date >= ?
       GROUP BY status`,
      [studentId, sinceDate]
    );

    let present = 0, absent = 0, late = 0;
    for (const s of stats) {
      if (s.status === 'present') present = s.cnt;
      else if (s.status === 'absent') absent = s.cnt;
      else if (s.status === 'late') late = s.cnt;
    }
    const totalClasses = present + absent + late;
    const attendanceRate = totalClasses > 0 ? Math.round((present / totalClasses) * 100) : 100;

    // 최근 결석 상세 (absences 테이블)
    const recentAbsences = await executeQuery<any>(
      context.env.DB,
      `SELECT a.absence_date, c.name as class_name, a.reason
       FROM absences a
       LEFT JOIN classes c ON a.class_id = c.id
       WHERE a.student_id = ? AND a.absence_date >= ?
       ORDER BY a.absence_date DESC LIMIT 10`,
      [studentId, sinceDate]
    );

    // 보강 현황
    const makeupStats = await executeQuery<any>(
      context.env.DB,
      `SELECT m.status, COUNT(*) as cnt FROM makeups m
       JOIN absences a ON m.absence_id = a.id
       WHERE a.student_id = ? AND a.absence_date >= ?
       GROUP BY m.status`,
      [studentId, sinceDate]
    );

    let makeupCompleted = 0, makeupPending = 0;
    for (const m of makeupStats) {
      if (m.status === 'completed') makeupCompleted = m.cnt;
      else makeupPending += m.cnt;
    }

    return successResponse({
      totalClasses,
      present,
      absent,
      late,
      attendanceRate,
      recentAbsences: recentAbsences.map((a: any) => ({
        date: a.absence_date,
        className: a.class_name || '',
        reason: a.reason || '',
      })),
      makeups: { completed: makeupCompleted, pending: makeupPending },
    });
  } catch (error) {
    logger.error('출결 요약 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('출결 요약 조회에 실패했습니다', 500);
  }
}

// ==================== 담당 선생님 관리 ====================

async function handleSetStudentTeachers(
  request: Request,
  context: RequestContext,
  studentId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const body = await request.json() as any;
  const teacherIds: string[] = Array.isArray(body.teacher_ids) ? body.teacher_ids : [];

  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);

  // 선생님들이 같은 academy인지 검증
  if (teacherIds.length > 0) {
    const placeholders = teacherIds.map(() => '?').join(',');
    const valid = await executeQuery<any>(
      context.env.DB,
      `SELECT id FROM users WHERE academy_id = ? AND id IN (${placeholders})`,
      [academyId, ...teacherIds]
    );
    if (valid.length !== teacherIds.length) {
      return errorResponse('유효하지 않은 선생님이 포함되어 있습니다', 400);
    }
  }

  await executeDelete(context.env.DB, 'DELETE FROM student_teachers WHERE student_id = ?', [studentId]);
  for (const tid of teacherIds) {
    await executeInsert(
      context.env.DB,
      'INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES (?, ?)',
      [studentId, tid]
    );
  }
  return successResponse({ student_id: studentId, teacher_ids: teacherIds });
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
      if (method === 'GET') return await handleGetStudents(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id/teachers
    const teachersMatch = pathname.match(/^\/api\/student\/([^/]+)\/teachers$/);
    if (teachersMatch) {
      if (method === 'PUT') return await handleSetStudentTeachers(request, context, teachersMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id/profile
    const profileMatch = pathname.match(/^\/api\/student\/([^/]+)\/profile$/);
    if (profileMatch) {
      if (method === 'GET') return await handleGetStudentProfile(context, profileMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id/comments
    const commentsMatch = pathname.match(/^\/api\/student\/([^/]+)\/comments$/);
    if (commentsMatch) {
      if (method === 'GET') return await handleGetStudentComments(request, context, commentsMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id/attendance
    const attendanceMatch = pathname.match(/^\/api\/student\/([^/]+)\/attendance$/);
    if (attendanceMatch) {
      if (method === 'GET') return await handleGetStudentAttendance(request, context, attendanceMatch[1]);
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
