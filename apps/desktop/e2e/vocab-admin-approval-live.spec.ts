/**
 * UC-E #50: 선생님 admin.html 단어 승인 UI 유즈케이스
 *
 * 1) API로 학생 계정 + pending 단어 1개 seed
 * 2) desktop(ERP) 로그인 → admin.html 진입
 * 3) 대기중 카운트 배지 / 퀵버튼 / 테이블에 pos·example·제출자 컬럼 확인
 * 4) 승인 버튼 클릭 → 상태 전환 확인
 * 5) 정리
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';
const API = process.env.API || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};

test.setTimeout(180000);
test.use({ baseURL: BASE });

async function apiJson(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

test('UC-E #50: admin.html에서 pending 단어 승인 흐름', async ({ page }) => {
  // ── seed: 선생님 로그인 → 학생 생성 → pending 단어 추가 ──
  const login = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin }),
  });
  expect(login.status).toBe(200);
  const token: string = login.body.data?.accessToken;
  expect(token).toBeTruthy();

  const uniq = `uc50${Date.now().toString(36).slice(-5)}`;
  const studentRes = await apiJson('/api/gacha/students', {
    method: 'POST',
    body: JSON.stringify({ name: `UC50-${uniq}`, grade: '중1', pin: '1111' }),
  }, token);
  expect(studentRes.status, JSON.stringify(studentRes.body)).toBeLessThan(300);
  const studentId: string = studentRes.body.data?.id;
  expect(studentId).toBeTruthy();

  // 선생님 라우트는 pending 상태를 바로 세팅하려면 학생 play 토큰으로 POST해야 함.
  // 간단화: /api/vocab/words로 teacher가 POST 후 PATCH status='pending'로 돌림
  const wordRes = await apiJson('/api/vocab/words', {
    method: 'POST',
    body: JSON.stringify({
      student_id: studentId,
      english: `approve${uniq}`,
      korean: '승인테스트',
      blank_type: 'korean',
    }),
  }, token);
  expect(wordRes.status, JSON.stringify(wordRes.body)).toBeLessThan(300);
  const wordId: string = wordRes.body.data?.id;
  await apiJson(`/api/vocab/words/${wordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'pending' }),
  }, token);

  try {
    // ── 로그인 ──
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const opts = document.querySelectorAll('#login-academy option');
      return opts.length > 1;
    }, { timeout: 15000 });
    await page.locator('#login-academy').selectOption(TEACHER.slug);
    await page.waitForTimeout(600);
    await page.fill('#login-name', TEACHER.name);
    await page.fill('#login-pin', TEACHER.pin);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL(url => !url.toString().includes('#/login'), { timeout: 15000 });
    } catch (e) {
      const err = await page.locator('.error').textContent().catch(() => null);
      const url = page.url();
      console.log(`[DEBUG] login timeout — url=${url}, error=${err}`);
      throw e;
    }

    // React ERP는 httpOnly 쿠키 우선이라 localStorage에 accessToken이 없을 수 있음.
    // admin.html은 localStorage.accessToken을 읽어 auth 체크 → 없으면 /#/login으로 리다이렉트.
    // 테스트 seed에서 얻은 token을 localStorage에 주입해 admin.html을 정상 통과시킨다.
    await page.evaluate((t) => localStorage.setItem('accessToken', t), token);

    // ── Cloudflare Pages: /vocab/admin.html → 308 /vocab/admin → static admin.html ──
    // 새 탭으로 직접 열어 React SPA state 간섭 차단 (localStorage는 same-origin이므로 공유)
    const adminPage = await page.context().newPage();
    await adminPage.goto(`${BASE}/vocab/admin.html`, { waitUntil: 'load' });
    await expect(adminPage).toHaveTitle(/Word Gacha/, { timeout: 10000 });

    // ── 1. 대기중 카운트 배지 ≥ 1 ──
    await adminPage.waitForFunction(() => {
      const el = document.getElementById('pendingBadge');
      return el && Number(el.dataset.n || '0') >= 1;
    }, undefined, { timeout: 15000 });
    const badgeN = await adminPage.locator('#pendingBadge').getAttribute('data-n');
    expect(Number(badgeN)).toBeGreaterThanOrEqual(1);

    // ── 2. 퀵버튼 "대기중만 보기" 클릭 → filterStatus=pending ──
    await adminPage.locator('#pendingShortcut').click();
    await expect(adminPage.locator('#filterStatus')).toHaveValue('pending');

    // ── 3. 테이블에 내 pending 단어 + 품사/예문/제출자 컬럼 표시 ──
    await expect(adminPage.locator(`tr[data-id="${wordId}"]`)).toBeVisible({ timeout: 10000 });
    const row = adminPage.locator(`tr[data-id="${wordId}"]`);
    await expect(row.locator('.badge.pending')).toBeVisible();
    await expect(row.locator('.badge.source-teacher, .badge.source-student')).toBeVisible();
    await expect(row.locator('button:has-text("승인")')).toBeVisible();
    await expect(row.locator('button:has-text("거절")')).toBeVisible();

    // ── 4. 헤더에 새 컬럼 3개 존재 ──
    const headerTexts = await adminPage.locator('#wordTable thead th').allTextContents();
    expect(headerTexts).toContain('품사');
    expect(headerTexts).toContain('예문');
    expect(headerTexts).toContain('제출');

    // ── 5. 승인 클릭 → status='approved'로 전환 ──
    await row.locator('button:has-text("승인")').click();
    await adminPage.waitForTimeout(1200);
    await expect(adminPage.locator(`tr[data-id="${wordId}"]`)).toHaveCount(0, { timeout: 10000 });

    // API 직접 확인: status='approved'
    const get = await apiJson(`/api/vocab/words?student_id=${studentId}`, {}, token);
    const w = (get.body.data ?? get.body).find((x: any) => x.id === wordId);
    expect(w?.status).toBe('approved');

    console.log(`✅ UC-E 통과 — pending badge=${badgeN}, 승인 완료 (id=${wordId})`);
  } finally {
    await apiJson(`/api/vocab/words/${wordId}`, { method: 'DELETE' }, token).catch(() => {});
    await apiJson(`/api/gacha/students/${studentId}`, { method: 'DELETE' }, token).catch(() => {});
  }
});
