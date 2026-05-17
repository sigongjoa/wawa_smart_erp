/**
 * 실제 컨텐츠 검증 — AI 답변 품질 + 숙제 플로우
 *
 * AI-1, AI-2, AI-3: 서로 다른 수학 질문 3건. 응답 step 카드 텍스트 추출 + KaTeX 카운트 + 응답 품질 휴리스틱.
 * HW-1: /assignments 목록 진입
 * HW-2: 숙제 상세 진입 (서재용 학생에 발행된 asn-* 클릭)
 *
 * 출력: e2e/uc-report/content-{id}.png + content-result.json
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

interface AIResult {
  id: string;
  question: string;
  status: 'PASS' | 'FAIL';
  http_status?: number;
  step_count?: number;
  katex_count?: number;
  response_text?: string;     // 첫 explain step의 본문
  steps_summary?: Array<{ kind: string; title?: string; question?: string; preview?: string }>;
  screenshot: string;
  assertions: Array<{ check: string; ok: boolean; detail?: string }>;
  error?: string;
}

interface HWResult {
  id: string;
  desc: string;
  status: 'PASS' | 'FAIL';
  screenshot: string;
  url?: string;
  assertions: Array<{ check: string; ok: boolean; detail?: string }>;
  found_assignments?: number;
  error?: string;
}

const AI_RESULTS: AIResult[] = [];
const HW_RESULTS: HWResult[] = [];

function flush() {
  fs.writeFileSync(
    path.join(OUT, 'content-result.json'),
    JSON.stringify({
      generated_at: new Date().toISOString(),
      site: SITE,
      ai: AI_RESULTS,
      homework: HW_RESULTS,
    }, null, 2),
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
  return token;
}

async function askAndCapture(page: any, id: string, question: string): Promise<AIResult> {
  const result: AIResult = {
    id, question, status: 'PASS',
    screenshot: `content-${id}.png`,
    assertions: [],
  };
  try {
    await page.goto(`${SITE}/#/ask-ai/write`);
    await page.waitForTimeout(2000);

    const textarea = page.locator('.ask-viewport .composer textarea');
    await textarea.click();
    await textarea.fill(question);

    const respPromise = page.waitForResponse(
      (r: any) => r.url().includes('/api/ask-ai/ask'),
      { timeout: 60000 },
    );
    await page.locator('.ask-viewport .composer button[type="submit"]').click();
    const resp = await respPromise;
    result.http_status = resp.status();

    let body: any = null;
    try { body = await resp.json(); } catch {}
    result.assertions.push({ check: 'HTTP 200', ok: resp.status() === 200, detail: `status=${resp.status()}` });

    if (body?.data?.response?.steps) {
      const steps = body.data.response.steps as any[];
      result.step_count = steps.length;
      result.steps_summary = steps.map((s) => ({
        kind: s.kind,
        title: s.title || undefined,
        question: s.question || undefined,
        preview: (s.body_md || s.question || s.quote || '').slice(0, 120),
      }));
      const firstExplain = steps.find((s) => s.kind === 'explain');
      result.response_text = firstExplain?.body_md ?? '(no explain step)';

      result.assertions.push({ check: 'step 카드 ≥ 2', ok: steps.length >= 2, detail: `count=${steps.length}` });
      const hasExplain = steps.some((s) => s.kind === 'explain');
      const hasCheckpoint = steps.some((s) => s.kind === 'checkpoint');
      result.assertions.push({ check: 'explain step 존재', ok: hasExplain });
      result.assertions.push({ check: 'checkpoint step 존재 (한 줄씩 멈춤)', ok: hasCheckpoint });
      result.assertions.push({
        check: '응답 본문에 한국어 (가-힣 ≥ 20자)',
        ok: !!result.response_text && (result.response_text.match(/[가-힣]/g)?.length ?? 0) >= 20,
        detail: `한글수=${result.response_text?.match(/[가-힣]/g)?.length ?? 0}`,
      });
    } else {
      result.assertions.push({ check: '응답 body.data.response.steps 존재', ok: false, detail: JSON.stringify(body).slice(0, 100) });
    }

    await page.waitForTimeout(3500); // KaTeX 렌더 대기
    await page.screenshot({ path: path.join(OUT, result.screenshot), fullPage: true });

    const katexCount = await page.locator('.katex').count();
    result.katex_count = katexCount;

    if (result.assertions.some((a) => !a.ok)) result.status = 'FAIL';
  } catch (e: any) {
    result.status = 'FAIL';
    result.error = e.message;
  }
  AI_RESULTS.push(result);
  flush();
  return result;
}

test.beforeAll(() => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  AI_RESULTS.length = 0;
  HW_RESULTS.length = 0;
});

test('AI-1: 정의 질문 (표본평균)', async ({ page }) => {
  await loginAndInject(page);
  const r = await askAndCapture(page, 'ai-1', '표본평균 X̄가 무엇인지 정의와 함께 설명해주세요.');
  expect(r.status).toBe('PASS');
});

test('AI-2: 증명 질문 (등차수열 합)', async ({ page }) => {
  await loginAndInject(page);
  const r = await askAndCapture(page, 'ai-2', '등차수열의 합 공식 S_n = n(a₁+a_n)/2 가 왜 성립하는지 한 줄씩 풀어주세요.');
  expect(r.status).toBe('PASS');
});

test('AI-3: 개념 질문 (편미분)', async ({ page }) => {
  await loginAndInject(page);
  const r = await askAndCapture(page, 'ai-3', '편미분이 일반 미분과 어떻게 다른지 직관적으로 설명해주세요.');
  expect(r.status).toBe('PASS');
});

test('HW-1: 숙제 목록 진입', async ({ page }) => {
  const r: HWResult = {
    id: 'hw-1', desc: '숙제 목록 (/assignments) 진입',
    status: 'PASS', screenshot: 'content-hw-1.png', assertions: [],
  };
  try {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/assignments`);
    await page.waitForResponse((r: any) => r.url().includes('/api/play/assignments'), { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, r.screenshot), fullPage: true });
    r.url = page.url();

    const bodyText = await page.locator('body').innerText();
    r.assertions.push({ check: 'URL이 /assignments', ok: page.url().includes('/assignments'), detail: page.url() });
    r.assertions.push({ check: '페이지 텍스트 존재', ok: bodyText.length > 0, detail: `len=${bodyText.length}` });

    // 발행한 숙제 제목이 보이는지
    const hasAssignment = bodyText.includes('E2E 테스트 숙제') || bodyText.includes('표본분포');
    r.assertions.push({ check: '발행한 테스트 숙제 표시', ok: hasAssignment, detail: bodyText.slice(0, 200) });

    if (r.assertions.some((a) => !a.ok)) r.status = 'FAIL';
  } catch (e: any) {
    r.status = 'FAIL'; r.error = e.message;
  }
  HW_RESULTS.push(r); flush();
  expect(r.status).toBe('PASS');
});

test('HW-2: 숙제 상세 진입', async ({ page }) => {
  const r: HWResult = {
    id: 'hw-2', desc: '숙제 카드 클릭 → 상세 화면',
    status: 'PASS', screenshot: 'content-hw-2.png', assertions: [],
  };
  try {
    await loginAndInject(page);
    await page.goto(`${SITE}/#/assignments`);
    await page.waitForResponse((r: any) => r.url().includes('/api/play/assignments'), { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 숙제 카드 첫번째 클릭 (제목 텍스트로 지정)
    const card = page.locator('text=E2E 테스트 숙제').first();
    const visible = await card.isVisible().catch(() => false);
    r.assertions.push({ check: '숙제 카드 표시됨 (클릭 가능)', ok: visible });

    if (visible) {
      await card.click();
      await page.waitForTimeout(2500);
      r.url = page.url();
      r.assertions.push({ check: 'URL이 /assignments/<id>', ok: /\/assignments\/[^/]+/.test(page.url()), detail: page.url() });
      const bodyText = await page.locator('body').innerText();
      r.assertions.push({ check: '상세 화면에 instructions 표시', ok: bodyText.includes('표본평균 분산') || bodyText.includes('한 줄씩'), detail: bodyText.slice(0, 200) });
    } else {
      r.status = 'FAIL';
    }

    await page.screenshot({ path: path.join(OUT, r.screenshot), fullPage: true });
    if (r.assertions.some((a) => !a.ok)) r.status = 'FAIL';
  } catch (e: any) {
    r.status = 'FAIL'; r.error = e.message;
  }
  HW_RESULTS.push(r); flush();
  expect(r.status).toBe('PASS');
});
