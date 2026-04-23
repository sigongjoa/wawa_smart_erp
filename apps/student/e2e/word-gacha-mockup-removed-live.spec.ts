/**
 * word-gacha 목업 제거 + 실 데이터 반영 검증
 */
import { test, expect, type Page } from '@playwright/test';

const TEACHER = {
  academyName: process.env.E2E_ACADEMY_NAME || 'E2E테스트학원',
};
const STU = { name: '테스트학생', pin: '1234' };

async function login(page: Page) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click(`.academy-item:has-text("${TEACHER.academyName}")`);
  await page.fill('input[placeholder="이름"]', STU.name);
  await page.fill('input[placeholder*="PIN"]', STU.pin);
  await page.click('.login-btn');
  await expect(page.locator('.home-page')).toBeVisible({ timeout: 15_000 });
}

async function enterWordGacha(page: Page) {
  await login(page);
  // creature 주입 (온보딩/재회 dialog skip)
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
    const dlgs = ['#dlg-onboard', '#reunion'];
    for (const id of dlgs) {
      const el = document.querySelector(id) as HTMLDialogElement | null;
      if (el?.open) el.close();
      if (el) el.hidden = true;
    }
  });
}

test('홈에서 목업 카피 제거됨', async ({ page }) => {
  await enterWordGacha(page);

  // 과거 목업 문구 전부 없어야 함
  const body = page.locator('body');
  await expect(body).not.toContainText('오늘 복습');
  await expect(body).not.toContainText('문법 답변도');
  await expect(body).not.toContainText('오늘의 퀘스트');
  await expect(body).not.toContainText('이번 주 페이스');
  await expect(body).not.toContainText('복습 세션');
  await expect(body).not.toContainText('새 단어 포획');
  await expect(body).not.toContainText('4월 19일 일');
  await expect(body).not.toContainText('23분');
  await expect(body).not.toContainText('+18%');

  console.log('✅ 홈 목업 카피 모두 제거됨');
});

test('HUD가 profile 기반 (하드코딩 LV 12 / 92 / 250 아님)', async ({ page }) => {
  await enterWordGacha(page);

  // HUD 값은 profile.lv/coin/streak 으로 세팅 — seed(LV 1, coin 0, streak 0)
  await expect(page.locator('#hud-lv')).toBeVisible();
  await expect(page.locator('#hud-coin')).toBeVisible();
  await expect(page.locator('#hud-streak')).toBeVisible();

  const lv = (await page.locator('#hud-lv').textContent())?.trim();
  const coin = (await page.locator('#hud-coin').textContent())?.trim();
  const streak = (await page.locator('#hud-streak').textContent())?.trim();
  console.log(`HUD: LV=${lv}, coin=${coin}, streak=${streak}`);

  // 구 목업 고정값 아님 확인
  expect(lv).not.toBe('12');
  expect(coin).not.toBe('250');
  expect(streak).not.toBe('92');

  console.log('✅ HUD = profile 기반 실 값');
});

test('기록(me) 화면에 실제 학생명 + words 기반 stats', async ({ page }) => {
  await enterWordGacha(page);

  // 하단 "기록" 탭 이동
  await page.locator('nav.tabbar').getByRole('button', { name: /기록/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'me', { timeout: 5_000 });

  // debug: localStorage play_student 확인
  const ls = await page.evaluate(() => ({
    play_student: localStorage.getItem('play_student'),
    play_token_len: (localStorage.getItem('play_token') || '').length,
  }));
  console.log('[LS]', JSON.stringify(ls));

  // 이름이 테스트학생 (반영 시간 고려 waitFor)
  await expect(page.locator('#me-name')).toHaveText(STU.name, { timeout: 5_000 });

  // stats 라벨
  await expect(page.locator('.stat-box').filter({ hasText: '외운 단어' })).toBeVisible();
  await expect(page.locator('.stat-box').filter({ hasText: '단어 수' })).toBeVisible();
  await expect(page.locator('.stat-box').filter({ hasText: '정답률' })).toBeVisible();

  // 구 목업 고정 stat 사라짐
  await expect(page.locator('body')).not.toContainText('1,284');
  await expect(page.locator('body')).not.toContainText('최장 17일');
  // 배지 6/12 도 사라짐 (목업 이었음)
  await expect(page.locator('.badges-grid')).toHaveCount(0);

  // 단어 수 — 테스트학생은 approved 5 + pending 1 = 6개
  // loadServerWords가 비동기라 잠시 대기
  await page.waitForFunction(() => {
    const el = document.getElementById('me-stat-total');
    return el && Number(el.textContent) > 0;
  }, undefined, { timeout: 10_000 });
  const total = (await page.locator('#me-stat-total').textContent())?.trim();
  const finalName = (await page.locator('#me-name').textContent())?.trim();
  console.log(`me: name=${finalName}, total=${total}`);
  expect(Number(total)).toBeGreaterThan(0);

  console.log('✅ me 화면 실 데이터 연결');
});
