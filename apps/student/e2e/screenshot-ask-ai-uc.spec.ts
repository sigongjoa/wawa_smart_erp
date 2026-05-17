/**
 * AskAI 실제 유즈케이스 E2E
 *
 * UC-A: 로그인 → /ask-ai Hub 렌더 (avatar/단원/quota/CTA)
 * UC-B: Hub → "글로 묻기" → /ask-ai/write 진입
 * UC-C: write → 질문 제출 → AI 응답 (KaTeX 수식 포함)
 * UC-D: Hub → "사진으로 묻기" → /ask-ai/photo 진입
 * UC-E: /drill 카드 페이지 렌더
 * UC-F: 401 처리 — 잘못된 토큰 → /login 리다이렉트
 * UC-G: 탭바 네비게이션 — Hub에서 다른 탭으로 이동 가능
 */
import { test, expect } from '@playwright/test';

const API = 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';
const SITE = 'https://wawa-learn.pages.dev';

async function loginAndInject(page: any) {
  const r = await fetch(`${API}/api/play/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ academy_slug: 'alpha', name: '서재용', pin: '1234' }),
  });
  const body = await r.json() as any;
  if (!body.success) throw new Error('login fail: ' + JSON.stringify(body));
  const { token, student } = body.data;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ token, student }: any) => {
    localStorage.setItem('play_token', token);
    localStorage.setItem('play_token_created_at', String(Date.now()));
    localStorage.setItem('play_student', JSON.stringify(student));
    localStorage.setItem('play_slug', 'alpha');
  }, { token, student });
  return { token, student };
}

test.describe('AskAI UC suite', () => {
  test('UC-A: /ask-ai Hub 렌더 (인증·헤더·quota·CTA·탭바)', async ({ page }) => {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: '/tmp/uc-a-hub.png', fullPage: true });

    await expect(page.locator('.ah-greeting h1')).toContainText('서재용');
    await expect(page.locator('.ah-hero h2')).toBeVisible();
    await expect(page.locator('.ah-quota')).toBeVisible();
    await expect(page.locator('.ah-hero-actions button').first()).toBeVisible();
    // 탭바
    const tabbar = page.locator('nav, footer').filter({ hasText: '홈' }).first();
    await expect(tabbar).toBeVisible();
  });

  test('UC-B: Hub → "글로 묻기" → /ask-ai/write 진입', async ({ page }) => {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(2000);
    await page.click('.ah-hero-actions button:has-text("글로 묻기")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/uc-b-write-empty.png', fullPage: true });

    expect(page.url()).toContain('/ask-ai/write');
    await expect(page.locator('.ask-viewport .composer textarea')).toBeVisible();
  });

  test('UC-C: write → 질문 제출 → AI 응답 (KaTeX)', async ({ page }) => {
    await loginAndInject(page);

    page.on('response', async (r) => {
      if (r.url().includes('/api/ask-ai/')) {
        console.log(`[NET] ${r.status()} ${r.url().split('/api/')[1]}`);
      }
    });

    await page.goto(`${SITE}/#/ask-ai/write`);
    await page.waitForTimeout(2000);

    const textarea = page.locator('.ask-viewport .composer textarea');
    await textarea.click();
    await textarea.fill('표본평균의 분산이 왜 σ²/n 인지 한 줄로 설명');
    await page.waitForTimeout(300);

    // race-free 응답 대기 (click 전에 등록)
    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/ask-ai/ask'),
      { timeout: 60000 },
    );
    await page.locator('.ask-viewport .composer button[type="submit"]').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/uc-c-loading.png', fullPage: true });

    const resp = await respPromise;
    console.log(`[UC-C] /ask response status=${resp.status()}`);
    await page.waitForTimeout(3000); // KaTeX 렌더 대기
    await page.screenshot({ path: '/tmp/uc-c-result.png', fullPage: true });

    if (resp.status() === 429) {
      // burst-limit 도달 — UC 자체는 client behavior 검증으로 변경
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).toMatch(/잠시 후|오류|429/);
      return;
    }
    expect(resp.status()).toBe(200);

    // step 1개 이상 렌더 (article.question 외에 step 카드)
    const stepCount = await page.locator('.ask-viewport main article, .ask-viewport main .step').count();
    expect(stepCount).toBeGreaterThan(1); // 질문 카드 + 응답 step
  });

  test('UC-D: Hub → "사진으로 묻기" → /ask-ai/photo', async ({ page }) => {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(2000);
    await page.click('.ah-hero-actions button:has-text("사진으로 묻기")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/uc-d-photo.png', fullPage: true });

    expect(page.url()).toContain('/ask-ai/photo');
  });

  test('UC-E: /drill 카드 페이지 렌더', async ({ page }) => {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/drill`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: '/tmp/uc-e-drill.png', fullPage: true });
    // page renders without crash (root has at least 1 visible element)
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('UC-F: 401 처리 — 잘못된 토큰 → /login 리다이렉트', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('play_token', 'bogus-token-uuid');
      localStorage.setItem('play_token_created_at', String(Date.now()));
      localStorage.setItem('play_student', JSON.stringify({ id: 'fake', name: 'X', grade: null }));
      localStorage.setItem('play_slug', 'alpha');
    });

    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/uc-f-401-redirect.png', fullPage: true });

    // 401 → askAI client가 localStorage clear + /login 리다이렉트
    expect(page.url()).toContain('/login');
  });

  test('UC-G: 탭바 네비 — Hub → 학습 → 도감 → 나', async ({ page }) => {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(2000);

    // 학습 탭 클릭
    await page.click('text=학습');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/uc-g-learn.png', fullPage: true });
    expect(page.url()).toMatch(/assignments|learn/);

    // 도감
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(1500);
    await page.click('text=도감');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/uc-g-dex.png', fullPage: true });
    expect(page.url()).toContain('/dex');

    // 나
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(1500);
    await page.click('text=나');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/uc-g-me.png', fullPage: true });
    expect(page.url()).toContain('/me');
  });
});
