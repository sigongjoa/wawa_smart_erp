import { test } from '@playwright/test';

const API = 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';

test('AskAI Hub — 서재용/alpha 토큰 주입 → 스크린샷', async ({ page }) => {
  const res = await fetch(`${API}/api/play/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ academy_slug: 'alpha', name: '서재용', pin: '1234' }),
  });
  const body = await res.json();
  if (!body.success) throw new Error('login fail: ' + JSON.stringify(body));
  const { token, student } = body.data;

  await page.setViewportSize({ width: 390, height: 844 });

  // 앱 로드 전 주입 — restore() 가 첫 mount 때 읽음
  await page.addInitScript(({ token, student }) => {
    localStorage.setItem('play_token', token);
    localStorage.setItem('play_token_created_at', String(Date.now()));
    localStorage.setItem('play_student', JSON.stringify(student));
    localStorage.setItem('play_slug', 'alpha');
  }, { token, student });

  await page.goto('https://wawa-learn.pages.dev/#/');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/auth-home.png', fullPage: true });

  await page.goto('https://wawa-learn.pages.dev/#/ask-ai');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/auth-ask-ai.png', fullPage: true });

  await page.goto('https://wawa-learn.pages.dev/#/ask-ai/write');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/auth-ask-ai-write.png', fullPage: true });
});
