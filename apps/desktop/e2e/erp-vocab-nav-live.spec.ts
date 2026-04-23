/**
 * ERP 관리자가 사이드바 "학습 (영단어)" 링크 클릭 시
 * 학생 게임이 아닌 선생님 관리 페이지(admin.html)가 정상 로드되는지 검증.
 *
 * 재현한 버그: React 앱은 token을 'auth_access_token' 키로 저장하는데
 * admin.html의 api.js는 'accessToken' 키로 읽어 → 항상 null → /#/login으로 튕김
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';
const API = process.env.API || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};

test.setTimeout(120_000);
test.use({ baseURL: BASE });

test('ERP 관리자가 "학습(영단어)" 링크 → admin.html 정상 로드 (로그인으로 안 튕김)', async ({ page }) => {
  // 1. ERP에 UI로 로그인
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const opts = document.querySelectorAll('#login-academy option');
    return opts.length > 1;
  }, { timeout: 15_000 });
  await page.locator('#login-academy').selectOption(TEACHER.slug);
  await page.waitForTimeout(600);
  await page.fill('#login-name', TEACHER.name);
  await page.fill('#login-pin', TEACHER.pin);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('#/login'), { timeout: 15_000 });

  // 2. localStorage에 token이 실제로 어디 있는지 기록 (디버깅)
  const storage = await page.evaluate(() => ({
    auth_access_token: localStorage.getItem('auth_access_token'),
    accessToken: localStorage.getItem('accessToken'),
  }));
  console.log('[LOCALSTORAGE]', JSON.stringify({
    has_auth_access_token: !!storage.auth_access_token,
    has_accessToken: !!storage.accessToken,
  }));

  // 3. 사이드바 "학습 (영단어)" 그룹 펼치기
  const vocabGroup = page.locator('button.sidebar-nav-group-toggle', { hasText: '학습 (영단어)' });
  await expect(vocabGroup).toBeVisible({ timeout: 10_000 });
  await vocabGroup.click();

  // 4. "단어/문법/교재" 링크 클릭 → admin.html 로드
  const adminLink = page.locator('a[href="/vocab/admin.html"]');
  await expect(adminLink).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/vocab\/admin/, { timeout: 15_000 }),
    adminLink.click(),
  ]);
  await page.waitForLoadState('domcontentloaded');

  // 5. 3초 뒤 URL 재확인 — /#/login으로 튕겼으면 버그 남아 있음
  await page.waitForTimeout(3000);
  const finalUrl = page.url();
  console.log('[FINAL URL]', finalUrl);

  expect(finalUrl, '관리자가 로그인 페이지로 튕기면 안 됨').not.toContain('#/login');
  await expect(page).toHaveTitle(/Word Gacha/);

  // 6. 선생님 UI의 핵심 DOM이 떠야 함 (사이드바가 아니라 vocab admin의 탭)
  await expect(page.locator('.tab[data-tab="words"]')).toBeVisible({ timeout: 10_000 });

  // 7. API 실제 호출이 성공하는지 (쿠키 credentials 경로)
  const studentsResp = await page.evaluate(async () => {
    try {
      // @ts-ignore
      const list = await window.API.getStudents();
      return { ok: true, count: Array.isArray(list) ? list.length : -1 };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  });
  console.log('[API.getStudents]', JSON.stringify(studentsResp));
  expect(studentsResp.ok, `API 호출 실패: ${studentsResp.error}`).toBeTruthy();

  console.log('✅ ERP 네비게이션 정상 — admin.html 로드 + API 성공');
});
