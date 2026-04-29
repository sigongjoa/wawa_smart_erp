/**
 * 선생님 관리 라우트 핸들러
 */

import { RequestContext, Env } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeQuery, executeInsert, executeUpdate } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { shouldBlockTestDataInProd } from '@/middleware/test-data-guard';
import { logger } from '@/utils/logger';
import { getAcademyId } from '@/utils/context';
import { handleRouteError } from '@/utils/error-handler';
import { generatePrefixedId } from '@/utils/id';
import { hashPin } from '@/utils/crypto';
import { teacherNamesRateLimit } from '@/middleware/rateLimit';
import { z } from 'zod';

// CSV 마이그레이션 한도 — 메모리·CPU 보호 (TEACH-SEC-H4)
const CSV_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const CSV_MAX_ROWS = 10_000;
const CSV_BATCH_SIZE = 50;
const CSV_HEADER_ALLOWLIST = new Set([
  'id', 'ID', 'student_id',
  'name', 'Name', '이름',
  'grade', 'Grade', '학년',
  'class_id', 'class', 'Class', '반',
]);

// 임시 PIN 만료 (TEACH-SEC-H3)
const TEMP_PIN_TTL_HOURS = 24;

// ==================== 스키마 ====================
const CreateTeacherSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다').max(100),
  pin: z.string().min(4, 'PIN은 최소 4자 이상이어야 합니다').max(20),
  subjects: z.array(z.string()).min(1, '최소 하나의 과목을 선택해주세요'),
  isAdmin: z.boolean().default(false),
});

type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>;

const UpdateTeacherSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['instructor', 'admin']).optional(),
  subjects: z.array(z.string()).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

// ==================== 헬퍼 함수 ====================

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

    // prod 환경에서 테스트 패턴 이름/이메일 생성 차단 (E2E 테스트 오염 재발 방지)
    if (shouldBlockTestDataInProd(context.env.ENVIRONMENT, input.name)) {
      logger.warn(
        `prod 테스트 데이터 생성 시도 차단: name=${input.name} ip=${ipAddress}`
      );
      return errorResponse(
        '테스트 패턴의 이름(테스트_, 강사_, 라이브테스트_ 등)은 프로덕션에서 생성할 수 없습니다',
        403
      );
    }

    logger.logRequest('POST', '/api/teachers', undefined, ipAddress);

    // 같은 학원 내 이름 중복 확인
    const academyId = getAcademyId(context);
    const existingTeacher = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM users WHERE name = ? AND academy_id = ? LIMIT 1',
      [input.name, academyId]
    );

    if (existingTeacher) {
      return errorResponse('이미 등록된 선생님입니다', 409);
    }

    // PIN 해싱
    const pinHash = await hashPin(input.pin);

    // 선생님 생성
    const teacherId = generatePrefixedId('user');
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
async function fetchStudentsFromNotion(
  env: Env
): Promise<Array<{ name: string; subjects: string[] }>> {
  const NOTION_API_KEY = env.NOTION_API_KEY || '';
  if (!NOTION_API_KEY) {
    logger.warn('NOTION_API_KEY 미설정 — 빈 배열 반환');
    return [];
  }
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
    logger.error('Notion 데이터 조회 오류', error instanceof Error ? error : new Error(String(error)));
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
    const notionStudents = await fetchStudentsFromNotion(context.env);

    // D1에서 기존 학생 목록 조회
    const d1Students = await executeQuery<any>(
      context.env.DB,
      'SELECT id, name FROM students WHERE academy_id = ?',
      [getAcademyId(context)]
    );

    // 이름으로 매칭하여 subjects 업데이트 — D1 batch (TEACH-PERF-M2)
    const notionByName = new Map(notionStudents.map((s) => [s.name, s.subjects]));
    const updateStmt = context.env.DB.prepare('UPDATE students SET subjects = ? WHERE id = ?');
    let updatedCount = 0;
    let pending: any[] = [];
    const BATCH = 50;
    for (const d1Student of d1Students) {
      const subjects = notionByName.get(d1Student.name);
      if (!subjects || subjects.length === 0) continue;
      pending.push(updateStmt.bind(JSON.stringify(subjects), d1Student.id));
      if (pending.length >= BATCH) {
        await context.env.DB.batch(pending);
        updatedCount += pending.length;
        pending = [];
      }
    }
    if (pending.length > 0) {
      await context.env.DB.batch(pending);
      updatedCount += pending.length;
    }

    // 최종 학생 수 조회
    const finalStudents = await executeQuery<any>(
      context.env.DB,
      'SELECT COUNT(*) as count FROM students WHERE academy_id = ?',
      [getAcademyId(context)]
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

    // 크기 제한 — 메모리/CPU 보호 (TEACH-SEC-H4)
    if (csvFile.size > CSV_MAX_BYTES) {
      return errorResponse(
        `CSV 크기가 한도(${CSV_MAX_BYTES / 1024 / 1024}MB)를 초과했습니다`,
        413,
      );
    }

    // CSV 내용 읽기
    const csvContent = await csvFile.text();
    const lines = csvContent.split('\n').filter((line: string) => line.trim());

    if (lines.length < 2) {
      return errorResponse('유효한 데이터가 없습니다', 400);
    }
    if (lines.length - 1 > CSV_MAX_ROWS) {
      return errorResponse(`행 수가 한도(${CSV_MAX_ROWS})를 초과했습니다`, 413);
    }

    // 헤더 파싱 + 화이트리스트 — prototype pollution 방어 (TEACH-SEC-H4)
    const rawHeaders = lines[0]
      .split(',')
      .map((h: string) => h.trim().replace(/^["']|["']$/g, ''));
    const headers = rawHeaders.map((h: string) => (CSV_HEADER_ALLOWLIST.has(h) ? h : ''));

    logger.info(`CSV 파싱 완료: ${lines.length - 1}행`);

    // 기존 학생 ID 조회 (중복 방지)
    const existingStudents = await executeQuery<any>(
      context.env.DB,
      'SELECT id FROM students WHERE academy_id = ?',
      [getAcademyId(context)]
    );
    const existingIds = new Set(existingStudents.map((s: any) => s.id));

    // CSV에서 학생 추가 — D1 batch (TEACH-PERF-M1)
    let insertedCount = 0;
    let skippedCount = 0;
    const academyId = getAcademyId(context);
    const insertStmt = context.env.DB.prepare(
      `INSERT OR IGNORE INTO students (id, name, grade, class_id, academy_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
    );
    let batch: any[] = [];

    const flush = async () => {
      if (batch.length === 0) return;
      const results = await context.env.DB.batch(batch);
      for (const r of results) {
        const changes = (r.meta?.changes ?? 0) as number;
        if (changes > 0) insertedCount++; else skippedCount++;
      }
      batch = [];
    };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]
        .split(',')
        .map((v: string) => v.trim().replace(/^["']|["']$/g, ''));
      // null-prototype 객체로 prototype 키 오염 차단 (TEACH-SEC-H4)
      const row: Record<string, string> = Object.create(null);
      headers.forEach((header: string, index: number) => {
        if (header) row[header] = values[index] || '';
      });

      const studentId =
        row['id'] || row['ID'] || row['student_id'] || generatePrefixedId('student');
      const name = row['name'] || row['Name'] || row['이름'] || '';
      const grade = row['grade'] || row['Grade'] || row['학년'] || 'unknown';
      const classId = row['class_id'] || row['class'] || row['Class'] || row['반'] || 'class-1';

      if (!name || existingIds.has(studentId)) {
        skippedCount++;
        continue;
      }
      existingIds.add(studentId);
      batch.push(insertStmt.bind(studentId, name, grade, classId, academyId));
      if (batch.length >= CSV_BATCH_SIZE) await flush();
    }
    await flush();

    // 최종 학생 수 조회
    const finalStudents = await executeQuery<any>(
      context.env.DB,
      'SELECT COUNT(*) as count FROM students WHERE academy_id = ?',
      [getAcademyId(context)]
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
      `SELECT id, name, email, role, status, subjects, academy_id, last_login_at, created_at, updated_at
       FROM users
       WHERE academy_id = ? AND role IN ('instructor', 'admin')
       ORDER BY
         CASE status WHEN 'active' THEN 0 WHEN 'disabled' THEN 1 ELSE 2 END,
         name`,
      [context.auth.academyId]
    );

    // subjects JSON 파싱
    const parsed = teachers.map((t: any) => ({
      ...t,
      subjects: t.subjects ? safeJsonArray(t.subjects) : [],
    }));

    return successResponse(parsed);
  } catch (error) {
    logger.error('선생님 목록 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('선생님 목록 조회에 실패했습니다', 500);
  }
}

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * PATCH /api/teachers/:id — 선생님 수정 (admin only, 같은 학원)
 * 규칙:
 *  - 본인 role 변경 금지 (자기 admin 박탈 방지)
 *  - 마지막 남은 admin은 role/status 변경으로 admin이 0명이 되지 않도록
 */
async function handleUpdateTeacher(
  teacherId: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  if (!requireRole(context, 'admin')) {
    return errorResponse('관리자만 선생님을 수정할 수 있습니다', 403);
  }

  const body = await request.json() as any;
  const input = UpdateTeacherSchema.parse(body);
  const academyId = getAcademyId(context);
  const myId = context.auth!.userId;

  // 대상 유저 조회 + 같은 학원 확인
  const target = await executeFirst<any>(
    context.env.DB,
    `SELECT id, name, role, status FROM users WHERE id = ? AND academy_id = ?`,
    [teacherId, academyId]
  );
  if (!target) return errorResponse('선생님을 찾을 수 없습니다', 404);

  // 자기 자신 role/status 변경 금지
  if (teacherId === myId && (input.role !== undefined || input.status !== undefined)) {
    return errorResponse('본인의 역할/상태는 변경할 수 없습니다', 403);
  }

  // 마지막 admin 보호
  const isDowngrade = target.role === 'admin' && input.role && input.role !== 'admin';
  const isDisable = target.role === 'admin' && input.status === 'disabled' && target.status !== 'disabled';
  if (isDowngrade || isDisable) {
    const count = await executeFirst<{ c: number }>(
      context.env.DB,
      `SELECT COUNT(*) as c FROM users
       WHERE academy_id = ? AND role = 'admin' AND COALESCE(status,'active') = 'active' AND id != ?`,
      [academyId, teacherId]
    );
    if (!count || count.c === 0) {
      return errorResponse('최소 1명의 활성 관리자가 유지되어야 합니다', 400);
    }
  }

  // 이름 중복 체크
  if (input.name && input.name !== target.name) {
    const dup = await executeFirst<{ id: string }>(
      context.env.DB,
      `SELECT id FROM users WHERE academy_id = ? AND name = ? AND id != ?`,
      [academyId, input.name, teacherId]
    );
    if (dup) return errorResponse('같은 이름의 선생님이 이미 있습니다', 409);
  }

  const fields: string[] = [];
  const values: any[] = [];
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.role !== undefined) { fields.push('role = ?'); values.push(input.role); }
  if (input.subjects !== undefined) { fields.push('subjects = ?'); values.push(JSON.stringify(input.subjects)); }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }

  if (fields.length === 0) return errorResponse('수정할 필드가 없습니다', 400);
  fields.push("updated_at = datetime('now')");
  values.push(teacherId);

  await executeUpdate(
    context.env.DB,
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  logger.info(`선생님 수정: ${teacherId} by ${myId}`);

  const updated = await executeFirst<any>(
    context.env.DB,
    `SELECT id, name, email, role, status, subjects, last_login_at, updated_at FROM users WHERE id = ?`,
    [teacherId]
  );
  if (updated) updated.subjects = updated.subjects ? safeJsonArray(updated.subjects) : [];

  return successResponse(updated);
}

/**
 * DELETE /api/teachers/:id — 선생님 비활성화 (soft-delete, admin only)
 * 하드 삭제 금지 — 기존 레포트·성적·수업 FK 보호
 */
async function handleDeleteTeacher(
  teacherId: string,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  if (!requireRole(context, 'admin')) {
    return errorResponse('관리자만 선생님을 비활성화할 수 있습니다', 403);
  }

  const academyId = getAcademyId(context);
  const myId = context.auth!.userId;

  if (teacherId === myId) {
    return errorResponse('본인 계정은 비활성화할 수 없습니다', 403);
  }

  const target = await executeFirst<any>(
    context.env.DB,
    `SELECT id, role, COALESCE(status,'active') as status FROM users WHERE id = ? AND academy_id = ?`,
    [teacherId, academyId]
  );
  if (!target) return errorResponse('선생님을 찾을 수 없습니다', 404);
  if (target.status === 'disabled') {
    return successResponse({ message: '이미 비활성화된 계정입니다' });
  }

  // 마지막 admin 보호
  if (target.role === 'admin') {
    const count = await executeFirst<{ c: number }>(
      context.env.DB,
      `SELECT COUNT(*) as c FROM users
       WHERE academy_id = ? AND role = 'admin' AND COALESCE(status,'active') = 'active' AND id != ?`,
      [academyId, teacherId]
    );
    if (!count || count.c === 0) {
      return errorResponse('최소 1명의 활성 관리자가 유지되어야 합니다', 400);
    }
  }

  await executeUpdate(
    context.env.DB,
    `UPDATE users SET status = 'disabled', updated_at = datetime('now') WHERE id = ?`,
    [teacherId]
  );

  logger.info(`선생님 비활성화: ${teacherId} by ${myId}`);
  return successResponse({ message: '선생님이 비활성화되었습니다' });
}

/**
 * POST /api/teachers/:id/reset-pin — PIN 재발급 (admin only)
 * 임시 PIN 6자리 숫자를 반환 (1회)
 */
async function handleResetTeacherPin(
  teacherId: string,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  if (!requireRole(context, 'admin')) {
    return errorResponse('관리자만 PIN을 재설정할 수 있습니다', 403);
  }

  const academyId = getAcademyId(context);
  const target = await executeFirst<any>(
    context.env.DB,
    `SELECT id FROM users WHERE id = ? AND academy_id = ?`,
    [teacherId, academyId]
  );
  if (!target) return errorResponse('선생님을 찾을 수 없습니다', 404);

  // 6자리 숫자 PIN — 기각 샘플링으로 modulo 편향 제거 (TEACH-SEC-L1)
  let tempPin = '';
  while (tempPin.length < 6) {
    const buf = crypto.getRandomValues(new Uint8Array(8));
    for (const b of buf) {
      if (b < 250) {
        tempPin += String(b % 10);
        if (tempPin.length === 6) break;
      }
    }
  }

  // TEACH-SEC-H3: 강제변경 플래그 + 발급 시각 + 기존 세션 전체 폐기
  const pinHash = await hashPin(tempPin);
  await context.env.DB.batch([
    context.env.DB
      .prepare(
        `UPDATE users
            SET password_hash = ?,
                password_must_change = 1,
                password_reset_at = datetime('now'),
                updated_at = datetime('now')
          WHERE id = ?`
      )
      .bind(pinHash, teacherId),
    context.env.DB
      .prepare(`DELETE FROM sessions WHERE user_id = ?`)
      .bind(teacherId),
  ]);

  logger.info(`PIN 재설정: ${teacherId} by ${context.auth!.userId} (sessions revoked)`);
  // TEACH-SEC-H2 partial: 평문 PIN 응답이라 proxy/CDN cache·로그 노출 차단을 위해
  // Cache-Control: no-store + private 강제.
  const resp = successResponse({
    tempPin,
    expiresInHours: TEMP_PIN_TTL_HOURS,
    mustChange: true,
    message: `임시 PIN을 안전한 채널로 ${TEMP_PIN_TTL_HOURS}시간 이내에 전달하세요. 첫 로그인 시 변경이 강제됩니다.`,
  });
  resp.headers.set('Cache-Control', 'no-store, private, max-age=0');
  resp.headers.set('Pragma', 'no-cache');
  return resp;
}

/**
 * GET /api/teachers/names?slug=xxx - 이름 목록만 조회 (공개 - 로그인 페이지용)
 * slug로 학원 식별, 이메일/역할 등 민감 정보 미포함
 */
async function handleGetTeacherNames(context: RequestContext): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
      return errorResponse('학원코드(slug)가 필요합니다', 400);
    }

    // 무인증 엔드포인트 — 스크래핑/열거 방어 (TEACH-SEC-H1)
    const blocked = await teacherNamesRateLimit(context.env.KV, context.request, slug);
    if (blocked) return blocked;

    // 비활성 강사는 로그인 드롭다운에서 제외 — TEACH-SEC-M4 부분 완화
    const teachers = await executeQuery<{ name: string }>(
      context.env.DB,
      `SELECT u.name FROM users u
       JOIN academies a ON u.academy_id = a.id
       WHERE a.slug = ? AND a.is_active = 1
         AND u.role IN ('instructor', 'admin')
         AND COALESCE(u.status, 'active') = 'active'
       ORDER BY u.name`,
      [slug]
    );

    // 학원 기본 정보도 함께 반환 (로고, 이름)
    const academy = await executeFirst<{ name: string; logo_url: string | null }>(
      context.env.DB,
      'SELECT name, logo_url FROM academies WHERE slug = ? AND is_active = 1',
      [slug]
    );

    return successResponse({
      teachers: teachers.map(t => t.name),
      academy: academy ? { name: academy.name, logo: academy.logo_url } : null,
    });
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

    // /api/teachers/:id/reset-pin
    const resetMatch = pathname.match(/^\/api\/teachers\/([^/]+)\/reset-pin$/);
    if (resetMatch && method === 'POST') {
      return await handleResetTeacherPin(resetMatch[1], context);
    }

    // /api/teachers/:id (PATCH / DELETE)
    const idMatch = pathname.match(/^\/api\/teachers\/([^/]+)$/);
    if (idMatch) {
      if (method === 'PATCH') return await handleUpdateTeacher(idMatch[1], request, context);
      if (method === 'DELETE') return await handleDeleteTeacher(idMatch[1], context);
    }

    if (pathname === '/api/migrate/notion-to-d1' && method === 'POST') {
      return await handleMigrateNotionToD1(request, context);
    }

    if (pathname === '/api/migrate/csv' && method === 'POST') {
      return await handleMigrateCSV(request, context);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      return errorResponse(`입력 검증 오류: ${message}`, 400);
    }
    logger.error('Teachers handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('Internal server error', 500);
  }
}
