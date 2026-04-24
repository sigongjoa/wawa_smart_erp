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
import {
  handleListSchedules,
  handleCreateSchedule,
  handleImportExamPeriod,
  handleDeleteSchedule,
} from './student/schedules';

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

    // 담당 선생님 + 담임 플래그 조회
    const teachers = await executeQuery<any>(
      context.env.DB,
      `SELECT u.id, u.name, st.is_homeroom FROM student_teachers st
       JOIN users u ON st.teacher_id = u.id
       WHERE st.student_id = ? AND u.academy_id = ?`,
      [studentId, academyId]
    );
    const homeroom = teachers.find((t: any) => t.is_homeroom === 1) || null;

    return successResponse({
      ...student,
      subjects: student.subjects ? JSON.parse(student.subjects) : [],
      teachers,
      homeroom_teacher: homeroom ? { id: homeroom.id, name: homeroom.name } : null,
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

// ==================== 담임(homeroom) 지정 ====================
// 합의서 4-5: 학생당 담임 1명, admin/센터장이 배정/전환
async function handleSetHomeroom(
  request: Request,
  context: RequestContext,
  studentId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const body = (await request.json()) as any;
  const teacherId: string | null = body.teacher_id ?? null;

  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);

  // 전원 해제 (담임 플래그만 초기화)
  await executeUpdate(
    context.env.DB,
    'UPDATE student_teachers SET is_homeroom = 0 WHERE student_id = ?',
    [studentId]
  );

  if (teacherId) {
    const teacher = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM users WHERE id = ? AND academy_id = ?',
      [teacherId, academyId]
    );
    if (!teacher) return errorResponse('유효하지 않은 선생님입니다', 400);

    // 담당 매핑이 없으면 생성, 있으면 담임 플래그만 세팅
    await executeInsert(
      context.env.DB,
      'INSERT OR IGNORE INTO student_teachers (student_id, teacher_id, is_homeroom) VALUES (?, ?, 1)',
      [studentId, teacherId]
    );
    await executeUpdate(
      context.env.DB,
      'UPDATE student_teachers SET is_homeroom = 1 WHERE student_id = ? AND teacher_id = ?',
      [studentId, teacherId]
    );
  }

  return successResponse({ student_id: studentId, homeroom_teacher_id: teacherId });
}

// ==================== 학부모 상담 (4-1) ====================
// 공유 정책: 학생의 모든 담당 선생님(student_teachers) + admin이 열람/작성 가능

const ConsultationSchema = z.object({
  channel: z.enum(['phone', 'sms', 'kakao', 'in_person', 'other']),
  category: z.enum(['monthly', 'pre_exam', 'post_exam', 'ad_hoc']).default('monthly'),
  consulted_at: z.string().min(1),
  subjects: z.array(z.string()).optional(),
  summary: z.string().min(1, '상담 내용은 필수입니다'),
  parent_sentiment: z.enum(['positive', 'neutral', 'concerned']).nullable().optional(),
  follow_up: z.string().nullable().optional(),
  follow_up_due: z.string().nullable().optional(),
});

async function canAccessStudent(
  context: RequestContext,
  studentId: string
): Promise<boolean> {
  const role = context.auth!.role;
  if (role === 'admin') return true;
  return await teacherOwnsStudent(context.env.DB, context.auth!.userId, studentId);
}

async function handleListConsultations(
  request: Request,
  context: RequestContext,
  studentId: string
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  const academyId = getAcademyId(context);

  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);
  if (!(await canAccessStudent(context, studentId))) {
    return errorResponse('담당 학생만 열람할 수 있습니다', 403);
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const rows = await executeQuery<any>(
    context.env.DB,
    `SELECT c.*, u.name AS author_name
     FROM consultations c
     LEFT JOIN users u ON c.author_id = u.id
     WHERE c.student_id = ? AND c.academy_id = ?
     ORDER BY c.consulted_at DESC
     LIMIT ?`,
    [studentId, academyId, limit]
  );

  return successResponse(
    rows.map((r) => ({ ...r, subjects: r.subjects ? JSON.parse(r.subjects) : [] }))
  );
}

async function handleCreateConsultation(
  request: Request,
  context: RequestContext,
  studentId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const authorId = context.auth!.userId;

  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);
  if (!(await canAccessStudent(context, studentId))) {
    return errorResponse('담당 학생만 상담을 기록할 수 있습니다', 403);
  }

  try {
    const body = (await request.json()) as any;
    const input = ConsultationSchema.parse(body);
    const id = generatePrefixedId('cons');
    await executeInsert(
      context.env.DB,
      `INSERT INTO consultations
       (id, academy_id, student_id, author_id, channel, category, consulted_at,
        subjects, summary, parent_sentiment, follow_up, follow_up_due)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        academyId,
        studentId,
        authorId,
        input.channel,
        input.category,
        input.consulted_at,
        input.subjects ? JSON.stringify(input.subjects) : null,
        input.summary,
        input.parent_sentiment ?? null,
        input.follow_up ?? null,
        input.follow_up_due ?? null,
      ]
    );
    return successResponse({ id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('입력 검증 오류: ' + error.errors.map((e) => e.message).join(', '), 400);
    }
    return handleRouteError(error, '상담 기록 생성');
  }
}

async function handleDeleteConsultation(
  context: RequestContext,
  studentId: string,
  consultationId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const row = await executeFirst<any>(
    context.env.DB,
    'SELECT author_id FROM consultations WHERE id = ? AND student_id = ? AND academy_id = ?',
    [consultationId, studentId, academyId]
  );
  if (!row) return errorResponse('상담 기록을 찾을 수 없습니다', 404);

  // 작성자 본인 또는 admin만 삭제
  if (context.auth!.role !== 'admin' && row.author_id !== context.auth!.userId) {
    return errorResponse('작성자만 삭제할 수 있습니다', 403);
  }
  await executeDelete(context.env.DB, 'DELETE FROM consultations WHERE id = ?', [consultationId]);
  return successResponse({ id: consultationId, deleted: true });
}

// ==================== 교과 선생님 메모 (student_teacher_notes) ====================

const NOTE_CATEGORIES = ['attitude', 'understanding', 'homework', 'exam', 'etc'] as const;
const NOTE_SENTIMENTS = ['positive', 'neutral', 'concern'] as const;
const NOTE_SOURCES = ['manual', 'post_class', 'post_exam', 'post_assignment', 'live_session'] as const;
const NOTE_VISIBILITIES = ['staff', 'homeroom_only', 'parent_share'] as const;

const TeacherNoteSchema = z.object({
  subject: z.string().min(1, '과목은 필수입니다').max(40),
  category: z.enum(NOTE_CATEGORIES),
  sentiment: z.enum(NOTE_SENTIMENTS),
  tags: z.array(z.string().max(40)).max(10).optional(),
  content: z.string().min(1, '본문은 필수입니다').max(1000),
  source: z.enum(NOTE_SOURCES).optional(),
  source_ref_id: z.string().nullable().optional(),
  visibility: z.enum(NOTE_VISIBILITIES).optional(),
});

const TeacherNoteUpdateSchema = TeacherNoteSchema.partial();

/** YYYY-MM 형식 period_tag 생성 (월 단위 요약 인덱스) */
function currentPeriodTag(): string {
  return new Date().toISOString().slice(0, 7);
}

async function isHomeroomOf(
  db: any,
  teacherId: string,
  studentId: string
): Promise<boolean> {
  const row = await executeFirst<{ n: number }>(
    db,
    'SELECT 1 AS n FROM student_teachers WHERE teacher_id = ? AND student_id = ? AND is_homeroom = 1 LIMIT 1',
    [teacherId, studentId]
  );
  return !!row;
}

async function handleListNotes(
  request: Request,
  context: RequestContext,
  studentId: string
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  const academyId = getAcademyId(context);

  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);

  // 조회 권한: 담당 교과 선생님 + 담임 + admin
  if (!(await canAccessStudent(context, studentId))) {
    return errorResponse('담당 학생만 열람할 수 있습니다', 403);
  }

  const url = new URL(request.url);
  const subject = url.searchParams.get('subject');
  const period = url.searchParams.get('period'); // YYYY-MM
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const where: string[] = ['n.student_id = ?', 'n.academy_id = ?'];
  const params: any[] = [studentId, academyId];
  if (subject) { where.push('n.subject = ?'); params.push(subject); }
  if (period)  { where.push('n.period_tag = ?'); params.push(period); }
  params.push(limit);

  const rows = await executeQuery<any>(
    context.env.DB,
    `SELECT n.*, u.name AS author_name
     FROM student_teacher_notes n
     LEFT JOIN users u ON n.author_id = u.id
     WHERE ${where.join(' AND ')}
     ORDER BY n.created_at DESC
     LIMIT ?`,
    params
  );

  return successResponse(
    rows.map((r: any) => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] }))
  );
}

async function handleCreateNote(
  request: Request,
  context: RequestContext,
  studentId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const authorId = context.auth!.userId;

  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);

  // 작성 권한: 담당 교과 선생님 + admin (담임만 있는 경우엔 담임 자격으로도 허용)
  if (!(await canAccessStudent(context, studentId))) {
    return errorResponse('담당 학생만 메모를 작성할 수 있습니다', 403);
  }

  try {
    const body = (await request.json()) as any;
    const input = TeacherNoteSchema.parse(body);
    const id = generatePrefixedId('stn');
    const tagsJson = input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null;
    await executeInsert(
      context.env.DB,
      `INSERT INTO student_teacher_notes
       (id, academy_id, student_id, author_id, subject, category, sentiment,
        tags, content, source, source_ref_id, visibility, period_tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        academyId,
        studentId,
        authorId,
        input.subject,
        input.category,
        input.sentiment,
        tagsJson,
        input.content,
        input.source ?? 'manual',
        input.source_ref_id ?? null,
        input.visibility ?? 'staff',
        currentPeriodTag(),
      ]
    );
    logger.logSecurity('NOTE_CREATED', 'low', { noteId: id, studentId, authorId });
    return successResponse({ id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('입력 검증 오류: ' + error.errors.map((e) => e.message).join(', '), 400);
    }
    return handleRouteError(error, '교과 메모 생성');
  }
}

async function handleUpdateNote(
  request: Request,
  context: RequestContext,
  studentId: string,
  noteId: string
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  const academyId = getAcademyId(context);

  const row = await executeFirst<any>(
    context.env.DB,
    'SELECT author_id, created_at FROM student_teacher_notes WHERE id = ? AND student_id = ? AND academy_id = ?',
    [noteId, studentId, academyId]
  );
  if (!row) return errorResponse('메모를 찾을 수 없습니다', 404);

  // 작성자 본인 또는 admin만 수정
  if (context.auth!.role !== 'admin' && row.author_id !== context.auth!.userId) {
    return errorResponse('작성자만 수정할 수 있습니다', 403);
  }
  // 24시간 내 수정만 (admin 예외)
  if (context.auth!.role !== 'admin') {
    const created = new Date(row.created_at + 'Z').getTime();
    if (Date.now() - created > 24 * 3600 * 1000) {
      return errorResponse('작성 24시간이 지난 메모는 수정할 수 없습니다', 403);
    }
  }

  try {
    const body = (await request.json()) as any;
    const input = TeacherNoteUpdateSchema.parse(body);
    const sets: string[] = [];
    const params: any[] = [];
    if (input.subject !== undefined)    { sets.push('subject = ?');    params.push(input.subject); }
    if (input.category !== undefined)   { sets.push('category = ?');   params.push(input.category); }
    if (input.sentiment !== undefined)  { sets.push('sentiment = ?');  params.push(input.sentiment); }
    if (input.tags !== undefined)       {
      sets.push('tags = ?');
      params.push(input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null);
    }
    if (input.content !== undefined)    { sets.push('content = ?');    params.push(input.content); }
    if (input.visibility !== undefined) { sets.push('visibility = ?'); params.push(input.visibility); }
    if (sets.length === 0) return errorResponse('수정할 필드가 없습니다', 400);
    sets.push("updated_at = datetime('now')");
    params.push(noteId);
    await executeUpdate(
      context.env.DB,
      `UPDATE student_teacher_notes SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    return successResponse({ id: noteId, updated: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('입력 검증 오류: ' + error.errors.map((e) => e.message).join(', '), 400);
    }
    return handleRouteError(error, '교과 메모 수정');
  }
}

async function handleDeleteNote(
  context: RequestContext,
  studentId: string,
  noteId: string
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  const academyId = getAcademyId(context);
  const row = await executeFirst<any>(
    context.env.DB,
    'SELECT author_id FROM student_teacher_notes WHERE id = ? AND student_id = ? AND academy_id = ?',
    [noteId, studentId, academyId]
  );
  if (!row) return errorResponse('메모를 찾을 수 없습니다', 404);
  if (context.auth!.role !== 'admin' && row.author_id !== context.auth!.userId) {
    return errorResponse('작성자만 삭제할 수 있습니다', 403);
  }
  await executeDelete(context.env.DB, 'DELETE FROM student_teacher_notes WHERE id = ?', [noteId]);
  logger.logSecurity('NOTE_DELETED', 'low', { noteId, studentId });
  return successResponse({ id: noteId, deleted: true });
}

// 담임 대시보드: 학생×과목 메모 매트릭스 (period 기준)
async function handleHomeroomNotesOverview(
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  const academyId = getAcademyId(context);
  const teacherId = context.auth!.userId;
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || currentPeriodTag();

  const homeroomStudents = await executeQuery<any>(
    context.env.DB,
    `SELECT s.id, s.name, s.grade
     FROM student_teachers st
     JOIN students s ON s.id = st.student_id
     WHERE st.teacher_id = ? AND st.is_homeroom = 1 AND s.academy_id = ?
     ORDER BY s.name`,
    [teacherId, academyId]
  );

  if (homeroomStudents.length === 0) {
    return successResponse({ period, students: [] });
  }

  const studentIds = homeroomStudents.map((s: any) => s.id);
  const ph = studentIds.map(() => '?').join(',');

  // 학생×과목별 집계
  const aggRows = await executeQuery<any>(
    context.env.DB,
    `SELECT n.student_id, n.subject,
            COUNT(*) as cnt,
            SUM(CASE WHEN n.sentiment='positive' THEN 1 ELSE 0 END) as pos,
            SUM(CASE WHEN n.sentiment='neutral'  THEN 1 ELSE 0 END) as neu,
            SUM(CASE WHEN n.sentiment='concern'  THEN 1 ELSE 0 END) as con
     FROM student_teacher_notes n
     WHERE n.academy_id = ? AND n.period_tag = ? AND n.student_id IN (${ph})
     GROUP BY n.student_id, n.subject`,
    [academyId, period, ...studentIds]
  );

  // 학생별 그룹핑
  const byStudent = new Map<string, any[]>();
  for (const r of aggRows) {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, []);
    byStudent.get(r.student_id)!.push({
      subject: r.subject,
      count: r.cnt,
      sentiment_counts: { positive: r.pos, neutral: r.neu, concern: r.con },
    });
  }

  const students = homeroomStudents.map((s: any) => {
    const subjects = byStudent.get(s.id) || [];
    const concern_count = subjects.reduce((a, b) => a + (b.sentiment_counts?.concern || 0), 0);
    const total_notes = subjects.reduce((a, b) => a + b.count, 0);
    return {
      id: s.id,
      name: s.name,
      grade: s.grade,
      by_subject: subjects,
      concern_count,
      total_notes,
    };
  });

  return successResponse({ period, students });
}

// (homeroom 사용 추적 — TS 미사용 경고 회피)
void isHomeroomOf;

// ==================== 담임 대시보드 (4-5 + 4-1 이행 점검) ====================
// GET /api/homeroom/summary - 현재 로그인 선생님 기준
//   - 담임 학생 수, 이번 달 상담 완료/미완료, 7일 내 후속 상담, 다가오는 시험 일정
async function handleHomeroomSummary(context: RequestContext): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  const academyId = getAcademyId(context);
  const teacherId = context.auth!.userId;

  // 담임인 학생 목록
  const homeroomStudents = await executeQuery<any>(
    context.env.DB,
    `SELECT s.id, s.name, s.grade
     FROM student_teachers st
     JOIN students s ON s.id = st.student_id
     WHERE st.teacher_id = ? AND st.is_homeroom = 1 AND s.academy_id = ?
     ORDER BY s.name`,
    [teacherId, academyId]
  );

  if (homeroomStudents.length === 0) {
    return successResponse({
      homeroom_count: 0,
      this_month_consulted: [],
      this_month_pending: [],
      follow_ups_due: [],
      upcoming_exams: [],
    });
  }

  const studentIds = homeroomStudents.map((s: any) => s.id);
  const ph = studentIds.map(() => '?').join(',');

  // 이번 달(YYYY-MM) 상담이 있었던 학생
  const yearMonth = new Date().toISOString().slice(0, 7);
  const consultedRows = await executeQuery<any>(
    context.env.DB,
    `SELECT DISTINCT student_id FROM consultations
     WHERE academy_id = ? AND student_id IN (${ph})
       AND substr(consulted_at, 1, 7) = ?`,
    [academyId, ...studentIds, yearMonth]
  );
  const consultedSet = new Set(consultedRows.map((r: any) => r.student_id));
  const thisMonthConsulted = homeroomStudents.filter((s: any) => consultedSet.has(s.id));
  const thisMonthPending = homeroomStudents.filter((s: any) => !consultedSet.has(s.id));

  // 7일 내 후속 상담 예정
  const today = new Date().toISOString().slice(0, 10);
  const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const followUps = await executeQuery<any>(
    context.env.DB,
    `SELECT c.id, c.student_id, c.follow_up, c.follow_up_due, s.name AS student_name
     FROM consultations c
     JOIN students s ON s.id = c.student_id
     WHERE c.academy_id = ? AND c.student_id IN (${ph})
       AND c.follow_up_due IS NOT NULL
       AND c.follow_up_due >= ? AND c.follow_up_due <= ?
     ORDER BY c.follow_up_due ASC`,
    [academyId, ...studentIds, today, weekLater]
  );

  // 다가오는 시험 (external schedules kind=exam, 14일 이내)
  const twoWeeksLater = new Date(Date.now() + 14 * 86400000).toISOString();
  const upcomingExams = await executeQuery<any>(
    context.env.DB,
    `SELECT e.id, e.student_id, e.title, e.starts_at, s.name AS student_name
     FROM student_external_schedules e
     JOIN students s ON s.id = e.student_id
     WHERE e.academy_id = ? AND e.student_id IN (${ph})
       AND e.kind = 'exam' AND e.starts_at IS NOT NULL
       AND e.starts_at >= ? AND e.starts_at <= ?
     ORDER BY e.starts_at ASC`,
    [academyId, ...studentIds, new Date().toISOString(), twoWeeksLater]
  );

  return successResponse({
    homeroom_count: homeroomStudents.length,
    this_month_consulted: thisMonthConsulted,
    this_month_pending: thisMonthPending,
    follow_ups_due: followUps,
    upcoming_exams: upcomingExams,
  });
}

// GET /api/homeroom/calendar?month=YYYY-MM - 담임 학생 × 월별 상담 매트릭스
async function handleHomeroomCalendar(
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  const academyId = getAcademyId(context);
  const teacherId = context.auth!.userId;
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return errorResponse('month는 YYYY-MM 형식이어야 합니다', 400);
  }

  const students = await executeQuery<any>(
    context.env.DB,
    `SELECT s.id, s.name, s.grade
     FROM student_teachers st
     JOIN students s ON s.id = st.student_id
     WHERE st.teacher_id = ? AND st.is_homeroom = 1 AND s.academy_id = ?
     ORDER BY s.name`,
    [teacherId, academyId]
  );

  if (students.length === 0) return successResponse({ month, students: [], consultations: [] });

  const ph = students.map(() => '?').join(',');
  const studentIds = students.map((s: any) => s.id);

  const rows = await executeQuery<any>(
    context.env.DB,
    `SELECT id, student_id, category, channel, consulted_at, summary
     FROM consultations
     WHERE academy_id = ? AND student_id IN (${ph})
       AND substr(consulted_at, 1, 7) = ?
     ORDER BY consulted_at ASC`,
    [academyId, ...studentIds, month]
  );

  return successResponse({ month, students, consultations: rows });
}

// 외부 일정(schedules) 도메인은 student/schedules.ts 로 분리됨
// (import 는 파일 상단에서 수행)

// ==================== 메인 핸들러 ====================

export async function handleStudent(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/homeroom/summary, /api/homeroom/calendar (담임 대시보드)
    if (pathname === '/api/homeroom/summary') {
      if (method === 'GET') return await handleHomeroomSummary(context);
      return errorResponse('Method not allowed', 405);
    }
    if (pathname === '/api/homeroom/calendar') {
      if (method === 'GET') return await handleHomeroomCalendar(request, context);
      return errorResponse('Method not allowed', 405);
    }
    if (pathname === '/api/homeroom/notes-overview') {
      if (method === 'GET') return await handleHomeroomNotesOverview(request, context);
      return errorResponse('Method not allowed', 405);
    }

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

    // /api/student/:id/homeroom (담임 지정/전환, admin)
    const homeroomMatch = pathname.match(/^\/api\/student\/([^/]+)\/homeroom$/);
    if (homeroomMatch) {
      if (method === 'PUT') return await handleSetHomeroom(request, context, homeroomMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id/notes (교과 선생님 메모)
    const notesMatch = pathname.match(/^\/api\/student\/([^/]+)\/notes$/);
    if (notesMatch) {
      if (method === 'GET')  return await handleListNotes(request, context, notesMatch[1]);
      if (method === 'POST') return await handleCreateNote(request, context, notesMatch[1]);
      return errorResponse('Method not allowed', 405);
    }
    const noteItemMatch = pathname.match(/^\/api\/student\/([^/]+)\/notes\/([^/]+)$/);
    if (noteItemMatch) {
      if (method === 'PATCH')  return await handleUpdateNote(request, context, noteItemMatch[1], noteItemMatch[2]);
      if (method === 'DELETE') return await handleDeleteNote(context, noteItemMatch[1], noteItemMatch[2]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id/consultations (학부모 상담 로그, 공유)
    const consultationsMatch = pathname.match(/^\/api\/student\/([^/]+)\/consultations$/);
    if (consultationsMatch) {
      if (method === 'GET') return await handleListConsultations(request, context, consultationsMatch[1]);
      if (method === 'POST') return await handleCreateConsultation(request, context, consultationsMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id/consultations/:cid
    const consultationItemMatch = pathname.match(/^\/api\/student\/([^/]+)\/consultations\/([^/]+)$/);
    if (consultationItemMatch) {
      if (method === 'DELETE')
        return await handleDeleteConsultation(context, consultationItemMatch[1], consultationItemMatch[2]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id/schedules (외부 일정, 공유)
    const schedulesMatch = pathname.match(/^\/api\/student\/([^/]+)\/schedules$/);
    if (schedulesMatch) {
      if (method === 'GET') return await handleListSchedules(context, schedulesMatch[1], canAccessStudent);
      if (method === 'POST') return await handleCreateSchedule(request, context, schedulesMatch[1], canAccessStudent);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id/schedules/from-exam-period/:periodId
    const importExamMatch = pathname.match(
      /^\/api\/student\/([^/]+)\/schedules\/from-exam-period\/([^/]+)$/
    );
    if (importExamMatch) {
      if (method === 'POST')
        return await handleImportExamPeriod(context, importExamMatch[1], importExamMatch[2], canAccessStudent);
      return errorResponse('Method not allowed', 405);
    }

    // /api/student/:id/schedules/:sid
    const scheduleItemMatch = pathname.match(/^\/api\/student\/([^/]+)\/schedules\/([^/]+)$/);
    if (scheduleItemMatch) {
      if (method === 'DELETE')
        return await handleDeleteSchedule(context, scheduleItemMatch[1], scheduleItemMatch[2]);
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
