/**
 * 학생 외부 일정 (student_external_schedules) 핸들러
 * student-handler.ts 에서 분리 — 독립 도메인
 */
import { z } from 'zod';
import { RequestContext } from '@/types';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId } from '@/utils/context';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert, executeDelete } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';

export const ExternalScheduleSchema = z.object({
  kind: z.enum(['other_subject', 'other_academy', 'exam', 'event']),
  title: z.string().min(1),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  recurrence: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

interface IdRow { id: string }

export async function handleListSchedules(
  context: RequestContext,
  studentId: string,
  canAccess: (ctx: RequestContext, id: string) => Promise<boolean>
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();
  const academyId = getAcademyId(context);
  const student = await executeFirst<IdRow>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);
  if (!(await canAccess(context, studentId))) {
    return errorResponse('담당 학생만 열람할 수 있습니다', 403);
  }
  const rows = await executeQuery<Record<string, unknown>>(
    context.env.DB,
    `SELECT s.*, u.name AS author_name
     FROM student_external_schedules s
     LEFT JOIN users u ON s.author_id = u.id
     WHERE s.student_id = ? AND s.academy_id = ?
     ORDER BY COALESCE(s.starts_at, s.created_at) DESC`,
    [studentId, academyId]
  );
  return successResponse(rows);
}

export async function handleCreateSchedule(
  request: Request,
  context: RequestContext,
  studentId: string,
  canAccess: (ctx: RequestContext, id: string) => Promise<boolean>
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const authorId = context.auth!.userId;
  const student = await executeFirst<IdRow>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);
  if (!(await canAccess(context, studentId))) {
    return errorResponse('담당 학생만 등록할 수 있습니다', 403);
  }
  try {
    const input = ExternalScheduleSchema.parse(await request.json());
    const id = generatePrefixedId('esch');
    await executeInsert(
      context.env.DB,
      `INSERT INTO student_external_schedules
       (id, academy_id, student_id, author_id, kind, title, starts_at, ends_at, recurrence, location, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, academyId, studentId, authorId,
        input.kind, input.title,
        input.starts_at ?? null, input.ends_at ?? null,
        input.recurrence ?? null, input.location ?? null, input.note ?? null,
      ]
    );
    return successResponse({ id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('입력 검증 오류: ' + error.errors.map((e) => e.message).join(', '), 400);
    }
    return handleRouteError(error, '외부 일정 생성');
  }
}

interface ExamPeriodRow {
  id: string;
  period_month: string;
  title: string;
}

export async function handleImportExamPeriod(
  context: RequestContext,
  studentId: string,
  periodId: string,
  canAccess: (ctx: RequestContext, id: string) => Promise<boolean>
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const authorId = context.auth!.userId;

  if (!(await canAccess(context, studentId))) {
    return errorResponse('담당 학생만 등록할 수 있습니다', 403);
  }

  const period = await executeFirst<ExamPeriodRow>(
    context.env.DB,
    'SELECT * FROM exam_periods WHERE id = ? AND academy_id = ?',
    [periodId, academyId]
  );
  if (!period) return errorResponse('정기고사 기간을 찾을 수 없습니다', 404);

  const startsAt = `${period.period_month}-01T00:00:00`;
  const title = `정기고사 - ${period.title}`;

  const dup = await executeFirst<IdRow>(
    context.env.DB,
    `SELECT id FROM student_external_schedules
     WHERE student_id = ? AND title = ? AND starts_at = ?`,
    [studentId, title, startsAt]
  );
  if (dup) return successResponse({ id: dup.id, imported: false });

  const id = generatePrefixedId('esch');
  await executeInsert(
    context.env.DB,
    `INSERT INTO student_external_schedules
     (id, academy_id, student_id, author_id, kind, title, starts_at, note)
     VALUES (?, ?, ?, ?, 'exam', ?, ?, ?)`,
    [id, academyId, studentId, authorId, title, startsAt, `정기고사 기간(${periodId})에서 자동 연계`]
  );
  return successResponse({ id, imported: true });
}

interface ScheduleRow { author_id: string }

export async function handleDeleteSchedule(
  context: RequestContext,
  studentId: string,
  scheduleId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const row = await executeFirst<ScheduleRow>(
    context.env.DB,
    'SELECT author_id FROM student_external_schedules WHERE id = ? AND student_id = ? AND academy_id = ?',
    [scheduleId, studentId, academyId]
  );
  if (!row) return errorResponse('일정을 찾을 수 없습니다', 404);
  if (context.auth!.role !== 'admin' && row.author_id !== context.auth!.userId) {
    return errorResponse('작성자만 삭제할 수 있습니다', 403);
  }
  await executeDelete(context.env.DB, 'DELETE FROM student_external_schedules WHERE id = ?', [scheduleId]);
  return successResponse({ id: scheduleId, deleted: true });
}
