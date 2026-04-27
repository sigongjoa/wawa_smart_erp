/**
 * 가차 카드 관리 핸들러
 * 카드 CRUD + 이미지 업로드 (R2)
 */
import { RequestContext } from '@/types';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert, executeUpdate, executeDelete } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { logger } from '@/utils/logger';
import { parsePagination } from '@/utils/pagination';
import { paginatedList } from '@/utils/paginatedList';

// ── 입력 검증 ──

interface CreateCardInput {
  student_id?: string;
  type: 'text' | 'image';
  question?: string;
  question_image?: string;
  answer: string;
  topic?: string;
  chapter?: string;
  grade?: string;
}

function validateCreateCard(body: any): CreateCardInput {
  const type = body.type || 'text';
  if (!['text', 'image'].includes(type)) {
    throw new Error('입력 검증 오류: 유형은 text 또는 image여야 합니다');
  }
  if (type === 'text' && (!body.question || typeof body.question !== 'string')) {
    throw new Error('입력 검증 오류: 텍스트 카드는 문제가 필수입니다');
  }
  if (type === 'image' && !body.question_image) {
    throw new Error('입력 검증 오류: 이미지 카드는 이미지가 필수입니다');
  }
  if (!body.answer || typeof body.answer !== 'string' || body.answer.trim().length === 0) {
    throw new Error('입력 검증 오류: 정답은 필수입니다');
  }
  return {
    student_id: body.student_id || null,
    type,
    question: body.question?.trim() || null,
    question_image: body.question_image || null,
    answer: body.answer.trim(),
    topic: body.topic?.trim() || null,
    chapter: body.chapter?.trim() || null,
    grade: body.grade?.trim() || null,
  };
}

// ── 핸들러 함수들 ──

async function handleGetCards(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const userId = getUserId(context);
  const isAdmin = context.auth!.role === 'admin';
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id');
  const topic = url.searchParams.get('topic');
  const grade = url.searchParams.get('grade');

  const pg = parsePagination(url, { defaultLimit: 50, maxLimit: 200 });

  const result = await paginatedList<any>({
    db: context.env.DB,
    table: 'gacha_cards',
    baseFilters: [
      { sql: 'academy_id = ?', param: academyId },
      !isAdmin ? { sql: 'teacher_id = ?', param: userId } : null,
      studentId && studentId !== 'all' ? { sql: 'student_id = ?', param: studentId } : null,
    ],
    extraFilters: [
      topic ? { sql: 'topic = ?', param: topic } : null,
      grade ? { sql: 'grade = ?', param: grade } : null,
    ],
    orderBy: 'created_at DESC',
    pagination: pg,
  });

  return successResponse(result);
}

async function handleCreateCard(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const body = await request.json() as any;
  const input = validateCreateCard(body);
  const academyId = getAcademyId(context);
  const teacherId = getUserId(context);

  // student_id 유효성 확인
  if (input.student_id) {
    const student = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM gacha_students WHERE id = ? AND academy_id = ?',
      [input.student_id, academyId]
    );
    if (!student) {
      return errorResponse('학생을 찾을 수 없습니다', 404);
    }
  }

  const cardId = generatePrefixedId('gcard');
  const now = new Date().toISOString();

  await executeInsert(
    context.env.DB,
    `INSERT INTO gacha_cards (id, academy_id, teacher_id, student_id, type, question, question_image, answer, topic, chapter, grade, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [cardId, academyId, teacherId, input.student_id, input.type, input.question, input.question_image, input.answer, input.topic, input.chapter, input.grade, now]
  );

  logger.logAudit('GACHA_CARD_CREATE', 'GachaCard', cardId, teacherId);

  return successResponse({ id: cardId, ...input }, 201);
}

async function handleUpdateCard(request: Request, context: RequestContext, cardId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const card = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM gacha_cards WHERE id = ? AND academy_id = ?',
    [cardId, academyId]
  );
  if (!card) {
    return errorResponse('카드를 찾을 수 없습니다', 404);
  }

  // 소유자 또는 admin만 수정 가능
  if (card.teacher_id !== context.auth!.userId && context.auth!.role !== 'admin') {
    return errorResponse('수정 권한이 없습니다', 403);
  }

  const body = await request.json() as any;
  const sets: string[] = [];
  const params: unknown[] = [];

  const fields = ['question', 'question_image', 'answer', 'topic', 'chapter', 'grade', 'type', 'student_id'];
  for (const f of fields) {
    if (body[f] !== undefined) {
      sets.push(`${f} = ?`);
      params.push(body[f]);
    }
  }
  if (sets.length === 0) {
    return errorResponse('입력 검증 오류: 수정할 필드가 없습니다', 400);
  }

  sets.push("updated_at = datetime('now')");
  params.push(cardId);
  await executeUpdate(context.env.DB, `UPDATE gacha_cards SET ${sets.join(', ')} WHERE id = ?`, params);

  return successResponse({ id: cardId, updated: true });
}

async function handleDeleteCard(context: RequestContext, cardId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const card = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM gacha_cards WHERE id = ? AND academy_id = ?',
    [cardId, academyId]
  );
  if (!card) {
    return errorResponse('카드를 찾을 수 없습니다', 404);
  }

  // 소유자 또는 admin만 삭제 가능
  if (card.teacher_id !== context.auth!.userId && context.auth!.role !== 'admin') {
    return errorResponse('삭제 권한이 없습니다', 403);
  }

  // R2 이미지 정리
  if (card.question_image) {
    try { await context.env.BUCKET.delete(card.question_image); } catch { /* non-critical */ }
  }

  await executeDelete(context.env.DB, 'DELETE FROM gacha_cards WHERE id = ?', [cardId]);

  logger.logAudit('GACHA_CARD_DELETE', 'GachaCard', cardId, getUserId(context));

  return successResponse({ id: cardId, deleted: true });
}

async function handleBulkCreate(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const body = await request.json() as any;
  if (!Array.isArray(body.cards) || body.cards.length === 0) {
    return errorResponse('입력 검증 오류: cards 배열이 필요합니다', 400);
  }
  if (body.cards.length > 50) {
    return errorResponse('입력 검증 오류: 한번에 최대 50장까지 생성 가능합니다', 400);
  }

  const academyId = getAcademyId(context);
  const teacherId = getUserId(context);
  const now = new Date().toISOString();
  const created: string[] = [];

  for (const c of body.cards) {
    const input = validateCreateCard(c);
    const cardId = generatePrefixedId('gcard');
    await executeInsert(
      context.env.DB,
      `INSERT INTO gacha_cards (id, academy_id, teacher_id, student_id, type, question, question_image, answer, topic, chapter, grade, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cardId, academyId, teacherId, input.student_id, input.type, input.question, input.question_image, input.answer, input.topic, input.chapter, input.grade, now]
    );
    created.push(cardId);
  }

  return successResponse({ created, count: created.length }, 201);
}

async function handleUploadImage(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const userId = getUserId(context);

  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return errorResponse('입력 검증 오류: 파일이 필요합니다', 400);
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return errorResponse('파일 크기가 5MB를 초과합니다', 413);
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return errorResponse('입력 검증 오류: PNG, JPG, GIF, WebP 이미지만 허용됩니다', 400);
  }

  const ext = file.name.split('.').pop() || 'png';
  const timestamp = Date.now();
  const randomId = crypto.randomUUID().split('-')[0];
  const key = `card-images/${academyId}/${timestamp}-${randomId}.${ext}`;

  const buffer = await file.arrayBuffer();
  await context.env.BUCKET.put(key, buffer, {
    httpMetadata: { contentType: file.type },
  });

  logger.logAudit('GACHA_IMAGE_UPLOAD', 'GachaCard', key, userId, { fileSize: file.size });

  return successResponse({
    key,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type,
    url: `${context.env.API_URL}/api/gacha/image/${key}`,
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

// ── 메인 라우터 ──

export async function handleGachaCard(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/gacha/cards
    if (pathname === '/api/gacha/cards') {
      if (method === 'GET') return await handleGetCards(request, context);
      if (method === 'POST') return await handleCreateCard(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/gacha/cards/bulk
    if (pathname === '/api/gacha/cards/bulk') {
      if (method === 'POST') return await handleBulkCreate(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/gacha/cards/upload-image
    if (pathname === '/api/gacha/cards/upload-image') {
      if (method === 'POST') return await handleUploadImage(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/gacha/image/* (공개 - 이미지 서빙)
    const imageMatch = pathname.match(/^\/api\/gacha\/image\/(.+)$/);
    if (imageMatch) {
      if (method === 'GET') return await handleGetImage(context, decodeURIComponent(imageMatch[1]));
      return errorResponse('Method not allowed', 405);
    }

    // /api/gacha/cards/:id
    const idMatch = pathname.match(/^\/api\/gacha\/cards\/([^/]+)$/);
    if (idMatch) {
      const id = idMatch[1];
      if (method === 'PATCH') return await handleUpdateCard(request, context, id);
      if (method === 'DELETE') return await handleDeleteCard(context, id);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, '가차 카드 관리');
  }
}
