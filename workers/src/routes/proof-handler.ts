/**
 * 증명 연습 관리 핸들러
 * 증명 CRUD + 단계 관리 + 공유/복사 + 학생 배정
 */
import { RequestContext } from '@/types';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert, executeUpdate, executeDelete } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { logger } from '@/utils/logger';

// ── 입력 검증 ──

interface ProofInput {
  title: string;
  grade: string;
  chapter?: string;
  difficulty?: number;
  description?: string;
  description_image?: string;
  steps?: StepInput[];
}

interface StepInput {
  content: string;
  content_image?: string;
  blanks_json?: string;
  hint?: string;
}

function validateProofInput(body: any): ProofInput {
  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    throw new Error('입력 검증 오류: 증명 제목은 필수입니다');
  }
  if (!body.grade || typeof body.grade !== 'string') {
    throw new Error('입력 검증 오류: 학년은 필수입니다');
  }
  if (body.difficulty !== undefined && (body.difficulty < 1 || body.difficulty > 5)) {
    throw new Error('입력 검증 오류: 난이도는 1~5 사이여야 합니다');
  }
  if (body.steps) {
    if (!Array.isArray(body.steps)) {
      throw new Error('입력 검증 오류: steps는 배열이어야 합니다');
    }
    for (let i = 0; i < body.steps.length; i++) {
      const s = body.steps[i];
      if (!s.content || typeof s.content !== 'string') {
        throw new Error(`입력 검증 오류: Step ${i + 1}의 내용은 필수입니다`);
      }
      if (s.blanks_json) {
        try {
          const blanks = JSON.parse(s.blanks_json);
          if (!Array.isArray(blanks)) throw new Error();
        } catch {
          throw new Error(`입력 검증 오류: Step ${i + 1}의 빈칸 JSON이 유효하지 않습니다`);
        }
      }
    }
  }
  return {
    title: body.title.trim(),
    grade: body.grade.trim(),
    chapter: body.chapter?.trim() || null,
    difficulty: body.difficulty || 1,
    description: body.description?.trim() || null,
    description_image: body.description_image || null,
    steps: body.steps || [],
  };
}

// ── 핸들러 함수들 ──

async function handleGetProofs(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const url = new URL(request.url);
  const grade = url.searchParams.get('grade');
  const difficulty = url.searchParams.get('difficulty');

  let query = `
    SELECT p.*,
      (SELECT COUNT(*) FROM proof_steps ps WHERE ps.proof_id = p.id) as step_count
    FROM proofs p
    WHERE p.academy_id = ?
  `;
  const params: unknown[] = [academyId];

  if (grade) { query += ' AND p.grade = ?'; params.push(grade); }
  if (difficulty && !isNaN(Number(difficulty))) { query += ' AND p.difficulty = ?'; params.push(Number(difficulty)); }
  query += ' ORDER BY p.created_at DESC';

  const proofs = await executeQuery<any>(context.env.DB, query, params);
  return successResponse(proofs);
}

async function handleGetProof(context: RequestContext, proofId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM proofs WHERE id = ? AND academy_id = ?',
    [proofId, academyId]
  );
  if (!proof) {
    return errorResponse('증명을 찾을 수 없습니다', 404);
  }

  const steps = await executeQuery<any>(
    context.env.DB,
    'SELECT * FROM proof_steps WHERE proof_id = ? ORDER BY step_order',
    [proofId]
  );

  return successResponse({ ...proof, steps });
}

async function handleCreateProof(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const body = await request.json() as any;
  const input = validateProofInput(body);
  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  const now = new Date().toISOString();

  const proofId = generatePrefixedId('proof');

  await executeInsert(
    context.env.DB,
    `INSERT INTO proofs (id, academy_id, created_by, title, grade, chapter, difficulty, description, description_image, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [proofId, academyId, userId, input.title, input.grade, input.chapter, input.difficulty, input.description, input.description_image, now, now]
  );

  // 단계 삽입
  if (input.steps && input.steps.length > 0) {
    for (let i = 0; i < input.steps.length; i++) {
      const step = input.steps[i];
      const stepId = generatePrefixedId('pstep');
      await executeInsert(
        context.env.DB,
        `INSERT INTO proof_steps (id, proof_id, step_order, content, content_image, blanks_json, hint)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [stepId, proofId, i + 1, step.content, step.content_image || null, step.blanks_json || null, step.hint || null]
      );
    }
  }

  logger.logAudit('PROOF_CREATE', 'Proof', proofId, userId, { title: input.title, stepCount: input.steps?.length || 0 });

  return successResponse({ id: proofId, title: input.title }, 201);
}

async function handleUpdateProof(request: Request, context: RequestContext, proofId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM proofs WHERE id = ? AND academy_id = ?',
    [proofId, academyId]
  );
  if (!proof) {
    return errorResponse('증명을 찾을 수 없습니다', 404);
  }

  const body = await request.json() as any;
  const sets: string[] = [];
  const params: unknown[] = [];

  const fields = ['title', 'grade', 'chapter', 'difficulty', 'description', 'description_image'];
  for (const f of fields) {
    if (body[f] !== undefined) {
      sets.push(`${f} = ?`);
      params.push(body[f]);
    }
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(proofId);

  await executeUpdate(context.env.DB, `UPDATE proofs SET ${sets.join(', ')} WHERE id = ?`, params);

  return successResponse({ id: proofId, updated: true });
}

async function handleUpdateSteps(request: Request, context: RequestContext, proofId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM proofs WHERE id = ? AND academy_id = ?',
    [proofId, academyId]
  );
  if (!proof) {
    return errorResponse('증명을 찾을 수 없습니다', 404);
  }

  const body = await request.json() as any;
  if (!Array.isArray(body.steps)) {
    return errorResponse('입력 검증 오류: steps 배열이 필요합니다', 400);
  }

  // 기존 단계 삭제 후 재삽입 (순서 보장)
  await executeDelete(context.env.DB, 'DELETE FROM proof_steps WHERE proof_id = ?', [proofId]);

  for (let i = 0; i < body.steps.length; i++) {
    const step = body.steps[i];
    if (!step.content || typeof step.content !== 'string') {
      return errorResponse(`입력 검증 오류: Step ${i + 1}의 내용은 필수입니다`, 400);
    }
    const stepId = step.id || generatePrefixedId('pstep');
    await executeInsert(
      context.env.DB,
      `INSERT INTO proof_steps (id, proof_id, step_order, content, content_image, blanks_json, hint)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [stepId, proofId, i + 1, step.content, step.content_image || null, step.blanks_json || null, step.hint || null]
    );
  }

  await executeUpdate(
    context.env.DB,
    'UPDATE proofs SET updated_at = ? WHERE id = ?',
    [new Date().toISOString(), proofId]
  );

  return successResponse({ proof_id: proofId, step_count: body.steps.length });
}

async function handleDeleteProof(context: RequestContext, proofId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM proofs WHERE id = ? AND academy_id = ?',
    [proofId, academyId]
  );
  if (!proof) {
    return errorResponse('증명을 찾을 수 없습니다', 404);
  }

  // R2 이미지 정리
  if (proof.description_image) {
    try { await context.env.BUCKET.delete(proof.description_image); } catch { /* non-critical */ }
  }
  const steps = await executeQuery<any>(
    context.env.DB,
    'SELECT content_image FROM proof_steps WHERE proof_id = ? AND content_image IS NOT NULL',
    [proofId]
  );
  for (const step of steps) {
    try { await context.env.BUCKET.delete(step.content_image); } catch { /* non-critical */ }
  }

  // CASCADE로 proof_steps 자동 삭제
  await executeDelete(context.env.DB, 'DELETE FROM proof_assignments WHERE proof_id = ?', [proofId]);
  await executeDelete(context.env.DB, 'DELETE FROM proofs WHERE id = ?', [proofId]);

  logger.logAudit('PROOF_DELETE', 'Proof', proofId, getUserId(context), { title: proof.title });

  return successResponse({ id: proofId, deleted: true });
}

// ── 이미지 업로드 ──

async function handleUploadImage(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return errorResponse('입력 검증 오류: 파일이 필요합니다', 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return errorResponse('파일 크기가 5MB를 초과합니다', 413);
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return errorResponse('입력 검증 오류: PNG, JPG, GIF, WebP만 허용됩니다', 400);
  }

  const ext = file.name.split('.').pop() || 'png';
  const timestamp = Date.now();
  const randomId = crypto.randomUUID().split('-')[0];
  const key = `proof-images/${academyId}/${timestamp}-${randomId}.${ext}`;

  const buffer = await file.arrayBuffer();
  await context.env.BUCKET.put(key, buffer, {
    httpMetadata: { contentType: file.type },
  });

  return successResponse({
    key,
    url: `${context.env.API_URL}/api/proof/image/${key}`,
  }, 201);
}

async function handleGetImage(context: RequestContext, key: string): Promise<Response> {
  const object = await context.env.BUCKET.get(key);
  if (!object) {
    return errorResponse('이미지를 찾을 수 없습니다', 404);
  }
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

// ── 공유 마켓 ──

async function handleGetSharedProofs(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  const url = new URL(request.url);
  const grade = url.searchParams.get('grade');
  const search = url.searchParams.get('q');

  let query = `
    SELECT p.id, p.title, p.grade, p.difficulty, p.chapter, p.description,
      p.share_count, p.created_at,
      (SELECT COUNT(*) FROM proof_steps ps WHERE ps.proof_id = p.id) as step_count
    FROM proofs p
    WHERE p.is_shared = 1
  `;
  const params: unknown[] = [];

  if (grade) { query += ' AND p.grade = ?'; params.push(grade); }
  if (search) { query += ' AND (p.title LIKE ? OR p.chapter LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY p.share_count DESC, p.created_at DESC LIMIT 100';

  const proofs = await executeQuery<any>(context.env.DB, query, params);
  return successResponse(proofs);
}

async function handleShareProof(context: RequestContext, proofId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM proofs WHERE id = ? AND academy_id = ?',
    [proofId, academyId]
  );
  if (!proof) return errorResponse('증명을 찾을 수 없습니다', 404);

  await executeUpdate(
    context.env.DB,
    'UPDATE proofs SET is_shared = 1, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), proofId]
  );

  return successResponse({ id: proofId, shared: true });
}

async function handleUnshareProof(context: RequestContext, proofId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM proofs WHERE id = ? AND academy_id = ?',
    [proofId, academyId]
  );
  if (!proof) return errorResponse('증명을 찾을 수 없습니다', 404);

  await executeUpdate(
    context.env.DB,
    'UPDATE proofs SET is_shared = 0, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), proofId]
  );

  return successResponse({ id: proofId, shared: false });
}

async function handleCopyProof(request: Request, context: RequestContext, proofId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }

  // 공유된 증명만 복사 가능
  const original = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM proofs WHERE id = ? AND is_shared = 1',
    [proofId]
  );
  if (!original) return errorResponse('공유된 증명을 찾을 수 없습니다', 404);

  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  const now = new Date().toISOString();

  // 증명 복사
  const newProofId = generatePrefixedId('proof');
  await executeInsert(
    context.env.DB,
    `INSERT INTO proofs (id, academy_id, created_by, title, grade, chapter, difficulty, description, description_image, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newProofId, academyId, userId, original.title, original.grade, original.chapter, original.difficulty, original.description, original.description_image, now, now]
  );

  // 단계 복사
  const steps = await executeQuery<any>(
    context.env.DB,
    'SELECT * FROM proof_steps WHERE proof_id = ? ORDER BY step_order',
    [proofId]
  );
  for (const step of steps) {
    const newStepId = generatePrefixedId('pstep');
    await executeInsert(
      context.env.DB,
      `INSERT INTO proof_steps (id, proof_id, step_order, content, content_image, blanks_json, hint)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newStepId, newProofId, step.step_order, step.content, step.content_image, step.blanks_json, step.hint]
    );
  }

  // 공유 기록
  const shareId = generatePrefixedId('pshare');
  await executeInsert(
    context.env.DB,
    `INSERT INTO proof_shares (id, original_proof_id, shared_by, copied_by, copied_academy_id, copied_proof_id, copied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [shareId, proofId, original.created_by, userId, academyId, newProofId, now]
  );

  // 원본 share_count 증가
  await executeUpdate(
    context.env.DB,
    'UPDATE proofs SET share_count = share_count + 1 WHERE id = ?',
    [proofId]
  );

  logger.logAudit('PROOF_COPY', 'Proof', newProofId, userId, { originalId: proofId, title: original.title });

  return successResponse({ id: newProofId, copiedFrom: proofId, title: original.title }, 201);
}

// ── 학생 배정 ──

async function handleAssignProof(request: Request, context: RequestContext, proofId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  const body = await request.json() as any;

  if (!Array.isArray(body.student_ids) || body.student_ids.length === 0) {
    return errorResponse('입력 검증 오류: student_ids 배열이 필요합니다', 400);
  }

  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM proofs WHERE id = ? AND academy_id = ?',
    [proofId, academyId]
  );
  if (!proof) return errorResponse('증명을 찾을 수 없습니다', 404);

  const assigned: string[] = [];
  for (const studentId of body.student_ids) {
    // 학생이 본 학원 소속인지 확인
    const student = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM gacha_students WHERE id = ? AND academy_id = ?',
      [studentId, academyId]
    );
    if (!student) continue;

    // 이미 배정되었는지 확인
    const existing = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM proof_assignments WHERE student_id = ? AND proof_id = ?',
      [studentId, proofId]
    );
    if (existing) continue;

    const assignId = generatePrefixedId('passign');
    await executeInsert(
      context.env.DB,
      `INSERT INTO proof_assignments (id, student_id, proof_id, assigned_by, assigned_at)
       VALUES (?, ?, ?, ?, ?)`,
      [assignId, studentId, proofId, userId, new Date().toISOString()]
    );
    assigned.push(studentId);
  }

  return successResponse({ proof_id: proofId, assigned_students: assigned });
}

async function handleUnassignProof(context: RequestContext, proofId: string, studentId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  // 증명이 본 학원 소속인지 확인
  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM proofs WHERE id = ? AND academy_id = ?',
    [proofId, academyId]
  );
  if (!proof) return errorResponse('증명을 찾을 수 없습니다', 404);

  // 학생이 본 학원 소속인지 확인
  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM gacha_students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);

  await executeDelete(
    context.env.DB,
    'DELETE FROM proof_assignments WHERE proof_id = ? AND student_id = ?',
    [proofId, studentId]
  );
  return successResponse({ proof_id: proofId, student_id: studentId, unassigned: true });
}

// ── 대시보드 통계 ──

async function handleGetStats(context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  const isAdmin = context.auth!.role === 'admin';

  const studentFilter = isAdmin ? '' : 'AND gs.teacher_id = ?';
  const cardFilter = isAdmin ? '' : 'AND gc.teacher_id = ?';
  const baseParams: unknown[] = isAdmin ? [academyId] : [academyId, userId];

  const studentCount = await executeFirst<any>(
    context.env.DB,
    `SELECT COUNT(*) as count FROM gacha_students gs WHERE gs.academy_id = ? ${studentFilter}`,
    baseParams
  );

  const cardCount = await executeFirst<any>(
    context.env.DB,
    `SELECT COUNT(*) as count FROM gacha_cards gc WHERE gc.academy_id = ? ${cardFilter}`,
    baseParams
  );

  const proofCount = await executeFirst<any>(
    context.env.DB,
    'SELECT COUNT(*) as count FROM proofs WHERE academy_id = ?',
    [academyId]
  );

  // 오늘 활동 학생 수
  const today = new Date().toISOString().split('T')[0];
  const activeToday = await executeFirst<any>(
    context.env.DB,
    `SELECT COUNT(DISTINCT gs2.student_id) as count
     FROM gacha_sessions gs2
     JOIN gacha_students gst ON gst.id = gs2.student_id
     WHERE gs2.session_date = ? AND gst.academy_id = ?`,
    [today, academyId]
  );

  // 학생별 진도
  const studentProgress = await executeQuery<any>(
    context.env.DB,
    `SELECT
      gs.id, gs.name, gs.grade,
      (SELECT COUNT(*) FROM gacha_cards gc WHERE gc.student_id = gs.id) as card_count,
      (SELECT COUNT(*) FROM proof_assignments pa WHERE pa.student_id = gs.id) as assigned_proofs,
      (SELECT COUNT(DISTINCT proof_id) FROM proof_results pr WHERE pr.student_id = gs.id) as completed_proofs,
      (SELECT AVG(score) FROM proof_results pr WHERE pr.student_id = gs.id) as avg_proof_score,
      (SELECT session_date FROM gacha_sessions gse WHERE gse.student_id = gs.id ORDER BY session_date DESC LIMIT 1) as last_activity
    FROM gacha_students gs
    WHERE gs.academy_id = ? ${studentFilter}
    ORDER BY gs.name`,
    baseParams
  );

  // 많이 틀리는 증명 TOP 5
  const hardProofs = await executeQuery<any>(
    context.env.DB,
    `SELECT p.id, p.title, p.grade, p.difficulty,
      AVG(pr.score) as avg_score, COUNT(pr.id) as attempt_count
    FROM proofs p
    JOIN proof_results pr ON pr.proof_id = p.id
    WHERE p.academy_id = ?
    GROUP BY p.id
    HAVING attempt_count >= 2
    ORDER BY avg_score ASC
    LIMIT 5`,
    [academyId]
  );

  return successResponse({
    summary: {
      students: studentCount?.count || 0,
      cards: cardCount?.count || 0,
      proofs: proofCount?.count || 0,
      activeToday: activeToday?.count || 0,
    },
    studentProgress,
    hardProofs,
  });
}

// ── 메인 라우터 ──

export async function handleProof(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/proof/image/* (공개 - 이미지 서빙)
    const imageMatch = pathname.match(/^\/api\/proof\/image\/(.+)$/);
    if (imageMatch) {
      if (method === 'GET') return await handleGetImage(context, decodeURIComponent(imageMatch[1]));
      return errorResponse('Method not allowed', 405);
    }

    // /api/proof/upload-image
    if (pathname === '/api/proof/upload-image') {
      if (method === 'POST') return await handleUploadImage(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/proof/shared (공유 마켓)
    if (pathname === '/api/proof/shared') {
      if (method === 'GET') return await handleGetSharedProofs(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/proof/stats (대시보드)
    if (pathname === '/api/proof/stats') {
      if (method === 'GET') return await handleGetStats(context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/proof/:id/steps
    const stepsMatch = pathname.match(/^\/api\/proof\/([^/]+)\/steps$/);
    if (stepsMatch) {
      if (method === 'PUT') return await handleUpdateSteps(request, context, stepsMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/proof/:id/share
    const shareMatch = pathname.match(/^\/api\/proof\/([^/]+)\/share$/);
    if (shareMatch) {
      if (method === 'POST') return await handleShareProof(context, shareMatch[1]);
      if (method === 'DELETE') return await handleUnshareProof(context, shareMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/proof/:id/copy
    const copyMatch = pathname.match(/^\/api\/proof\/([^/]+)\/copy$/);
    if (copyMatch) {
      if (method === 'POST') return await handleCopyProof(request, context, copyMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/proof/:id/assign
    const assignMatch = pathname.match(/^\/api\/proof\/([^/]+)\/assign$/);
    if (assignMatch) {
      if (method === 'POST') return await handleAssignProof(request, context, assignMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/proof/:id/assign/:studentId
    const unassignMatch = pathname.match(/^\/api\/proof\/([^/]+)\/assign\/([^/]+)$/);
    if (unassignMatch) {
      if (method === 'DELETE') return await handleUnassignProof(context, unassignMatch[1], unassignMatch[2]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/proof/:id
    const idMatch = pathname.match(/^\/api\/proof\/([^/]+)$/);
    if (idMatch) {
      const id = idMatch[1];
      if (method === 'GET') return await handleGetProof(context, id);
      if (method === 'PATCH') return await handleUpdateProof(request, context, id);
      if (method === 'DELETE') return await handleDeleteProof(context, id);
      return errorResponse('Method not allowed', 405);
    }

    // /api/proof
    if (pathname === '/api/proof') {
      if (method === 'GET') return await handleGetProofs(request, context);
      if (method === 'POST') return await handleCreateProof(request, context);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, '증명 관리');
  }
}
