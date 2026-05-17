/**
 * 보강 관리 집중 스크린샷
 */
import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'https://wawa-smart-erp.pages.dev';
const OUT = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots', 'usecase');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page: any, name: string, fullPage = false) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  ✅ ${name}.png`);
}

test.describe('Makeup Screenshots', () => {
  test.setTimeout(300_000);

  test('capture makeup', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const sel = page.locator('select').first();
    if (await sel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sel.selectOption({ value: 'test-canyon' });
      await page.waitForTimeout(400);
    }
    await page.locator('#login-name').fill('하이머딩거');
    await page.locator('#login-pin').fill('1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);

    // 보강 관리 메인 (전체)
    await page.goto(`${BASE}/#/absence`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shot(page, 'uc-makeup-overview', true);

    // 미보강 필터
    const pendingBtn = page.locator('button:has-text("미보강"), [data-status="pending"]').first();
    if (await pendingBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pendingBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, 'uc-makeup-pending');
    }

    // 보강예정 필터
    const scheduledBtn = page.locator('button:has-text("보강예정"), [data-status="scheduled"]').first();
    if (await scheduledBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await scheduledBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, 'uc-makeup-scheduled');
    }

    // 보강완료 필터
    const completedBtn = page.locator('button:has-text("보강완료"), [data-status="completed"]').first();
    if (await completedBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await completedBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, 'uc-makeup-completed');
    }

    console.log(`✅ Saved to ${OUT}`);
  });
});
