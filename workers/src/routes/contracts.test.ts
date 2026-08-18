/**
 * 계약(상품·회차) 검증 — 실제 SQLite 위에서 라우트를 호출.
 * 핵심: 정산 구간이 달력 월이 아니라 수납일 기준으로 잡히는지,
 *       그 구간 안의 수업/결석/보강만 집계되는지.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { RequestContext } from '@/types';
import { makeTestD1, makeTestEnv, ShimD1 } from '@/test-support/d1-shim';
import { handleContracts, billingCycle, plannedDates, slotsOf, minutesToSlots } from '@/routes/contracts-handler';

function ctx(db: ShimD1, academyId = 'acad-1', role = 'admin', userId = 'u1'): RequestContext {
  return {
    env: makeTestEnv(db),
    auth: { userId, role, academyId },
    tenantId: academyId,
  } as unknown as RequestContext;
}

/** contracts가 조회 시 JOIN하는 주변 테이블 (shim 기본 스키마에 없음) */
function makeDb(): ShimD1 {
  const db = makeTestD1(['079_contracts.sql']);
  db.raw.exec(`
    CREATE TABLE student_teachers (teacher_id TEXT, student_id TEXT);
    CREATE TABLE enrollments (id TEXT PRIMARY KEY, student_id TEXT, day TEXT, subject TEXT,
      start_time TEXT, end_time TEXT);
    CREATE TABLE attendance_records (id TEXT PRIMARY KEY, student_id TEXT, academy_id TEXT,
      date TEXT, subject TEXT, net_minutes INTEGER, added_minutes INTEGER DEFAULT 0);
    CREATE TABLE absences (id TEXT PRIMARY KEY, student_id TEXT, absence_date TEXT, reason TEXT);
    CREATE TABLE makeups (id TEXT PRIMARY KEY, absence_id TEXT, status TEXT, scheduled_date TEXT,
      required_minutes INTEGER DEFAULT 0, completed_minutes INTEGER DEFAULT 0);

    INSERT INTO academies VALUES ('acad-1'), ('acad-2');
    INSERT INTO students VALUES ('stu-1','acad-1'), ('stu-2','acad-2');

    -- 수학 주3 / 영어 주1 배정 (영어는 계약 2회라 불일치가 드러나야 함)
    -- 수학 화·목·토 각 90분 = 주 9타임 / 영어 금 60분 = 주 2타임
    INSERT INTO enrollments VALUES ('e1','stu-1','화','수학','18:00','19:30'),
                                   ('e2','stu-1','목','수학','18:00','19:30'),
                                   ('e3','stu-1','토','수학','13:00','14:30'),
                                   ('e4','stu-1','금','영어','19:00','20:00');

    -- 수납일 15일 → 정산 구간 8/15~9/14. 경계 밖(8/14, 9/15)은 빠져야 한다.
    INSERT INTO attendance_records VALUES
      ('a1','stu-1','acad-1','2026-08-18','수학',90,0),
      ('a2','stu-1','acad-1','2026-09-03','수학',83,5),
      ('a3','stu-1','acad-1','2026-08-21','영어',90,0),
      ('a4','stu-1','acad-1','2026-09-10',NULL,90,0),
      ('a5','stu-1','acad-1','2026-08-14','수학',90,0),
      ('a7','stu-1','acad-1','2026-09-15','수학',90,0);
    -- 다른 학원 학생 출석 (섞이면 안 됨)
    INSERT INTO attendance_records VALUES ('a6','stu-2','acad-2','2026-08-18','수학',90,0);

    -- 구간 내 결석 3건: 보강완료 1 / 보강예정 1 / 보강 미지정 1. ab4는 구간 밖.
    INSERT INTO absences VALUES ('ab1','stu-1','2026-08-20','감기'), ('ab2','stu-1','2026-09-02','가족행사'),
                                ('ab3','stu-1','2026-09-08',''), ('ab4','stu-1','2026-08-10','구간밖');
    INSERT INTO makeups VALUES ('m1','ab1','completed','2026-08-23',90,90),
                              ('m2','ab2','scheduled','2026-09-06',90,30);
  `);
  return db;
}

const put = (body: unknown) =>
  new Request('https://x/api/contracts', { method: 'PUT', body: JSON.stringify(body) });

/** 기준일 2026-09-01 → 수납일 15일 계약의 구간은 8/15~9/14 */
const get = (qs = 'student_id=stu-1&anchor=2026-09-01') =>
  new Request(`https://x/api/contracts?${qs}`);

async function json(res: Response): Promise<any> {
  return await res.json();
}

describe('contracts', () => {
  let db: ShimD1;
  beforeEach(() => {
    db = makeDb();
  });

  const seedContracts = async () => {
    for (const c of [
      { subject: '수학', unit_price: 65000, session_count: 3, collect_day: 15 },
      { subject: '영어', unit_price: 65000, session_count: 2, collect_day: 15 },
    ]) {
      const res = await handleContracts('PUT', '/api/contracts', put({ student_id: 'stu-1', ...c }), ctx(db));
      expect(res.status).toBe(200);
    }
  };

  it('30분 = 1타임으로 환산한다', () => {
    expect(slotsOf('16:00', '17:30')).toBe(3); // 90분
    expect(slotsOf('18:00', '19:00')).toBe(2); // 60분
    expect(slotsOf('17:00', '17:30')).toBe(1); // 30분
    expect(slotsOf('20:00', '09:30')).toBe(0); // 자정 넘김/역전은 0 (실데이터에 존재)
    expect(slotsOf('16:00', '16:00')).toBe(0);
    expect(slotsOf(null, '17:30')).toBe(0);
    // 실제 수업 분 → 타임 (반올림 경계)
    expect(minutesToSlots(83)).toBe(3);
    expect(minutesToSlots(75)).toBe(3);
    expect(minutesToSlots(74)).toBe(2);
    expect(minutesToSlots(0)).toBe(0);
  });

  it('달력용 예정일은 시간표 요일로 뽑는다', () => {
    // 2026-08-15(토)~09-14(월): 토5 + 화4 + 목4
    expect(plannedDates(['화', '목', '토'], '2026-08-15', '2026-09-14')).toHaveLength(13);
    expect(plannedDates(['토'], '2026-08-15', '2026-08-15')).toEqual(['2026-08-15']); // 경계 포함
    expect(plannedDates([], '2026-08-15', '2026-09-14')).toEqual([]);
    expect(plannedDates(['월'], '2026-09-14', '2026-08-15')).toEqual([]); // 역전 구간
  });

  it('정산 구간을 입금일 기준으로 잡는다', () => {
    expect(billingCycle(15, '2026-09-01')).toEqual({ from: '2026-08-15', to: '2026-09-14' });
    expect(billingCycle(1, '2026-08-18')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    // 기준일이 수납일보다 앞이면 지난 구간
    expect(billingCycle(15, '2026-08-14')).toEqual({ from: '2026-07-15', to: '2026-08-14' });
    // 수납일이 말일을 넘으면 그 달 말일로 당긴다
    expect(billingCycle(31, '2026-02-10')).toEqual({ from: '2026-01-31', to: '2026-02-27' });
    // 연도 롤오버
    expect(billingCycle(20, '2026-01-10')).toEqual({ from: '2025-12-20', to: '2026-01-19' });
  });

  it('구간 안의 수업·결석·보강만 집계한다', async () => {
    await seedContracts();
    const { data } = await json(await handleContracts('GET', '/api/contracts', get(), ctx(db)));

    expect(data.cycle).toMatchObject({ from: '2026-08-15', to: '2026-09-14', collect_day: 15 });

    const math = data.contracts.find((c: any) => c.subject === '수학');
    expect(math.total_price).toBe(195000); // 65000 × 3타임
    expect(math.weekly_slots).toBe(9); // 시간표 화·목·토 각 90분
    expect(math.has_schedule).toBe(true);
    expect(math.planned_slots).toBe(12); // m = 계약 3타임 × 4주
    expect(math.done_minutes).toBe(178); // 90 + (83+5) — 8/14·9/15 출석은 구간 밖
    expect(math.done_slots).toBe(6); // n = 178분 ÷ 30 (반올림)
    expect(math.missed_slots).toBe(6); // m - n

    const eng = data.contracts.find((c: any) => c.subject === '영어');
    expect(eng.weekly_slots).toBe(2); // 금 60분
    expect(eng.planned_slots).toBe(8); // 계약 2타임 × 4주
    expect(eng.done_slots).toBe(3); // 90분
    expect(eng.missed_slots).toBe(5);

    expect(data.monthly_total).toBe(325000);
    expect(data.slot_minutes).toBe(30);
    expect(data.planned_slots).toBe(20); // 12 + 8
    expect(data.done_slots).toBe(9); // 6 + 3
    expect(data.missed_slots).toBe(11);
    expect(data.draft_count).toBe(0);
    expect(data.absent_count).toBe(3); // ab4(8/10)는 구간 밖
    expect(data.makeup_completed).toBe(1);
    expect(data.makeup_pending).toBe(1);
    expect(data.makeup_pending_minutes).toBe(60); // 90 - 30
    expect(data.makeup_unscheduled).toBe(1); // ab3은 보강 자체가 없음
    expect(data.unassigned_attendance).toBe(1);
  });

  it('계약이 없는 시간표 과목도 미등록 행으로 노출된다', async () => {
    // 계약 0건 — 시간표에는 수학·영어가 있다
    const { data } = await json(await handleContracts('GET', '/api/contracts', get(), ctx(db)));

    expect(data.contracts.map((c: any) => c.subject)).toEqual(['수학', '영어']);
    expect(data.draft_count).toBe(2);

    const math = data.contracts.find((c: any) => c.subject === '수학');
    expect(math.id).toBeNull();
    expect(math.is_draft).toBe(true);
    expect(math.session_count).toBe(9); // 시간표 주당 타임을 제안값으로
    expect(math.planned_slots).toBe(0); // 저장 전에는 m을 지어내지 않는다
    expect(math.missed_slots).toBe(0);
    expect(math.done_slots).toBe(6); // 실제 진행분은 그대로 보여준다
    expect(math.total_price).toBe(0);
    expect(data.monthly_total).toBe(0);
  });

  it('미등록 과목을 저장하면 실제 계약이 되고 총계에 잡힌다', async () => {
    await handleContracts(
      'PUT',
      '/api/contracts',
      put({ student_id: 'stu-1', subject: '수학', unit_price: 65000, session_count: 3, collect_day: 15 }),
      ctx(db)
    );
    const { data } = await json(await handleContracts('GET', '/api/contracts', get(), ctx(db)));

    const math = data.contracts.find((c: any) => c.subject === '수학');
    expect(math.is_draft).toBe(false);
    expect(math.id).toBeTruthy();
    expect(math.planned_slots).toBe(12);
    expect(math.total_price).toBe(195000);
    expect(data.monthly_total).toBe(195000);
    expect(data.draft_count).toBe(1); // 영어는 아직 미등록
  });

  it('같은 과목을 다시 PUT하면 새 행이 아니라 갱신된다', async () => {
    const base = { student_id: 'stu-1', subject: '수학', unit_price: 65000, session_count: 3 };
    await handleContracts('PUT', '/api/contracts', put(base), ctx(db));
    await handleContracts('PUT', '/api/contracts', put({ ...base, session_count: 2 }), ctx(db));

    const { data } = await json(await handleContracts('GET', '/api/contracts', get(), ctx(db)));
    // 수학은 갱신된 계약 1건, 영어는 시간표만 있어 미등록 행으로 남는다
    const math = data.contracts.filter((c: any) => c.subject === '수학');
    expect(math).toHaveLength(1);
    expect(math[0].session_count).toBe(2);
    expect(math[0].total_price).toBe(130000);
    expect(data.draft_count).toBe(1);
  });

  it('다른 학원 학생은 조회되지 않는다', async () => {
    const res = await handleContracts('GET', '/api/contracts', get('student_id=stu-2'), ctx(db, 'acad-1'));
    expect(res.status).toBe(404);
  });

  it('담당이 아닌 강사는 403', async () => {
    const res = await handleContracts(
      'GET',
      '/api/contracts',
      get(),
      ctx(db, 'acad-1', 'instructor', 'teacher-other')
    );
    expect(res.status).toBe(403);
  });

  it('음수 단가/시수는 0으로 클램프된다', async () => {
    await handleContracts(
      'PUT',
      '/api/contracts',
      put({ student_id: 'stu-1', subject: '수학', unit_price: -5000, session_count: -3 }),
      ctx(db)
    );
    const { data } = await json(await handleContracts('GET', '/api/contracts', get(), ctx(db)));
    expect(data.contracts[0].total_price).toBe(0);
  });
});
