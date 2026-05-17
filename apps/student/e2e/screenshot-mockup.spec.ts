import { test } from '@playwright/test';

test('mockup hub screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('https://wawa-mockups.pages.dev/mobile-home.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/mockup-hub-mobile.png', fullPage: true });
});

test('login screenshot for ref', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('https://wawa-learn.pages.dev/#/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/login-mobile.png', fullPage: true });
});
