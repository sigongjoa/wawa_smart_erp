import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIR = path.join(__dirname, '..', 'test-downloads');
const BASE = 'http://localhost:5173';

test('디버그: 로그인 전체 과정 추적', async ({ page }) => {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

  // 모든 콘솔 로그 수집
  page.on('console', msg => console.log(`[BROWSER ${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

  // 네트워크 요청/응답 추적
  page.on('request', req => {
    if (req.url().includes('8787')) console.log(`[REQ] ${req.method()} ${req.url()}`);
  });
  page.on('response', res => {
    if (res.url().includes('8787')) console.log(`[RES] ${res.status()} ${res.url()}`);
  });
  page.on('requestfailed', req => {
    if (req.url().includes('8787')) console.log(`[FAIL] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // localStorage 정리 후 재로드
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 로그인
  console.log('\n--- 로그인 시도 ---');
  await page.fill('input[placeholder="예: 김상현"]', '서재용 개발자');
  await page.fill('input[placeholder="PIN을 입력하세요"]', '1141');
  await page.click('button:has-text("로그인")');

  // 15초 대기하면서 상태 변화 추적
  for (let i = 1; i <= 5; i++) {
    await page.waitForTimeout(3000);
    const hash = await page.evaluate(() => window.location.hash);
    const btnText = await page.locator('button[type="submit"]').textContent().catch(() => 'N/A');
    console.log(`[${i*3}s] hash=${hash} btn="${btnText?.trim()}"`);
  }

  await page.screenshot({ path: path.join(DIR, 'debug-login-final.png'), fullPage: true });
});
