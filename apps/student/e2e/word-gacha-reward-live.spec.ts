/**
 * 시험 완료 후 리워드(EXP/coin) 지급 + 결과 화면에 reward 배지 노출
 */
import { test, expect, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click('.academy-item:has-text("E2E테스트학원")');
  await page.fill('input[placeholder="이름"]', '테스트학생');
  await page.fill('input[placeholder*="PIN"]', '1234');
  await page.click('.login-btn');
  await page.waitForSelector('.home-page', { timeout: 15_000 });
  await page.evaluate(() => {
    const now = new Date().toISOString();
    localStorage.setItem('wg.v1.creature', JSON.stringify({
      speciesKey:'sprout',name:'테스트',personality:'curious',
      stage:1,bond:50,hunger:80,lastInteractionAt:now,lastTickedAt:now,
    }));
    // profile 초기화 (기존 테스트 누적 제거)
    localStorage.setItem('wg.v1.profile', JSON.stringify({
      lv: 1, exp: 0, coin: 0, streak: 0, lastActiveDate: null,
    }));
  });
  await page.locator('.home-mode-card').filter({ hasText: '영단어' }).click();
  await page.waitForURL(/\/word-gacha\//, { timeout: 15_000 });
  await page.evaluate(() => ['#dlg-onboard','#reunion'].forEach(id => {
    const el = document.querySelector(id) as HTMLDialogElement | null;
    if (el?.open) el.close(); if (el) (el as any).hidden = true;
  }));
}

test('시험 완료 → 결과에 리워드 배지 + profile 에 EXP/coin 반영', async ({ page }) => {
  await enter(page);

  // HUD 초기값
  const before = await page.evaluate(() => ({
    exp: Number(document.getElementById('hud-exp')?.style.getPropertyValue('--exp')?.replace('%','') || 0),
    coin: Number(document.getElementById('hud-coin')?.textContent || 0),
  }));
  console.log('hud before:', JSON.stringify(before));

  // 내 단어장 → 시험 치기
  await page.locator('nav.tabbar').getByRole('button', { name: /학습/ }).click();
  await page.locator('#tab-learn-mywords').click();
  const examBtn = page.locator('#btn-self-exam');
  await expect(examBtn).toBeVisible();
  await examBtn.click();

  // 응시 진입
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'print', { timeout: 15_000 });
  const total = await page.evaluate(() => {
    const v = document.getElementById('print-take-progress')?.textContent || '';
    const m = v.match(/\/\s*(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  expect(total).toBeGreaterThan(0);

  // 모두 첫 선택지로 풀고 제출
  for (let i = 0; i < total; i++) {
    await page.locator('#print-take-choices .print-take-choice').first().click();
    if (i === total - 1) page.once('dialog', d => d.accept());
    await page.locator('#print-take-next').click();
  }

  // 결과 화면 + 리워드 배지
  await expect(page.locator('#print-take-result')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.print-take-result-reward')).toBeVisible();
  const rewardText = await page.locator('.print-take-result-reward').textContent();
  console.log('reward:', rewardText?.trim());
  expect(rewardText).toMatch(/EXP\s*\+\d+/);
  expect(rewardText).toMatch(/코인\s*\+\d+/);

  // 홈으로 → HUD 반영 확인
  await page.locator('#print-take-result-home').click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('wg.v1.profile') || '{}');
    return {
      lv: p.lv, exp: p.exp, coin: p.coin,
      hudCoin: document.getElementById('hud-coin')?.textContent,
    };
  });
  console.log('after:', JSON.stringify(after));
  expect(after.exp ?? 0).toBeGreaterThan(0);
  // coin은 정답수*3 (0 정답이면 0) — EXP는 완주 보너스 최소 10
  expect(Number(after.hudCoin)).toBe(after.coin);

  console.log('✅ 리워드 지급 확인');
});
