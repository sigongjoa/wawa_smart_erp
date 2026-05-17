/**
 * Calendar 학생 핸들러 — /api/play/calendar/* (PIN 토큰 인증, KV play:*)
 *
 *  GET    /api/play/calendar/events?from=&to=     학원 공통 + 본인 일정
 *  POST   /api/play/calendar/events                본인 일정 등록 (owner_type=student)
 *  PATCH  /api/play/calendar/events/:id            본인 일정 수정
 *  DELETE /api/play/calendar/events/:id            본인 일정 soft delete
 *  POST   /api/play/calendar/events/:id/ack        학원 공통 일정 read + 완료 토글
 */
import { RequestContext } from '@/types';
import {
  successResponse,
  errorResponse,
  createdResponse,
  notFoundResponse,
  unauthorizedResponse,
} from '@/utils/response';
import { executeFirst, executeUpdate } from '@/utils/db';
import { isValidId, sanitizeNullable, sanitizeRequired } from '@/utils/sanitize';
import { generatePrefixedId } from '@/utils/id';
import {
  CATEGORIES,
  EventRow,
  EventCategory,
  isValidDate,
  loadEventsForStudent,
} from '@/services/calendar';

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
  return (await context.env.KV.get(`play:${token}`, 'json')) as PlayAuth | null;
}

function isCategory(v: unknown): v is EventCategory {
  return typeof v === 'string' && (CATEGORIES as string[]).includes(v);
}

export async function handlePlayCalendar(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext,
): Promise<Response> {
  const auth = await getPlayAuth(context);
  if (!auth) return unauthorizedResponse();
  const { studentId, academyId } = auth;

  try {
    // GET /api/play/calendar/events
    if (method === 'GET' && pathname === '/api/play/calendar/events') {
      const url = new URL(request.url);
      const from = url.searchParams.get('from') ?? '';
      const to = url.searchParams.get('to') ?? '';
      if (!isValidDate(from) || !isValidDate(to)) {
        return errorResponse('from / to 는 YYYY-MM-DD 형식이어야 합니다', 400);
      }
      const events = await loadEventsForStudent(context.env.DB, academyId, studentId, from, to);
      return successResponse({ events });
    }

    // POST /api/play/calendar/events  → 본인 일정 등록
    if (method === 'POST' && pathname === '/api/play/calendar/events') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null;
      if (!body) return errorResponse('잘못된 요청 본문', 400);

      let category: EventCategory;
      let title: string;
      let memo: string | null;
      let link: string | null;
      try {
        if (!isCategory(body.category)) return errorResponse('category 값이 올바르지 않습니다', 400);
        category = body.category;
        title = sanitizeRequired(body.title, 'title', 200);
        memo = sanitizeNullable(body.memo, 2000);
        link = sanitizeNullable(body.link, 500);
      } catch (e) {
        return errorResponse((e as Error).message, 400);
      }

      if (!isValidDate(body.start_date)) {
        return errorResponse('start_date 는 YYYY-MM-DD 형식이어야 합니다', 400);
      }
      const startDate = body.start_date as string;
      const endDate = body.end_date == null || body.end_date === ''
        ? null
        : isValidDate(body.end_date) ? (body.end_date as string) : null;
      if (body.end_date && endDate === null) {
        return errorResponse('end_date 는 YYYY-MM-DD 형식이어야 합니다', 400);
      }
      if (endDate && endDate < startDate) {
        return errorResponse('end_date 는 start_date 이후여야 합니다', 400);
      }

      const id = generatePrefixedId('calev');
      const now = Date.now();
      const ok = await executeUpdate(
        context.env.DB,
        `INSERT INTO calendar_events
          (id, academy_id, owner_type, owner_id, category, title, memo, link, start_date, end_date, created_by, created_at, updated_at)
         VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, academyId, studentId, category, title, memo, link, startDate, endDate, studentId, now, now],
      );
      if (!ok) return errorResponse('일정 저장 실패', 500);
      return createdResponse({ id });
    }

    // PATCH /api/play/calendar/events/:id
    const patchMatch = pathname.match(/^\/api\/play\/calendar\/events\/([^/]+)$/);
    if (method === 'PATCH' && patchMatch) {
      const eventId = patchMatch[1];
      if (!isValidId(eventId)) return errorResponse('잘못된 id', 400);

      const existing = await executeFirst<EventRow>(
        context.env.DB,
        `SELECT * FROM calendar_events WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
        [eventId, academyId],
      );
      if (!existing) return notFoundResponse();
      if (existing.owner_type !== 'student' || existing.owner_id !== studentId) {
        return errorResponse('수정 권한이 없습니다', 403);
      }

      const body = await request.json().catch(() => null) as Record<string, unknown> | null;
      if (!body) return errorResponse('잘못된 요청 본문', 400);

      let title = existing.title;
      let memo = existing.memo;
      let link = existing.link;
      let category = existing.category;
      let startDate = existing.start_date;
      let endDate = existing.end_date;
      try {
        if (body.title !== undefined) title = sanitizeRequired(body.title, 'title', 200);
        if (body.memo !== undefined) memo = sanitizeNullable(body.memo, 2000);
        if (body.link !== undefined) link = sanitizeNullable(body.link, 500);
      } catch (e) {
        return errorResponse((e as Error).message, 400);
      }
      if (body.category !== undefined) {
        if (!isCategory(body.category)) return errorResponse('category 값이 올바르지 않습니다', 400);
        category = body.category;
      }
      if (body.start_date !== undefined) {
        if (!isValidDate(body.start_date)) return errorResponse('start_date 형식 오류', 400);
        startDate = body.start_date as string;
      }
      if (body.end_date !== undefined) {
        if (body.end_date === null || body.end_date === '') endDate = null;
        else if (isValidDate(body.end_date)) endDate = body.end_date as string;
        else return errorResponse('end_date 형식 오류', 400);
      }
      if (endDate && endDate < startDate) return errorResponse('end_date 는 start_date 이후여야 합니다', 400);

      const ok = await executeUpdate(
        context.env.DB,
        `UPDATE calendar_events
         SET category = ?, title = ?, memo = ?, link = ?, start_date = ?, end_date = ?, updated_at = ?
         WHERE id = ? AND academy_id = ? AND owner_type = 'student' AND owner_id = ? AND deleted_at IS NULL`,
        [category, title, memo, link, startDate, endDate, Date.now(), eventId, academyId, studentId],
      );
      if (!ok) return errorResponse('수정 실패', 500);
      return successResponse({ id: eventId });
    }

    // DELETE /api/play/calendar/events/:id
    const deleteMatch = pathname.match(/^\/api\/play\/calendar\/events\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const eventId = deleteMatch[1];
      if (!isValidId(eventId)) return errorResponse('잘못된 id', 400);

      await executeUpdate(
        context.env.DB,
        `UPDATE calendar_events SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND academy_id = ? AND owner_type = 'student' AND owner_id = ? AND deleted_at IS NULL`,
        [Date.now(), Date.now(), eventId, academyId, studentId],
      );
      return successResponse({ id: eventId });
    }

    // POST /api/play/calendar/events/:id/ack  (학원 공통 일정 read/완료 토글)
    const ackMatch = pathname.match(/^\/api\/play\/calendar\/events\/([^/]+)\/ack$/);
    if (method === 'POST' && ackMatch) {
      const eventId = ackMatch[1];
      if (!isValidId(eventId)) return errorResponse('잘못된 id', 400);

      const evt = await executeFirst<{ owner_type: string }>(
        context.env.DB,
        `SELECT owner_type FROM calendar_events WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
        [eventId, academyId],
      );
      if (!evt) return notFoundResponse();
      if (evt.owner_type !== 'academy') {
        return errorResponse('학원 공통 일정에만 확인 표시 가능합니다', 400);
      }

      const body = await request.json().catch(() => ({})) as { completed?: boolean };
      const now = Date.now();
      const setCompleted = body.completed === true;

      const existing = await executeFirst<{ completed_at: number | null }>(
        context.env.DB,
        `SELECT completed_at FROM calendar_event_acks WHERE event_id = ? AND student_id = ?`,
        [eventId, studentId],
      );

      // completed=true이면 completed_at 세팅, false/생략이면 null로 토글
      const completedAt = setCompleted ? now : null;

      if (existing) {
        await executeUpdate(
          context.env.DB,
          `UPDATE calendar_event_acks
           SET read_at = COALESCE(read_at, ?), completed_at = ?
           WHERE event_id = ? AND student_id = ?`,
          [now, completedAt, eventId, studentId],
        );
      } else {
        await executeUpdate(
          context.env.DB,
          `INSERT INTO calendar_event_acks (event_id, student_id, read_at, completed_at)
           VALUES (?, ?, ?, ?)`,
          [eventId, studentId, now, completedAt],
        );
      }
      return successResponse({ id: eventId, completed_at: completedAt });
    }

    return errorResponse('Not Found', 404);
  } catch (err) {
    return errorResponse((err as Error).message || '서버 오류', 500);
  }
}
