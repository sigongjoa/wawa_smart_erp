/**
 * AskAI UC 보고서용 — 스크린샷을 e2e/uc-report/ 에 저장 + result.json 기록
 *
 * 실행: npx playwright test e2e/screenshot-uc-report.spec.ts --project=chromium --workers=1
 * 결과: e2e/uc-report/{uc-name}.png + result.json
 */
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API = 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';
const SITE = 'https://wawa-learn.pages.dev';
const OUT = path.join(__dirname, 'uc-report');

const RESULTS: Array<{
  uc: string;
  desc: string;
  status: 'PASS' | 'FAIL';
  screenshot: string;
  network?: Array<{ url: string; status: number }>;
  assertions: Array<{ check: string; ok: boolean; detail?: string }>;
  url?: string;
  error?: string;
}> = [];

function record(r: typeof RESULTS[0]) {
  RESULTS.push(r);
  fs.writeFileSync(
    path.join(OUT, 'result.json'),
    JSON.stringify({ generated_at: new Date().toISOString(), site: SITE, results: RESULTS }, null, 2),
  );
}

async function loginAndInject(page: any) {
  const r = await fetch(`${API}/api/play/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ academy_slug: 'alpha', name: '서재용', pin: '1234' }),
  });
  const body = await r.json() as any;
  const { token, student } = body.data;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ token, student }: any) => {
    localStorage.setItem('play_token', token);
    localStorage.setItem('play_token_created_at', String(Date.now()));
    localStorage.setItem('play_student', JSON.stringify(student));
    localStorage.setItem('play_slug', 'alpha');
  }, { token, student });
}

function netListener(page: any) {
  const log: Array<{ url: string; status: number }> = [];
  page.on('response', (r: any) => {
    if (r.url().includes('/api/ask-ai/') || r.url().includes('/api/play/')) {
      log.push({ url: r.url().split('zeskywa499.workers.dev')[1] || r.url(), status: r.status() });
    }
  });
  return log;
}

test.beforeAll(() => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  RESULTS.length = 0;
});

test('UC-A: /ask-ai Hub 렌더', async ({ page }) => {
  const net = netListener(page);
  const assertions: any[] = [];
  let status: 'PASS' | 'FAIL' = 'PASS';
  let err: string | undefined;
  try {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(2500);
    const screenshot = 'uc-a-hub.png';
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });

    const greeting = await page.locator('.ah-greeting h1').textContent();
    assertions.push({ check: '인사 텍스트에 학생 이름', ok: !!greeting?.includes('서재용'), detail: greeting ?? '' });

    assertions.push({ check: '히어로 섹션 표시', ok: await page.locator('.ah-hero h2').isVisible() });
    assertions.push({ check: 'quota 바 표시', ok: await page.locator('.ah-quota').isVisible() });
    assertions.push({ check: 'CTA 2개 (사진/글)', ok: (await page.locator('.ah-hero-actions button').count()) === 2 });

    const tabbar = page.locator('nav, footer').filter({ hasText: '홈' }).first();
    assertions.push({ check: '하단 탭바 표시', ok: await tabbar.isVisible() });

    if (assertions.some((a) => !a.ok)) status = 'FAIL';
    record({ uc: 'UC-A', desc: 'Hub 렌더 (헤더·CTA·quota·탭바)', status, screenshot, network: net, assertions, url: page.url() });
    expect(status).toBe('PASS');
  } catch (e: any) {
    err = e.message;
    record({ uc: 'UC-A', desc: 'Hub 렌더', status: 'FAIL', screenshot: 'uc-a-hub.png', network: net, assertions, error: err });
    throw e;
  }
});

test('UC-B: 글로 묻기 → /write 진입', async ({ page }) => {
  const net = netListener(page);
  const assertions: any[] = [];
  let status: 'PASS' | 'FAIL' = 'PASS';
  try {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(2000);
    await page.click('.ah-hero-actions button:has-text("글로 묻기")');
    await page.waitForTimeout(1500);
    const screenshot = 'uc-b-write.png';
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });

    assertions.push({ check: 'URL이 /ask-ai/write', ok: page.url().includes('/ask-ai/write'), detail: page.url() });
    assertions.push({ check: 'composer textarea 표시', ok: await page.locator('.ask-viewport .composer textarea').isVisible() });
    assertions.push({ check: '카메라 버튼 표시', ok: await page.locator('.ask-viewport .composer button').first().isVisible() });

    if (assertions.some((a) => !a.ok)) status = 'FAIL';
    record({ uc: 'UC-B', desc: '글로 묻기 → /write', status, screenshot, network: net, assertions, url: page.url() });
    expect(status).toBe('PASS');
  } catch (e: any) {
    record({ uc: 'UC-B', desc: '글로 묻기 → /write', status: 'FAIL', screenshot: 'uc-b-write.png', network: net, assertions, error: e.message });
    throw e;
  }
});

test('UC-C: 질문 제출 → AI 응답 + KaTeX', async ({ page }) => {
  const net = netListener(page);
  const assertions: any[] = [];
  let status: 'PASS' | 'FAIL' = 'PASS';
  try {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai/write`);
    await page.waitForTimeout(2000);

    const textarea = page.locator('.ask-viewport .composer textarea');
    await textarea.click();
    await textarea.fill('표본평균의 분산이 왜 σ²/n 인지 한 줄로 설명');

    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/ask-ai/ask'),
      { timeout: 60000 },
    );
    await page.locator('.ask-viewport .composer button[type="submit"]').click();
    const resp = await respPromise;
    assertions.push({ check: 'POST /api/ask-ai/ask 응답 200', ok: resp.status() === 200, detail: `status=${resp.status()}` });

    await page.waitForTimeout(3500); // KaTeX render
    const screenshot = 'uc-c-result.png';
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });

    const stepCount = await page.locator('.ask-viewport main article, .ask-viewport main .step').count();
    assertions.push({ check: '응답 step 카드 ≥ 2 (질문+응답)', ok: stepCount >= 2, detail: `count=${stepCount}` });

    const katexCount = await page.locator('.katex').count();
    assertions.push({ check: 'KaTeX 수식 렌더', ok: katexCount > 0, detail: `katex=${katexCount}` });

    if (assertions.some((a) => !a.ok)) status = 'FAIL';
    record({ uc: 'UC-C', desc: '질문 제출 → AI 응답 + KaTeX', status, screenshot, network: net, assertions, url: page.url() });
    expect(status).toBe('PASS');
  } catch (e: any) {
    record({ uc: 'UC-C', desc: '질문 제출 → AI 응답', status: 'FAIL', screenshot: 'uc-c-result.png', network: net, assertions, error: e.message });
    throw e;
  }
});

test('UC-D: 사진으로 묻기 → /photo', async ({ page }) => {
  const net = netListener(page);
  const assertions: any[] = [];
  let status: 'PASS' | 'FAIL' = 'PASS';
  try {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(2000);
    await page.click('.ah-hero-actions button:has-text("사진으로 묻기")');
    await page.waitForTimeout(1500);
    const screenshot = 'uc-d-photo.png';
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });

    assertions.push({ check: 'URL이 /ask-ai/photo', ok: page.url().includes('/ask-ai/photo'), detail: page.url() });

    if (assertions.some((a) => !a.ok)) status = 'FAIL';
    record({ uc: 'UC-D', desc: '사진으로 묻기 → /photo', status, screenshot, network: net, assertions, url: page.url() });
    expect(status).toBe('PASS');
  } catch (e: any) {
    record({ uc: 'UC-D', desc: '사진 묻기 → /photo', status: 'FAIL', screenshot: 'uc-d-photo.png', network: net, assertions, error: e.message });
    throw e;
  }
});

test('UC-E: /drill 카드 페이지', async ({ page }) => {
  const net = netListener(page);
  const assertions: any[] = [];
  let status: 'PASS' | 'FAIL' = 'PASS';
  try {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/drill`);
    await page.waitForTimeout(2500);
    const screenshot = 'uc-e-drill.png';
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });

    const text = await page.locator('body').innerText();
    assertions.push({ check: '페이지 렌더 (body 텍스트 존재)', ok: text.length > 0, detail: `len=${text.length}` });
    assertions.push({ check: '"오늘 복습" 헤더 존재', ok: text.includes('오늘 복습'), detail: text.slice(0, 50) });

    if (assertions.some((a) => !a.ok)) status = 'FAIL';
    record({ uc: 'UC-E', desc: '/drill 카드 페이지', status, screenshot, network: net, assertions, url: page.url() });
    expect(status).toBe('PASS');
  } catch (e: any) {
    record({ uc: 'UC-E', desc: '/drill 카드 페이지', status: 'FAIL', screenshot: 'uc-e-drill.png', network: net, assertions, error: e.message });
    throw e;
  }
});

test('UC-F: bogus 토큰 → /login 리다이렉트', async ({ page }) => {
  const net = netListener(page);
  const assertions: any[] = [];
  let status: 'PASS' | 'FAIL' = 'PASS';
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('play_token', 'bogus-token-uuid');
      localStorage.setItem('play_token_created_at', String(Date.now()));
      localStorage.setItem('play_student', JSON.stringify({ id: 'fake', name: 'X', grade: null }));
      localStorage.setItem('play_slug', 'alpha');
    });
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(3000);
    const screenshot = 'uc-f-401.png';
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });

    assertions.push({ check: 'URL이 /login 으로 리다이렉트', ok: page.url().includes('/login'), detail: page.url() });
    const tokenAfter = await page.evaluate(() => localStorage.getItem('play_token'));
    assertions.push({ check: 'localStorage play_token 제거됨', ok: tokenAfter === null, detail: `remained=${tokenAfter}` });

    if (assertions.some((a) => !a.ok)) status = 'FAIL';
    record({ uc: 'UC-F', desc: 'bogus 토큰 → /login', status, screenshot, network: net, assertions, url: page.url() });
    expect(status).toBe('PASS');
  } catch (e: any) {
    record({ uc: 'UC-F', desc: 'bogus 토큰 → /login', status: 'FAIL', screenshot: 'uc-f-401.png', network: net, assertions, error: e.message });
    throw e;
  }
});

test('UC-G1: 탭 → 학습', async ({ page }) => {
  const net = netListener(page);
  const assertions: any[] = [];
  let status: 'PASS' | 'FAIL' = 'PASS';
  try {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(2000);
    await page.click('text=학습');
    await page.waitForTimeout(1500);
    const screenshot = 'uc-g-learn.png';
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });
    assertions.push({ check: 'URL이 /assignments 또는 /learn', ok: /assignments|learn/.test(page.url()), detail: page.url() });
    if (assertions.some((a) => !a.ok)) status = 'FAIL';
    record({ uc: 'UC-G1', desc: '탭 학습 이동', status, screenshot, network: net, assertions, url: page.url() });
    expect(status).toBe('PASS');
  } catch (e: any) {
    record({ uc: 'UC-G1', desc: '탭 학습 이동', status: 'FAIL', screenshot: 'uc-g-learn.png', network: net, assertions, error: e.message });
    throw e;
  }
});

test('UC-G2: 탭 → 도감', async ({ page }) => {
  const net = netListener(page);
  const assertions: any[] = [];
  let status: 'PASS' | 'FAIL' = 'PASS';
  try {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(2000);
    await page.click('text=도감');
    await page.waitForTimeout(1500);
    const screenshot = 'uc-g-dex.png';
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });
    assertions.push({ check: 'URL이 /dex', ok: page.url().includes('/dex'), detail: page.url() });
    if (assertions.some((a) => !a.ok)) status = 'FAIL';
    record({ uc: 'UC-G2', desc: '탭 도감 이동', status, screenshot, network: net, assertions, url: page.url() });
    expect(status).toBe('PASS');
  } catch (e: any) {
    record({ uc: 'UC-G2', desc: '탭 도감 이동', status: 'FAIL', screenshot: 'uc-g-dex.png', network: net, assertions, error: e.message });
    throw e;
  }
});

test('UC-G3: 탭 → 나', async ({ page }) => {
  const net = netListener(page);
  const assertions: any[] = [];
  let status: 'PASS' | 'FAIL' = 'PASS';
  try {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai`);
    await page.waitForTimeout(2000);
    await page.click('text=나');
    await page.waitForTimeout(1500);
    const screenshot = 'uc-g-me.png';
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });
    assertions.push({ check: 'URL이 /me', ok: page.url().includes('/me'), detail: page.url() });
    if (assertions.some((a) => !a.ok)) status = 'FAIL';
    record({ uc: 'UC-G3', desc: '탭 나 이동', status, screenshot, network: net, assertions, url: page.url() });
    expect(status).toBe('PASS');
  } catch (e: any) {
    record({ uc: 'UC-G3', desc: '탭 나 이동', status: 'FAIL', screenshot: 'uc-g-me.png', network: net, assertions, error: e.message });
    throw e;
  }
});
