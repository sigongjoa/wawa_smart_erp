/**
 * 수강계약(상품·회차) 핸들러
 *
 *   GET    /api/contracts?student_id=&anchor=YYYY-MM-DD   계약 + 정산 구간 회차
 *   PUT    /api/contracts                                  upsert (student_id + subject 기준)
 *   DELETE /api/contracts/:id
 *
 * 정산 구간은 달력 월이 아니라 **수납일 기준 1개월**이다.
 *   collect_day=15 → 8/15 ~ 9/14 가 한 구간.
 * 구간은 학생당 하나로 잡는다(계약별 수납일이 갈리는 경우는 최빈값 사용).
 * 결석·보강은 과목 정보가 없어(absences에 subject 없음) 학생 단위로만 집계한다.
 *
 * 결제·수납 이력은 취급하지 않는다 (별도 결제 신청 페이지 소관).
 */
import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeDelete } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { getAcademyId } from '@/utils/context';
import { handleRouteError } from '@/utils/error-handler';
import { generatePrefixedId } from '@/utils/id';
import { sanitizeText, sanitizeNullable, isValidId } from '@/utils/sanitize';

const STATUSES = ['active', 'suspended', 'ended'];

function clampInt(v: unknown, min: number, max: number): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function isDate(v: unknown): boolean {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 해당 월(1-based)의 말일 */
function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 수납일 기준 정산 구간. anchor가 속한 구간을 [from, to]로 반환.
 * 수납일이 말일을 넘으면(31일 ↔ 2월) 그 달 말일로 당긴다.
 */
export function billingCycle(collectDay: number, anchor: string): { from: string; to: string } {
  const [ay, am, ad] = anchor.split('-').map(Number);
  const startDay = (y: number, m: number) => Math.min(collectDay, lastDay(y, m));

  // anchor가 이번 달 수납일 이전이면 구간은 지난달 수납일에 시작
  let y = ay;
  let m = am;
  if (ad < startDay(ay, am)) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  const from = `${y}-${pad(m)}-${pad(startDay(y, m))}`;

  // 다음 구간 시작 하루 전 = 이번 구간 종료
  let ny = y;
  let nm = m + 1;
  if (nm === 13) {
    nm = 1;
    ny += 1;
  }
  const next = new Date(Date.UTC(ny, nm - 1, startDay(ny, nm)));
  next.setUTCDate(next.getUTCDate() - 1);
  return { from, to: next.toISOString().slice(0, 10) };
}

const DAY_INDEX: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

/** 수업량의 기본 단위. 30분 = 1타임. */
export const SLOT_MINUTES = 30;
/** 한 달 = 4주로 본다 (수납 주기와 맞추기 위한 고정 계수) */
export const WEEKS_PER_CYCLE = 4;

/** 'HH:MM' → 분 */
function toMinutes(hhmm: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

/** enrollments 한 행의 길이를 타임으로. 자정 넘김·역전은 0 처리. */
export function slotsOf(startTime: unknown, endTime: unknown): number {
  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  if (s === null || e === null || e <= s) return 0;
  return Math.round((e - s) / SLOT_MINUTES);
}

/** 분 → 타임 (반올림) */
export const minutesToSlots = (minutes: number): number =>
  Math.round((minutes || 0) / SLOT_MINUTES);

/**
 * 구간 [from, to] 안의 수업 예정일을 날짜로 뽑는다.
 * enrollments의 요일 목록이 곧 주간 수업 계획이므로, 이게 "해야 했던 날"(m).
 * 같은 요일에 2타임이면 그 날짜가 2번 들어간다.
 */
export function plannedDates(days: string[], from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];

  const wanted = days.map((d) => DAY_INDEX[d]).filter((i) => i !== undefined);
  if (wanted.length === 0) return [];

  // 구간은 최대 32일이라 전수 순회가 가장 단순하고 오차가 없다
  const out: string[] = [];
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    for (const w of wanted) if (w === dow) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** 계약들의 수납일 최빈값. 전부 비어 있으면 null (→ 달력 월로 폴백) */
function dominantCollectDay(contracts: Array<{ collect_day: number | null }>): number | null {
  const tally = new Map<number, number>();
  for (const c of contracts) {
    if (c.collect_day == null) continue;
    tally.set(c.collect_day, (tally.get(c.collect_day) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestN = 0;
  for (const [day, n] of tally) {
    if (n > bestN || (n === bestN && best !== null && day < best)) {
      best = day;
      bestN = n;
    }
  }
  return best;
}

/** academy 격리 + 담당 검증. 통과 못하면 Response, 통과하면 null */
async function assertStudent(context: RequestContext, studentId: string): Promise<Response | null> {
  if (!isValidId(studentId)) return errorResponse('학생 ID 형식 오류', 400);
  const student = await executeFirst<{ id: string }>(
    context.env.DB,
    'SELECT id FROM students WHERE id = ? AND academy_id = ?',
    [studentId, getAcademyId(context)]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);
  if (context.auth!.role === 'admin') return null;
  const owns = await executeFirst<{ n: number }>(
    context.env.DB,
    'SELECT 1 AS n FROM student_teachers WHERE teacher_id = ? AND student_id = ? LIMIT 1',
    [context.auth!.userId, studentId]
  );
  return owns ? null : errorResponse('담당 학생만 열람할 수 있습니다', 403);
}

/** 계약 회차 vs 시간표 회차 vs 실제 진행 회차 */
async function getContracts(request: Request, context: RequestContext): Promise<Response> {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || '';
  const denied = await assertStudent(context, studentId);
  if (denied) return denied;

  const anchor = url.searchParams.get('anchor') || new Date().toISOString().slice(0, 10);
  if (!isDate(anchor)) return errorResponse('anchor 형식 오류 (YYYY-MM-DD)', 400);

  const academyId = getAcademyId(context);

  // 정산 구간은 계약의 수납일로 정해지므로 계약을 먼저 읽는다
  const contracts = await executeQuery<any>(
    context.env.DB,
    `SELECT id, subject, product_name, unit_price, session_count, in_date, out_date,
            collect_day, status, note
       FROM contracts WHERE student_id = ? AND academy_id = ? ORDER BY subject`,
    [studentId, academyId]
  );

  const collectDay = dominantCollectDay(contracts);
  // 수납일이 없으면 달력 월(1일 기준)로 폴백
  const { from, to } = billingCycle(collectDay ?? 1, anchor);

  // N+1 방지: 구간이 정해진 뒤 집계 4건 병렬
  const [scheduled, done, absent, makeups] = await Promise.all([
    executeQuery<any>(
      context.env.DB,
      'SELECT subject, day, start_time, end_time FROM enrollments WHERE student_id = ?',
      [studentId]
    ),
    // 캘린더에 날짜를 찍어야 해서 집계가 아니라 원시 행을 가져온다 (한 달치라 소량)
    executeQuery<any>(
      context.env.DB,
      `SELECT date, subject, (net_minutes + added_minutes) AS minutes
         FROM attendance_records
        WHERE student_id = ? AND academy_id = ? AND date BETWEEN ? AND ?
        ORDER BY date`,
      [studentId, academyId, from, to]
    ),
    executeQuery<any>(
      context.env.DB,
      `SELECT absence_date, reason FROM absences
        WHERE student_id = ? AND absence_date BETWEEN ? AND ? ORDER BY absence_date`,
      [studentId, from, to]
    ),
    executeQuery<any>(
      context.env.DB,
      `SELECT m.status, m.scheduled_date, m.required_minutes, m.completed_minutes,
              a.absence_date
         FROM makeups m JOIN absences a ON m.absence_id = a.id
        WHERE a.student_id = ? AND a.absence_date BETWEEN ? AND ?`,
      [studentId, from, to]
    ),
  ]);

  // 과목별 시간표 — 요일(달력용)과 주당 타임(대조용)
  const schedBySubject = new Map<string, { days: string[]; slots: number }>();
  for (const e of scheduled) {
    if (!e.subject) continue;
    const cur = schedBySubject.get(e.subject) ?? { days: [], slots: 0 };
    cur.days.push(e.day);
    cur.slots += slotsOf(e.start_time, e.end_time);
    schedBySubject.set(e.subject, cur);
  }

  const absentDates = new Set(absent.map((a: any) => a.absence_date));

  // 계약이 아직 없는 과목도 행으로 노출한다 (여기를 눌러 첫 계약을 만든다).
  // 시간표 과목 ∪ 계약 과목 — 어느 쪽에만 있어도 빠지지 않게.
  const bySubject = new Map<string, any>(contracts.map((c: any) => [c.subject, c]));
  const allSubjects = [...new Set([...bySubject.keys(), ...schedBySubject.keys()])].sort();
  const rows = allSubjects.map((subject) => {
    const existing = bySubject.get(subject);
    if (existing) return existing;
    const sched = schedBySubject.get(subject)!;
    return {
      id: null,
      subject,
      product_name: null,
      // 시간표에서 뽑은 주당 타임을 제안값으로 — 모달을 열면 이미 채워져 있다
      unit_price: 0,
      session_count: sched.slots,
      in_date: null,
      out_date: null,
      collect_day: null,
      status: 'active',
      note: null,
      is_draft: true,
    };
  });

  const items = rows.map((c: any) => {
    const sched = schedBySubject.get(c.subject) ?? { days: [], slots: 0 };
    const attended = done.filter((r: any) => r.subject === c.subject);
    const attendedDates = new Set(attended.map((r: any) => r.date));

    // ── 회차(타임) 계산 — 요일 매칭이 아니라 계약 타임 기준 ──
    // m = 주당 타임 × 4. 시간표가 없거나 실제 운영과 어긋나도 계산이 성립한다.
    // 미등록(draft) 행은 계약값이 없으므로 m을 0으로 둔다 — 저장 전 숫자를 지어내지 않는다.
    const plannedSlots = c.is_draft ? 0 : c.session_count * WEEKS_PER_CYCLE;
    const doneSlots = minutesToSlots(
      attended.reduce((s: number, r: any) => s + (r.minutes ?? 0), 0)
    );

    // ── 달력 — 날짜는 시간표 요일에서 (없으면 실제 출석일만 표시) ──
    const plannedDays = plannedDates(sched.days, from, to);
    const seen = new Set<string>();
    const sessions = plannedDays.map((date) => {
      const dup = seen.has(date); // 같은 날 2타임 중 두 번째
      seen.add(date);
      const status =
        attendedDates.has(date) && !dup ? 'done' : absentDates.has(date) ? 'absent' : 'missed';
      return { date, status };
    });
    const extra = attended
      .filter((r: any) => !plannedDays.includes(r.date))
      .map((r: any) => ({ date: r.date, status: 'extra' as const }));

    return {
      ...c,
      is_draft: !!c.is_draft,
      total_price: c.is_draft ? 0 : c.unit_price * c.session_count,
      weekly_slots: sched.slots, // 시간표상 주당 타임 (계약과 대조용)
      has_schedule: sched.days.length > 0,
      planned_slots: plannedSlots,
      done_slots: doneSlots,
      missed_slots: Math.max(0, plannedSlots - doneSlots),
      done_minutes: attended.reduce((s: number, r: any) => s + (r.minutes ?? 0), 0),
      sessions: [...sessions, ...extra].sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

  const completed = makeups.filter((m: any) => m.status === 'completed');
  const pending = makeups.filter((m: any) => m.status !== 'completed');
  const absentCount = absent.length;

  return successResponse({
    cycle: { from, to, collect_day: collectDay, anchor },
    contracts: items,
    // 미등록 과목 수 — 0보다 크면 정산 금액이 아직 완전하지 않다는 뜻
    draft_count: items.filter((c: any) => c.is_draft).length,
    monthly_total: items.reduce((s: number, c: any) => s + c.total_price, 0),
    // 구간 요약: 수업 / 결석 / 보강
    slot_minutes: SLOT_MINUTES,
    planned_slots: items.reduce((s: number, c: any) => s + c.planned_slots, 0),
    missed_slots: items.reduce((s: number, c: any) => s + c.missed_slots, 0),
    done_slots: items.reduce((s: number, c: any) => s + c.done_slots, 0),
    done_minutes: done.reduce((s: number, r: any) => s + (r.minutes ?? 0), 0),
    absent_count: absentCount,
    // 결석·보강 날짜 — 캘린더에 겹쳐 찍는다
    absences: absent.map((a: any) => ({ date: a.absence_date, reason: a.reason || '' })),
    makeups: makeups.map((m: any) => ({
      date: m.scheduled_date || m.absence_date,
      status: m.status,
    })),
    makeup_completed: completed.length,
    makeup_pending: pending.length,
    makeup_pending_minutes: pending.reduce(
      (s: number, m: any) => s + ((m.required_minutes ?? 0) - (m.completed_minutes ?? 0)),
      0
    ),
    // 결석했는데 보강 자체가 안 잡힌 건수
    makeup_unscheduled: Math.max(0, absentCount - makeups.length),
    // subject 미기입 출석은 과목 배분 불가 → 합계 신뢰도 지표로 노출
    unassigned_attendance: done.filter((r: any) => !r.subject).length,
  });
}

async function putContract(request: Request, context: RequestContext): Promise<Response> {
  const body = (await request.json()) as any;
  const denied = await assertStudent(context, body?.student_id || '');
  if (denied) return denied;

  const subject = sanitizeText(body?.subject, 20);
  if (!subject) return errorResponse('과목은 필수입니다', 400);
  for (const k of ['in_date', 'out_date']) {
    if (body[k] != null && !isDate(body[k])) return errorResponse(`${k} 형식 오류 (YYYY-MM-DD)`, 400);
  }

  await executeInsert(
    context.env.DB,
    `INSERT INTO contracts
       (id, academy_id, student_id, subject, product_name, unit_price, session_count,
        in_date, out_date, collect_day, status, note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(student_id, subject) DO UPDATE SET
       product_name  = excluded.product_name,
       unit_price    = excluded.unit_price,
       session_count = excluded.session_count,
       in_date       = excluded.in_date,
       out_date      = excluded.out_date,
       collect_day   = excluded.collect_day,
       status        = excluded.status,
       note          = excluded.note,
       updated_at    = datetime('now')`,
    [
      generatePrefixedId('ct'),
      getAcademyId(context),
      body.student_id,
      subject,
      sanitizeNullable(body.product_name, 60),
      clampInt(body.unit_price, 0, 100_000_000),
      clampInt(body.session_count, 0, 100),
      body.in_date ?? null,
      body.out_date ?? null,
      body.collect_day == null ? null : clampInt(body.collect_day, 1, 31),
      STATUSES.includes(body.status) ? body.status : 'active',
      sanitizeNullable(body.note, 200),
    ]
  );
  return successResponse({ ok: true });
}

async function deleteContract(context: RequestContext, id: string): Promise<Response> {
  if (!isValidId(id)) return errorResponse('ID 형식 오류', 400);
  const academyId = getAcademyId(context);
  const row = await executeFirst<{ student_id: string }>(
    context.env.DB,
    'SELECT student_id FROM contracts WHERE id = ? AND academy_id = ?',
    [id, academyId]
  );
  if (!row) return errorResponse('계약을 찾을 수 없습니다', 404);
  const denied = await assertStudent(context, row.student_id);
  if (denied) return denied;
  await executeDelete(context.env.DB, 'DELETE FROM contracts WHERE id = ? AND academy_id = ?', [
    id,
    academyId,
  ]);
  return successResponse({ ok: true });
}

export async function handleContracts(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    if (pathname === '/api/contracts') {
      if (method === 'GET') return await getContracts(request, context);
      if (method === 'PUT') return await putContract(request, context);
    }
    const idMatch = pathname.match(/^\/api\/contracts\/([^/]+)$/);
    if (method === 'DELETE' && idMatch) return await deleteContract(context, idMatch[1]);

    return errorResponse('경로를 찾을 수 없습니다', 404);
  } catch (error) {
    return handleRouteError(error, 'contracts');
  }
}
