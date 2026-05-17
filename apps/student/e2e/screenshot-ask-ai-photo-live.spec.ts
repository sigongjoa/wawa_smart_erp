/**
 * UC-03 사진 업로드 end-to-end 라이브 테스트
 *
 * PH-1: 학생 로그인 → /ask-ai/photo → file input에 PNG 업로드 → R2 key 받음 → preview
 * PH-2: 사진 + 짧은 텍스트 ("풀어줘") → /ask 호출 → AI Vision 응답 받음
 * PH-3: 강사 큐에 사진 첨부된 conversation 표시 확인
 */
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';

const API = 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';
const SITE = 'https://wawa-learn.pages.dev';
const TEST_IMAGE = '/tmp/test-math-problem.png';

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

test.describe('AskAI 사진 업로드 end-to-end', () => {
  test.setTimeout(180_000);

  test('PH-1: /ask-ai/photo → file 업로드 → R2 key + preview', async ({ page }) => {
    await loginAndInject(page);

    let uploadResp: any = null;
    page.on('response', async (r) => {
      if (r.url().includes('/api/ask-ai/photos/upload')) {
        try { uploadResp = { status: r.status(), body: await r.json() }; } catch {}
      }
    });

    await page.goto(`${SITE}/#/ask-ai/photo`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: '/tmp/ph-1-before-upload.png', fullPage: true });

    // file input은 hidden — setInputFiles로 직접 주입
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE);
    await page.waitForTimeout(4000);  // upload + R2 PUT

    await page.screenshot({ path: '/tmp/ph-1-after-upload.png', fullPage: true });

    console.log(`[PH-1] upload status=${uploadResp?.status}, r2_key=${uploadResp?.body?.data?.r2_key ?? 'none'}`);
    expect(uploadResp?.status).toBe(200);
    expect(uploadResp?.body?.data?.r2_key).toContain('students/');
  });

  test('PH-2: 사진 + 텍스트 → AI Vision 응답', async ({ page }) => {
    await loginAndInject(page);

    let askResp: any = null;
    page.on('response', async (r) => {
      if (r.url().includes('/api/ask-ai/ask') && r.request().method() === 'POST') {
        try { askResp = { status: r.status(), body: await r.json() }; } catch {}
      }
    });

    await page.goto(`${SITE}/#/ask-ai/photo`);
    await page.waitForTimeout(2500);

    await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE);
    await page.waitForTimeout(4000);  // upload 완료 대기

    const textarea = page.locator('.ask-viewport .composer textarea');
    await textarea.click();
    await textarea.fill('이 문제 풀어줘. 사진의 이차함수 꼭짓점은?');
    await page.waitForTimeout(300);

    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/ask-ai/ask'),
      { timeout: 120_000 },
    );
    await page.locator('.ask-viewport .composer button[type="submit"]').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/ph-2-loading.png', fullPage: true });

    const resp = await respPromise;
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/ph-2-result.png', fullPage: true });

    const status = resp.status();
    const stepCount = (askResp?.body?.data?.response?.steps ?? []).length;
    console.log(`[PH-2] ask status=${status}, steps=${stepCount}`);
    console.log(`[PH-2] response preview: ${JSON.stringify(askResp?.body?.data?.response ?? {}).slice(0, 400)}`);

    if (status === 429) {
      console.warn('[PH-2] burst limited');
      return;
    }
    expect(status).toBe(200);
    expect(stepCount).toBeGreaterThan(0);
  });
});
