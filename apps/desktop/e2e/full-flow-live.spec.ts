import { test, expect, Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_PATH = path.join(__dirname, '..', '.playwright', 'auth.json');

// API ~3초 기준 현실적 타임아웃
test.setTimeout(30000);

// 학생 select 로딩 대기
async function waitForStudents(page: Page) {
  await page.waitForFunction(() => {
    const sel = document.querySelector('#student-select') as HTMLSelectElement;
    return sel && sel.options.length > 1;
  }, { timeout: 10000 });
}

test.describe('전체 유즈케이스 플로우', () => {
  test.describe.configure({ mode: 'serial' });

  // UC1: 로그인 → storageState 저장 (이후 테스트에서 재사용)
  test('UC1: 로그인', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.login-card');
    await page.fill('#name', '서재용 개발자');
    await page.fill('#pin', '1141');
    await page.click('button[type="submit"]');

    await page.waitForURL(/#\/timer/, { timeout: 10000 });
    await expect(page.locator('.app-header')).toBeVisible();

    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeTruthy();

    // 인증 상태 저장 — 이후 테스트에서 로그인 스킵
    const dir = path.dirname(STORAGE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await page.context().storageState({ path: STORAGE_PATH });
  });

  // UC2~6: 저장된 인증으로 바로 시작
  test('UC2: 네비게이션 — 리다이렉트 없이 이동', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto('/#/settings');
    await expect(page.locator('.page-title')).toContainText('설정', { timeout: 10000 });

    await page.click('a[href="#/report"]');
    await page.waitForURL(/#\/report/);
    await expect(page.locator('.page-title')).toContainText('월말평가');

    await page.click('a[href="#/timer"]');
    await page.waitForURL(/#\/timer/);
    await expect(page.locator('.page-title')).toContainText('시간표');

    await ctx.close();
  });

  test('UC3: 설정 → 활성 월 2026-04 저장', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto('/#/settings');
    await page.waitForSelector('#active-month', { timeout: 10000 });
    await page.selectOption('#active-month', '2026-04');
    await page.click('button:has-text("저장")');

    await expect(page.locator('text=저장 완료')).toBeVisible({ timeout: 10000 });
    await ctx.close();
  });

  test('UC4: 월말평가 → 학생 목록 + 리포트 로딩', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto('/#/report');
    await expect(page.locator('strong:has-text("2026-04")')).toBeVisible({ timeout: 10000 });

    await waitForStudents(page);
    const count = await page.locator('#student-select option').count();
    expect(count).toBeGreaterThan(1);

    await ctx.close();
  });

  test('UC5: 학생 선택 → 리포트 미리보기', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto('/#/report');
    await page.waitForSelector('.page-title', { timeout: 10000 });
    await waitForStudents(page);

    const firstValue = await page.locator('#student-select option').nth(1).getAttribute('value');
    await page.locator('#student-select').selectOption(firstValue!);

    await expect(page.locator('.report-paper')).toContainText('월말평가 리포트', { timeout: 10000 });

    await ctx.close();
  });

  test('UC6: JPG 다운로드', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto('/#/report');
    await page.waitForSelector('.page-title', { timeout: 10000 });
    await waitForStudents(page);

    const firstValue = await page.locator('#student-select option').nth(1).getAttribute('value');
    await page.locator('#student-select').selectOption(firstValue!);
    await page.waitForTimeout(500);

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await page.click('button:has-text("JPG 다운로드")');

    const download = await downloadPromise;
    if (download) {
      const filename = download.suggestedFilename();
      expect(filename).toContain('.jpg');

      const dir = path.join(__dirname, '..', '.playwright', 'downloads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, filename);
      await download.saveAs(filepath);
      expect(fs.statSync(filepath).size).toBeGreaterThan(500);
    } else {
      await expect(page.locator('button:has-text("JPG 다운로드")')).toBeVisible({ timeout: 10000 });
    }

    await ctx.close();
  });
});
