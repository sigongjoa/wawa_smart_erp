/**
 * Calendar 강사 핸들러 — /api/calendar/* (JWT 인증, admin/instructor 권한)
 *
 *  GET    /api/calendar/events?from=&to=        본인이 볼 수 있는 모든 일정
 *  POST   /api/calendar/events                  학원 공통(owner_type=academy) 등록
 *  PATCH  /api/calendar/events/:id              본인 작성 학원 일정 수정
 *  DELETE /api/calendar/events/:id              본인 작성 학원 일정 soft delete
 *  GET    /api/calendar/teacher-widget?from=&to= 위젯용 (미확인 학생 카운트)
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
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { isValidId, sanitizeNullable, sanitizeRequired } from '@/utils/sanitize';
import { generatePrefixedId } from '@/utils/id';
import { createNotification } from '@/services/notify';
import {
  CATEGORIES,
  EventRow,
  EventCategory,
  isValidDate,
  loadEventsForTeacher,
  loadTeacherWidget,
  rowToDto,
} from '@/services/calendar';

const CATEGORY_LABEL: Record<EventCategory, string> = {
  performance: '수행평가',
  school_exam: '학교시험',
  external_exam: '검정고시·공인시험',
  academy: '학원일정',
  personal: '개인',
};

function isCategory(v: unknown): v is EventCategory {
  return typeof v === 'string' && (CATEGORIES as string[]).includes(v);
}

export async function handleCalendar(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext,
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const userId = getUserId(context);

  try {
    // GET /api/calendar/events
    if (method === 'GET' && pathname === '/api/calendar/events') {
      const url = new URL(request.url);
      const from = url.searchParams.get('from') ?? '';
      const to = url.searchParams.get('to') ?? '';
      if (!isValidDate(from) || !isValidDate(to)) {
        return errorResponse('from / to 는 YYYY-MM-DD 형식이어야 합니다', 400);
      }
      const events = await loadEventsForTeacher(context.env.DB, academyId, userId, from, to);
      return successResponse({ events });
    }

    // GET /api/calendar/teacher-widget
    if (method === 'GET' && pathname === '/api/calendar/teacher-widget') {
      const url = new URL(request.url);
      const from = url.searchParams.get('from') ?? '';
      const to = url.searchParams.get('to') ?? '';
      if (!isValidDate(from) || !isValidDate(to)) {
        return errorResponse('from / to 는 YYYY-MM-DD 형식이어야 합니다', 400);
      }
      const events = await loadTeacherWidget(context.env.DB, academyId, userId, from, to);
      return successResponse({ events });
    }

    // POST /api/calendar/events
    if (method === 'POST' && pathname === '/api/calendar/events') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null;
      if (!body) return errorResponse('잘못된 요청 본문', 400);

      let category: EventCategory;
      let title: string;
      let memo: string | null;
      let link: string | null;
      try {
        if (!isCategory(body.category)) {
          return errorResponse('category 값이 올바르지 않습니다', 400);
        }
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
         VALUES (?, ?, 'academy', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, academyId, academyId, category, title, memo, link, startDate, endDate, userId, now, now],
      );
      if (!ok) return errorResponse('일정 저장 실패', 500);

      // 학원 전체 학생 broadcast 알림
      try {
        await createNotification(context.env.DB, context.env.KV, {
          academy_id: academyId,
          recipient_role: 'student',
          type: 'calendar_event_published',
          title: `[${CATEGORY_LABEL[category]}] ${title}`,
          body: endDate ? `${startDate} ~ ${endDate}` : startDate,
          link: `/calendar?event=${id}`,
          payload: { event_id: id, category, start_date: startDate, end_date: endDate },
          expires_in_days: 30,
        });
      } catch { /* 알림 실패가 일정 등록을 막지 않도록 */ }

      return createdResponse({ id });
    }

    // PATCH /api/calendar/events/:id
    const patchMatch = pathname.match(/^\/api\/calendar\/events\/([^/]+)$/);
    if (method === 'PATCH' && patchMatch) {
      const eventId = patchMatch[1];
      if (!isValidId(eventId)) return errorResponse('잘못된 id', 400);

      const existing = await executeFirst<EventRow>(
        context.env.DB,
        `SELECT * FROM calendar_events WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
        [eventId, academyId],
      );
      if (!existing) return notFoundResponse();
      if (existing.owner_type !== 'academy' || existing.created_by !== userId) {
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
         WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
        [category, title, memo, link, startDate, endDate, Date.now(), eventId, academyId],
      );
      if (!ok) return errorResponse('수정 실패', 500);
      return successResponse({ id: eventId });
    }

    // DELETE /api/calendar/events/:id
    const deleteMatch = pathname.match(/^\/api\/calendar\/events\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const eventId = deleteMatch[1];
      if (!isValidId(eventId)) return errorResponse('잘못된 id', 400);

      const existing = await executeFirst<EventRow>(
        context.env.DB,
        `SELECT owner_type, created_by FROM calendar_events
         WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
        [eventId, academyId],
      );
      if (!existing) return notFoundResponse();
      if (existing.owner_type !== 'academy' || existing.created_by !== userId) {
        return errorResponse('삭제 권한이 없습니다', 403);
      }

      await executeUpdate(
        context.env.DB,
        `UPDATE calendar_events SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
        [Date.now(), Date.now(), eventId, academyId],
      );
      return successResponse({ id: eventId });
    }

    return errorResponse('Not Found', 404);
  } catch (err) {
    return errorResponse((err as Error).message || '서버 오류', 500);
  }
}
