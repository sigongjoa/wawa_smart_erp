import { test, expect } from '@playwright/test';

// 학부모 월간 리포트 E2E — 라이브 워커 대상
// 유즈케이스:
//   UC1. 교사가 로그인 → 담당 학생 조회
//   UC2. 해당 학생에 학부모 공유 코멘트 1건 생성 (parent_share, 이번 달)
//   UC3. 학부모 리포트 공유 링크 발급 (POST /share)
//   UC4. 공개 GET으로 리포트 조회 — 토큰 없이 400
//   UC5. 조작된 토큰으로 조회 — 401
//   UC6. 다른 학생 ID로 같은 토큰 사용 — 401
//   UC7. 유효 토큰+month으로 조회 — 200, student/attendance/exams/progress/materials/notes 구조 검증
//   UC8. UC2에서 작성한 학부모 코멘트가 notes에 포함되는지
//   UC9. 프론트 /parent-report/:id?token=... 경로로 페이지 렌더 확인 (학생 이름 표시)

const API = process.env.E2E_API_URL || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const SLUG = process.env.E2E_SLUG || 'alpha';
const TEACHER_NAME = process.env.E2E_TEACHER_NAME || '서재용';
// 실 계정 자격증명은 하드코딩하지 않음. 실행: E2E_TEACHER_PIN=xxxx pnpm playwright test parent-report-live
const TEACHER_PIN = process.env.E2E_TEACHER_PIN || '';

test.setTimeout(120000);

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

test.describe('학부모 월간 리포트 E2E', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!TEACHER_PIN, 'E2E_TEACHER_PIN 환경변수가 필요합니다.');

  let token = '';
  let studentId = '';
  let studentName = '';
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  let shareToken = '';
  let sharePath = '';
  let shareUrl = '';
  let noteId = '';

  test('UC1: 교사 로그인 + 담당 학생 선택', async () => {
    const r = await req('POST', '/api/auth/login', {
      slug: SLUG, name: TEACHER_NAME, pin: TEACHER_PIN,
    });
    expect(r.status, `login raw=${JSON.stringify(r.raw)}`).toBe(200);
    expect(r.json.accessToken).toBeTruthy();
    token = r.json.accessToken;

    const rs = await req('GET', '/api/student', undefined, token);
    expect(rs.status).toBe(200);
    const students = Array.isArray(rs.json) ? rs.json : rs.json.students ?? [];
    expect(students.length, '담당 학생 1명 이상 필요').toBeGreaterThan(0);
    studentId = students[0].id;
    studentName = students[0].name;
    console.log(`[UC1] student=${studentName} (${studentId}), month=${month}`);
  });

  test('UC2: 학부모 공유 코멘트 1건 생성', async () => {
    const content = `[E2E] ${new Date().toISOString()} 이번 달 꾸준히 집중했습니다.`;
    const r = await req(
      'POST',
      `/api/student/${studentId}/notes`,
      {
        subject: '영어',
        category: 'attitude',
        sentiment: 'positive',
        content,
        visibility: 'parent_share',
        period_tag: month,
      },
      token
    );
    // 학원/스키마에 따라 필드 이름이 약간 다를 수 있어서 관대하게 처리
    expect([200, 201], `create note raw=${JSON.stringify(r.raw)}`).toContain(r.status);
    noteId = r.json?.id || '';
    console.log(`[UC2] note created id=${noteId}`);
  });

  test('UC3: 학부모 리포트 공유 링크 발급', async () => {
    const r = await req(
      'POST',
      `/api/parent-report/${studentId}/share`,
      { month, days: 7 },
      token
    );
    expect(r.status, `share raw=${JSON.stringify(r.raw)}`).toBe(200);
    expect(r.json.token).toBeTruthy();
    expect(r.json.path).toContain(`/parent-report/${studentId}`);
    expect(r.json.path).toContain(`token=`);
    expect(r.json.path).toContain(`month=${month}`);
    expect(new Date(r.json.expires_at).getTime()).toBeGreaterThan(Date.now());
    shareToken = r.json.token;
    sharePath = r.json.path;
    shareUrl = r.json.url;
    console.log(`[UC3] token(first 20)=${shareToken.slice(0, 20)}... path=${sharePath}`);
  });

  test('UC4: 공개 GET 토큰 누락 시 400', async () => {
    const res = await fetch(`${API}/api/parent-report/${studentId}?month=${month}`);
    expect(res.status).toBe(400);
  });

  test('UC5: 조작된 토큰은 401', async () => {
    const tampered = shareToken.slice(0, -4) + 'AAAA';
    const res = await fetch(
      `${API}/api/parent-report/${studentId}?token=${encodeURIComponent(tampered)}&month=${month}`
    );
    expect(res.status).toBe(401);
  });

  test('UC6: 다른 학생 id로 같은 토큰 사용 시 401', async () => {
    const fakeId = studentId.slice(0, -1) + (studentId.slice(-1) === 'a' ? 'b' : 'a');
    const res = await fetch(
      `${API}/api/parent-report/${fakeId}?token=${encodeURIComponent(shareToken)}&month=${month}`
    );
    // 서명에 studentId가 포함되어 있으므로 서명 불일치 → 401
    expect(res.status).toBe(401);
  });

  test('UC7: 유효한 토큰으로 리포트 조회', async () => {
    const res = await fetch(
      `${API}/api/parent-report/${studentId}?token=${encodeURIComponent(shareToken)}&month=${month}`
    );
    expect(res.status).toBe(200);
    const raw = await res.json();
    expect(raw.success).toBe(true);
    const data = raw.data;

    expect(data.student?.id).toBe(studentId);
    expect(data.student?.name).toBe(studentName);
    expect(data.month).toBe(month);

    expect(data.attendance).toBeDefined();
    expect(typeof data.attendance.scheduled).toBe('number');
    expect(typeof data.attendance.attended).toBe('number');
    expect(typeof data.attendance.total_net_minutes).toBe('number');
    expect(Array.isArray(data.attendance.by_subject)).toBe(true);

    expect(Array.isArray(data.exams)).toBe(true);
    expect(Array.isArray(data.progress)).toBe(true);
    expect(data.materials).toBeDefined();
    expect(Array.isArray(data.materials.assignments)).toBe(true);
    expect(Array.isArray(data.materials.print_materials)).toBe(true);
    expect(Array.isArray(data.notes)).toBe(true);

    console.log(
      `[UC7] 출석 ${data.attendance.attended}/${data.attendance.scheduled} · ` +
      `시험 ${data.exams.length}건 · 진도 ${data.progress.length}교재 · ` +
      `과제 ${data.materials.assignments.length} · 코멘트 ${data.notes.length}`
    );
  });

  test('UC8: 방금 만든 학부모 코멘트가 notes에 노출', async () => {
    const res = await fetch(
      `${API}/api/parent-report/${studentId}?token=${encodeURIComponent(shareToken)}&month=${month}`
    );
    expect(res.status).toBe(200);
    const raw = await res.json();
    const data = raw.data;
    const found = data.notes.some((n: any) => n.content?.startsWith('[E2E]'));
    expect(found, `notes에 parent_share 코멘트가 포함되어야 함. notes=${JSON.stringify(data.notes)}`).toBe(true);
  });

  test('UC9: 프론트 /parent-report/:id 페이지 렌더링', async ({ page }) => {
    // 프론트는 API 프리뷰가 아닌 로컬 프리뷰(4173)에서 동작
    // baseURL에 해시 라우트로 token/month 전달, VITE_API_URL이 라이브 워커를 가리키도록 설정돼 있어야 함
    const pathHash = `/#/parent-report/${studentId}?token=${encodeURIComponent(shareToken)}&month=${month}`;
    await page.goto(pathHash);

    // 학생 이름이 헤더에 렌더되기를 기대
    await expect(page.getByRole('heading', { name: new RegExp(studentName) })).toBeVisible({
      timeout: 15000,
    });

    // 섹션 헤더들
    await expect(page.getByText('이번 달 한눈에')).toBeVisible();
    await expect(page.getByText('시험 일정 & 준비')).toBeVisible();
    await expect(page.getByText('진도 현황')).toBeVisible();
    await expect(page.getByText('선생님이 준비한 자료')).toBeVisible();
    await expect(page.getByText('이번 달 선생님 코멘트')).toBeVisible();
  });

  test.afterAll(async () => {
    // 생성한 노트 정리 (엔드포인트 존재 시)
    if (noteId && token) {
      await req('DELETE', `/api/student/${studentId}/notes/${noteId}`, undefined, token).catch(() => {});
    }
    console.log(`[cleanup] shareUrl=${shareUrl}`);
  });
});
