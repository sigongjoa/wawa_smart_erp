/**
 * 학생 학습 기록 (통합 도메인) — Phase 2 유스케이스 e2e (API + UI 혼합)
 *
 * UC1 페이지 라우트 도달 (헤더/버튼 노출)
 * UC2 신규 lesson-item CRUD (POST/GET/PATCH/DELETE) — admin 권한
 * UC3 학부모 share 토큰 발급 → 학부모 페이지 데이터 응답에 포함
 * UC4 학부모 페이지 SPA 렌더 — 항목 제목 노출
 * UC5 visible_to_parent=0 일 땐 학부모 페이지에 노출되지 않음
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';
const API = process.env.E2E_API_URL || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};

test.setTimeout(180_000);
test.use({ baseURL: BASE });

async function login(page: Page) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('#login-academy option').length > 1,
        { timeout: 15_000 }
      );
      await page.locator('#login-academy').selectOption(TEACHER.slug);
      await page.waitForTimeout(800);
      await page.fill('#login-name', TEACHER.name);
      await page.fill('#login-pin', TEACHER.pin);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => !url.toString().includes('#/login'), { timeout: 25_000 });
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(2_000);
    }
  }
}

async function getAccessToken(page: Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('auth_access_token'));
  expect(t, 'accessToken 추출 실패').toBeTruthy();
  return t!;
}

async function fetchJson(req: APIRequestContext, url: string, token: string, init?: any) {
  const r = await req.fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok(), status: r.status(), body: j?.data ?? j };
}

/** Playwright APIRequestContext로 API 호출 (Authorization 헤더만, 쿠키 미포함) */
async function apiCall(
  req: APIRequestContext,
  token: string,
  url: string,
  init: { method?: string; data?: any; cookieHeader?: string } = {}
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (init.cookieHeader) headers.Cookie = init.cookieHeader;
  const r = await req.fetch(url, {
    method: init.method ?? 'GET',
    headers,
    data: init.data,
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok(), status: r.status(), body: j?.data ?? j };
}

async function getCookieHeader(page: Page, apiOrigin: string): Promise<string> {
  const cookies = await page.context().cookies(apiOrigin);
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

/** 페이지 컨텍스트(브라우저)의 fetch 사용 — 페이지가 인증되는 방식 그대로 호출 */
async function pageApiCall(
  page: Page,
  url: string,
  init: { method?: string; data?: any } = {}
) {
  return page.evaluate(
    async ({ url, method, body }) => {
      const r = await fetch(url, {
        method: method || 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_access_token') ?? ''}`,
        },
        body: body || undefined,
      });
      const text = await r.text();
      let j: any = null;
      try {
        j = JSON.parse(text);
      } catch {}
      return { ok: r.ok, status: r.status, body: j?.data ?? j ?? text };
    },
    { url, method: init.method, body: init.data }
  );
}

test('UC1 — /lessons 라우트 헤더·신규 버튼 노출', async ({ page }) => {
  await login(page);
  await page.goto('/#/lessons');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: '학생 학습 기록' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /\+ 새 항목/ })).toBeVisible();
  await expect(page.locator('.page-header select')).toBeVisible();
});

test('UC2~UC5 — API CRUD + 학부모 share + 학부모 SPA 노출 + 비공개 항목 차단', async ({
  page,
  request,
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const cookieHeader = await getCookieHeader(page, API);
  console.log('[e2e] cookies:', cookieHeader ? cookieHeader.split('; ').map(c=>c.split('=')[0]).join(',') : '(none)');

  // 학생 한 명 (담당 → 없으면 전체 → 없으면 새로 생성)
  let students: any[] = [];
  for (const path of ['/api/student', '/api/student?scope=all']) {
    const r = await pageApiCall(page,`${API}${path}`, { cookieHeader });
    console.log(`[e2e] GET ${path} → ${r.status}`);
    if (!r.ok) continue;
    const arr = r.body;
    if (Array.isArray(arr) && arr.length > 0) {
      students = arr;
      break;
    }
  }
  let createdStudent: any = null;
  if (students.length === 0) {
    const cr = await pageApiCall(page,`${API}/api/student`, {
      method: 'POST',
      cookieHeader,
      data: JSON.stringify({
        name: `E2E-임시학생-${Date.now().toString(36)}`,
        grade: '중2',
      }),
    });
    expect(cr.ok, `학생 생성 실패 ${cr.status}: ${JSON.stringify(cr.body)}`).toBeTruthy();
    createdStudent = cr.body;
    students = [createdStudent];
  }
  const student = students[0];
  console.log('[e2e] using student:', student.name, student.id);

  // ── UC2: 항목 2개 생성 (공개 / 비공개) ─────────
  const visibleCreate = await pageApiCall(page,`${API}/api/lesson-items`, {
    method: 'POST',
    cookieHeader,
    data: JSON.stringify({
      student_id: student.id,
      kind: 'unit',
      textbook: 'E2E-쎈',
      unit_name: 'E2E-단원-공개',
      title: 'E2E-자료-공개',
      purpose: '오답 보강',
      understanding: 60,
      visible_to_parent: true,
    }),
  });
  expect(visibleCreate.ok, `생성 실패: ${JSON.stringify(visibleCreate.body)}`).toBeTruthy();
  const visibleItem = visibleCreate.body;
  expect(visibleItem.id).toBeTruthy();
  expect(visibleItem.visible_to_parent).toBe(true);

  const hiddenCreate = await pageApiCall(page,`${API}/api/lesson-items`, {
    method: 'POST',
    cookieHeader,
    data: JSON.stringify({
      student_id: student.id,
      kind: 'unit',
      title: 'E2E-자료-비공개',
      visible_to_parent: false,
    }),
  });
  expect(hiddenCreate.ok).toBeTruthy();
  const hiddenItem = hiddenCreate.body;

  // ── PATCH: 이해도 75, 상태 in_progress ────────
  const patchRes = await apiCall(
    request,
    token,
    `${API}/api/lesson-items/${visibleItem.id}`,
    {
      method: 'PATCH',
      cookieHeader,
      data: JSON.stringify({ understanding: 75, status: 'in_progress', note: 'E2E note' }),
    }
  );
  expect(patchRes.ok).toBeTruthy();
  expect(patchRes.body.understanding).toBe(75);
  expect(patchRes.body.status).toBe('in_progress');

  // GET 단건
  const getRes = await pageApiCall(page,`${API}/api/lesson-items/${visibleItem.id}`, { cookieHeader });
  expect(getRes.ok).toBeTruthy();
  expect(getRes.body.title).toBe('E2E-자료-공개');
  expect(getRes.body.note).toBe('E2E note');

  // 목록 조회 (해당 학생)
  const listRes = await apiCall(
    request,
    token,
    `${API}/api/lesson-items?student_id=${student.id}`,
    { cookieHeader }
  );
  expect(listRes.ok).toBeTruthy();
  const ids = (listRes.body as any[]).map((x) => x.id);
  expect(ids).toContain(visibleItem.id);
  expect(ids).toContain(hiddenItem.id);

  // ── UC3: share 토큰 발급 ────────
  const shareRes = await apiCall(
    request,
    token,
    `${API}/api/lesson-items/${visibleItem.id}/share`,
    { method: 'POST', cookieHeader }
  );
  expect(shareRes.ok).toBeTruthy();
  const shareToken = shareRes.body.token;
  const sharePath = shareRes.body.path;
  expect(shareToken).toBeTruthy();
  expect(sharePath).toContain(`/parent/student/${student.id}`);

  // ── UC3 검증: 학부모 API 호출 (HMAC 토큰) ────────
  const parentRes = await request.get(
    `${API}/api/parent/students/${student.id}/lessons?token=${encodeURIComponent(shareToken)}`
  );
  expect(parentRes.ok(), `학부모 API 실패 ${parentRes.status()}`).toBeTruthy();
  const parentJson = await parentRes.json();
  const parentItems = (parentJson?.data ?? parentJson)?.items ?? [];
  const parentTitles = parentItems.map((i: any) => i.title);
  expect(parentTitles).toContain('E2E-자료-공개');
  // UC5: 비공개 항목은 노출되지 않음
  expect(parentTitles).not.toContain('E2E-자료-비공개');

  // ── UC4: 학부모 SPA 페이지 렌더 검증 ────────
  const parentPage = await page.context().newPage();
  await parentPage.goto(`${BASE}/#${sharePath}`);
  await parentPage.waitForLoadState('networkidle');
  await expect(
    parentPage.getByRole('heading', { name: new RegExp(student.name) })
  ).toBeVisible({ timeout: 15_000 });
  await expect(parentPage.getByText('E2E-자료-공개')).toBeVisible();
  await expect(parentPage.getByText('E2E-자료-비공개')).toHaveCount(0);
  await parentPage.close();

  // ── 정리 (soft archive) ────────
  await pageApiCall(page,`${API}/api/lesson-items/${visibleItem.id}`, { method: 'DELETE', cookieHeader });
  await pageApiCall(page,`${API}/api/lesson-items/${hiddenItem.id}`, { method: 'DELETE', cookieHeader });
  if (createdStudent) {
    await pageApiCall(page,`${API}/api/student/${createdStudent.id}`, { method: 'DELETE', cookieHeader });
  }
});
