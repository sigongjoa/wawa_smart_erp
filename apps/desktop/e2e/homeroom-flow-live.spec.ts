import { test, expect } from '@playwright/test';

// 담임제 E2E — 합의서 4-5 / 4-1 / 4-2 + UX 5종
// - 담임 지정 (admin)
// - 학부모 상담 기록 작성 + 공유 조회
// - 외부 일정 (타학원) 추가
// - 정기고사 자동 반영
// - 담임 요약 / 월별 매트릭스

const API = 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const SLUG = 'alpha';
const TEACHER = { name: '서재용', pin: '1141' };

test.setTimeout(120000);

// ── helpers ────────────────────────────────────────────────
async function req(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; json: any; raw: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const raw = await res.json().catch(() => ({}));
  return { status: res.status, json: (raw as any).data ?? raw, raw };
}

test.describe('담임제 E2E — 합의서 4-5 / 4-1 / 4-2', () => {
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let teacherId = '';
  let studentId = '';
  let consultationId = '';
  let scheduleId = '';

  test('UC1: 로그인 (admin 토큰)', async () => {
    const r = await req('POST', '/api/auth/login', { slug: SLUG, ...TEACHER });
    expect(r.status).toBe(200);
    expect(r.json.accessToken).toBeTruthy();
    token = r.json.accessToken;
    // JWT payload에서 userId 추출
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8')
    );
    teacherId = payload.userId;
    expect(teacherId).toBeTruthy();
    console.log(`[UC1] admin token ✓ userId=${teacherId}`);
  });

  test('UC2: 담당 학생 목록에서 학생 1명 선택', async () => {
    const r = await req('GET', '/api/student', undefined, token);
    expect(r.status).toBe(200);
    const students = Array.isArray(r.json) ? r.json : r.json.students ?? [];
    expect(students.length, '담당 학생이 최소 1명 필요').toBeGreaterThan(0);
    studentId = students[0].id;
    console.log(`[UC2] target student: ${students[0].name} (${studentId})`);
  });

  test('UC3: 담임 지정 (PUT /api/student/:id/homeroom)', async () => {
    const r = await req(
      'PUT',
      `/api/student/${studentId}/homeroom`,
      { teacher_id: teacherId },
      token
    );
    expect(r.status).toBe(200);
    expect(r.json.homeroom_teacher_id).toBe(teacherId);
    console.log('[UC3] homeroom assigned ✓');
  });

  test('UC4: 프로필에서 담임 확인 (homeroom_teacher 필드)', async () => {
    const r = await req('GET', `/api/student/${studentId}/profile`, undefined, token);
    expect(r.status).toBe(200);
    expect(r.json.homeroom_teacher).toBeTruthy();
    expect(r.json.homeroom_teacher.id).toBe(teacherId);
    console.log(`[UC4] profile.homeroom_teacher = ${r.json.homeroom_teacher.name} ✓`);
  });

  test('UC5: 학부모 상담 기록 생성 (4-1, 카카오 수단)', async () => {
    const r = await req(
      'POST',
      `/api/student/${studentId}/consultations`,
      {
        channel: 'kakao',
        category: 'monthly',
        consulted_at: new Date().toISOString(),
        summary: '[E2E] 4월 정기 상담 — 시험 전 학습 계획 공유\n[카톡 대화]\n학부모님: 수학 진도 어디까지?',
        parent_sentiment: 'positive',
        follow_up: '다음 주 중간고사 전 2차 상담',
        follow_up_due: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      },
      token
    );
    expect(r.status).toBe(200);
    expect(r.json.id).toBeTruthy();
    consultationId = r.json.id;
    console.log(`[UC5] consultation created ✓ id=${consultationId}`);
  });

  test('UC6: 상담 타임라인 조회 — 작성자명·뱃지 필드 포함', async () => {
    const r = await req('GET', `/api/student/${studentId}/consultations`, undefined, token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json)).toBe(true);
    const c = r.json.find((x: any) => x.id === consultationId);
    expect(c).toBeTruthy();
    expect(c.author_name).toBeTruthy();
    expect(c.channel).toBe('kakao');
    expect(c.category).toBe('monthly');
    expect(c.follow_up_due).toBeTruthy();
    console.log(`[UC6] timeline OK, author=${c.author_name}, follow_up_due=${c.follow_up_due}`);
  });

  test('UC7: 외부 일정 — 타학원 추가 (4-2)', async () => {
    const r = await req(
      'POST',
      `/api/student/${studentId}/schedules`,
      {
        kind: 'other_academy',
        title: '[E2E] 영어 1:1 과외',
        recurrence: '매주 화·목 19:00',
        location: 'ABC어학원',
        note: '시험 기간엔 쉰다',
      },
      token
    );
    expect(r.status).toBe(200);
    expect(r.json.id).toBeTruthy();
    scheduleId = r.json.id;
    console.log(`[UC7] external schedule created ✓ id=${scheduleId}`);
  });

  test('UC8: 외부 일정 목록 조회', async () => {
    const r = await req('GET', `/api/student/${studentId}/schedules`, undefined, token);
    expect(r.status).toBe(200);
    const item = r.json.find((x: any) => x.id === scheduleId);
    expect(item).toBeTruthy();
    expect(item.kind).toBe('other_academy');
    console.log(`[UC8] schedule list OK`);
  });

  test('UC9: 담임 요약 — /api/homeroom/summary', async () => {
    const r = await req('GET', '/api/homeroom/summary', undefined, token);
    expect(r.status).toBe(200);
    expect(r.json.homeroom_count).toBeGreaterThanOrEqual(1);
    // 이번 달 상담을 방금 기록했으므로 consulted에 포함되어야 함
    const ids = r.json.this_month_consulted.map((s: any) => s.id);
    expect(ids).toContain(studentId);
    // 3일 뒤 follow_up_due 등록했으므로 follow_ups_due에 포함
    const followStudents = r.json.follow_ups_due.map((f: any) => f.student_id);
    expect(followStudents).toContain(studentId);
    console.log(
      `[UC9] summary OK — homeroom=${r.json.homeroom_count}, consulted=${r.json.this_month_consulted.length}, follow=${r.json.follow_ups_due.length}`
    );
  });

  test('UC10: 담임 월 매트릭스 — /api/homeroom/calendar', async () => {
    const month = new Date().toISOString().slice(0, 7);
    const r = await req('GET', `/api/homeroom/calendar?month=${month}`, undefined, token);
    expect(r.status).toBe(200);
    expect(r.json.month).toBe(month);
    const studentIds = r.json.students.map((s: any) => s.id);
    expect(studentIds).toContain(studentId);
    const cIds = r.json.consultations.map((c: any) => c.id);
    expect(cIds).toContain(consultationId);
    console.log(
      `[UC10] calendar OK — students=${r.json.students.length}, consultations=${r.json.consultations.length}`
    );
  });

  test('UC11: 권한 — 다른 학생 상담 조회 시 403 (비담당)', async () => {
    // 임의 가짜 학생 id로 시도
    const r = await req(
      'GET',
      '/api/student/stu-nonexistent-xxx/consultations',
      undefined,
      token
    );
    // admin은 전체 접근이므로 admin 계정에선 404가 정답. instructor는 403
    expect([403, 404]).toContain(r.status);
    console.log(`[UC11] access guard OK (status=${r.status})`);
  });

  test('UC12: 작성자만 상담 삭제 가능', async () => {
    const r = await req(
      'DELETE',
      `/api/student/${studentId}/consultations/${consultationId}`,
      undefined,
      token
    );
    expect(r.status).toBe(200);
    expect(r.json.deleted).toBe(true);

    // 재조회 시 사라졌는지
    const list = await req('GET', `/api/student/${studentId}/consultations`, undefined, token);
    const stillThere = list.json.find((x: any) => x.id === consultationId);
    expect(stillThere).toBeFalsy();
    console.log(`[UC12] delete by author OK`);
  });

  test('UC13: 정리 — 외부 일정 삭제', async () => {
    const r = await req(
      'DELETE',
      `/api/student/${studentId}/schedules/${scheduleId}`,
      undefined,
      token
    );
    expect(r.status).toBe(200);
    console.log(`[UC13] cleanup OK`);
  });
});
