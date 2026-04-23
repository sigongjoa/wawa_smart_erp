/**
 * 홈의 "놀아주기" 버튼이 창문 자리에 배치됐는지 검증
 */
import { test, expect } from '@playwright/test';

test('놀아주기 버튼이 우상단 창문 자리로 이동됨', async ({ page }) => {
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
      speciesKey: 'sprout', name: '테스트', personality: 'curious',
      stage: 1, bond: 50, hunger: 80,
      lastInteractionAt: now, lastTickedAt: now,
    }));
    sessionStorage.setItem('wg.sync-banner-dismissed', '1');
  });
  await page.locator('.home-mode-card').filter({ hasText: '영단어' }).click();
  await page.waitForURL(/\/word-gacha\//, { timeout: 15_000 });
  await page.evaluate(() => {
    ['#dlg-onboard','#reunion'].forEach(id => {
      const el = document.querySelector(id) as HTMLDialogElement | null;
      if (el?.open) el.close();
      if (el) (el as any).hidden = true;
    });
  });

  const info = await page.evaluate(() => {
    const pr = document.querySelector('.item.playroom-entry') as HTMLElement | null;
    const win = document.querySelector('.room .window') as HTMLElement | null;
    const room = document.querySelector('.room') as HTMLElement | null;
    const prRect = pr?.getBoundingClientRect();
    const roomRect = room?.getBoundingClientRect();
    return {
      prVisible: !!pr && (prRect?.width ?? 0) > 0,
      windowDisplay: win ? getComputedStyle(win).display : null,
      prTop: prRect && roomRect ? (prRect.top - roomRect.top) / roomRect.height : null,
      prRight: prRect && roomRect ? (roomRect.right - prRect.right) / roomRect.width : null,
    };
  });
  console.log('info:', JSON.stringify(info));

  // 창문은 숨겨짐
  expect(info.windowDisplay).toBe('none');
  // 놀아주기 보이고 우상단에 (top: ~10% 기준, right: ~8% 기준)
  expect(info.prVisible).toBe(true);
  expect(info.prTop).toBeLessThan(0.2);  // 위쪽 20% 이내
  expect(info.prRight).toBeLessThan(0.15); // 오른쪽 15% 이내
  console.log('✅ 놀아주기 버튼이 우상단 창문 자리로 이동 확인');
});
