import { test } from '@playwright/test';

test('AskAI hub screenshot', async ({ page }) => {
  // 모바일 viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('https://wawa-learn.pages.dev/#/ask-ai', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/ask-ai-mobile.png', fullPage: true });
  
  // 데스크톱
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://wawa-learn.pages.dev/#/ask-ai', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/ask-ai-desktop.png', fullPage: true });
});
