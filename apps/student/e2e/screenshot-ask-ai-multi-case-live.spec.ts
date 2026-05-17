/**
 * AskAI 다양 케이스 검증 — 중·고등 학생 수준 4개 난이도 분산
 *
 * MC-1: 중1·중2 기초 — 삼각형 내각의 합 (쉬움. confidence high 기대)
 * MC-2: 고1·고2 중간 — 역함수와 그래프 대칭 (confidence medium~high)
 * MC-3: 고3 심화 — ε-δ 정의로 극한 증명 (어려움. needs_teacher=true 기대)
 * MC-4: 도메인 외 — 한국사 안중근 (수학 ERP 컨텍스트 처리 확인)
 *
 * 각 케이스: 응답 캡처 + status·confidence·needs_teacher 로깅.
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
}

interface CaseSpec {
  id: string;
  level: string;
  question: string;
  screenshot: string;
}

const CASES: CaseSpec[] = [
  {
    id: 'MC-1',
    level: '중1·중2 기초',
    question: '삼각형 세 각의 합이 왜 180도인지 설명해주세요',
    screenshot: '/tmp/mc-1-easy-junior.png',
  },
  {
    id: 'MC-2',
    level: '고1·고2 중간',
    question: '함수 f(x)=2^x와 g(x)=log_2(x)가 서로 역함수임을 그래프로 어떻게 확인하나요?',
    screenshot: '/tmp/mc-2-medium-senior.png',
  },
  {
    id: 'MC-3',
    level: '고3 심화',
    question: 'ε-δ 정의로 lim_{x→2}(x²-4)/(x-2) = 4 를 증명해주세요',
    screenshot: '/tmp/mc-3-hard-epsilon-delta.png',
  },
  {
    id: 'MC-4',
    level: '도메인 외',
    question: '안중근 의사가 이토 히로부미를 저격한 이유를 한 문단으로 설명',
    screenshot: '/tmp/mc-4-out-of-domain.png',
  },
];

test.describe('AskAI 다양 케이스 (live, AI 호출)', () => {
  test.setTimeout(120_000);

  for (const c of CASES) {
    test(`${c.id} [${c.level}] — ${c.question.slice(0, 40)}...`, async ({ page }) => {
      await loginAndInject(page);

      // 응답 capture
      let askResp: any = null;
      page.on('response', async (r) => {
        if (r.url().includes('/api/ask-ai/ask') && r.request().method() === 'POST') {
          try { askResp = { status: r.status(), body: await r.json() }; } catch {}
        }
      });

      await page.goto(`${SITE}/#/ask-ai/write`);
      await page.waitForTimeout(2500);

      const textarea = page.locator('.ask-viewport .composer textarea');
      await textarea.click();
      await textarea.fill(c.question);
      await page.waitForTimeout(300);

      const respPromise = page.waitForResponse(
        (r) => r.url().includes('/api/ask-ai/ask'),
        { timeout: 90_000 },
      );
      await page.locator('.ask-viewport .composer button[type="submit"]').click();
      const resp = await respPromise;
      await page.waitForTimeout(4000); // KaTeX + step 렌더 대기

      await page.screenshot({ path: c.screenshot, fullPage: true });

      // 로그 — 사용자가 보기 위함
      const status = resp.status();
      const conversationId = askResp?.body?.data?.id ?? askResp?.body?.id ?? null;
      const confidence = askResp?.body?.data?.response?.confidence ?? askResp?.body?.response?.confidence ?? null;
      const needsTeacher = askResp?.body?.data?.response?.needs_teacher ?? askResp?.body?.response?.needs_teacher ?? null;
      const stepCount = (askResp?.body?.data?.response?.steps ?? askResp?.body?.response?.steps ?? []).length;

      console.log(`\n[${c.id}] level=${c.level}`);
      console.log(`[${c.id}] status=${status}, conversation_id=${conversationId}`);
      console.log(`[${c.id}] confidence=${confidence}, needs_teacher=${needsTeacher}, steps=${stepCount}`);
      console.log(`[${c.id}] screenshot=${c.screenshot}`);

      // burst-limit 도달이면 skip
      if (status === 429) {
        console.warn(`[${c.id}] burst limited — skipping assertions`);
        return;
      }
      expect(status).toBe(200);
      expect(conversationId).toBeTruthy();
    });
  }
});
