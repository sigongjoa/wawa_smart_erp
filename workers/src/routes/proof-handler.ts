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

// SEC-PROOF: 텍스트 위생화 — utils/sanitize.ts로 통일 (라운드 24)
import { sanitizeText, sanitizeNullable } from '@/utils/sanitize';

const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 2000;
const MAX_SHORT_LEN = 100;
const MAX_CONTENT_LEN = 5000;
const MAX_HINT_LEN = 1000;
const MAX_STEPS = 50;
const MAX_ASSIGN_STUDENTS = 100;

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
  // SEC-PROOF-H3+M1: sanitize + 길이 캡
  const cleanTitle = sanitizeText(body.title);
  const cleanGrade = sanitizeText(body.grade);
  if (!cleanTitle) throw new Error('입력 검증 오류: 증명 제목은 필수입니다');
  if (!cleanGrade) throw new Error('입력 검증 오류: 학년은 필수입니다');
  if (cleanTitle.length > MAX_TITLE_LEN) throw new Error(`입력 검증 오류: 제목은 ${MAX_TITLE_LEN}자 이내`);
  if (cleanGrade.length > MAX_SHORT_LEN) throw new Error(`입력 검증 오류: 학년은 ${MAX_SHORT_LEN}자 이내`);

  let cleanDifficulty: number = 1;
  if (body.difficulty !== undefined) {
    const d = Number(body.difficulty);
    if (!Number.isInteger(d) || d < 1 || d > 5) {
      throw new Error('입력 검증 오류: 난이도는 1~5 사이 정수여야 합니다');
    }
    cleanDifficulty = d;
  }

  const cleanChapter = sanitizeNullable(body.chapter);
  const cleanDescription = sanitizeNullable(body.description);
  const cleanDescImage = sanitizeNullable(body.description_image);
  if (cleanChapter && cleanChapter.length > MAX_SHORT_LEN) throw new Error('입력 검증 오류: chapter 너무 김');
  if (cleanDescription && cleanDescription.length > MAX_DESCRIPTION_LEN) throw new Error(`입력 검증 오류: description ${MAX_DESCRIPTION_LEN}자 초과`);

  let cleanSteps: StepInput[] = [];
  if (body.steps) {
    if (!Array.isArray(body.steps)) {
      throw new Error('입력 검증 오류: steps는 배열이어야 합니다');
    }
    if (body.steps.length > MAX_STEPS) {
      throw new Error(`입력 검증 오류: 단계는 최대 ${MAX_STEPS}개까지`);
    }
    cleanSteps = body.steps.map((s: any, i: number) => {
      const c = sanitizeText(s.content);
      if (!c) throw new Error(`입력 검증 오류: Step ${i + 1}의 내용은 필수입니다`);
      if (c.length > MAX_CONTENT_LEN) throw new Error(`입력 검증 오류: Step ${i + 1} 내용 ${MAX_CONTENT_LEN}자 초과`);
      const hint = sanitizeNullable(s.hint);
      if (hint && hint.length > MAX_HINT_LEN) throw new Error(`입력 검증 오류: Step ${i + 1} hint ${MAX_HINT_LEN}자 초과`);
      if (s.blanks_json) {
        try {
          const blanks = JSON.parse(s.blanks_json);
          if (!Array.isArray(blanks)) throw new Error();
        } catch {
          throw new Error(`입력 검증 오류: Step ${i + 1}의 빈칸 JSON이 유효하지 않습니다`);
        }
      }
      return {
        content: c,
        content_image: sanitizeNullable(s.content_image) ?? undefined,
        blanks_json: s.blanks_json || undefined,
        hint: hint ?? undefined,
      };
    });
  }

  return {
    title: cleanTitle,
    grade: cleanGrade,
    chapter: cleanChapter ?? undefined,
    difficulty: cleanDifficulty,
    description: cleanDescription ?? undefined,
    description_image: cleanDescImage ?? undefined,
    steps: cleanSteps,
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

  // 소유자 또는 admin만 수정 가능
  if (proof.created_by !== context.auth!.userId && context.auth!.role !== 'admin') {
    return errorResponse('수정 권한이 없습니다', 403);
  }

  const body = await request.json() as any;
  const sets: string[] = [];
  const params: unknown[] = [];

  // SEC-PROOF-H3: 화이트리스트 + sanitize + 타입/길이 검증. 이전엔 body 값 그대로 UPDATE.
  if ('title' in body) {
    const v = sanitizeText(body.title);
    if (!v) return errorResponse('title은 비울 수 없습니다', 400);
    if (v.length > MAX_TITLE_LEN) return errorResponse(`title은 ${MAX_TITLE_LEN}자 이내`, 400);
    sets.push('title = ?'); params.push(v);
  }
  if ('grade' in body) {
    const v = sanitizeText(body.grade);
    if (!v) return errorResponse('grade는 비울 수 없습니다', 400);
    if (v.length > MAX_SHORT_LEN) return errorResponse(`grade는 ${MAX_SHORT_LEN}자 이내`, 400);
    sets.push('grade = ?'); params.push(v);
  }
  if ('chapter' in body) {
    const v = sanitizeNullable(body.chapter);
    if (v && v.length > MAX_SHORT_LEN) return errorResponse(`chapter는 ${MAX_SHORT_LEN}자 이내`, 400);
    sets.push('chapter = ?'); params.push(v);
  }
  if ('difficulty' in body) {
    const d = Number(body.difficulty);
    if (!Number.isInteger(d) || d < 1 || d > 5) return errorResponse('difficulty는 1~5 정수', 400);
    sets.push('difficulty = ?'); params.push(d);
  }
  if ('description' in body) {
    const v = sanitizeNullable(body.description);
    if (v && v.length > MAX_DESCRIPTION_LEN) return errorResponse(`description은 ${MAX_DESCRIPTION_LEN}자 이내`, 400);
    sets.push('description = ?'); params.push(v);
  }
  if ('description_image' in body) {
    const v = sanitizeNullable(body.description_image);
    sets.push('description_image = ?'); params.push(v);
  }

  if (sets.length === 0) return errorResponse('수정할 필드가 없습니다', 400);

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
    'SELECT id, created_by FROM proofs WHERE id = ? AND academy_id = ?',
    [proofId, academyId]
  );
  if (!proof) {
    return errorResponse('증명을 찾을 수 없습니다', 404);
  }

  // 소유자 또는 admin만 단계 수정 가능
  if (proof.created_by !== context.auth!.userId && context.auth!.role !== 'admin') {
    return errorResponse('수정 권한이 없습니다', 403);
  }

  const body = await request.json() as any;
  if (!Array.isArray(body.steps)) {
    return errorResponse('입력 검증 오류: steps 배열이 필요합니다', 400);
  }
  if (body.steps.length > MAX_STEPS) {
    return errorResponse(`단계는 최대 ${MAX_STEPS}개까지`, 400);
  }

  // SEC-PROOF-M1: 검증 + sanitize 먼저 (실패 시 DELETE 전에 reject)
  type CleanStep = { id: string; content: string; content_image: string | null; blanks_json: string | null; hint: string | null };
  const cleanSteps: CleanStep[] = [];
  for (let i = 0; i < body.steps.length; i++) {
    const step = body.steps[i];
    const c = sanitizeText(step.content);
    if (!c) return errorResponse(`Step ${i + 1}의 내용은 필수`, 400);
    if (c.length > MAX_CONTENT_LEN) return errorResponse(`Step ${i + 1} 내용 ${MAX_CONTENT_LEN}자 초과`, 400);
    const hint = sanitizeNullable(step.hint);
    if (hint && hint.length > MAX_HINT_LEN) return errorResponse(`Step ${i + 1} hint ${MAX_HINT_LEN}자 초과`, 400);
    if (step.blanks_json) {
      try {
        const blanks = JSON.parse(step.blanks_json);
        if (!Array.isArray(blanks)) throw new Error();
      } catch {
        return errorResponse(`Step ${i + 1} blanks_json 유효하지 않음`, 400);
      }
    }
    cleanSteps.push({
      id: typeof step.id === 'string' && step.id ? step.id : generatePrefixedId('pstep'),
      content: c,
      content_image: sanitizeNullable(step.content_image),
      blanks_json: step.blanks_json || null,
      hint,
    });
  }

  // SEC-PROOF-M1: DELETE + INSERT를 batch로 원자화 — 중간 실패 시 단계 손실 방지
  const db = context.env.DB;
  const stmts: any[] = [
    db.prepare('DELETE FROM proof_steps WHERE proof_id = ?').bind(proofId),
  ];
  for (let i = 0; i < cleanSteps.length; i++) {
    const s = cleanSteps[i];
    stmts.push(
      db.prepare(
        `INSERT INTO proof_steps (id, proof_id, step_order, content, content_image, blanks_json, hint)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(s.id, proofId, i + 1, s.content, s.content_image, s.blanks_json, s.hint)
    );
  }
  stmts.push(
    db.prepare('UPDATE proofs SET updated_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), proofId)
  );
  await db.batch(stmts);

  return successResponse({ proof_id: proofId, step_count: cleanSteps.length });
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

  // 소유자 또는 admin만 삭제 가능
  if (proof.created_by !== context.auth!.userId && context.auth!.role !== 'admin') {
    return errorResponse('삭제 권한이 없습니다', 403);
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

  // 소유자 또는 admin만 공유 가능
  if (proof.created_by !== context.auth!.userId && context.auth!.role !== 'admin') {
    return errorResponse('공유 권한이 없습니다', 403);
  }

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

  // 소유자 또는 admin만 공유 해제 가능
  if (proof.created_by !== context.auth!.userId && context.auth!.role !== 'admin') {
    return errorResponse('공유 해제 권한이 없습니다', 403);
  }

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

  // SEC-PROOF-H1: 같은 학원이 같은 원본을 여러 번 복사해 share_count 부풀리기 차단.
  // 학원당 1회로 제한 — 이미 복사한 경우 기존 사본을 idempotent로 응답.
  const existingShare = await executeFirst<any>(
    context.env.DB,
    `SELECT copied_proof_id FROM proof_shares
     WHERE original_proof_id = ? AND copied_academy_id = ?
     ORDER BY copied_at DESC LIMIT 1`,
    [proofId, academyId]
  );
  if (existingShare?.copied_proof_id) {
    // 동일 학원에서 이미 복사한 경우 — share_count는 증가시키지 않음, 기존 사본 반환
    const existingProof = await executeFirst<any>(
      context.env.DB,
      'SELECT id, title FROM proofs WHERE id = ?',
      [existingShare.copied_proof_id]
    );
    if (existingProof) {
      return successResponse({
        id: existingProof.id,
        copiedFrom: proofId,
        title: existingProof.title,
        alreadyCopied: true,
      });
    }
    // 사본이 삭제됨 — 재복사 허용
  }

  const newProofId = generatePrefixedId('proof');
  const shareId = generatePrefixedId('pshare');

  // SEC-PROOF-M2: 단계 SELECT 후 모든 INSERT/UPDATE를 batch로 원자화
  const steps = await executeQuery<any>(
    context.env.DB,
    'SELECT * FROM proof_steps WHERE proof_id = ? ORDER BY step_order',
    [proofId]
  );

  const db = context.env.DB;
  const stmts: any[] = [
    db.prepare(
      `INSERT INTO proofs (id, academy_id, created_by, title, grade, chapter, difficulty, description, description_image, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(newProofId, academyId, userId, original.title, original.grade, original.chapter, original.difficulty, original.description, original.description_image, now, now),
  ];
  for (const step of steps) {
    stmts.push(
      db.prepare(
        `INSERT INTO proof_steps (id, proof_id, step_order, content, content_image, blanks_json, hint)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(generatePrefixedId('pstep'), newProofId, step.step_order, step.content, step.content_image, step.blanks_json, step.hint)
    );
  }
  stmts.push(
    db.prepare(
      `INSERT INTO proof_shares (id, original_proof_id, shared_by, copied_by, copied_academy_id, copied_proof_id, copied_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(shareId, proofId, original.created_by, userId, academyId, newProofId, now)
  );
  stmts.push(
    db.prepare('UPDATE proofs SET share_count = share_count + 1 WHERE id = ?').bind(proofId)
  );
  await db.batch(stmts);

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
  // SEC-PROOF-H2: 길이 캡 — 100명 초과 reject. ID 형식 검증.
  if (body.student_ids.length > MAX_ASSIGN_STUDENTS) {
    return errorResponse(`한 번에 ${MAX_ASSIGN_STUDENTS}명까지 배정 가능`, 400);
  }
  const cleanIds: string[] = [];
  for (const sid of body.student_ids) {
    if (typeof sid === 'string' && sid && sid.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(sid)) {
      cleanIds.push(sid);
    }
  }
  if (cleanIds.length === 0) return errorResponse('유효한 student_id가 없습니다', 400);

  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM proofs WHERE id = ? AND academy_id = ?',
    [proofId, academyId]
  );
  if (!proof) return errorResponse('증명을 찾을 수 없습니다', 404);

  // SEC-PROOF-H2: 학생 academy 검증을 단일 쿼리로 (이전 N+1).
  const placeholders = cleanIds.map(() => '?').join(',');
  const validRows = await executeQuery<{ id: string }>(
    context.env.DB,
    `SELECT id FROM gacha_students WHERE academy_id = ? AND id IN (${placeholders})`,
    [academyId, ...cleanIds]
  );
  const validIds = new Set(validRows.map(r => r.id));

  // 기존 배정 한꺼번에 조회
  const existingRows = await executeQuery<{ student_id: string }>(
    context.env.DB,
    `SELECT student_id FROM proof_assignments WHERE proof_id = ? AND student_id IN (${placeholders})`,
    [proofId, ...cleanIds]
  );
  const existingSet = new Set(existingRows.map(r => r.student_id));

  const toInsert = cleanIds.filter(id => validIds.has(id) && !existingSet.has(id));
  if (toInsert.length === 0) {
    return successResponse({ proof_id: proofId, assigned_students: [] });
  }

  // SEC-PROOF-H2: batch INSERT
  const now = new Date().toISOString();
  const db = context.env.DB;
  const stmts = toInsert.map((studentId) =>
    db.prepare(
      `INSERT INTO proof_assignments (id, student_id, proof_id, assigned_by, assigned_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(generatePrefixedId('passign'), studentId, proofId, userId, now)
  );
  await db.batch(stmts);

  return successResponse({ proof_id: proofId, assigned_students: toInsert });
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
