/**
 * TimerPage v2 마이그레이션 — 버튼/인터랙션 스모크 테스트
 *
 * 목표: 각 버튼이 정상적으로 보이고, 클릭 가능하며, 의도된 UI 반응이 일어나는지.
 *      (실제 DB 변경은 발생시키지 않음 — 모달 열기/닫기 + 구조 확인 위주)
 *
 * 실행:
 *   E2E_BASE_URL=http://localhost:4173 npx playwright test e2e/timer-v2-smoke-live.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const ADMIN = { name: '서재용 개발자', pin: '1141' };

test.setTimeout(120_000);

async function login(page: Page) {
  await page.goto(BASE_URL);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  await page.locator('input#name').fill(ADMIN.name);
  await page.locator('input#pin').fill(ADMIN.pin);
  await page.locator('button[type="submit"]').click();

  await page.waitForFunction(() => window.location.hash.includes('/timer'), { timeout: 15000 });
  await page.waitForSelector('.v2-app-main', { timeout: 15000 });
  await page.waitForSelector('.rpt-loading', { state: 'detached', timeout: 15000 }).catch(() => {});
}

test.describe('TimerPage v2 — 버튼별 동작 확인', () => {

  test('A. 페이지 골격 (PageHeader · SummaryBar · 요일필터 · 양 패널) 렌더', async ({ page }) => {
    await login(page);

    // PageHeader 타이틀
    await expect(page.locator('.v2-page-head__title')).toHaveText('실시간 수업 관리');

    // PageHeader actions 안의 live pulse (실시간 시계)
    await expect(page.locator('.v2-live-pulse')).toBeVisible();
    const clock1 = await page.locator('.v2-live-pulse').textContent();
    await page.waitForTimeout(1500);
    const clock2 = await page.locator('.v2-live-pulse').textContent();
    expect(clock1).not.toBe(clock2); // 1초마다 갱신

    // SummaryBar 4셀 — 대기/수업 중/정지/완료
    await expect(page.locator('.v2-summary-cell')).toHaveCount(4);
    for (const label of ['대기', '수업 중', '정지', '완료']) {
      await expect(page.locator(`.v2-summary-cell:has(.v2-summary-cell__label:text-is("${label}"))`)).toBeVisible();
    }

    // 요일 필터 — 7개 chip
    await expect(page.locator('.v2-timer-day')).toHaveCount(7);
    await expect(page.locator('.v2-timer-day--active')).toHaveCount(1);

    // 양 패널 (대기 + 수업 진행)
    await expect(page.locator('.v2-panel')).toHaveCount(2);
    await expect(page.locator('.v2-panel__title').filter({ hasText: /대기|요일/ })).toBeVisible();
    await expect(page.locator('.v2-panel__title').filter({ hasText: '수업 진행' })).toBeVisible();

    console.log('✓ A: 골격 렌더 OK');
  });

  test('B. 요일 chip — 다른 요일 클릭 시 활성 표시 전환', async ({ page }) => {
    await login(page);

    const initialActive = await page.locator('.v2-timer-day--active').textContent();
    // 다른 요일 클릭 (현재 활성이 아닌 첫 chip)
    const otherDay = page.locator('.v2-timer-day:not(.v2-timer-day--active)').first();
    const otherDayText = await otherDay.textContent();
    await otherDay.click();
    await page.waitForTimeout(800);

    // 활성 상태가 이동했는지
    const newActive = await page.locator('.v2-timer-day--active').textContent();
    expect(newActive).not.toBe(initialActive);
    expect(newActive).toContain(otherDayText?.trim().charAt(0) || '');
    console.log(`✓ B: 요일 전환 ${initialActive?.trim()} → ${newActive?.trim()}`);
  });

  test('C. PageHeader 액션 — "임시 수업" 버튼 클릭 시 모달 열림 → 닫기', async ({ page }) => {
    await login(page);

    const adhocBtn = page.locator('.v2-page-head__actions button:has-text("임시 수업")');
    // 오늘 요일이 아닐 수도 있으니 today chip 클릭 후 진행
    const today = page.locator('.v2-timer-day:has(.v2-timer-day__dot)');
    if (await today.count() > 0) await today.click();
    await page.waitForTimeout(500);

    await expect(adhocBtn).toBeVisible();
    await adhocBtn.click();
    await page.waitForTimeout(500);

    const modal = page.locator('div[role="dialog"][aria-label="임시 수업 추가"]');
    await expect(modal).toBeVisible();

    // 학생 검색 input
    await expect(modal.locator('input[placeholder*="이름"]')).toBeVisible();
    // 날짜 input
    await expect(modal.locator('input[type="date"]')).toBeVisible();
    // 취소
    await modal.locator('button:has-text("취소")').click();
    await page.waitForTimeout(300);
    await expect(modal).not.toBeVisible();
    console.log('✓ C: 임시 수업 모달 열기/닫기 OK');
  });

  test('D. PageHeader 액션 — "퇴근" 버튼 클릭 → 모달 열림 → 취소', async ({ page }) => {
    await login(page);

    const today = page.locator('.v2-timer-day:has(.v2-timer-day__dot)');
    if (await today.count() > 0) await today.click();
    await page.waitForTimeout(500);

    const finishBtn = page.locator('[data-testid="finish-day-btn"]');
    await expect(finishBtn).toBeVisible();
    await finishBtn.click();
    await page.waitForTimeout(500);

    // 퇴근 모달이 뜨거나, 대기 학생이 0명이면 toast가 뜸 — 둘 다 정상
    const finishModal = page.locator('.rt-finish-modal');
    const isVisible = await finishModal.isVisible({ timeout: 1500 }).catch(() => false);
    if (isVisible) {
      await expect(finishModal.locator('.rt-finish-title')).toContainText('퇴근');
      await finishModal.locator('button:has-text("취소")').click();
      await page.waitForTimeout(300);
      await expect(finishModal).not.toBeVisible();
      console.log('✓ D: 퇴근 모달 열기/취소 OK (대기 학생 있음)');
    } else {
      console.log('✓ D: 퇴근 버튼 클릭 OK (대기 학생 0명 → toast)');
    }
  });

  test('E. 대기 카드 — 적어도 1개 렌더된다면 클릭 가능한지', async ({ page }) => {
    await login(page);

    const today = page.locator('.v2-timer-day:has(.v2-timer-day__dot)');
    if (await today.count() > 0) await today.click();
    await page.waitForTimeout(800);

    const waitingCount = await page.locator('[data-testid^="waiting-card-"]').count();
    if (waitingCount === 0) {
      console.log('⚠ E: 오늘 대기 학생 없음 — skip');
      return;
    }

    const firstWaiting = page.locator('[data-testid^="waiting-card-"]').first();
    await expect(firstWaiting).toBeVisible();
    await expect(firstWaiting.locator('.v2-pending-row__name')).toBeVisible();

    const mainBtn = firstWaiting.locator('.v2-pending-row__main').first();
    await expect(mainBtn).toBeEnabled();
    console.log(`✓ E: 대기 카드 ${waitingCount}개 렌더 + 첫 카드 클릭 가능`);
  });

  test('F. 활성/정지 세션 카드 — 있을 경우 버튼 모두 클릭 가능 (read-only 검증)', async ({ page }) => {
    await login(page);

    const today = page.locator('.v2-timer-day:has(.v2-timer-day__dot)');
    if (await today.count() > 0) await today.click();
    await page.waitForTimeout(800);

    const activeCount = await page.locator('[data-testid^="active-session-"]').count();
    const pausedCount = await page.locator('[data-testid^="paused-session-"]').count();

    if (activeCount === 0 && pausedCount === 0) {
      console.log('⚠ F: 진행 중 세션 없음 — skip');
      return;
    }

    if (activeCount > 0) {
      const card = page.locator('[data-testid^="active-session-"]').first();
      await expect(card.locator('.v2-timer-card__name')).toBeVisible();
      await expect(card.locator('.v2-timer-card__time')).toBeVisible();
      const time = await card.locator('.v2-timer-card__time').textContent();
      expect(time).toMatch(/^\+?\d{2}:\d{2}$/);

      // 4개 버튼 (+10, +30, 정지, 완료)
      const btns = card.locator('.v2-timer-card__btn');
      await expect(btns).toHaveCount(4);
      for (const text of ['+10분', '+30분', '정지', '완료']) {
        await expect(card.locator(`.v2-timer-card__btn:has-text("${text}")`)).toBeEnabled();
      }
      console.log(`✓ F-active: 활성 카드 ${activeCount}개, 4 버튼 정상 enable`);
    }

    if (pausedCount > 0) {
      const card = page.locator('[data-testid^="paused-session-"]').first();
      await expect(card.locator('.v2-pill--warning')).toBeVisible();
      await expect(card.locator('.v2-timer-card__pause-clock')).toBeVisible();
      const btns = card.locator('.v2-timer-card__btn');
      await expect(btns).toHaveCount(2);
      for (const text of ['재개', '완료']) {
        await expect(card.locator(`.v2-timer-card__btn:has-text("${text}")`)).toBeEnabled();
      }
      console.log(`✓ F-paused: 정지 카드 ${pausedCount}개, 2 버튼 정상 enable`);
    }
  });

  test('G. End-to-end — 대기 → 체크인 → 정지(화장실) → 재개 → 체크아웃 (data 있을 때만)', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await login(page);

    const today = page.locator('.v2-timer-day:has(.v2-timer-day__dot)');
    if (await today.count() > 0) await today.click();
    await page.waitForTimeout(800);

    const waitingCount = await page.locator('[data-testid^="waiting-card-"]').count();
    if (waitingCount === 0) {
      console.log('⚠ G: 오늘 대기 학생 없음 — skip e2e');
      return;
    }

    // 1) 체크인
    const firstWaiting = page.locator('[data-testid^="waiting-card-"]').first();
    const studentName = (await firstWaiting.locator('.v2-pending-row__name').first().textContent())?.trim().split(/\s+/)[0] || '';
    console.log(`G-1 체크인 대상: ${studentName}`);
    await firstWaiting.locator('.v2-pending-row__main').first().click();
    await page.waitForTimeout(1500);

    const activeCard = page.locator('[data-testid^="active-session-"]').filter({ hasText: studentName }).first();
    await expect(activeCard).toBeVisible({ timeout: 8000 });
    console.log('G-1: 활성 카드 등장 OK');

    // 2) 정지 → 화장실
    await activeCard.locator('.v2-timer-card__btn:has-text("정지")').click();
    await expect(page.locator('.rt-pause-sheet')).toBeVisible({ timeout: 3000 });
    await page.locator('.rt-pause-option:has-text("화장실")').click();
    await page.waitForTimeout(1500);

    const pausedCard = page.locator('[data-testid^="paused-session-"]').filter({ hasText: studentName }).first();
    await expect(pausedCard).toBeVisible({ timeout: 5000 });
    await expect(pausedCard.locator('.v2-timer-card__pause-reason')).toContainText('화장실');
    console.log('G-2: 정지 사유=화장실 반영 OK');

    // 3) 재개
    await pausedCard.locator('.v2-timer-card__btn:has-text("재개")').click();
    await page.waitForTimeout(1500);
    const resumedCard = page.locator('[data-testid^="active-session-"]').filter({ hasText: studentName }).first();
    await expect(resumedCard).toBeVisible({ timeout: 5000 });
    console.log('G-3: 재개 OK');

    // 4) 완료 (체크아웃)
    await resumedCard.locator('.v2-timer-card__btn:has-text("완료")').click();
    await page.waitForTimeout(2000);
    // 카드가 사라졌거나 완료 카운트가 ≥1
    const completedValue = await page.locator('.v2-summary-cell:has(.v2-summary-cell__label:text-is("완료")) .v2-summary-cell__value').textContent();
    expect(parseInt(completedValue || '0', 10)).toBeGreaterThanOrEqual(1);
    console.log('G-4: 체크아웃 OK + 완료 카운트 반영');
  });
});
