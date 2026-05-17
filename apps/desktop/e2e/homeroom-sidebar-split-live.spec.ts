import { test, expect } from '@playwright/test';

const APP = 'https://wawa-smart-erp.pages.dev';

test.setTimeout(90000);

test(`Production '담임' 그룹 + 4개 하위 페이지 @ ${APP}`, async ({ page }) => {
  await page.goto(APP, { waitUntil: 'networkidle' });

  await page.locator('select').first().selectOption({ label: '알파시티점' });
  await page.getByPlaceholder('이름을 입력하세요').fill('서재용');
  await page.getByPlaceholder('PIN을 입력하세요').fill('1141');
  await page.getByRole('button', { name: '로그인' }).click();

  await page.waitForURL(/#\/timer$|#\/$/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle');

  const homeroomToggle = page
    .locator('.sidebar-nav-group-toggle')
    .filter({ hasText: '담임' })
    .first();
  await homeroomToggle.waitFor({ state: 'visible', timeout: 10000 });
  await homeroomToggle.click();

  const labels = ['대시보드', '학부모 상담', '후속 상담', '시험 전후 상담'];
  for (const label of labels) {
    const link = page.locator('.sidebar-nav-sub a').filter({ hasText: label }).first();
    await link.waitFor({ state: 'visible', timeout: 5000 });
    console.log(`[prod] 담임 sidebar has '${label}' ✓`);
  }

  await page.locator('.sidebar-nav-sub a').filter({ hasText: '학부모 상담' }).first().click();
  await page.waitForURL(/#\/homeroom\/consultations/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: '학부모 상담' })).toBeVisible();

  await page.locator('.sidebar-nav-sub a').filter({ hasText: '후속 상담' }).first().click();
  await page.waitForURL(/#\/homeroom\/follow-ups/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: '후속 상담' })).toBeVisible();

  await page.locator('.sidebar-nav-sub a').filter({ hasText: '시험 전후 상담' }).first().click();
  await page.waitForURL(/#\/homeroom\/exams/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: '시험 전후 상담' })).toBeVisible();

  await page.screenshot({ path: 'homeroom-sidebar-split-prod.png', fullPage: true });
});
