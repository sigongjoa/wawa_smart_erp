import { test } from '@playwright/test';

const API = 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';
const SITE = 'https://wawa-learn.pages.dev';

test('AskAI 전체 플로우 — 로그인+/ask-ai/write+질문 보내기', async ({ page }) => {
  // ── 1. login ──
  const r = await fetch(`${API}/api/play/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ academy_slug: 'alpha', name: '서재용', pin: '1234' }),
  });
  const lb = await r.json();
  const { token, student } = lb.data;

  // ── 2. token 주입 ──
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ token, student }) => {
    localStorage.setItem('play_token', token);
    localStorage.setItem('play_token_created_at', String(Date.now()));
    localStorage.setItem('play_student', JSON.stringify(student));
    localStorage.setItem('play_slug', 'alpha');
  }, { token, student });

  // 네트워크 응답 캐치
  page.on('response', async (resp) => {
    if (resp.url().includes('/api/ask-ai/')) {
      console.log(`[NET] ${resp.status()} ${resp.url()}`);
      try {
        const body = await resp.text();
        console.log(`[BODY] ${body.slice(0, 300)}`);
      } catch {}
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[CONSOLE.${msg.type()}]`, msg.text().slice(0, 200));
    }
  });

  // ── 3. /ask-ai/write 진입 ──
  await page.goto(`${SITE}/#/ask-ai/write`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/flow-1-write-empty.png', fullPage: true });

  // ── 4. 질문 입력 + send ──
  const textarea = page.locator('.ask-viewport .composer textarea');
  await textarea.click();
  await textarea.fill('표본평균 분산이 왜 σ²/n 인가요?');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/flow-2-typed.png', fullPage: true });

  // submit
  await page.locator('.ask-viewport .composer button[type="submit"]').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/flow-3-loading.png', fullPage: true });

  // 응답 대기 (Gemini ~5-15s)
  await page.waitForTimeout(15000);
  await page.screenshot({ path: '/tmp/flow-4-result.png', fullPage: true });
});
