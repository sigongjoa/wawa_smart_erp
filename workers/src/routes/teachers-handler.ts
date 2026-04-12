/**
 * 선생님 관리 라우트 핸들러
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeQuery, executeInsert, executeUpdate } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { getAcademyId } from '@/utils/context';
import { handleRouteError } from '@/utils/error-handler';
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
      [teacherId, uniqueEmail, input.name, pinHash, role, getAcademyId(context), now, now]
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
    return handleRouteError(error, '선생님 추가', { ipAddress });
  }
}

/**
 * Notion API에서 학생 데이터 가져오기 (레거시 - 마이그레이션용)
 */
async function fetchStudentsFromNotion(): Promise<Array<{ name: string; subjects: string[] }>> {
  // Notion API 토큰은 환경 변수에서 가져오기 (hardcoded 제거)
  const NOTION_API_KEY = typeof process !== 'undefined' && process.env?.NOTION_API_KEY
    ? process.env.NOTION_API_KEY
    : '';
  const DB_STUDENTS = '2f973635-f415-802d-b167-f5cb13265758';

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DB_STUDENTS}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = (await response.json()) as any;
    const students: Array<{ name: string; subjects: string[] }> = [];

    for (const item of data.results || []) {
      const props = item.properties || {};
      const name = props['이름']?.title?.[0]?.plain_text;
      const subjects = (props['수강과목']?.multi_select || []).map((s: any) => s.name);

      if (name) {
        students.push({ name, subjects });
      }
    }

    return students;
  } catch (error) {
    console.error('Notion 데이터 조회 오류:', error);
    return [];
  }
}

/**
 * POST /api/migrate/notion-to-d1 - Notion 데이터 마이그레이션
 * Notion에서 학생의 수강과목 정보를 가져와 D1에 업데이트
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

    // Notion에서 학생 데이터 가져오기
    const notionStudents = await fetchStudentsFromNotion();

    // D1에서 기존 학생 목록 조회
    const d1Students = await executeQuery<any>(
      context.env.DB,
      'SELECT id, name FROM students WHERE academy_id = ?',
      ['acad-1']
    );

    // 이름으로 매칭하여 subjects 업데이트
    let updatedCount = 0;
    for (const d1Student of d1Students) {
      const notionStudent = notionStudents.find(s => s.name === d1Student.name);

      if (notionStudent && notionStudent.subjects.length > 0) {
        // subjects를 JSON 배열로 저장
        const subjectsJson = JSON.stringify(notionStudent.subjects);

        await executeUpdate(
          context.env.DB,
          'UPDATE students SET subjects = ? WHERE id = ?',
          [subjectsJson, d1Student.id]
        );

        updatedCount++;
      }
    }

    // 최종 학생 수 조회
    const finalStudents = await executeQuery<any>(
      context.env.DB,
      'SELECT COUNT(*) as count FROM students WHERE academy_id = ?',
      ['acad-1']
    );

    const finalCount = finalStudents[0]?.count || 0;

    // 응답 반환
    return successResponse({
      notionCount: notionStudents.length,
      d1Count: d1Students.length,
      updatedCount: updatedCount,
      finalCount: finalCount,
      message: `Notion 데이터 마이그레이션 완료: ${updatedCount}명의 학생 수강과목 업데이트`,
    });
  } catch (error) {
    logger.error('마이그레이션 처리 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('마이그레이션 처리에 실패했습니다', 500);
  }
}

/**
 * CSV 마이그레이션 함수
 */
async function handleMigrateCSV(
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

    logger.logRequest('POST', '/api/migrate/csv', undefined, ipAddress);

    // multipart/form-data 파싱
    const formData = await request.formData();
    const csvFile = formData.get('file') as File | null;

    if (!csvFile) {
      return errorResponse('CSV 파일이 필요합니다', 400);
    }

    if (!csvFile.name.endsWith('.csv')) {
      return errorResponse('CSV 파일만 지원합니다', 400);
    }

    // CSV 내용 읽기
    const csvContent = await csvFile.text();
    const lines = csvContent.split('\n').filter((line: string) => line.trim());

    if (lines.length < 2) {
      return errorResponse('유효한 데이터가 없습니다', 400);
    }

    // 헤더 파싱
    const headers = lines[0]
      .split(',')
      .map((h: string) => h.trim().replace(/^["']|["']$/g, ''));

    logger.info(`CSV 파싱 완료: ${lines.length - 1}행`);

    // 기존 학생 ID 조회 (중복 방지)
    const existingStudents = await executeQuery<any>(
      context.env.DB,
      'SELECT id FROM students WHERE academy_id = ?',
      ['acad-1']
    );
    const existingIds = new Set(existingStudents.map((s: any) => s.id));

    // CSV에서 학생 추가
    let insertedCount = 0;
    let skippedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]
        .split(',')
        .map((v: string) => v.trim().replace(/^["']|["']$/g, ''));
      const row: Record<string, string> = {};

      headers.forEach((header: string, index: number) => {
        row[header] = values[index] || '';
      });

      // CSV 헤더: id, name, grade, class_id (또는 유사한 형식)
      const studentId =
        row['id'] || row['ID'] || row['student_id'] || `student-${Math.random().toString(36).substr(2, 9)}`;
      const name = row['name'] || row['Name'] || row['이름'] || '';
      const grade = row['grade'] || row['Grade'] || row['학년'] || 'unknown';
      const classId = row['class_id'] || row['class'] || row['Class'] || row['반'] || 'class-1';

      if (!name || existingIds.has(studentId)) {
        skippedCount++;
        continue;
      }

      try {
        await executeInsert(
          context.env.DB,
          `INSERT INTO students (id, name, grade, class_id, academy_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [studentId, name, grade, classId, 'acad-1', 'active']
        );
        insertedCount++;
        existingIds.add(studentId);
      } catch (e) {
        logger.warn(`학생 추가 실패: ${name}`, e instanceof Error ? e : new Error(String(e)));
        skippedCount++;
      }
    }

    // 최종 학생 수 조회
    const finalStudents = await executeQuery<any>(
      context.env.DB,
      'SELECT COUNT(*) as count FROM students WHERE academy_id = ?',
      ['acad-1']
    );

    const finalCount = finalStudents[0]?.count || 0;

    logger.info(`CSV 마이그레이션 완료: 추가=${insertedCount}, 건너뜀=${skippedCount}, 총=${finalCount}`);

    return successResponse({
      success: true,
      totalRows: lines.length - 1,
      insertedCount,
      skippedCount,
      finalCount,
      message: `마이그레이션 완료 - 총 ${finalCount}명 (신규: ${insertedCount}, 건너뜀: ${skippedCount})`,
    });
  } catch (error) {
    logger.error('CSV 마이그레이션 처리 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('CSV 마이그레이션 처리에 실패했습니다', 500);
  }
}

/**
 * GET /api/teachers - 선생님 목록 조회 (인증 필요)
 */
async function handleGetTeachers(context: RequestContext): Promise<Response> {
  try {
    if (!context.auth) return unauthorizedResponse();

    const teachers = await executeQuery<any>(
      context.env.DB,
      `SELECT id, name, email, role, academy_id, created_at, updated_at
       FROM users
       WHERE academy_id = ? AND role IN ('teacher', 'admin')
       ORDER BY name`,
      [context.auth.academyId]
    );

    return successResponse(teachers);
  } catch (error) {
    logger.error('선생님 목록 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('선생님 목록 조회에 실패했습니다', 500);
  }
}

/**
 * GET /api/teachers/names - 이름 목록만 조회 (공개 - 로그인 페이지용)
 * 이메일, 역할 등 민감 정보 미포함
 */
async function handleGetTeacherNames(context: RequestContext): Promise<Response> {
  try {
    const teachers = await executeQuery<{ name: string }>(
      context.env.DB,
      `SELECT name FROM users WHERE academy_id = 'acad-1' AND role IN ('teacher', 'admin') ORDER BY name`,
      []
    );

    return successResponse(teachers.map(t => t.name));
  } catch (error) {
    logger.error('선생님 이름 목록 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('조회 실패', 500);
  }
}

export async function handleTeachers(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (pathname === '/api/teachers/names' && method === 'GET') {
      return await handleGetTeacherNames(context);
    }

    if (pathname === '/api/teachers' && method === 'GET') {
      return await handleGetTeachers(context);
    }

    if (pathname === '/api/teachers' && method === 'POST') {
      return await handleCreateTeacher(request, context);
    }

    if (pathname === '/api/migrate/notion-to-d1' && method === 'POST') {
      return await handleMigrateNotionToD1(request, context);
    }

    if (pathname === '/api/migrate/csv' && method === 'POST') {
      return await handleMigrateCSV(request, context);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Teachers handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('Internal server error', 500);
  }
}
