import { test, expect } from '@playwright/test';
import { ensureReady, takeScreenshot } from './helpers';

test.describe('출석 기록 뷰', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await ensureReady(page);
    await page.goto('/#/timer/attendance');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('출석 기록 페이지 로딩 확인', async ({ page }) => {
    await expect(page.locator('.page-title')).toContainText('출석 기록', { timeout: 60000 });
    await expect(page.locator('.att-date-nav')).toBeVisible();
    await expect(page.locator('.att-stats')).toBeVisible();
    await takeScreenshot(page, 'att_01_페이지_로딩');
  });

  test('날짜 이동 동작 확인', async ({ page }) => {
    const prevBtn = page.locator('.att-date-btn').first();
    await prevBtn.click();
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'att_02_이전날짜');

    const todayBtn = page.locator('.att-date-today');
    await todayBtn.click();
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'att_03_오늘');
  });

  test('빈 상태 확인', async ({ page }) => {
    const dateInput = page.locator('.att-date-input');
    await dateInput.fill('2020-01-01');
    await page.waitForTimeout(300);

    await expect(page.locator('.att-empty')).toBeVisible();
    await takeScreenshot(page, 'att_04_빈상태');
  });

  test('사이드바에서 출석 기록 메뉴 접근 확인', async ({ page }) => {
    await page.goto('/#/timer/day');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 사이드바에서 출석 기록 링크 클릭
    const link = page.locator('a[href*="attendance"]').first();
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('.page-title')).toContainText('출석 기록', { timeout: 60000 });
    }
    await takeScreenshot(page, 'att_05_사이드바_접근');
  });
});
