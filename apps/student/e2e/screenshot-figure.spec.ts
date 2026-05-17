/**
 * figure step (points-2d) 시각 검증.
 * 그래프가 SVG 로 실제 렌더되는지 확인.
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

const QUESTIONS = [
  { id: 'fig-1', q: '정규분포 종 모양 곡선을 그림으로 그려줘' },
  { id: 'fig-2', q: 'y=sin(x) 한 주기 그림으로 그려줘' },
  { id: 'fig-3', q: 'y = x^2 - 4 의 그래프를 그리고 근의 위치를 점으로 표시해줘' },
];

const RESULTS: Array<any> = [];

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

test.beforeAll(() => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
});

for (const Q of QUESTIONS) {
  test(`${Q.id}: "${Q.q}"`, async ({ page }) => {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/ask-ai/write`);
    await page.waitForTimeout(2000);

    const textarea = page.locator('.ask-viewport .composer textarea');
    await textarea.fill(Q.q);

    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/ask-ai/ask'),
      { timeout: 60000 },
    );
    await page.locator('.ask-viewport .composer button[type="submit"]').click();
    const resp = await respPromise;

    let body: any = null;
    try { body = await resp.json(); } catch {}

    await page.waitForTimeout(3500);
    const screenshot = `figure-${Q.id}.png`;
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });

    const svgCount = await page.locator('.ask-viewport main svg').count();
    const figureCount = await page.locator('.ask-viewport main .figure').count();

    const result = {
      id: Q.id,
      question: Q.q,
      http_status: resp.status(),
      success: body?.success ?? false,
      step_count: body?.data?.response?.steps?.length ?? 0,
      figure_in_response: body?.data?.response?.steps?.filter((s: any) => s.kind === 'figure').length ?? 0,
      svg_rendered: svgCount,
      figure_dom: figureCount,
      screenshot,
    };
    RESULTS.push(result);
    fs.writeFileSync(path.join(OUT, 'figure-result.json'), JSON.stringify(RESULTS, null, 2));

    console.log(`[${Q.id}] HTTP=${resp.status()} steps=${result.step_count} figures=${result.figure_in_response} svg=${svgCount}`);
  });
}
