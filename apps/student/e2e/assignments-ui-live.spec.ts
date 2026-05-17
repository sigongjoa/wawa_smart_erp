/**
 * 학생앱 과제 UI — 실 브라우저 E2E
 *
 * 실행:
 *   cd apps/student
 *   STUDENT_URL=https://wawa-learn.pages.dev npx playwright test e2e/assignments-ui-live.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

const API = process.env.API_URL || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const SLUG = 'alpha';
const ACADEMY_NAME = '알파시티점';
const TEACHER = { name: '서재용', pin: '1141' };
const STUDENT_NAME = '강은서';
const STUDENT_PIN = '9999';

let teacherToken = '';
let studentId = '';
let assignmentId = '';

async function apiPost(path: string, body: any, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json: (json as any).data ?? json };
}

async function apiGet(path: string, token: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json: (json as any).data ?? json };
}

async function apiDelete(path: string, token: string) {
  const res = await fetch(`${API}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  return res.status;
}

test.describe.serial('과제 UI E2E (실제 브라우저)', () => {

  test('UI0. 학원 목록 공개 API 확인', async ({ request }) => {
    const res = await request.get(`${API}/api/onboard/academies`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const list = (body.data ?? body) as Array<{ slug: string; name: string }>;
    const alpha = list.find(a => a.slug === SLUG);
    expect(alpha, `slug=${SLUG} 학원이 공개 목록에 없음`).toBeTruthy();
    console.log(`✅ 공개 학원 목록에 ${alpha!.name} 있음`);
  });

  test('UI1. (셋업) 교사 로그인 + PIN 초기화 + 과제 생성', async () => {
    const login = await apiPost('/api/auth/login', { slug: SLUG, name: TEACHER.name, pin: TEACHER.pin });
    expect(login.status).toBe(200);
    teacherToken = login.json.accessToken;
    expect(teacherToken).toBeTruthy();

    const list = await apiGet('/api/gacha/students?scope=all', teacherToken);
    const stu = (list.json as any[]).find(s => s.name === STUDENT_NAME && s.status === 'active');
    expect(stu, `${STUDENT_NAME} 학생 못 찾음`).toBeTruthy();
    studentId = stu.id;

    await apiPost(`/api/gacha/students/${studentId}/reset-pin`, { pin: STUDENT_PIN }, teacherToken);

    const asn = await apiPost('/api/assignments', {
      title: `UI E2E 테스트 과제 — ${new Date().toISOString()}`,
      instructions: '이건 UI 테스트용 과제입니다. 풀어서 제출해주세요.',
      kind: 'perf_eval',
      due_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
      student_ids: [studentId],
    }, teacherToken);
    expect(asn.status).toBe(201);
    assignmentId = asn.json.id;
    console.log(`✅ 셋업 완료 — 학생=${studentId}, 과제=${assignmentId}`);
  });

  test('UI2. 로그인 페이지 로드 + 학원 목록에 알파시티점 표시', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.locator('.login-title')).toContainText('WAWA Learn');

    await page.click('.login-academy-select');
    const item = page.locator(`.academy-item:has-text("${ACADEMY_NAME}")`);
    await expect(item).toBeVisible({ timeout: 10_000 });

    const emptyMsg = page.locator('.academy-empty');
    await expect(emptyMsg).toHaveCount(0);
    console.log(`✅ 학원 목록에 "${ACADEMY_NAME}" 노출 ("등록된 학원이 없습니다" 없음)`);
  });

  test('UI3. 강은서 로그인 → 홈 진입', async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.locator('.home-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('h1')).toContainText(STUDENT_NAME);
    console.log('✅ 로그인 → 홈');
  });

  test('UI4. 홈 화면에 과제 위젯 노출', async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.locator('.home-page')).toBeVisible({ timeout: 15_000 });

    const widgetHeading = page.locator('.home-section h2', { hasText: '과제' });
    await expect(widgetHeading).toBeVisible({ timeout: 10_000 });

    // 방금 만든 과제 제목 일부가 보여야 함
    await expect(page.getByText(/UI E2E 테스트 과제/)).toBeVisible({ timeout: 5000 });
    console.log('✅ 과제 위젯에 새 과제 노출');
  });

  test('UI5. 과제 목록 페이지 이동 + 상세 이동', async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.locator('.home-page')).toBeVisible({ timeout: 15_000 });

    // 모두 보기 버튼
    const seeAll = page.locator('.home-section').filter({ hasText: '과제' }).locator('button:has-text("모두 보기")');
    await seeAll.click();
    await page.waitForURL(/#\/assignments$/, { timeout: 10_000 });

    const card = page.getByText(/UI E2E 테스트 과제/);
    await expect(card.first()).toBeVisible({ timeout: 10_000 });
    await card.first().click();

    await page.waitForURL(/#\/assignments\/.+/, { timeout: 10_000 });
    await expect(page.getByText(/UI E2E 테스트 과제/)).toBeVisible();
    await expect(page.getByText('이건 UI 테스트용 과제입니다')).toBeVisible();
    console.log('✅ 상세 페이지 진입 + 지시문 렌더');
  });

  test('UI6. (정리) 과제 닫기', async () => {
    if (!assignmentId || !teacherToken) return;
    const status = await apiDelete(`/api/assignments/${assignmentId}`, teacherToken);
    expect(status).toBeLessThan(400);
    console.log('✅ 테스트 과제 닫기 완료');
  });
});

async function loginAsStudent(page: Page) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click(`.academy-item:has-text("${ACADEMY_NAME}")`);
  await page.fill('input[placeholder="이름"]', STUDENT_NAME);
  await page.fill('input[placeholder*="PIN"]', STUDENT_PIN);
  await page.click('.login-btn');
}
