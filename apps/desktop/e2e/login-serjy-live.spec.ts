import { test, expect } from '@playwright/test';

const BASE = 'https://wawa-smart-erp.pages.dev';

test.setTimeout(120000);
test('서재용 PIN 1141 로그인 테스트', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[ERR] ${err.message}`));
  page.on('response', async res => {
    if (res.url().includes('/api/auth/login')) {
      const body = await res.text().catch(() => '');
      logs.push(`[LOGIN RES] ${res.status()} ${body}`);
    }
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 학원 목록 로딩 대기 후 alpha 선택
  await page.waitForFunction(() => {
    const opts = document.querySelectorAll('#login-academy option');
    return opts.length > 1;
  }, { timeout: 15000 });

  const opts = await page.locator('#login-academy option').evaluateAll((els: any[]) =>
    els.map(e => ({ value: e.value, text: e.textContent }))
  );
  logs.push(`[ACADEMIES] ${JSON.stringify(opts)}`);

  await page.locator('#login-academy').selectOption('alpha');
  await page.waitForTimeout(1500);

  await page.fill('#login-name', '서재용');
  await page.fill('#login-pin', '1141');
  await page.screenshot({ path: '/tmp/before-login.png', fullPage: true });

  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  const url = page.url();
  const hash = await page.evaluate(() => window.location.hash);
  const errorBox = await page.locator('.error').textContent().catch(() => null);
  await page.screenshot({ path: '/tmp/after-login.png', fullPage: true });

  console.log('\n=== LOGS ===');
  logs.forEach(l => console.log(l));
  console.log(`\nFINAL URL: ${url}`);
  console.log(`HASH: ${hash}`);
  console.log(`ERROR: ${errorBox}`);
});
