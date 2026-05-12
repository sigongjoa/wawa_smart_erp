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

// SEC-PIN-KDF: 신규 PIN 해싱은 utils/crypto.ts (100k iter, salt 포맷).
// 기존 학생의 legacy hash(10k iter)는 gacha-play-handler.ts:handleLogin이
// verify 시 자동으로 새 형식으로 재해시.
import { hashPin } from '@/utils/crypto';

// SEC-GSTU-M2: 텍스트 위생화 — utils/sanitize.ts로 통일 (라운드 24)
import { sanitizeText, sanitizeNullable } from '@/utils/sanitize';
import { markNotificationsReadByPayloadKey } from '@/services/notify';

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
  // SEC-GSTU-M2: name 위생화 + 길이 캡 50
  const cleanName = sanitizeText(body.name, 50);
  if (!cleanName) throw new Error('입력 검증 오류: 학생 이름은 필수입니다');
  if (!body.pin || typeof body.pin !== 'string' || !/^\d{4}$/.test(body.pin)) {
    throw new Error('입력 검증 오류: PIN은 4자리 숫자여야 합니다');
  }
  return {
    name: cleanName,
    pin: body.pin,
    grade: sanitizeNullable(body.grade, 30) ?? undefined,
  };
}

function validateUpdateInput(body: any): UpdateStudentInput {
  const result: UpdateStudentInput = {};
  if (body.name !== undefined) {
    const cleanName = sanitizeText(body.name, 50);
    if (!cleanName) throw new Error('입력 검증 오류: 학생 이름이 유효하지 않습니다');
    result.name = cleanName;
  }
  if (body.grade !== undefined) result.grade = sanitizeNullable(body.grade, 30) ?? undefined;
  if (body.school !== undefined) result.school = sanitizeNullable(body.school, 100);
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
  // SEC-GSTU-H1: instructor는 본인 학생만 조회. admin은 학원 전체.
  if (context.auth!.role !== 'admin' && student.teacher_id !== getUserId(context)) {
    return errorResponse('담당 학생이 아닙니다', 403);
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
  // SEC-PIN-KDF: 100k iter pbkdf2$... 형식. pin_salt는 NULL (포맷 안에 salt 인코딩됨).
  const pinHash = await hashPin(input.pin);
  const now = new Date().toISOString();

  await executeInsert(
    context.env.DB,
    `INSERT INTO gacha_students (id, academy_id, teacher_id, name, pin_hash, pin_salt, grade, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    [studentId, academyId, teacherId, input.name, pinHash, input.grade, now]
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
  // SEC-GSTU-H1: instructor는 본인 담당 학생만 수정 가능. admin은 학원 전체.
  if (context.auth!.role !== 'admin' && student.teacher_id !== getUserId(context)) {
    return errorResponse('담당 학생이 아닙니다', 403);
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
  // SEC-GSTU-H1: instructor는 본인 학생만 삭제. admin은 학원 전체.
  if (context.auth!.role !== 'admin' && student.teacher_id !== getUserId(context)) {
    return errorResponse('담당 학생이 아닙니다', 403);
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
    'SELECT id, teacher_id FROM gacha_students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) {
    return errorResponse('학생을 찾을 수 없습니다', 404);
  }
  // SEC-GSTU-H1: instructor는 본인 학생만 PIN 리셋. admin은 학원 전체.
  if (context.auth!.role !== 'admin' && student.teacher_id !== getUserId(context)) {
    return errorResponse('담당 학생이 아닙니다', 403);
  }

  // SEC-PIN-KDF: 100k iter 형식 사용
  const pinHash = await hashPin(pin);

  // pin_salt: NOT NULL 제약 — 새 pbkdf2$ hash는 salt를 hash에 포함, 빈 문자열로 채움.
  await executeUpdate(
    context.env.DB,
    "UPDATE gacha_students SET pin_hash = ?, pin_salt = '', updated_at = ? WHERE id = ?",
    [pinHash, new Date().toISOString(), studentId]
  );

  // generate=true 일 때만 평문 포함 (강사가 학생에게 전달용, 한 번만 노출)
  const resp = successResponse({
    id: studentId,
    pinReset: true,
    ...(body.generate === true ? { pin } : {}),
  });
  // GSTU-H2 partial: 평문 PIN 노출 응답이면 cache 차단
  if (body.generate === true) {
    resp.headers.set('Cache-Control', 'no-store, private, max-age=0');
    resp.headers.set('Pragma', 'no-cache');
  }
  return resp;
}

// ── 학생 자가 가입 요청 (signup-requests) — 교사 검토 ──

interface SignupRequestRow {
  id: string;
  academy_id: string;
  name: string;
  grade: string | null;
  pin_hash: string;
  status: string;
  memo: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reject_reason: string | null;
  requested_teacher_id: string | null;
  requested_teacher_name: string | null;
}

async function handleListSignupRequests(context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const url = new URL(context.request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  if (!['pending', 'rejected', 'all'].includes(status)) {
    return errorResponse('입력 검증 오류: status는 pending|rejected|all', 400);
  }

  const rows = status === 'all'
    ? await executeQuery<SignupRequestRow>(
        context.env.DB,
        `SELECT r.id, r.academy_id, r.name, r.grade, r.status, r.memo,
                r.submitted_at, r.reviewed_at, r.reviewed_by, r.reject_reason,
                r.requested_teacher_id, u.name AS requested_teacher_name
         FROM student_signup_requests r
         LEFT JOIN users u ON u.id = r.requested_teacher_id
         WHERE r.academy_id = ?
         ORDER BY r.submitted_at DESC
         LIMIT 200`,
        [academyId],
      )
    : await executeQuery<SignupRequestRow>(
        context.env.DB,
        `SELECT r.id, r.academy_id, r.name, r.grade, r.status, r.memo,
                r.submitted_at, r.reviewed_at, r.reviewed_by, r.reject_reason,
                r.requested_teacher_id, u.name AS requested_teacher_name
         FROM student_signup_requests r
         LEFT JOIN users u ON u.id = r.requested_teacher_id
         WHERE r.academy_id = ? AND r.status = ?
         ORDER BY r.submitted_at DESC
         LIMIT 200`,
        [academyId, status],
      );

  return successResponse(rows);
}

async function handleApproveSignupRequest(context: RequestContext, requestId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const teacherId = getUserId(context);

  // pending 요청만 승인 가능 (academy_id 격리)
  const req = await executeFirst<SignupRequestRow>(
    context.env.DB,
    `SELECT * FROM student_signup_requests
     WHERE id = ? AND academy_id = ? AND status = 'pending'`,
    [requestId, academyId],
  );
  if (!req) {
    return errorResponse('가입 요청을 찾을 수 없습니다 (이미 처리되었거나 거절됨)', 404);
  }

  // 동명 학생 중복 차단 (race 방어)
  const existing = await executeFirst<{ id: string }>(
    context.env.DB,
    'SELECT id FROM gacha_students WHERE academy_id = ? AND name = ?',
    [academyId, req.name],
  );
  if (existing) {
    return errorResponse('이미 같은 이름의 학생이 등록되어 있습니다', 409);
  }

  const studentId = generatePrefixedId('gstu');
  const now = new Date().toISOString();

  // 학생이 지정한 선생님이 있고 여전히 active 면 그 선생님을 담당으로 배정, 없으면 승인자 본인.
  const assignedTeacherId = req.requested_teacher_id ?? teacherId;

  // 원자 실행: gacha_students INSERT + students INSERT + signup_requests DELETE (Ⅱ-5)
  // pin_salt 컬럼은 schema상 NOT NULL이지만 pbkdf2$ 새 형식은 hash 안에 salt 포함 → 빈 문자열로 채움.
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO gacha_students (id, academy_id, teacher_id, name, pin_hash, pin_salt, grade, status, created_at)
       VALUES (?, ?, ?, ?, ?, '', ?, 'active', ?)`,
    ).bind(studentId, academyId, assignedTeacherId, req.name, req.pin_hash, req.grade, now),
    context.env.DB.prepare(
      `INSERT INTO students (id, academy_id, name, grade, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    ).bind(studentId, academyId, req.name, req.grade, now, now),
    context.env.DB.prepare(
      'DELETE FROM student_signup_requests WHERE id = ? AND academy_id = ?',
    ).bind(requestId, academyId),
  ]);

  logger.logAudit('STUDENT_SIGNUP_APPROVE', 'StudentSignupRequest', requestId, teacherId, { studentId, name: req.name });

  // 관련 알림 read 처리 (실패해도 본 처리 결과는 유지)
  try {
    await markNotificationsReadByPayloadKey(context.env.DB, context.env.KV, {
      academy_id: academyId,
      type: 'student_signup_request',
      payload_key: 'request_id',
      payload_value: requestId,
    });
  } catch (e) {
    logger.warn(`알림 read 처리 실패 (approve ${requestId}): ${e instanceof Error ? e.message : String(e)}`);
  }

  return successResponse({ studentId, name: req.name });
}

async function handleRejectSignupRequest(request: Request, context: RequestContext, requestId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const teacherId = getUserId(context);

  const body = await request.json().catch(() => ({})) as any;
  const reason = sanitizeNullable(body?.reason, 200);

  // pending → rejected (academy_id 격리 + 멱등 가드)
  // executeUpdate는 boolean만 반환하므로 changes 수 확인을 위해 raw prepare 사용.
  const result = await context.env.DB
    .prepare(
      `UPDATE student_signup_requests
       SET status = 'rejected',
           reviewed_at = datetime('now'),
           reviewed_by = ?,
           reject_reason = ?
       WHERE id = ? AND academy_id = ? AND status = 'pending'`,
    )
    .bind(teacherId, reason, requestId, academyId)
    .run();

  if (!result.meta || result.meta.changes === 0) {
    return errorResponse('가입 요청을 찾을 수 없습니다 (이미 처리됨)', 404);
  }

  logger.logAudit('STUDENT_SIGNUP_REJECT', 'StudentSignupRequest', requestId, teacherId, { reason });

  try {
    await markNotificationsReadByPayloadKey(context.env.DB, context.env.KV, {
      academy_id: academyId,
      type: 'student_signup_request',
      payload_key: 'request_id',
      payload_value: requestId,
    });
  } catch (e) {
    logger.warn(`알림 read 처리 실패 (reject ${requestId}): ${e instanceof Error ? e.message : String(e)}`);
  }

  return successResponse({ requestId, status: 'rejected' });
}

// ── 메인 라우터 ──

export async function handleGachaStudent(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/gacha/students/signup-requests (목록)
    if (pathname === '/api/gacha/students/signup-requests') {
      if (method === 'GET') return await handleListSignupRequests(context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/gacha/students/signup-requests/:id/approve
    const approveMatch = pathname.match(/^\/api\/gacha\/students\/signup-requests\/([^/]+)\/approve$/);
    if (approveMatch) {
      if (method === 'POST') return await handleApproveSignupRequest(context, approveMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/gacha/students/signup-requests/:id/reject
    const rejectMatch = pathname.match(/^\/api\/gacha\/students\/signup-requests\/([^/]+)\/reject$/);
    if (rejectMatch) {
      if (method === 'POST') return await handleRejectSignupRequest(request, context, rejectMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

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
