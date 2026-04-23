import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';

test.setTimeout(120000);
test.use({ baseURL: BASE });

test('영단어 관리(원본 admin.html) ERP 통합 유즈케이스', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[ERR] ${err.message}`));

  // ── 1. 로그인 페이지에서 실제 로그인 ─────────────────────────
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const opts = document.querySelectorAll('#login-academy option');
    return opts.length > 1;
  }, { timeout: 15000 });
  await page.locator('#login-academy').selectOption('e2e-test');
  await page.waitForTimeout(800);
  await page.fill('#login-name', 'E2E관리자');
  await page.fill('#login-pin', '9999');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('#/login'), { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/erp-after-login.png', fullPage: true });

  // 디버깅: 현재 URL/사이드바 텍스트 출력
  const debugInfo = await page.evaluate(() => ({
    url: window.location.href,
    sidebarHtml: document.querySelector('.app-sidebar')?.innerHTML?.slice(0, 1500),
    bodyText: document.body.innerText.slice(0, 800),
  }));
  console.log('[DEBUG]', JSON.stringify(debugInfo).slice(0, 2500));

  // ── 3. 사이드바 "학습 (영단어)" 그룹 펼치기 ─────────────────
  const vocabGroup = page.locator('button.sidebar-nav-group-toggle', { hasText: '학습 (영단어)' });
  await expect(vocabGroup, '영단어 사이드바 그룹').toBeVisible({ timeout: 8000 });
  await vocabGroup.click();

  // ── 4. "단어/문법/교재" 링크 클릭 → admin.html 로 이동 ─────
  const adminLink = page.locator('a[href="/vocab/admin.html"]');
  await expect(adminLink, 'admin.html 링크').toBeVisible();
  await Promise.all([
    page.waitForURL(/\/vocab\/admin/, { timeout: 15000 }),
    adminLink.click(),
  ]);

  // ── 5. 원본 admin.html UI 확인 ─────────────────────────────
  await page.waitForLoadState('domcontentloaded');
  const title = await page.title();
  expect(title, 'admin.html 타이틀').toContain('Word Gacha');

  // 원본 admin.html 의 핵심 DOM 요소 (학생 탭) 가 보이는지 확인
  const tabBtns = page.locator('.tab-btn, [class*="tab"], button');
  expect(await tabBtns.count(), '탭 버튼 수').toBeGreaterThan(0);

  // window.API 어댑터 동작 검증 — getStudents 호출
  const studentsResp = await page.evaluate(async () => {
    try {
      // @ts-ignore
      const list = await window.API.getStudents();
      return { ok: true, count: Array.isArray(list) ? list.length : -1 };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  });
  console.log('[GET STUDENTS]', JSON.stringify(studentsResp));
  expect(studentsResp.ok, `API.getStudents 동작 (${studentsResp.error || ''})`).toBeTruthy();

  // grammar 도 호출되는지
  const grammarResp = await page.evaluate(async () => {
    try {
      // @ts-ignore
      const g = await window.API.getGrammar();
      return { ok: true, type: typeof g };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  });
  console.log('[GET GRAMMAR]', JSON.stringify(grammarResp));
  expect(grammarResp.ok, `API.getGrammar 동작`).toBeTruthy();

  await page.screenshot({ path: '/tmp/vocab-admin-loaded.png', fullPage: true });

  console.log('\n=== LOGS ===');
  logs.slice(-30).forEach(l => console.log(l));
});
