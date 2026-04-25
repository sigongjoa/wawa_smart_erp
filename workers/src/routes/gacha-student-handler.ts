/**
 * 가차 학생 관리 핸들러
 * 학�� → 선생님 → 학생 계층 구조
 * PIN 기반 학생 인증 (PBKDF2-SHA256)
 */
import { RequestContext } from '@/types';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert, executeUpdate, executeDelete } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { logger } from '@/utils/logger';

// ── PIN 해싱 (PBKDF2-SHA256) ──

async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 10000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── 입력 검증 ──

interface CreateStudentInput {
  name: string;
  pin: string;
  grade?: string;
}

interface UpdateStudentInput {
  name?: string;
  grade?: string;
  status?: string;
  school?: string | null;
}

function validateCreateInput(body: any): CreateStudentInput {
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    throw new Error('입력 검증 오류: ���생 이름은 필수입니다');
  }
  if (!body.pin || typeof body.pin !== 'string' || !/^\d{4}$/.test(body.pin)) {
    throw new Error('입력 검증 오류: PIN은 4자리 숫자여야 합니다');
  }
  return {
    name: body.name.trim(),
    pin: body.pin,
    grade: body.grade?.trim() || null,
  };
}

function validateUpdateInput(body: any): UpdateStudentInput {
  const result: UpdateStudentInput = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw new Error('입력 검증 오류: 학생 이름이 유효하지 않습니다');
    }
    result.name = body.name.trim();
  }
  if (body.grade !== undefined) result.grade = body.grade?.trim() || null;
  if (body.school !== undefined) result.school = body.school?.trim() || null;
  if (body.status !== undefined) {
    if (!['active', 'inactive'].includes(body.status)) {
      throw new Error('입력 검증 오류: 상태는 active 또는 inactive여야 합니다');
    }
    result.status = body.status;
  }
  return result;
}

// ── 핸들러 함수들 ──

async function handleGetStudents(context: RequestContext, request?: Request): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  const isAdmin = context.auth!.role === 'admin';
  const scope = request ? new URL(request.url).searchParams.get('scope') : null;
  const showAll = isAdmin && scope === 'all';

  let query = `
    SELECT gs.*,
      (SELECT COUNT(*) FROM gacha_cards gc WHERE gc.student_id = gs.id) as card_count,
      (SELECT COUNT(*) FROM proof_assignments pa WHERE pa.student_id = gs.id) as proof_count
    FROM gacha_students gs
    WHERE gs.academy_id = ?
  `;
  const params: unknown[] = [academyId];

  if (!showAll) {
    query += ' AND gs.teacher_id = ?';
    params.push(userId);
  }
  query += ' ORDER BY gs.created_at DESC';

  const students = await executeQuery<any>(context.env.DB, query, params);
  return successResponse(students);
}

async function handleGetStudent(context: RequestContext, studentId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const student = await executeFirst<any>(
    context.env.DB,
    `SELECT gs.*,
      (SELECT COUNT(*) FROM gacha_cards gc WHERE gc.student_id = gs.id) as card_count,
      (SELECT COUNT(*) FROM proof_assignments pa WHERE pa.student_id = gs.id) as proof_count,
      (SELECT COUNT(*) FROM gacha_sessions gse WHERE gse.student_id = gs.id) as session_count
    FROM gacha_students gs
    WHERE gs.id = ? AND gs.academy_id = ?`,
    [studentId, academyId]
  );
  if (!student) {
    return errorResponse('학생을 찾을 수 없습니다', 404);
  }
  return successResponse(student);
}

async function handleCreateStudent(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const body = await request.json() as any;
  const input = validateCreateInput(body);
  const academyId = getAcademyId(context);
  const teacherId = getUserId(context);

  // 중복 체크
  const existing = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM gacha_students WHERE academy_id = ? AND teacher_id = ? AND name = ?',
    [academyId, teacherId, input.name]
  );
  if (existing) {
    return errorResponse('같은 이름의 학생이 이미 존재합니다', 409);
  }

  const studentId = generatePrefixedId('gstu');
  const salt = generateSalt();
  const pinHash = await hashPin(input.pin, salt);
  const now = new Date().toISOString();

  await executeInsert(
    context.env.DB,
    `INSERT INTO gacha_students (id, academy_id, teacher_id, name, pin_hash, pin_salt, grade, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [studentId, academyId, teacherId, input.name, pinHash, salt, input.grade, now]
  );

  // 시험 배정/과제 등에서 FK가 students(id)를 참조하므로 동일 id로 students에도 insert
  try {
    await executeInsert(
      context.env.DB,
      `INSERT INTO students (id, academy_id, name, grade, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      [studentId, academyId, input.name, input.grade, now, now]
    );
  } catch (e) {
    // 이미 있으면 무시
    logger.warn('students 동기화 실패 (이미 존재 가능)', e instanceof Error ? e : new Error(String(e)));
  }

  logger.logAudit('GACHA_STUDENT_CREATE', 'GachaStudent', studentId, teacherId, { name: input.name });

  return successResponse({ id: studentId, name: input.name, grade: input.grade }, 201);
}

async function handleUpdateStudent(request: Request, context: RequestContext, studentId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const body = await request.json() as any;
  const input = validateUpdateInput(body);

  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM gacha_students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) {
    return errorResponse('학생을 찾을 수 없습니다', 404);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
  if (input.grade !== undefined) { sets.push('grade = ?'); params.push(input.grade); }
  if (input.school !== undefined) { sets.push('school = ?'); params.push(input.school); }
  if (input.status !== undefined) { sets.push('status = ?'); params.push(input.status); }
  if (sets.length === 0) {
    return errorResponse('입력 검증 오��: 수정할 필드가 없습니다', 400);
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(studentId);

  await executeUpdate(
    context.env.DB,
    `UPDATE gacha_students SET ${sets.join(', ')} WHERE id = ?`,
    params
  );

  return successResponse({ id: studentId, ...input });
}

async function handleDeleteStudent(context: RequestContext, studentId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM gacha_students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) {
    return errorResponse('학생을 찾을 수 없습니다', 404);
  }

  // CASCADE로 관련 데이터 자동 삭제 (sessions, results, assignments)
  await executeDelete(context.env.DB, 'DELETE FROM gacha_students WHERE id = ?', [studentId]);
  // 동기화된 students 레코드도 정리 (존재하지 않을 수 있음)
  try { await executeDelete(context.env.DB, 'DELETE FROM students WHERE id = ?', [studentId]); } catch {}

  logger.logAudit('GACHA_STUDENT_DELETE', 'GachaStudent', studentId, getUserId(context), { name: student.name });

  return successResponse({ id: studentId, deleted: true });
}

async function handleResetPin(request: Request, context: RequestContext, studentId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const body = await request.json().catch(() => ({})) as any;

  // 두 모드: (a) body.pin 직접 지정  (b) body.generate=true → 서버가 4자리 랜덤 생성 후 응답에 노출
  let pin: string;
  if (body.generate === true) {
    // 0000~9999 균등 — 단방향 해시는 보존, 평문은 응답에 한 번만 포함
    const buf = new Uint8Array(2);
    crypto.getRandomValues(buf);
    const n = ((buf[0] << 8) | buf[1]) % 10000;
    pin = String(n).padStart(4, '0');
  } else {
    if (!body.pin || !/^\d{4}$/.test(body.pin)) {
      return errorResponse('입력 검증 오류: PIN은 4자리 숫자여야 합니다', 400);
    }
    pin = body.pin;
  }

  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM gacha_students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) {
    return errorResponse('학생을 찾을 수 없습니다', 404);
  }

  const salt = generateSalt();
  const pinHash = await hashPin(pin, salt);

  await executeUpdate(
    context.env.DB,
    'UPDATE gacha_students SET pin_hash = ?, pin_salt = ?, updated_at = ? WHERE id = ?',
    [pinHash, salt, new Date().toISOString(), studentId]
  );

  // generate=true 일 때만 평문 포함 (강사가 학생에게 전달용, 한 번만 노출)
  return successResponse({
    id: studentId,
    pinReset: true,
    ...(body.generate === true ? { pin } : {}),
  });
}

// ── 메인 라우터 ──

export async function handleGachaStudent(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/gacha/students
    if (pathname === '/api/gacha/students') {
      if (method === 'GET') return await handleGetStudents(context, request);
      if (method === 'POST') return await handleCreateStudent(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/gacha/students/:id/reset-pin
    const resetPinMatch = pathname.match(/^\/api\/gacha\/students\/([^/]+)\/reset-pin$/);
    if (resetPinMatch) {
      if (method === 'POST') return await handleResetPin(request, context, resetPinMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/gacha/students/:id
    const idMatch = pathname.match(/^\/api\/gacha\/students\/([^/]+)$/);
    if (idMatch) {
      const id = idMatch[1];
      if (method === 'GET') return await handleGetStudent(context, id);
      if (method === 'PATCH') return await handleUpdateStudent(request, context, id);
      if (method === 'DELETE') return await handleDeleteStudent(context, id);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, '가차 학생 관리');
  }
}
