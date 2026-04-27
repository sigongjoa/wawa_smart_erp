/**
 * 회의 녹음 + AI 요약 핸들러
 * - CRUD: 회의 목록/상세/삭제
 * - 오디오 업로드 → R2 저장
 * - Clova STT 음성인식
 * - Gemini AI 요약
 * - 보드 게시 연동
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { executeQuery, executeFirst, executeInsert, executeDelete, executeUpdate } from '@/utils/db';
import { logger } from '@/utils/logger';
import { generateId } from '@/utils/id';
import { geminiGenerate } from '@/utils/gemini';
import { z } from 'zod';

// ─── Schemas ───

const CreateMeetingSchema = z.object({
  title: z.string().min(1).max(100),
  participants: z.array(z.string()).optional(),
});

const UploadAudioSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().default('audio/webm'),
});

const UpdateActionSchema = z.object({
  status: z.enum(['pending', 'done']),
});

// ─── Helpers ───

async function callClovaSTT(
  audioBuffer: ArrayBuffer,
  invokeUrl: string,
  secretKey: string,
): Promise<string> {
  const res = await fetch(`${invokeUrl}/recognizer/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-CLOVASPEECH-API-KEY': secretKey,
    },
    body: JSON.stringify({
      language: 'ko-KR',
      completion: 'sync',
      diarization: { enable: true },
      format: 'webm',
    }),
  });

  // Clova upload API expects multipart or direct binary
  // Use the params-in-body approach for upload endpoint
  const formData = new FormData();
  formData.append('media', new Blob([audioBuffer]));
  formData.append('params', JSON.stringify({
    language: 'ko-KR',
    completion: 'sync',
    diarization: { enable: true },
  }));

  const sttRes = await fetch(`${invokeUrl}/recognizer/upload`, {
    method: 'POST',
    headers: {
      'X-CLOVASPEECH-API-KEY': secretKey,
    },
    body: formData,
  });

  if (!sttRes.ok) {
    const errText = await sttRes.text();
    throw new Error(`Clova STT 오류: ${sttRes.status} - ${errText}`);
  }

  const sttData = await sttRes.json() as any;
  return sttData?.text || '';
}

async function callGeminiSummary(
  transcript: string,
  title: string,
  participants: string[],
  context: RequestContext,
): Promise<{ summary: string; keyDecisions: string[]; extractedActions: Array<{ title: string; assigneeName: string | null; dueDate: string | null }> } | { _blocked: Response }> {
  const participantList = participants.length > 0 ? participants.join(', ') : '미지정';

  const prompt = `당신은 학원 강사 회의 내용을 정리하는 비서입니다.
아래 회의 녹취록을 분석하여 JSON 형식으로 결과를 반환하세요.

## 규칙
- summary: 3~5문장 핵심 요약
- keyDecisions: 회의에서 결정된 사항 목록 (없으면 빈 배열)
- extractedActions: 구체적인 할일 목록
  - title: 할일 내용
  - assigneeName: 담당자 이름 (녹취록에서 언급된 이름, 없으면 null)
  - dueDate: 기한 (언급된 경우 YYYY-MM-DD 형식, 없으면 null)

## 회의 정보
- 제목: ${title}
- 참석자: ${participantList}

## 녹취록
${transcript}

## 출력 (순수 JSON만, 마크다운 코드블록 없이)
{"summary":"...","keyDecisions":["..."],"extractedActions":[{"title":"...","assigneeName":"...","dueDate":"..."}]}`;

  const result = await geminiGenerate({
    env: context.env,
    userId: context.auth!.userId,
    kind: 'meeting-summary',
    prompt,
    temperature: 0.3,
    maxOutputTokens: 2048,
  });
  if (result.blocked) return { _blocked: result.blocked };
  const rawText = result.text!;

  const jsonStr = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return { summary: rawText, keyDecisions: [], extractedActions: [] };
  }
}

// ─── Handlers ───

/** GET /api/meeting — 회의 목록 */
async function handleList(context: RequestContext): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const academyId = context.tenantId;
  const meetings = await executeQuery<any>(
    context.env.DB,
    `SELECT id, title, status, duration_seconds, participants, summary,
            created_by, created_at, updated_at
     FROM meetings WHERE academy_id = ?
     ORDER BY created_at DESC LIMIT 50`,
    [academyId]
  );

  return successResponse(meetings.map(m => ({
    ...m,
    participants: m.participants ? JSON.parse(m.participants) : [],
  })));
}

/** GET /api/meeting/:id — 회의 상세 */
async function handleGet(id: string, context: RequestContext): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const meeting = await executeFirst<any>(
    context.env.DB,
    `SELECT * FROM meetings WHERE id = ? AND academy_id = ?`,
    [id, context.tenantId]
  );

  if (!meeting) return errorResponse('회의를 찾을 수 없습니다', 404);

  const actions = await executeQuery<any>(
    context.env.DB,
    `SELECT * FROM meeting_actions WHERE meeting_id = ? ORDER BY created_at`,
    [id]
  );

  return successResponse({
    ...meeting,
    participants: meeting.participants ? JSON.parse(meeting.participants) : [],
    keyDecisions: meeting.key_decisions ? JSON.parse(meeting.key_decisions) : [],
    actions,
  });
}

/** POST /api/meeting — 회의 생성 */
async function handleCreate(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const body = await request.json() as any;
  const input = CreateMeetingSchema.parse(body);
  const id = generateId();

  await executeInsert(
    context.env.DB,
    `INSERT INTO meetings (id, academy_id, title, participants, status, created_by)
     VALUES (?, ?, ?, ?, 'recording', ?)`,
    [id, context.tenantId, input.title, JSON.stringify(input.participants || []), context.auth!.userId]
  );

  return successResponse({ id, title: input.title, status: 'recording' });
}

/** POST /api/meeting/:id/upload — 오디오 업로드 + STT + AI 요약 파이프라인 */
async function handleUploadAndProcess(
  id: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const meeting = await executeFirst<any>(
    context.env.DB,
    `SELECT * FROM meetings WHERE id = ? AND academy_id = ?`,
    [id, context.tenantId]
  );
  if (!meeting) return errorResponse('회의를 찾을 수 없습니다', 404);

  const body = await request.json() as any;
  const input = UploadAudioSchema.parse(body);

  // 1) Base64 → ArrayBuffer, R2 저장
  const audioBytes = Uint8Array.from(atob(input.audioBase64), c => c.charCodeAt(0));
  const ext = input.mimeType.includes('wav') ? 'wav' : input.mimeType.includes('mp4') ? 'mp4' : 'webm';
  const r2Key = `meetings/${id}/audio.${ext}`;

  await context.env.BUCKET.put(r2Key, audioBytes.buffer, {
    httpMetadata: { contentType: input.mimeType },
  });

  const audioUrl = `/api/file/${r2Key}`;
  await executeUpdate(
    context.env.DB,
    `UPDATE meetings SET audio_url = ?, status = 'transcribing', updated_at = datetime('now') WHERE id = ?`,
    [audioUrl, id]
  );

  // 2) Clova STT
  const invokeUrl = context.env.CLOVA_INVOKE_URL;
  const secretKey = context.env.CLOVA_SECRET_KEY;
  if (!invokeUrl || !secretKey) {
    await executeUpdate(context.env.DB,
      `UPDATE meetings SET status = 'error', error_message = 'Clova API 키 미설정', updated_at = datetime('now') WHERE id = ?`, [id]);
    return errorResponse('Clova STT API 키가 설정되지 않았습니다', 500);
  }

  let transcript: string;
  try {
    transcript = await callClovaSTT(audioBytes.buffer, invokeUrl, secretKey);
  } catch (err: any) {
    logger.error('Clova STT 실패', err);
    await executeUpdate(context.env.DB,
      `UPDATE meetings SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
      [err.message, id]);
    return errorResponse('음성인식 실패: ' + err.message, 502);
  }

  if (!transcript || transcript.trim().length < 5) {
    await executeUpdate(context.env.DB,
      `UPDATE meetings SET status = 'error', error_message = '음성이 인식되지 않았습니다. 더 길게 녹음하거나 텍스트 입력을 이용해주세요.', updated_at = datetime('now') WHERE id = ?`, [id]);
    return errorResponse('음성이 인식되지 않았습니다. 녹음이 너무 짧거나 음성이 없습니다.', 400);
  }

  await executeUpdate(context.env.DB,
    `UPDATE meetings SET transcript = ?, status = 'summarizing', updated_at = datetime('now') WHERE id = ?`,
    [transcript, id]);

  // 3) Gemini AI 요약 — 게이트웨이가 한도/키/에러 모두 처리
  const participants: string[] = meeting.participants ? JSON.parse(meeting.participants) : [];

  let aiResult;
  try {
    const r = await callGeminiSummary(transcript, meeting.title, participants, context);
    if ('_blocked' in r) {
      await executeUpdate(context.env.DB,
        `UPDATE meetings SET status = 'done', error_message = 'AI 요약 차단됨 (한도/키 미설정)', updated_at = datetime('now') WHERE id = ?`,
        [id]);
      return r._blocked;
    }
    aiResult = r;
  } catch (err: any) {
    logger.error('Gemini 요약 실패', err);
    await executeUpdate(context.env.DB,
      `UPDATE meetings SET status = 'done', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
      ['요약 생성 실패: ' + err.message, id]);
    return successResponse({ id, transcript, summary: null, error: err.message });
  }

  // 4) DB 저장
  await executeUpdate(context.env.DB,
    `UPDATE meetings SET summary = ?, key_decisions = ?, status = 'done',
     duration_seconds = ?, updated_at = datetime('now') WHERE id = ?`,
    [aiResult.summary, JSON.stringify(aiResult.keyDecisions), Math.round(audioBytes.length / 16000), id]
  );

  // 액션 아이템 저장
  for (const action of aiResult.extractedActions) {
    await executeInsert(context.env.DB,
      `INSERT INTO meeting_actions (id, meeting_id, title, assignee_name, due_date)
       VALUES (?, ?, ?, ?, ?)`,
      [generateId(), id, action.title, action.assigneeName, action.dueDate]
    );
  }

  return successResponse({
    id,
    transcript,
    summary: aiResult.summary,
    keyDecisions: aiResult.keyDecisions,
    actions: aiResult.extractedActions,
  });
}

/** POST /api/meeting/:id/transcribe — 텍스트 직접 입력으로 요약 (녹음 없이) */
async function handleTranscribeText(
  id: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const meeting = await executeFirst<any>(
    context.env.DB,
    `SELECT * FROM meetings WHERE id = ? AND academy_id = ?`,
    [id, context.tenantId]
  );
  if (!meeting) return errorResponse('회의를 찾을 수 없습니다', 404);

  const body = await request.json() as any;
  const transcript = body.transcript;
  if (!transcript || typeof transcript !== 'string') {
    return errorResponse('녹취록 텍스트가 필요합니다', 400);
  }

  await executeUpdate(context.env.DB,
    `UPDATE meetings SET transcript = ?, status = 'summarizing', updated_at = datetime('now') WHERE id = ?`,
    [transcript, id]);

  const participants: string[] = meeting.participants ? JSON.parse(meeting.participants) : [];
  let aiResult;
  try {
    const r = await callGeminiSummary(transcript, meeting.title, participants, context);
    if ('_blocked' in r) {
      await executeUpdate(context.env.DB,
        `UPDATE meetings SET status = 'done', error_message = 'AI 요약 차단됨', updated_at = datetime('now') WHERE id = ?`,
        [id]);
      return r._blocked;
    }
    aiResult = r;
  } catch (err: any) {
    logger.error('Gemini 요약 실패', err);
    await executeUpdate(context.env.DB,
      `UPDATE meetings SET status = 'done', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
      ['요약 실패: ' + err.message, id]);
    return successResponse({ id, transcript, summary: null, error: err.message });
  }

  await executeUpdate(context.env.DB,
    `UPDATE meetings SET summary = ?, key_decisions = ?, status = 'done', updated_at = datetime('now') WHERE id = ?`,
    [aiResult.summary, JSON.stringify(aiResult.keyDecisions), id]
  );

  for (const action of aiResult.extractedActions) {
    await executeInsert(context.env.DB,
      `INSERT INTO meeting_actions (id, meeting_id, title, assignee_name, due_date)
       VALUES (?, ?, ?, ?, ?)`,
      [generateId(), id, action.title, action.assigneeName, action.dueDate]
    );
  }

  return successResponse({
    id,
    transcript,
    summary: aiResult.summary,
    keyDecisions: aiResult.keyDecisions,
    actions: aiResult.extractedActions,
  });
}

/** PATCH /api/meeting/actions/:actionId — 액션 상태 변경 */
async function handleUpdateAction(
  actionId: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const body = await request.json() as any;
  const input = UpdateActionSchema.parse(body);

  // 테넌트 격리: meetings JOIN으로 academy_id 검증
  const action = await executeFirst<any>(context.env.DB,
    `SELECT ma.id FROM meeting_actions ma
     JOIN meetings m ON ma.meeting_id = m.id
     WHERE ma.id = ? AND m.academy_id = ?`,
    [actionId, context.tenantId]
  );
  if (!action) return errorResponse('액션을 찾을 수 없습니다', 404);

  await executeUpdate(context.env.DB,
    `UPDATE meeting_actions SET status = ? WHERE id = ?`,
    [input.status, actionId]
  );

  return successResponse({ id: actionId, status: input.status });
}

/** POST /api/meeting/:id/publish — 보드에 회의 요약 게시 */
async function handlePublish(
  id: string,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const meeting = await executeFirst<any>(
    context.env.DB,
    `SELECT * FROM meetings WHERE id = ? AND academy_id = ?`,
    [id, context.tenantId]
  );
  if (!meeting) return errorResponse('회의를 찾을 수 없습니다', 404);
  if (!meeting.summary) return errorResponse('요약이 아직 생성되지 않았습니다', 400);

  // 소유자 또는 admin만 게시 가능
  const isOwner = meeting.created_by === context.auth!.userId;
  const isAdmin = context.auth!.role === 'admin';
  if (!isOwner && !isAdmin) return errorResponse('게시 권한이 없습니다', 403);

  const keyDecisions: string[] = meeting.key_decisions ? JSON.parse(meeting.key_decisions) : [];
  const decisionText = keyDecisions.length > 0
    ? '\n\n주요 결정사항:\n' + keyDecisions.map((d, i) => `${i + 1}. ${d}`).join('\n')
    : '';

  // 보드에 공지로 게시
  const noticeId = generateId();
  await executeInsert(context.env.DB,
    `INSERT INTO notices (id, academy_id, author_id, title, content, category, is_pinned)
     VALUES (?, ?, ?, ?, ?, 'meeting', 0)`,
    [noticeId, context.tenantId, context.auth!.userId, `[회의록] ${meeting.title}`, meeting.summary + decisionText]
  );

  // 액션 아이템도 보드 액션으로 생성
  const actions = await executeQuery<any>(context.env.DB,
    `SELECT * FROM meeting_actions WHERE meeting_id = ?`, [id]);

  for (const action of actions) {
    const actionId = generateId();
    // assigned_to는 user ID가 필요하지만, 회의록에서는 이름만 추출되므로 생성자에게 할당
    await executeInsert(context.env.DB,
      `INSERT INTO action_items (id, academy_id, notice_id, title, description, assigned_to, assigned_by, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [actionId, context.tenantId, noticeId, action.title, action.assignee_name ? `담당: ${action.assignee_name}` : '', context.auth!.userId, context.auth!.userId, action.due_date]
    );
  }

  return successResponse({ noticeId, message: '보드에 게시되었습니다' });
}

/** DELETE /api/meeting/:id */
async function handleDeleteMeeting(id: string, context: RequestContext): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  // R2 오디오 삭제
  const meeting = await executeFirst<any>(context.env.DB,
    `SELECT audio_url, created_by FROM meetings WHERE id = ? AND academy_id = ?`,
    [id, context.tenantId]);

  if (!meeting) return errorResponse('회의를 찾을 수 없습니다', 404);

  // 소유자 또는 admin만 삭제 가능
  const isOwner = meeting.created_by === context.auth!.userId;
  const isAdmin = context.auth!.role === 'admin';
  if (!isOwner && !isAdmin) return errorResponse('삭제 권한이 없습니다', 403);

  if (meeting.audio_url) {
    const r2Key = meeting.audio_url.replace('/api/file/', '');
    try { await context.env.BUCKET.delete(r2Key); } catch { /* ignore */ }
  }

  await executeDelete(context.env.DB, `DELETE FROM meeting_actions WHERE meeting_id = ?`, [id]);
  await executeDelete(context.env.DB, `DELETE FROM meetings WHERE id = ?`, [id]);

  return successResponse({ deleted: true });
}

// ─── Router ───

export async function handleMeeting(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // GET /api/meeting — 목록
    if (pathname === '/api/meeting' && method === 'GET') {
      return handleList(context);
    }

    // POST /api/meeting — 생성
    if (pathname === '/api/meeting' && method === 'POST') {
      return handleCreate(request, context);
    }

    // PATCH /api/meeting/actions/:id — 액션 상태
    const actionMatch = pathname.match(/^\/api\/meeting\/actions\/([^/]+)$/);
    if (actionMatch && method === 'PATCH') {
      return handleUpdateAction(actionMatch[1], request, context);
    }

    // GET /api/meeting/:id — 상세
    const idMatch = pathname.match(/^\/api\/meeting\/([^/]+)$/);
    if (idMatch && method === 'GET') {
      return handleGet(idMatch[1], context);
    }

    // DELETE /api/meeting/:id
    if (idMatch && method === 'DELETE') {
      return handleDeleteMeeting(idMatch[1], context);
    }

    // POST /api/meeting/:id/upload — 오디오 업로드 + 처리
    const uploadMatch = pathname.match(/^\/api\/meeting\/([^/]+)\/upload$/);
    if (uploadMatch && method === 'POST') {
      return handleUploadAndProcess(uploadMatch[1], request, context);
    }

    // POST /api/meeting/:id/transcribe — 텍스트 직접 요약
    const transcribeMatch = pathname.match(/^\/api\/meeting\/([^/]+)\/transcribe$/);
    if (transcribeMatch && method === 'POST') {
      return handleTranscribeText(transcribeMatch[1], request, context);
    }

    // POST /api/meeting/:id/publish — 보드 게시
    const publishMatch = pathname.match(/^\/api\/meeting\/([^/]+)\/publish$/);
    if (publishMatch && method === 'POST') {
      return handlePublish(publishMatch[1], context);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('입력 검증 오류: ' + error.errors.map(e => e.message).join(', '), 400);
    }
    logger.error('Meeting handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('서버 오류가 발생했습니다', 500);
  }
}
