/**
 * 학생이 내 단어장에서 직접 시험을 시작하는 플로우 (self-start)
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
  });
  await page.locator('.home-mode-card').filter({ hasText: '영단어' }).click();
  await page.waitForURL(/\/word-gacha\//, { timeout: 15_000 });
  await page.evaluate(() => ['#dlg-onboard','#reunion'].forEach(id => {
    const el = document.querySelector(id) as HTMLDialogElement | null;
    if (el?.open) el.close(); if (el) (el as any).hidden = true;
  }));
}

test('내 단어장에서 [시험 치기] → 응시 화면 → 문항 풀이 → 제출 → 결과', async ({ page }) => {
  await enter(page);
  // 학습 탭 → 내 단어장
  await page.locator('nav.tabbar').getByRole('button', { name: /학습/ }).click();
  await page.locator('#tab-learn-mywords').click();

  // [시험 치기] 버튼 보임
  const examBtn = page.locator('#btn-self-exam');
  await expect(examBtn).toBeVisible({ timeout: 5_000 });
  await expect(examBtn).toContainText('시험 치기');
  await expect(examBtn).toContainText('내 단어 10문제');

  // 클릭 → 응시 화면 전환
  await examBtn.click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'print', { timeout: 15_000 });
  await expect(page.locator('#print-take-progress')).toContainText(/\d+\s*\/\s*\d+/);

  const total = await page.evaluate(() => {
    const v = document.getElementById('print-take-progress')?.textContent || '';
    const m = v.match(/\/\s*(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  expect(total).toBeGreaterThanOrEqual(4);

  // 모든 문제 첫 번째 선택지로 찍기
  for (let i = 0; i < total; i++) {
    await page.locator('#print-take-choices .print-take-choice').first().click();
    const isLast = i === total - 1;
    if (isLast) page.once('dialog', d => d.accept());
    await page.locator('#print-take-next').click();
  }

  // 결과 화면
  await expect(page.locator('#print-take-result')).toBeVisible({ timeout: 15_000 });
  const correct = await page.locator('#print-take-result-correct').textContent();
  const allTotal = await page.locator('#print-take-result-total').textContent();
  console.log(`result: ${correct}/${allTotal}`);
  expect(Number(allTotal)).toBe(total);

  console.log('✅ self-start 시험 end-to-end UI 통과');
});
