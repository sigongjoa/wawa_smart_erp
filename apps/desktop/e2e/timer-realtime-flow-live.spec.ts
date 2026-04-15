/**
 * Timer Realtime Flow E2E — v1.9.0 복원 검증
 *
 * 실제 브라우저로:
 *   1. 로그인
 *   2. /timer 이동
 *   3. 대기 카드가 뜨는지 확인
 *   4. 카드 클릭 → check-in
 *   5. 세션 카드가 나타나고 카운트다운/버튼이 보이는지 확인
 *   6. 정지 → 재개 → 체크아웃
 *
 * 실행:
 *   E2E_BASE_URL=https://a592a53c.wawa-smart-erp.pages.dev \
 *   npx playwright test e2e/timer-realtime-flow.spec.ts --headed
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';
const ADMIN = { name: '서재용 개발자', pin: '1141' };

test.setTimeout(120_000);

async function login(page: Page) {
  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  await page.locator('input#name').fill(ADMIN.name);
  await page.locator('input#pin').fill(ADMIN.pin);
  await page.locator('button[type="submit"]').click();

  await page.waitForFunction(() => window.location.hash.includes('/timer'), {
    timeout: 15000,
  });
}

test.describe('Timer Realtime Flow — v1.9.0 복원', () => {
  test('대기 카드 클릭 → check-in → pause → resume → check-out', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[BROWSER]', msg.text());
    });

    await login(page);

    // /timer 로드 대기
    await page.waitForSelector('.rt-root', { timeout: 15000 });
    await page.waitForSelector('.rt-columns', { timeout: 10000 });

    // 로딩 스피너 사라질 때까지
    await page.waitForSelector('.rpt-loading', { state: 'detached', timeout: 10000 }).catch(() => {});

    // 요약 바에 있는 대기 pill 숫자 확인
    const waitingPill = page.locator('.rt-pill.waiting strong');
    const waitingCount = parseInt((await waitingPill.textContent()) || '0', 10);
    console.log('대기 학생 수:', waitingCount);
    expect(waitingCount).toBeGreaterThan(0); // 담당 학생 21명 중 오늘 요일에 맞는 학생

    // 첫 대기 카드 선택
    const firstWaitingCard = page.locator('.rt-waiting-card').first();
    await expect(firstWaitingCard).toBeVisible();
    const studentName = await firstWaitingCard.locator('.rt-student-name').textContent();
    console.log('체크인 대상 학생:', studentName);

    // confirm 자동 승인 (체크아웃 단계에서 사용됨)
    page.on('dialog', (dialog) => dialog.accept());

    // ─── 1) 체크인 ───────────────────
    await firstWaitingCard.click();
    await page.waitForTimeout(1500);

    // 세션 카드가 우측에 나타났는지
    const sessionCard = page.locator('.rt-session-card').first();
    await expect(sessionCard).toBeVisible({ timeout: 10000 });
    await expect(sessionCard.locator('.rt-student-name')).toHaveText(studentName!);

    // 카운트다운 값 표시 확인
    const timerValue = sessionCard.locator('.rt-timer-value').first();
    await expect(timerValue).toBeVisible();
    const timerText = await timerValue.textContent();
    console.log('타이머 표시:', timerText);
    expect(timerText).toMatch(/^\+?\d{2}:\d{2}$/);

    // ─── 2) 정지 ────────────────────
    const pauseBtn = sessionCard.locator('button:has-text("정지")');
    await expect(pauseBtn).toBeVisible();
    await pauseBtn.click();

    // pause 사유 바텀시트
    const pauseSheet = page.locator('.rt-pause-sheet');
    await expect(pauseSheet).toBeVisible({ timeout: 5000 });
    await page.locator('.rt-pause-option:has-text("화장실")').click();
    await page.waitForTimeout(1500);

    // 정지 카드로 전환
    const pausedCard = page.locator('.rt-session-card--paused').first();
    await expect(pausedCard).toBeVisible({ timeout: 5000 });
    await expect(pausedCard.locator('.rt-status-tag.paused')).toBeVisible();
    await expect(pausedCard.locator('.rt-pause-reason')).toHaveText('화장실');

    // ─── 3) 재개 ────────────────────
    const resumeBtn = pausedCard.locator('button:has-text("재개")');
    await resumeBtn.click();
    await page.waitForTimeout(1500);

    // 다시 활성 카드로
    const activeAgain = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();
    await expect(activeAgain).toBeVisible({ timeout: 5000 });

    // ─── 4) 체크아웃 ─────────────────
    const doneBtn = activeAgain.locator('button:has-text("완료")');
    await doneBtn.click();
    await page.waitForTimeout(2000);

    // 완료 후 해당 학생은 대기/활성에서 사라지고, 완료 카운트가 +1 이 됨
    const completedPill = page.locator('.rt-pill.completed strong');
    const completedCount = parseInt((await completedPill.textContent()) || '0', 10);
    console.log('완료 카운트:', completedCount);
    expect(completedCount).toBeGreaterThanOrEqual(1);
  });
});
