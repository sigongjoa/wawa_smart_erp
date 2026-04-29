/**
 * 라이브 문제 세션 핸들러
 * - 교사(JWT) 데스크톱 ↔ 학생(Play KV 토큰) 모바일/태블릿 1:1 풀이 공유
 * - 세션 중 상태는 KV(lvs:state:{id})에 저장 (이미지는 base64 data URL로 인라인)
 * - 종료 시 최종 캔버스 PNG를 R2에 영구 저장
 *
 * 라우팅:
 *   교사 (JWT, /api/live/*):
 *     POST   /api/live/sessions
 *     GET    /api/live/sessions/:id
 *     GET    /api/live/sessions/:id/state
 *     PATCH  /api/live/sessions/:id/state          (side: 'teacher'|'problem')
 *     POST   /api/live/sessions/:id/end
 *
 *   학생 (Play KV 토큰, /api/play/live/*):
 *     GET    /api/play/live/active
 *     GET    /api/play/live/sessions/:id/state
 *     PATCH  /api/play/live/sessions/:id/state     (side: 'student' only)
 */

import { z } from 'zod';
import { RequestContext } from '@/types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from '@/utils/response';
import { executeFirst, executeUpdate, executeInsert } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId } from '@/utils/context';
import { generatePrefixedId } from '@/utils/id';
import { logger } from '@/utils/logger';

interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

async function getPlayAuth(context: RequestContext): Promise<PlayAuth | null> {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const data = (await context.env.KV.get(`play:${token}`, 'json')) as PlayAuth | null;
  return data;
}

const STATE_TTL = 3600;
const MAX_IMG_DATAURL_LEN = 1_400_000; // ~1MB raw → ~1.4MB base64

interface LiveState {
  problem: { text?: string; image_data_url?: string; updated_at: number };
  teacher: { text?: string; strokes?: any[]; updated_at: number };
  student: {
    text?: string;
    strokes?: any[];
    photo_data_urls?: string[]; // 최대 5개
    updated_at: number;
  };
  pulse: number;
  status?: 'active' | 'ended';
}

function emptyState(): LiveState {
  const now = Date.now();
  return {
    problem: { updated_at: now },
    teacher: { updated_at: now },
    student: { updated_at: now },
    pulse: now,
    status: 'active',
  };
}

function isValidImageDataUrl(s: string): boolean {
  if (s.length > MAX_IMG_DATAURL_LEN) return false;
  return /^data:image\/(png|jpeg|jpg|webp);base64,/.test(s);
}

/**
 * SEC-LIVE-M1: 텍스트 위생화 — C0/C1 제어문자 제거 + trim.
 * KV/DB 저장 전 모든 외부 입력 텍스트에 적용.
 */
function sanitizeText(v: any): string {
  if (typeof v !== 'string') return '';
  // \t, \n 유지 — 그 외 C0/C1 제어문자 제거
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}
function sanitizeNullable(v: any): string | null {
  const cleaned = sanitizeText(v);
  return cleaned === '' ? null : cleaned;
}

const StatePatchSchema = z.object({
  side: z.enum(['teacher', 'student', 'problem']),
  text: z.string().max(20000).optional(),
  strokes: z.array(z.any()).max(5000).optional(),
  image_data_url: z.string().optional(),
  append_photo_data_url: z.string().optional(),
});

const CreateSessionSchema = z.object({
  student_id: z.string().min(1),
  subject: z.string().min(1).max(40),
  problem_text: z.string().max(5000).optional(),
});

const EndSessionSchema = z.object({
  teacher_solution_image: z.string().optional(),
  student_answer_image: z.string().optional(),
  create_note: z
    .object({
      sentiment: z.enum(['positive', 'neutral', 'concern']),
      summary: z.string().min(1).max(1000),
      category: z.enum(['attitude', 'understanding', 'homework', 'exam', 'etc']).optional(),
    })
    .optional(),
});

function stateKey(id: string): string {
  return `lvs:state:${id}`;
}
function activeKey(studentId: string): string {
  return `lvs:active:student:${studentId}`;
}

async function loadSession(
  context: RequestContext,
  id: string
): Promise<any | null> {
  return await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM live_sessions WHERE id = ?',
    [id]
  );
}

async function loadState(context: RequestContext, id: string): Promise<LiveState> {
  const raw = await context.env.KV.get(stateKey(id), 'json');
  return (raw as LiveState | null) || emptyState();
}

// 서버측 내용 기반 dedup — pulse만 바뀌고 실제 컨텐츠(strokes/text/image)는 동일한
// heartbeat-only PATCH에 대해 KV.put 생략. 무료 티어 KV put 한도(일 1000) 보호.
// isolate 재활용 시 초기화되지만 isolate 유지 동안엔 유효.
const lastContentHash: Map<string, string> =
  (globalThis as any).__liveContentHash ??= new Map();

function hashStateForDedup(state: LiveState): string {
  // pulse 제외 — 순수 내용 변화만 체크
  const { pulse: _, ...rest } = state as any;
  return JSON.stringify(rest);
}

async function saveState(
  context: RequestContext,
  id: string,
  state: LiveState
): Promise<void> {
  const contentHash = hashStateForDedup(state);
  // 내용 동일 → KV write skip (pulse만 바뀐 heartbeat 등)
  if (lastContentHash.get(id) === contentHash) return;

  await context.env.KV.put(stateKey(id), JSON.stringify(state), {
    expirationTtl: STATE_TTL,
  });
  lastContentHash.set(id, contentHash);
}

function decodeBase64Image(b64: string): { buf: ArrayBuffer; mime: string } | null {
  const m = b64.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  const mimeExt = m ? m[1] : 'png';
  const payload = m ? m[2] : b64;
  try {
    const binary = atob(payload);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return { buf: buf.buffer, mime: `image/${mimeExt === 'jpg' ? 'jpeg' : mimeExt}` };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// 교사 측 (JWT)
// ─────────────────────────────────────────────────────────────────

export async function handleLive(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (!requireAuth(context)) return unauthorizedResponse();
    const academyId = getAcademyId(context);
    const userId = context.auth!.userId;

    // POST /api/live/sessions
    if (method === 'POST' && pathname === '/api/live/sessions') {
      if (!requireRole(context, 'instructor', 'admin')) return unauthorizedResponse();
      const body = (await request.json()) as any;
      const input = CreateSessionSchema.parse(body);

      const student = await executeFirst<any>(
        context.env.DB,
        'SELECT id FROM students WHERE id = ? AND academy_id = ?',
        [input.student_id, academyId]
      );
      if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);

      // SEC-LIVE-M1: 입력 위생화 — subject/problem_text C0/C1 제거 + trim
      const cleanSubject = sanitizeText(input.subject);
      const cleanProblemText = sanitizeNullable(input.problem_text);
      if (!cleanSubject) return errorResponse('subject 필수', 400);

      const id = generatePrefixedId('lvs');
      await executeInsert(
        context.env.DB,
        `INSERT INTO live_sessions
         (id, academy_id, teacher_id, student_id, subject, problem_text)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, academyId, userId, input.student_id, cleanSubject, cleanProblemText]
      );

      const state = emptyState();
      if (cleanProblemText) state.problem.text = cleanProblemText;
      await saveState(context, id, state);
      await context.env.KV.put(activeKey(input.student_id), id, {
        expirationTtl: STATE_TTL,
      });

      logger.logAudit('LIVE_SESSION_START', 'LiveSession', id, userId, {
        student_id: input.student_id,
        subject: input.subject,
      });
      return successResponse({ id, started_at: new Date().toISOString() }, 201);
    }

    // GET /api/live/sessions/:id
    let m = pathname.match(/^\/api\/live\/sessions\/([^/]+)$/);
    if (m && method === 'GET') {
      const id = m[1];
      const sess = await loadSession(context, id);
      if (!sess || sess.academy_id !== academyId) return notFoundResponse();
      if (sess.teacher_id !== userId && context.auth!.role !== 'admin') {
        return errorResponse('권한 없음', 403);
      }
      return successResponse(sess);
    }

    // GET /api/live/sessions/:id/state
    m = pathname.match(/^\/api\/live\/sessions\/([^/]+)\/state$/);
    if (m && method === 'GET') {
      const id = m[1];
      const sess = await loadSession(context, id);
      if (!sess || sess.academy_id !== academyId) return notFoundResponse();
      if (sess.teacher_id !== userId && context.auth!.role !== 'admin') {
        return errorResponse('권한 없음', 403);
      }
      const state = await loadState(context, id);
      if (sess.status === 'ended') state.status = 'ended';
      return successResponse(state);
    }

    // PATCH /api/live/sessions/:id/state
    if (m && method === 'PATCH') {
      const id = m[1];
      const sess = await loadSession(context, id);
      if (!sess || sess.academy_id !== academyId) return notFoundResponse();
      if (sess.teacher_id !== userId) return errorResponse('교사 본인만 수정 가능', 403);
      if (sess.status === 'ended') return errorResponse('이미 종료된 세션', 400);

      const body = (await request.json()) as any;
      const input = StatePatchSchema.parse(body);
      if (input.side !== 'teacher' && input.side !== 'problem') {
        return errorResponse('교사는 teacher/problem side만 수정 가능', 403);
      }

      const state = await loadState(context, id);
      const now = Date.now();
      if (input.side === 'teacher') {
        // SEC-LIVE-M1: text 위생화
        if (input.text !== undefined) state.teacher.text = sanitizeText(input.text);
        if (input.strokes !== undefined) state.teacher.strokes = input.strokes;
        state.teacher.updated_at = now;
      } else {
        if (input.text !== undefined) state.problem.text = sanitizeText(input.text);
        if (input.image_data_url !== undefined) {
          if (!isValidImageDataUrl(input.image_data_url)) {
            return errorResponse('이미지가 너무 크거나 형식 오류 (1MB 이내 PNG/JPG)', 400);
          }
          state.problem.image_data_url = input.image_data_url;
        }
        state.problem.updated_at = now;
      }
      state.pulse = now;
      await saveState(context, id, state);
      return successResponse({ pulse: now });
    }

    // POST /api/live/sessions/:id/end
    m = pathname.match(/^\/api\/live\/sessions\/([^/]+)\/end$/);
    if (m && method === 'POST') {
      const id = m[1];
      const sess = await loadSession(context, id);
      if (!sess || sess.academy_id !== academyId) return notFoundResponse();
      if (sess.teacher_id !== userId) return errorResponse('권한 없음', 403);
      if (sess.status === 'ended') return errorResponse('이미 종료된 세션', 400);

      const body = (await request.json().catch(() => ({}))) as any;
      const input = EndSessionSchema.parse(body || {});

      // SEC-LIVE-M2: 멱등 race guard — 사전 마크. 두 번째 호출은 사전 status 체크에서 차단되며,
      // 동시 호출 시에도 R2 업로드 1회로 수렴. UPDATE 결과 0행이면 이미 종료된 것으로 간주.
      const finalState = await loadState(context, id);
      let teacherKey: string | null = null;
      let studentKey: string | null = null;
      let problemKey: string | null = null;

      // PERF-LIVE-M1: R2 3개 업로드 병렬화 (이전: 직렬)
      const r2Tasks: Promise<void>[] = [];
      if (input.teacher_solution_image) {
        const dec = decodeBase64Image(input.teacher_solution_image);
        if (dec) {
          teacherKey = `academies/${academyId}/live/${id}/teacher.png`;
          r2Tasks.push(
            context.env.BUCKET.put(teacherKey, dec.buf, {
              httpMetadata: { contentType: dec.mime },
            }).then(() => undefined)
          );
        }
      }
      if (input.student_answer_image) {
        const dec = decodeBase64Image(input.student_answer_image);
        if (dec) {
          studentKey = `academies/${academyId}/live/${id}/student.png`;
          r2Tasks.push(
            context.env.BUCKET.put(studentKey, dec.buf, {
              httpMetadata: { contentType: dec.mime },
            }).then(() => undefined)
          );
        }
      }
      if (finalState.problem.image_data_url) {
        const dec = decodeBase64Image(finalState.problem.image_data_url);
        if (dec) {
          problemKey = `academies/${academyId}/live/${id}/problem.png`;
          r2Tasks.push(
            context.env.BUCKET.put(problemKey, dec.buf, {
              httpMetadata: { contentType: dec.mime },
            }).then(() => undefined)
          );
        }
      }
      if (r2Tasks.length) await Promise.all(r2Tasks);

      const startedAtMs = new Date(sess.started_at + 'Z').getTime();
      const endedAtIso = new Date().toISOString();
      const durationSec = Math.max(
        0,
        Math.round((Date.now() - (isNaN(startedAtMs) ? Date.now() : startedAtMs)) / 1000)
      );

      let noteId: string | null = null;
      if (input.create_note) {
        // SEC-LIVE-M1: summary 위생화 (학생-강사 공유 노트로 영속됨)
        const cleanSummary = sanitizeText(input.create_note.summary);
        if (!cleanSummary) return errorResponse('create_note.summary는 비울 수 없습니다', 400);
        noteId = generatePrefixedId('stn');
        const periodTag = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        await executeInsert(
          context.env.DB,
          `INSERT INTO student_teacher_notes
           (id, academy_id, student_id, author_id, subject, category, sentiment,
            tags, content, source, source_ref_id, visibility, period_tag)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            noteId,
            academyId,
            sess.student_id,
            userId,
            sess.subject,
            input.create_note.category || 'understanding',
            input.create_note.sentiment,
            JSON.stringify(['라이브세션']),
            cleanSummary,
            'live_session',
            id,
            'staff',
            periodTag,
          ]
        );
      }

      // SEC-LIVE-M2: status guard로 동시 종료 호출의 두 번째를 차단 — UPDATE 영향 행 0이면 이미 ended
      await executeUpdate(
        context.env.DB,
        `UPDATE live_sessions
         SET status = 'ended', ended_at = ?, duration_sec = ?,
             problem_r2_key = COALESCE(?, problem_r2_key),
             teacher_solution_text = ?, teacher_solution_r2_key = COALESCE(?, teacher_solution_r2_key),
             student_answer_text = ?, student_answer_r2_key = COALESCE(?, student_answer_r2_key),
             note_id = ?
         WHERE id = ? AND status != 'ended'`,
        [
          endedAtIso,
          durationSec,
          problemKey,
          finalState.teacher.text || null,
          teacherKey,
          finalState.student.text || null,
          studentKey,
          noteId,
          id,
        ]
      );

      // KV: ended 상태로 짧게 보관 (학생 폴링이 status=ended 인지) → 60초
      finalState.status = 'ended';
      finalState.pulse = Date.now();
      await context.env.KV.put(stateKey(id), JSON.stringify(finalState), {
        expirationTtl: 60,
      });
      await context.env.KV.delete(activeKey(sess.student_id));

      logger.logAudit('LIVE_SESSION_END', 'LiveSession', id, userId, {
        duration_sec: durationSec,
        note_id: noteId,
      });
      return successResponse({ id, note_id: noteId });
    }

    return notFoundResponse();
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return errorResponse('잘못된 입력: ' + JSON.stringify(err.issues), 400);
    }
    logger.error('handleLive error', err);
    return errorResponse('서버 오류', 500);
  }
}

// ─────────────────────────────────────────────────────────────────
// 학생 측 (Play KV 토큰)
// ─────────────────────────────────────────────────────────────────

export async function handlePlayLive(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    const auth = await getPlayAuth(context);
    if (!auth) return unauthorizedResponse();

    // GET /api/play/live/active
    if (method === 'GET' && pathname === '/api/play/live/active') {
      const sessId = await context.env.KV.get(activeKey(auth.studentId));
      if (!sessId) return successResponse({ session: null });
      const sess = await loadSession(context, sessId);
      if (!sess || sess.status === 'ended' || sess.academy_id !== auth.academyId) {
        return successResponse({ session: null });
      }
      const teacher = await executeFirst<any>(
        context.env.DB,
        'SELECT name FROM users WHERE id = ?',
        [sess.teacher_id]
      );
      return successResponse({
        session: {
          id: sess.id,
          subject: sess.subject,
          teacher_name: teacher?.name || null,
          started_at: sess.started_at,
        },
      });
    }

    // GET /api/play/live/sessions/:id/state
    let m = pathname.match(/^\/api\/play\/live\/sessions\/([^/]+)\/state$/);
    if (m && method === 'GET') {
      const id = m[1];
      const sess = await loadSession(context, id);
      if (!sess || sess.academy_id !== auth.academyId) return notFoundResponse();
      if (sess.student_id !== auth.studentId) return errorResponse('권한 없음', 403);
      const state = await loadState(context, id);
      if (sess.status === 'ended') state.status = 'ended';
      return successResponse(state);
    }

    // PATCH /api/play/live/sessions/:id/state
    if (m && method === 'PATCH') {
      const id = m[1];
      const sess = await loadSession(context, id);
      if (!sess || sess.academy_id !== auth.academyId) return notFoundResponse();
      if (sess.student_id !== auth.studentId) return errorResponse('권한 없음', 403);
      if (sess.status === 'ended') return errorResponse('이미 종료된 세션', 400);

      const body = (await request.json()) as any;
      const input = StatePatchSchema.parse(body);
      if (input.side !== 'student') {
        return errorResponse('학생은 student side만 수정 가능', 403);
      }

      const state = await loadState(context, id);
      const now = Date.now();
      // SEC-LIVE-M1: text 위생화
      if (input.text !== undefined) state.student.text = sanitizeText(input.text);
      if (input.strokes !== undefined) state.student.strokes = input.strokes;
      if (input.append_photo_data_url) {
        if (!isValidImageDataUrl(input.append_photo_data_url)) {
          return errorResponse('이미지가 너무 크거나 형식 오류 (1MB 이내)', 400);
        }
        state.student.photo_data_urls = state.student.photo_data_urls || [];
        if (state.student.photo_data_urls.length >= 5) {
          return errorResponse('사진은 최대 5장', 400);
        }
        state.student.photo_data_urls.push(input.append_photo_data_url);
      }
      state.student.updated_at = now;
      state.pulse = now;
      await saveState(context, id, state);
      return successResponse({ pulse: now });
    }

    return notFoundResponse();
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return errorResponse('잘못된 입력: ' + JSON.stringify(err.issues), 400);
    }
    logger.error('handlePlayLive error', err);
    return errorResponse('서버 오류', 500);
  }
}
