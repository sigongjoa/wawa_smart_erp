import { test, expect } from '@playwright/test';

// Production(master) 브랜치 alias
const APP = 'https://wawa-smart-erp.pages.dev';

test.setTimeout(90000);

test(`Production '담임 대시보드' 사이드바 노출 @ ${APP}`, async ({ page }) => {
  await page.goto(APP, { waitUntil: 'networkidle' });

  await page.locator('select').first().selectOption({ label: '알파시티점' });
  await page.getByPlaceholder('이름을 입력하세요').fill('서재용');
  await page.getByPlaceholder('PIN을 입력하세요').fill('1141');
  await page.getByRole('button', { name: '로그인' }).click();

  await page.waitForURL(/#\/timer$|#\/$/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle');

  const studentToggle = page
    .locator('.sidebar-nav-group-toggle')
    .filter({ hasText: '학생' })
    .first();
  await studentToggle.waitFor({ state: 'visible', timeout: 10000 });
  await studentToggle.click();

  const homeroomLink = page.getByRole('link', { name: '담임 대시보드' });
  await homeroomLink.first().waitFor({ state: 'visible', timeout: 10000 });

  const sidebarHtml = await page.locator('.app-sidebar').innerHTML();
  const hasLabel = sidebarHtml.includes('담임 대시보드');
  console.log(`[prod] sidebar has '담임 대시보드'? ${hasLabel}`);

  await page.screenshot({ path: 'homeroom-sidebar-prod.png', fullPage: true });

  expect(hasLabel).toBeTruthy();
});
