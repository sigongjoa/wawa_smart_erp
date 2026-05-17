/**
 * AskAI HTTP route handler
 *
 * 라우트:
 *   POST /api/ask-ai/ask                — UC-01·03 학생 질문 (텍스트/사진)
 *   GET  /api/ask-ai/conversations/:id  — 대화 단건 fetch
 *   GET  /api/ask-ai/quota              — UC-02 학생 quota 조회
 *
 *   GET  /api/ask-ai/teacher/queue      — UC-09 강사 큐
 *   POST /api/ask-ai/teacher/decision   — UC-10 강사 결정
 *
 *   GET  /api/ask-ai/drill/today        — UC-12 오늘 카드 fetch
 *   POST /api/ask-ai/drill/rate         — UC-13 자가평가
 */

import type { RequestContext } from '@/types';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { authMiddleware } from '@/middleware/auth';
import { playGuard, checkBurstLimit } from '@/middleware/play-auth';
import { tenantMiddleware } from '@/middleware/tenant';
import { logger } from '@/utils/logger';

import {
  AskAIRequestSchema,
  TeacherActionRequestSchema,
  RatingSchema,
  type DrillCard,
  type SM2State,
} from '@/schemas/ask-ai';
import { orchestrate } from '@/services/ask-ai/orchestrator';
import { orchestrateV2 } from '@/services/ask-ai/orchestrate-v2';
import { GeminiFetcher } from '@/services/ask-ai/gemini-adapter';
import { checkQuota, incrementQuota, freshQuotaState, isStaleForToday } from '@/services/ask-ai/quota';
import { checkAiDailyLimit } from '@/utils/ai-rate-limit';
import { applyDecision, filterQueue, sortQueue, type ConversationSummary } from '@/services/ask-ai/teacher';
import { nextSM2 } from '@/services/ask-ai/sm2';
import { makePhotoKey, validatePhotoFile, expirationDate, MAX_PHOTO_BYTES } from '@/services/ask-ai/photo-upload';

const TZ_OFFSET_KST_MS = 9 * 60 * 60 * 1000;

function todayKST(): string {
  const now = new Date(Date.now() + TZ_OFFSET_KST_MS);
  return now.toISOString().slice(0, 10);
}

export async function handleAskAI(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  // 인증 — 학생/강사 라우트별 분기
  // 학생 endpoints: play_token (KV `play:<token>`) + tenant 체크
  // 강사 endpoints: JWT (httpOnly cookie or Bearer) + tenant 체크
  const isTeacherRoute = pathname.startsWith('/api/ask-ai/teacher/');

  if (isTeacherRoute) {
    const authResult = await authMiddleware(context);
    if (authResult instanceof Response) return authResult;
    const tenantResult = await tenantMiddleware(context);
    if (tenantResult instanceof Response) return tenantResult;
  } else {
    const guarded = await playGuard(context);
    if (guarded instanceof Response) return guarded;
  }
  const auth = context.auth!;

  try {
    // 학생용 — POST /ask
    if (method === 'POST' && pathname === '/api/ask-ai/ask') {
      return await handleAsk(request, context);
    }

    // 학생용 — POST /photos/upload (UC-03: 사진 R2 PUT + askai_photos INSERT)
    if (method === 'POST' && pathname === '/api/ask-ai/photos/upload') {
      return await handlePhotoUpload(request, context);
    }

    // 학생용 — GET /quota
    if (method === 'GET' && pathname === '/api/ask-ai/quota') {
      return await handleGetQuota(context);
    }

    // 학생용 — GET /conversations/:id
    if (method === 'GET' && pathname.startsWith('/api/ask-ai/conversations/')) {
      const id = pathname.slice('/api/ask-ai/conversations/'.length);
      return await handleGetConversation(id, context);
    }

    // 강사용 — GET /teacher/queue
    if (method === 'GET' && pathname === '/api/ask-ai/teacher/queue') {
      if (auth.role !== 'instructor' && auth.role !== 'admin') {
        return errorResponse('강사 권한이 필요합니다', 403);
      }
      return await handleTeacherQueue(request, context);
    }

    // 강사용 — POST /teacher/decision
    if (method === 'POST' && pathname === '/api/ask-ai/teacher/decision') {
      if (auth.role !== 'instructor' && auth.role !== 'admin') {
        return errorResponse('강사 권한이 필요합니다', 403);
      }
      return await handleTeacherDecision(request, context);
    }

    // 강사용 — GET /teacher/conversations/:id (UC-09 상세)
    if (method === 'GET' && pathname.startsWith('/api/ask-ai/teacher/conversations/')) {
      if (auth.role !== 'instructor' && auth.role !== 'admin') {
        return errorResponse('강사 권한이 필요합니다', 403);
      }
      const id = pathname.slice('/api/ask-ai/teacher/conversations/'.length);
      return await handleTeacherConversation(id, context);
    }

    // 학생 drill — GET /drill/today
    if (method === 'GET' && pathname === '/api/ask-ai/drill/today') {
      return await handleDrillToday(context);
    }

    // 학생 drill — POST /drill/rate
    if (method === 'POST' && pathname === '/api/ask-ai/drill/rate') {
      return await handleDrillRate(request, context);
    }

    return notFoundResponse();
  } catch (err) {
    logger.error('ask-ai handler error: ' + (err instanceof Error ? err.message : String(err)));
    return errorResponse('내부 오류', 500);
  }
}

/* ─────────── 학생 ─────────── */

async function handleAsk(request: Request, context: RequestContext): Promise<Response> {
  const auth = context.auth!;
  const today = todayKST();

  // 1) burst rate-limit (비용 폭주 차단 — 일일 quota 와 별개)
  const burstResp = await enforceBurstLimit(context, auth.userId);
  if (burstResp) return burstResp;

  // 2) request 검증 + student_id 강제
  const reqOrResp = await parseAskRequest(request, auth.userId);
  if (reqOrResp instanceof Response) return reqOrResp;
  const req = reqOrResp;

  // 3) UC-02 — 일일 quota 체크 (질문 + 사진)
  const quotaState = await loadQuota(context, auth.userId, today);
  const quotaResp = checkAskQuota(quotaState, req.attached_photos.length > 0);
  if (quotaResp) return quotaResp;

  // 4) Gemini key 체크 + AI daily limit (KV 1회 read+write per /ask)
  if (!context.env.GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY missing');
    return errorResponse('AI 서비스 설정 오류', 500);
  }
  // ask-ai는 orchestrate-v2 가 sub-call N회 호출 → daily limit 은 진입점 1회만 체크.
  // gemini-adapter 에 skipKVTracking=true 로 sub-call 의 KV 폭증 차단.
  const aiLimitBlocked = await checkAiDailyLimit(context.env.KV, auth.userId, 'ask-ai');
  if (aiLimitBlocked) return aiLimitBlocked;

  // 5) UC-01 — orchestrate (v2: Plan + Fill, multi-call로 truncate 회피)
  const studentMeta = await loadStudentMeta(context, auth.userId);
  const sections = await loadUnitSections(context, req.unit_id);
  const fetcher = new GeminiFetcher({
    env: context.env,
    userId: auth.userId,
    academyId: auth.academyId,
    model: 'gemini-2.5-flash',
    attachedPhotoKeys: req.attached_photos,  // UC-03 Vision
  });
  const result = await orchestrateV2({
    request: req,
    studentMeta,
    sections,
    claudeFetch: fetcher,
    now: () => new Date(),
  });

  // 6) 영속화 (대화 + quota) + Analytics Engine 메트릭
  await persistConversation(context, auth.userId, req, result);
  writeAskAIMetric(context, auth, req, result);
  const finalQuota = bumpQuota(quotaState, req.attached_photos.length > 0);
  await persistQuota(context, finalQuota);

  return successResponse({
    conversation_id: result.conversation_id,
    response: result.response,
    quota_remaining: {
      questions: finalQuota.questions_limit - finalQuota.questions_used,
      photos: finalQuota.photos_limit - finalQuota.photos_used,
    },
  });
}

/* ─────────── handleAsk 분리 헬퍼 ─────────── */

async function enforceBurstLimit(context: RequestContext, userId: string): Promise<Response | null> {
  const burst = await checkBurstLimit(context, `ask:${userId}`, 5, 60);
  if (burst.allowed) return null;
  return new Response(
    JSON.stringify({ success: false, error: '잠시 후 다시 시도해주세요', retry_after: burst.retryAfterSec, timestamp: new Date().toISOString() }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(burst.retryAfterSec) } },
  );
}

async function parseAskRequest(request: Request, userId: string) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = AskAIRequestSchema.safeParse({ ...body, student_id: userId });
  if (!parsed.success) return errorResponse(parsed.error.message, 400);
  return parsed.data;
}

function checkAskQuota(state: any, hasPhoto: boolean): Response | null {
  const q = checkQuota(state, 'question');
  if (!q.allowed) return errorResponse(q.reason ?? '한도 초과', 429);
  if (hasPhoto) {
    const p = checkQuota(state, 'photo');
    if (!p.allowed) return errorResponse(p.reason ?? '사진 한도 초과', 429);
  }
  return null;
}

function bumpQuota(state: any, hasPhoto: boolean) {
  const next = incrementQuota(state, 'question');
  return hasPhoto ? incrementQuota(next, 'photo') : next;
}

/**
 * Analytics Engine 으로 conversation metric 1건 발행.
 * D2~D5 회귀를 prod 트래픽에서 즉시 가시화하기 위한 신호.
 * - blob1: academy_id (격리·필터링)
 * - blob2: confidence
 * - blob3: needs_teacher (string)
 * - blob4: unit_id
 * - blob5: is_short ('1' if message length < 30)  — D1 회귀 신호
 * - double1: used_tokens
 * - double2: duration_ms
 *
 * binding 미설정이면 silently skip (개발 환경 호환).
 */
function writeAskAIMetric(
  context: RequestContext,
  auth: { academyId?: string },
  req: { unit_id?: string; message: string },
  result: { response: any; used_tokens: number; duration_ms: number },
): void {
  const ae = context.env.AE_ASKAI;
  if (!ae) return;
  try {
    const academyId = auth.academyId ?? 'unknown';
    ae.writeDataPoint({
      blobs: [
        academyId,
        String(result.response.confidence ?? 'unknown'),
        result.response.needs_teacher ? '1' : '0',
        req.unit_id ?? 'none',
        req.message.length < 30 ? '1' : '0',
      ],
      doubles: [result.used_tokens, result.duration_ms],
      indexes: [academyId],
    });
  } catch (err) {
    // AE 실패가 응답을 막아선 안 됨
    logger.warn('AE_ASKAI writeDataPoint 실패: ' + (err instanceof Error ? err.message : String(err)));
  }
}

async function persistConversation(
  context: RequestContext,
  studentId: string,
  req: { unit_id?: string; message: string; attached_photos: string[] },
  result: { conversation_id: string; response: any; used_tokens: number; duration_ms: number },
): Promise<void> {
  await context.env.DB.prepare(
    `INSERT INTO askai_conversations
      (id, student_id, unit_id, message, response_json, confidence, needs_teacher,
       used_tokens, duration_ms, attached_photos)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    result.conversation_id,
    studentId,
    req.unit_id ?? null,
    req.message,
    JSON.stringify(result.response),
    result.response.confidence,
    result.response.needs_teacher ? 1 : 0,
    result.used_tokens,
    result.duration_ms,
    JSON.stringify(req.attached_photos),
  ).run();
}

async function handleGetQuota(context: RequestContext): Promise<Response> {
  const auth = context.auth!;
  const today = todayKST();
  const state = await loadQuota(context, auth.userId, today);
  return successResponse({
    questions: { used: state.questions_used, limit: state.questions_limit },
    photos: { used: state.photos_used, limit: state.photos_limit },
    date: state.date,
  });
}

async function handleGetConversation(id: string, context: RequestContext): Promise<Response> {
  const auth = context.auth!;
  const row = await context.env.DB.prepare(
    `SELECT * FROM askai_conversations WHERE id = ? AND student_id = ?`
  ).bind(id, auth.userId).first();
  if (!row) return notFoundResponse();
  return successResponse({
    ...row,
    response: JSON.parse(row.response_json as string),
    attached_photos: row.attached_photos ? JSON.parse(row.attached_photos as string) : [],
  });
}

/* ─────────── 강사 ─────────── */

async function handleTeacherQueue(request: Request, context: RequestContext): Promise<Response> {
  const auth = context.auth!;
  const academyId = auth.academyId;
  if (!academyId) return errorResponse('학원 정보가 없습니다', 400);

  const url = new URL(request.url);
  const needsTeacherOnly = url.searchParams.get('needs_teacher') === '1';
  const uncommentedOnly = url.searchParams.get('uncommented') === '1';
  const sort = (url.searchParams.get('sort') ?? 'uncommented_first') as any;

  // 최근 7일 대화 — gacha_students JOIN으로 academy 격리 + 학생 이름
  const rows = await context.env.DB.prepare(
    `SELECT c.id as conversation_id, c.student_id, g.name as student_name,
            c.unit_id, c.confidence, c.needs_teacher, c.started_at,
            (SELECT decision FROM askai_decisions WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as decision,
            (SELECT COUNT(*) FROM askai_decisions WHERE conversation_id = c.id AND decision = 'comment') as comment_count
     FROM askai_conversations c
     JOIN gacha_students g ON g.id = c.student_id
     WHERE g.academy_id = ?
       AND c.started_at > datetime('now', '-7 days')
     ORDER BY c.started_at DESC
     LIMIT 200`
  ).bind(academyId).all();

  const summaries: ConversationSummary[] = (rows.results || []).map((r: any) => ({
    conversation_id: r.conversation_id,
    student_id: r.student_id,
    student_name: r.student_name ?? r.student_id,
    unit: r.unit_id ?? '미분류',
    confidence: r.confidence,
    needs_teacher: !!r.needs_teacher,
    decision: r.decision,
    comment_count: r.comment_count ?? 0,
    started_at: r.started_at,
  }));

  const filtered = filterQueue(summaries, { needsTeacherOnly, uncommentedOnly });
  const sorted = sortQueue(filtered, sort);

  return successResponse({ items: sorted, total: sorted.length });
}

async function handleTeacherConversation(id: string, context: RequestContext): Promise<Response> {
  const auth = context.auth!;
  const academyId = auth.academyId;
  if (!academyId) return errorResponse('학원 정보가 없습니다', 400);
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || id.length > 64) {
    return errorResponse('잘못된 conversation id', 400);
  }

  // academy 격리 — gacha_students JOIN으로 강사 academy 일치 검증
  const row = await context.env.DB.prepare(
    `SELECT c.*, g.name as student_name, g.academy_id as student_academy_id
     FROM askai_conversations c
     JOIN gacha_students g ON g.id = c.student_id
     WHERE c.id = ? AND g.academy_id = ?`
  ).bind(id, academyId).first();
  if (!row) return notFoundResponse();

  // 결정 이력
  const decisionsResult = await context.env.DB.prepare(
    `SELECT id, teacher_id, decision, comment, applied_at
     FROM askai_decisions
     WHERE conversation_id = ?
     ORDER BY id DESC`
  ).bind(id).all();
  const decisions = (decisionsResult.results ?? []) as any[];

  let response: unknown = null;
  try { response = JSON.parse(row.response_json as string); } catch { response = null; }
  let attached: string[] = [];
  try {
    if (row.attached_photos) attached = JSON.parse(row.attached_photos as string);
  } catch { attached = []; }

  return successResponse({
    conversation: {
      id: row.id,
      student_id: row.student_id,
      student_name: row.student_name,
      unit_id: row.unit_id,
      message: row.message,
      response,
      confidence: row.confidence,
      needs_teacher: !!row.needs_teacher,
      used_tokens: row.used_tokens,
      duration_ms: row.duration_ms,
      attached_photos: attached,
      started_at: row.started_at,
    },
    decisions,
  });
}

async function handleTeacherDecision(request: Request, context: RequestContext): Promise<Response> {
  const auth = context.auth!;
  const academyId = auth.academyId;
  if (!academyId) return errorResponse('학원 정보가 없습니다', 400);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = TeacherActionRequestSchema.safeParse({
    ...body,
    teacher_id: auth.userId,
  });
  if (!parsed.success) {
    return errorResponse(parsed.error.message, 400);
  }

  // academy 격리 — 대상 conversation의 학생이 같은 학원인지 검증
  const owner = await context.env.DB.prepare(
    `SELECT g.academy_id as student_academy_id
     FROM askai_conversations c
     JOIN gacha_students g ON g.id = c.student_id
     WHERE c.id = ?`
  ).bind(parsed.data.conversation_id).first();
  if (!owner) return notFoundResponse();
  if ((owner.student_academy_id as string) !== academyId) {
    return errorResponse('학원 권한이 없습니다', 403);
  }

  const result = applyDecision(parsed.data);

  await context.env.DB.prepare(
    `INSERT INTO askai_decisions (conversation_id, teacher_id, decision, comment) VALUES (?, ?, ?, ?)`
  ).bind(
    result.conversation_id, result.teacher_id, result.decision, result.comment ?? null
  ).run();

  // TODO: notify_student → push 발송 큐
  return successResponse(result);
}

/* ─────────── 사진 업로드 (UC-03) ─────────── */

async function handlePhotoUpload(request: Request, context: RequestContext): Promise<Response> {
  const auth = context.auth!;
  const studentId = auth.userId;

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return errorResponse('multipart/form-data 필요', 400);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('form 파싱 실패', 400);
  }

  const file = formData.get('photo');
  if (!(file instanceof File)) {
    return errorResponse('photo 파일이 없습니다', 400);
  }

  const mime = (file.type || '').toLowerCase();
  const check = validatePhotoFile({ size: file.size, mime });
  if (!check.allowed) {
    return errorResponse(check.reason ?? '파일 검증 실패', 415);
  }

  // path traversal 방어
  if (!/^[a-zA-Z0-9_-]+$/.test(studentId)) {
    return errorResponse('잘못된 학생 ID', 400);
  }

  const today = todayKST();
  const uuid = crypto.randomUUID();
  const r2Key = makePhotoKey({ student_id: studentId, today, uuid, filename: file.name || 'photo.jpg' });

  // R2 PUT
  const buf = await file.arrayBuffer();
  await context.env.BUCKET.put(r2Key, buf, {
    httpMetadata: { contentType: mime },
    customMetadata: { student_id: studentId, uploaded_at: new Date().toISOString() },
  });

  // askai_photos INSERT
  await context.env.DB.prepare(
    `INSERT INTO askai_photos (r2_key, student_id, conversation_id, size_bytes, mime, expires_at)
     VALUES (?, ?, NULL, ?, ?, ?)`
  ).bind(r2Key, studentId, file.size, mime, expirationDate(today)).run();

  return successResponse({
    r2_key: r2Key,
    size_bytes: file.size,
    mime,
    expires_at: expirationDate(today),
  });
}

/* ─────────── drill ─────────── */

async function handleDrillToday(context: RequestContext): Promise<Response> {
  const auth = context.auth!;
  const today = todayKST();

  const rows = await context.env.DB.prepare(
    `SELECT c.*, s.ease, s.interval_days, s.due_date, s.reps, s.lapses
     FROM askai_drill_cards c
     LEFT JOIN askai_sm2_state s ON s.card_id = c.id
     WHERE c.student_id = ?
       AND (s.due_date IS NULL OR s.due_date <= ?)
     ORDER BY s.due_date ASC NULLS FIRST
     LIMIT 10`
  ).bind(auth.userId, today).all();

  return successResponse({ cards: rows.results ?? [], today });
}

async function handleDrillRate(request: Request, context: RequestContext): Promise<Response> {
  const auth = context.auth!;
  const today = todayKST();
  const body = await request.json().catch(() => null);
  const parsed = z.object({
    card_id: z.string(),
    rating: RatingSchema,
  }).safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.message, 400);
  }

  // 카드 + 현재 SM-2 상태 fetch
  const cardRow = await context.env.DB.prepare(
    `SELECT c.id, s.ease, s.interval_days, s.due_date, s.reps, s.lapses
     FROM askai_drill_cards c
     LEFT JOIN askai_sm2_state s ON s.card_id = c.id
     WHERE c.id = ? AND c.student_id = ?`
  ).bind(parsed.data.card_id, auth.userId).first();
  if (!cardRow) return notFoundResponse();

  const current: SM2State = {
    card_id: parsed.data.card_id,
    ease: (cardRow.ease as number) ?? 2.5,
    interval_days: (cardRow.interval_days as number) ?? 1,
    due_date: (cardRow.due_date as string) ?? today,
    reps: (cardRow.reps as number) ?? 0,
    lapses: (cardRow.lapses as number) ?? 0,
  };

  const result = nextSM2(current, parsed.data.rating, today);

  await context.env.DB.prepare(
    `INSERT INTO askai_sm2_state (card_id, ease, interval_days, due_date, reps, lapses, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(card_id) DO UPDATE SET
       ease = excluded.ease,
       interval_days = excluded.interval_days,
       due_date = excluded.due_date,
       reps = excluded.reps,
       lapses = excluded.lapses,
       updated_at = datetime('now')`
  ).bind(
    result.next_state.card_id,
    result.next_state.ease,
    result.next_state.interval_days,
    result.next_state.due_date,
    result.next_state.reps,
    result.next_state.lapses,
  ).run();

  return successResponse(result);
}

/* ─────────── helpers (D1) ─────────── */

async function loadQuota(context: RequestContext, student_id: string, today: string) {
  const row = await context.env.DB.prepare(
    `SELECT * FROM askai_quota WHERE student_id = ? AND date = ?`
  ).bind(student_id, today).first();

  if (!row) return freshQuotaState(student_id, today);

  return {
    student_id, date: today,
    questions_used: row.questions_used as number,
    questions_limit: 30,
    photos_used: row.photos_used as number,
    photos_limit: 10,
  };
}

async function persistQuota(context: RequestContext, state: any): Promise<void> {
  await context.env.DB.prepare(
    `INSERT INTO askai_quota (student_id, date, questions_used, photos_used)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id, date) DO UPDATE SET
       questions_used = excluded.questions_used,
       photos_used = excluded.photos_used`
  ).bind(state.student_id, state.date, state.questions_used, state.photos_used).run();
}

async function loadStudentMeta(context: RequestContext, student_id: string) {
  // TODO: students 테이블 + _meta.json 통합. 지금은 KV 또는 미니멀 fallback
  const cached = await context.env.KV.get(`student-meta:${student_id}`);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignore */ }
  }
  return { name: student_id };
}

async function loadUnitSections(context: RequestContext, unit_id?: string) {
  // TODO: data/by-curriculum/ → KV/R2 sync 잡고 fetch. 지금은 빈 배열 (orchestrator는 동작)
  return [];
}

// inline import for the rate handler validation
import { z } from 'zod';
