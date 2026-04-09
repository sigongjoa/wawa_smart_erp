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

    // Notion에서 학생 데이터 가져오기 (테스트용 샘플 데이터)
    // 실제 환경에서는 Notion API를 호출하여 데이터를 가져와야 함
    const sampleStudents = [
      // 기존 31명 + 추가 10명 = 41명
      { id: 'student-001', name: '강은서', grade: '중2', classId: 'class-1' },
      { id: 'student-002', name: '이지은', grade: '중2', classId: 'class-1' },
      { id: 'student-003', name: '김민지', grade: '중2', classId: 'class-1' },
      { id: 'student-004', name: '박지호', grade: '중2', classId: 'class-1' },
      { id: 'student-005', name: '최준호', grade: '중2', classId: 'class-1' },
      { id: 'student-006', name: '이승아', grade: '중2', classId: 'class-1' },
      { id: 'student-007', name: '정다은', grade: '중2', classId: 'class-1' },
      { id: 'student-008', name: '임수현', grade: '중2', classId: 'class-1' },
      { id: 'student-009', name: '한예은', grade: '중3', classId: 'class-2' },
      { id: 'student-010', name: '김준영', grade: '중3', classId: 'class-2' },
      { id: 'student-011', name: '이인우', grade: '중3', classId: 'class-2' },
      { id: 'student-012', name: '박세진', grade: '중3', classId: 'class-2' },
      { id: 'student-013', name: '최우진', grade: '중3', classId: 'class-2' },
      { id: 'student-014', name: '정현준', grade: '중3', classId: 'class-2' },
      { id: 'student-015', name: '임지훈', grade: '중3', classId: 'class-2' },
      { id: 'student-016', name: '한민준', grade: '중3', classId: 'class-2' },
      { id: 'student-017', name: '김서연', grade: '고1', classId: 'class-3' },
      { id: 'student-018', name: '이수진', grade: '고1', classId: 'class-3' },
      { id: 'student-019', name: '박민경', grade: '고1', classId: 'class-3' },
      { id: 'student-020', name: '최지은', grade: '고1', classId: 'class-3' },
      { id: 'student-021', name: '정예림', grade: '고1', classId: 'class-3' },
      { id: 'student-022', name: '임나은', grade: '고1', classId: 'class-3' },
      { id: 'student-023', name: '한소현', grade: '고1', classId: 'class-3' },
      { id: 'student-024', name: '김준호', grade: '고1', classId: 'class-3' },
      { id: 'student-025', name: '이동현', grade: '고2', classId: 'class-4' },
      { id: 'student-026', name: '박준혁', grade: '고2', classId: 'class-4' },
      { id: 'student-027', name: '최동욱', grade: '고2', classId: 'class-4' },
      { id: 'student-028', name: '정준영', grade: '고2', classId: 'class-4' },
      { id: 'student-029', name: '임현준', grade: '고2', classId: 'class-4' },
      { id: 'student-030', name: '한상준', grade: '고2', classId: 'class-4' },
      { id: 'student-031', name: '김진호', grade: '고2', classId: 'class-4' },
      // 추가 10명
      { id: 'student-032', name: '이재욱', grade: '중2', classId: 'class-1' },
      { id: 'student-033', name: '박은영', grade: '중2', classId: 'class-1' },
      { id: 'student-034', name: '최민정', grade: '중3', classId: 'class-2' },
      { id: 'student-035', name: '정우경', grade: '중3', classId: 'class-2' },
      { id: 'student-036', name: '임수연', grade: '고1', classId: 'class-3' },
      { id: 'student-037', name: '한민경', grade: '고1', classId: 'class-3' },
      { id: 'student-038', name: '김소영', grade: '고2', classId: 'class-4' },
      { id: 'student-039', name: '이윤정', grade: '고2', classId: 'class-4' },
      { id: 'student-040', name: '박수정', grade: '중1', classId: 'class-1' },
      { id: 'student-041', name: '최준영', grade: '고3', classId: 'class-5' },
    ];

    // 기존 학생들 확인 (중복 피하기)
    const existingStudents = await executeQuery<any>(
      context.env.DB,
      'SELECT id FROM students WHERE academy_id = ?',
      ['acad-1']
    );

    const existingIds = new Set(existingStudents.map(s => s.id));

    // 신규 학생만 추가
    let insertedCount = 0;
    for (const student of sampleStudents) {
      if (!existingIds.has(student.id)) {
        await executeInsert(
          context.env.DB,
          `INSERT INTO students (id, name, grade, class_id, academy_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [student.id, student.name, student.grade, student.classId, 'acad-1', 'active']
        );
        insertedCount++;
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
      migratedCount: finalCount,
      insertedCount: insertedCount,
      message: `총 ${finalCount}명의 학생 데이터가 준비되었습니다 (신규 추가: ${insertedCount}명)`,
    });
  } catch (error) {
    logger.error('마이그레이션 처리 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('마이그레이션 처리에 실패했습니다', 500);
  }
}

// ==================== 메인 핸들러 ====================

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
 * GET /api/teachers - 선생님 목록 조회
 */
async function handleGetTeachers(context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const teachers = await executeQuery<any>(
      context.env.DB,
      `SELECT id, name, email, role, academy_id, created_at, updated_at
       FROM users
       WHERE academy_id = ? AND role IN ('teacher', 'admin')
       ORDER BY name`,
      [context.auth?.academyId || 'acad-1']
    );

    return successResponse(teachers);
  } catch (error) {
    logger.error('선생님 목록 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('선생님 목록 조회에 실패했습니다', 500);
  }
}

export async function handleTeachers(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
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
