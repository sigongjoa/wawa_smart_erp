/**
 * D1~D5 진단용 — 5종 질문으로 ask-ai 동작 sample.
 *
 * 케이스:
 *   1. SHORT  — "삼각형 세 각의 합이 왜 180도예요?"  (D1 500 회귀 재현 후보 / 짧은 기초)
 *   2. ABSTRACT — ε-δ 극한 증명                     (D3 confidence dial — 고난도 추상)
 *   3. OFFTOPIC — 안중근 저격 이유                  (D3·D4 — 도메인 외, low + needs_teacher 이어야 정상)
 *   4. FIGURE   — y=x²-2x+1 그래프                  (figure step 정상 작동)
 *   5. VAGUE    — "음... 그거 뭐였더라"             (모호 — medium/low 이어야 정상)
 *
 * prod /ask 5회 호출. 각 응답의 confidence/needs_teacher/used_tokens는 콘솔에 dump.
 */
import { test, expect } from '@playwright/test';

const API = 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';
const SITE = 'https://wawa-learn.pages.dev';

interface Case {
  slug: string;
  label: string;
  q: string;
}

const CASES: Case[] = [
  { slug: '1-short',    label: 'SHORT',    q: '삼각형 세 각의 합이 왜 180도예요?' },
  { slug: '2-abstract', label: 'ABSTRACT', q: 'ε-δ 정의로 lim x→2 (3x-1) = 5 를 증명해줘' },
  { slug: '3-offtopic', label: 'OFFTOPIC', q: '안중근 의사가 왜 이토 히로부미를 저격했어요?' },
  { slug: '4-figure',   label: 'FIGURE',   q: 'y = x² - 2x + 1 그래프 그려줘' },
  { slug: '5-vague',    label: 'VAGUE',    q: '음... 그거 뭐였더라' },
];

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
}

test.describe('ask-ai D1~D5 진단 5종', () => {
  for (const c of CASES) {
    test(`${c.label}: ${c.q.slice(0, 30)}`, async ({ page }) => {
      test.setTimeout(180000);
      // burst limit (5/60s) 회피 — 케이스 순서에 비례한 지연
      const idx = CASES.findIndex((x) => x.slug === c.slug);
      if (idx > 0) await new Promise((r) => setTimeout(r, idx * 14000));
      await loginAndInject(page);

      let status = 0;
      let respJson: any = null;
      page.on('response', async (r) => {
        if (r.url().includes('/api/ask-ai/ask')) {
          status = r.status();
          try { respJson = await r.json(); } catch {}
        }
      });

      await page.goto(`${SITE}/#/ask-ai/write`);
      await page.waitForTimeout(2000);

      const textarea = page.locator('.ask-viewport .composer textarea');
      await textarea.click();
      await textarea.fill(c.q);
      await page.waitForTimeout(200);

      const respPromise = page.waitForResponse(
        (r) => r.url().includes('/api/ask-ai/ask'),
        { timeout: 90000 },
      );
      await page.locator('.ask-viewport .composer button[type="submit"]').click();

      try {
        await respPromise;
      } catch {
        // timeout — 캡처만
      }
      await page.waitForTimeout(3500); // KaTeX/figure 렌더 대기
      await page.screenshot({ path: `/tmp/diag5-${c.slug}.png`, fullPage: true });

      const conf = respJson?.data?.response?.confidence ?? respJson?.response?.confidence ?? '?';
      const nt   = respJson?.data?.response?.needs_teacher ?? respJson?.response?.needs_teacher ?? '?';
      // used_tokens 는 ask endpoint 응답에는 노출 안 됨 → conversation GET 필요. 일단 status만.
      console.log(`[DIAG] ${c.label} status=${status} confidence=${conf} needs_teacher=${nt}`);
    });
  }
});
