/**
 * 강사 큐 검증 — Desktop /teacher/ask-ai
 *
 * TQ-1: 로그인 → /teacher/ask-ai 큐 화면 (좌 목록 캡처)
 * TQ-2: 학생 conversation 한 항목 클릭 → 우 상세 패널 (질문 + AI 단계) 캡처
 * TQ-3: 코멘트 입력 중 — textarea + 3 action 버튼 캡처 (저장 X)
 */
import { test, expect } from '@playwright/test';

const SITE = 'https://wawa-smart-erp.pages.dev';

async function loginAndGoto(page: any, path = '/teacher/ask-ai') {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 학원 옵션 로드 대기
  await page.waitForFunction(() => {
    const opts = document.querySelectorAll('#login-academy option');
    return opts.length > 1;
  }, { timeout: 15000 });

  await page.locator('#login-academy').selectOption('alpha');
  await page.waitForTimeout(1000);
  await page.fill('#login-name', '서재용');
  await page.fill('#login-pin', '1141');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  // 로그인 후 페이지 이동
  await page.goto(`${SITE}/#${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
}

test.describe('TeacherAskAIQueuePage live screenshot', () => {
  test.setTimeout(120_000);

  test('TQ-1: /teacher/ask-ai 큐 목록 렌더 (전체)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAndGoto(page, '/teacher/ask-ai');

    await page.screenshot({ path: '/tmp/tq-1-queue-overview.png', fullPage: true });

    // 큐 헤더 확인
    await expect(page.locator('.askai-q-title')).toContainText('설명 AI');
  });

  test('TQ-2: 한 항목 클릭 → 상세 패널 캡처', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAndGoto(page, '/teacher/ask-ai');

    // 첫 번째 큐 항목 클릭
    const firstSlip = page.locator('.askai-q-slip').first();
    if (await firstSlip.count() > 0) {
      await firstSlip.click();
      await page.waitForTimeout(2500); // detail fetch 대기
      await page.screenshot({ path: '/tmp/tq-2-detail-loaded.png', fullPage: true });

      // 상세에 학생 이름과 AI 응답 영역이 보여야
      const titleVisible = await page.locator('.askai-q-detail-student').count();
      expect(titleVisible).toBeGreaterThan(0);
    } else {
      await page.screenshot({ path: '/tmp/tq-2-detail-loaded.png', fullPage: true });
      console.log('[TQ-2] no slip found — empty queue');
    }
  });

  test('TQ-3: 코멘트 입력 중 (저장 안 함)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAndGoto(page, '/teacher/ask-ai');

    const firstSlip = page.locator('.askai-q-slip').first();
    if (await firstSlip.count() > 0) {
      await firstSlip.click();
      await page.waitForTimeout(2500);

      const textarea = page.locator('.askai-q-action-textarea');
      await textarea.click();
      await textarea.fill('테스트 코멘트 — 학생이 잘 이해한 것 같습니다. 다음 단원도 화이팅!');
      await page.waitForTimeout(800);
      await page.screenshot({ path: '/tmp/tq-3-comment-typed.png', fullPage: true });
    } else {
      await page.screenshot({ path: '/tmp/tq-3-comment-typed.png', fullPage: true });
    }
  });
});
