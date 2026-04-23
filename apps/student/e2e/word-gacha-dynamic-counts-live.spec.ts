/**
 * 하드코딩 목업 수치가 실제 데이터로 바뀌었는지 검증
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
  await page.waitForTimeout(1000);
}

test('내 단어장 필터 pill 카운트가 실 데이터 (342/18/74/250 아님)', async ({ page }) => {
  await enter(page);
  // 학습 탭 → 내 단어장
  await page.locator('nav.tabbar').getByRole('button', { name: /학습/ }).click();
  await page.locator('#tab-learn-mywords').click();
  await expect(page.locator('#tab-learn-mywords')).toHaveAttribute('aria-selected', 'true');

  const counts = await page.evaluate(() => ({
    all: document.querySelector('[data-count="all"]')?.textContent,
    new: document.querySelector('[data-count="new"]')?.textContent,
    learning: document.querySelector('[data-count="learning"]')?.textContent,
    mastered: document.querySelector('[data-count="mastered"]')?.textContent,
  }));
  console.log('counts:', JSON.stringify(counts));

  // 고정 목업 all=342 아님
  expect(counts.all).not.toBe('342');
  // 합산이 all과 일치 = 동적 계산됨
  const sum = Number(counts.new) + Number(counts.learning) + Number(counts.mastered);
  expect(Number(counts.all)).toBe(sum);
  expect(sum).toBeGreaterThan(0);
});

test('도감 전체/품사별 카운트 실 데이터 (342/1200 아님)', async ({ page }) => {
  await enter(page);
  await page.locator('nav.tabbar').getByRole('button', { name: /도감/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'dex');

  const dex = await page.evaluate(() => ({
    heroBig: document.getElementById('dex-hero-big')?.firstChild?.textContent,
    heroTotal: document.getElementById('dex-hero-total')?.textContent,
    heroPct: document.getElementById('dex-hero-pct')?.textContent,
    noun: document.querySelector('[data-dex-num="noun"]')?.textContent,
    verb: document.querySelector('[data-dex-num="verb"]')?.textContent,
  }));
  console.log('dex:', JSON.stringify(dex));

  // 목업 값 아님
  expect(dex.heroBig).not.toBe('342');
  expect(dex.noun).not.toBe('128 / 380');
  expect(dex.verb).not.toBe('94 / 310');
  // 전체 합 형식 "N / M"
  expect(dex.noun).toMatch(/^\d+\s*\/\s*\d+$/);
});
