/**
 * word-gacha 전체 상태 서버 동기화 검증
 *   시나리오: 기기A에서 진행 → localStorage clear → 기기B에서 재로그인 → 모든 상태 복원
 *
 * 실행: STUDENT_URL=https://wawa-learn.pages.dev npx playwright test e2e/word-gacha-server-state.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';

const API = process.env.API || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const ACADEMY_NAME = '알파시티점';
const STUDENT_NAME = '강은서';
const STUDENT_PIN = '9999';

async function loginAsStudent(page: Page) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click(`.academy-item:has-text("${ACADEMY_NAME}")`);
  await page.fill('input[placeholder="이름"]', STUDENT_NAME);
  await page.fill('input[placeholder*="PIN"]', STUDENT_PIN);
  await page.click('.login-btn');
  await expect(page.locator('.home-page')).toBeVisible({ timeout: 15_000 });
}

async function enterWordGacha(page: Page) {
  const vocabBtn = page.locator('.home-mode-card').filter({ hasText: '영단어' });
  await vocabBtn.click();
  await page.waitForURL(/\/word-gacha\//, { timeout: 15_000 });
  await expect(page).toHaveTitle(/Word Gacha/);
}

async function completeOnboardingIfShown(page: Page, name: string) {
  const onboard = page.locator('#dlg-onboard');
  // hydrateFromServer가 서버 fetch + removeItem까지 끝날 시간을 줌
  await page.waitForFunction(
    () => document.body.dataset.creature === 'ready' || document.getElementById('dlg-onboard')?.hasAttribute('open'),
    null, { timeout: 10_000 }
  ).catch(() => {});
  if (await onboard.isVisible().catch(() => false)) {
    await onboard.locator('.egg-pick[data-species="sprout"]').click();
    await expect(onboard).toHaveAttribute('data-species', 'sprout');
    await page.click('#btn-onboard-next');
    await expect(onboard).toHaveAttribute('data-step', '2');
    await onboard.locator('#inp-name').fill(name);
    await page.click('#btn-onboard-next');
    await expect(onboard).toHaveAttribute('data-step', '3');
    await expect(onboard).toHaveAttribute('data-name', name);
    await onboard.locator('.per-pick[data-personality="curious"]').click();
    await expect(onboard).toHaveAttribute('data-personality', 'curious');
    await page.click('#btn-onboard-next');
    await expect(onboard).toBeHidden({ timeout: 5_000 });
    // 다이얼로그 닫힌 직후 localStorage에 creature가 즉시 존재해야 함
    await page.waitForFunction(() => !!localStorage.getItem('wg.v1.creature'), null, { timeout: 2_000 });
  }
}

test('word-gacha 서버 state: 기기A 진행 → 로컬 clear → 기기B 재로그인 → 복원', async ({ page, context }) => {
  const consoleErrors: string[] = [];
  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  // ── 0) 로그인 → 서버 state 초기화 (이전 테스트 잔재 제거)
  await loginAsStudent(page);
  console.log('✅ 1. 기기A 로그인');

  const preToken = await page.evaluate(() => localStorage.getItem('play_token'));
  await page.request.put(`${API}/api/play/vocab/state`, {
    headers: { Authorization: `Bearer ${preToken}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({}),
  });
  console.log('✅ 1.5 서버 state 초기화');

  await enterWordGacha(page);
  console.log('✅ 2. word-gacha 진입');

  const creatureName = `토토${Date.now().toString().slice(-4)}`;
  await completeOnboardingIfShown(page, creatureName);
  console.log(`✅ 3. 온보딩 완료 (이름=${creatureName})`);

  // 서버 저장 debounce(1.2s) + max-defer(4s) + 여유
  await page.waitForTimeout(5000);

  const token = await page.evaluate(() => localStorage.getItem('play_token'));
  expect(token, 'play_token').toBeTruthy();

  // 서버 state 확인
  const stateRes1 = await page.request.get(`${API}/api/play/vocab/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(stateRes1.status()).toBe(200);
  const stateJson1 = await stateRes1.json();
  const savedState = stateJson1?.data?.state;
  console.log(`[DEBUG] 서버 savedState keys=${savedState ? Object.keys(savedState) : 'null'}, creature=${JSON.stringify(savedState?.creature)?.slice(0,120)}`);
  expect(savedState, '서버에 state가 저장되어 있어야 함').toBeTruthy();
  expect(savedState.creature?.name).toBe(creatureName);
  expect(['sprout', 'ember', 'droplet']).toContain(savedState.creature?.speciesKey);
  expect(savedState.profile).toBeTruthy();
  console.log(`✅ 4. 서버 state 저장 확인 (creature.name=${savedState.creature.name}, profile.lv=${savedState.profile?.lv ?? '-'})`);

  // ── 5) 기기A의 localStorage 전체 clear (토큰 제외)
  const snapshot = await page.evaluate(() => {
    const keep = {
      play_token: localStorage.getItem('play_token'),
      play_student: localStorage.getItem('play_student'),
    };
    localStorage.clear();
    if (keep.play_token) localStorage.setItem('play_token', keep.play_token);
    if (keep.play_student) localStorage.setItem('play_student', keep.play_student);
    return Object.keys(localStorage);
  });
  expect(snapshot.some(k => k.startsWith('wg.v1.'))).toBeFalsy();
  console.log('✅ 5. 로컬 state 전부 clear (토큰만 보존 — 기기 바꿈 시뮬)');

  // ── 6) 기기B 가정: word-gacha 재진입 → hydrateFromServer가 서버에서 복원
  await page.goto('/word-gacha/');
  await expect(page).toHaveTitle(/Word Gacha/);
  await page.waitForLoadState('networkidle');

  // 온보딩이 다시 뜨면 안 됨 (creature 복원됨)
  await page.waitForTimeout(1500);
  const onboardVisible = await page.locator('#dlg-onboard').isVisible().catch(() => false);
  expect(onboardVisible, '온보딩이 다시 뜨면 안 됨 (서버에서 creature 복원되어야)').toBeFalsy();
  console.log('✅ 6. 재진입 — 온보딩 안 뜸 (creature 서버에서 복원)');

  // ── 7) localStorage에 hydrate된 값 확인
  const hydrated = await page.evaluate(() => ({
    creature: JSON.parse(localStorage.getItem('wg.v1.creature') || 'null'),
    profile:  JSON.parse(localStorage.getItem('wg.v1.profile')  || 'null'),
    badges:   JSON.parse(localStorage.getItem('wg.v1.badges')   || 'null'),
    seen:     JSON.parse(localStorage.getItem('wg.v1.seen')     || 'null'),
  }));
  expect(hydrated.creature?.name).toBe(creatureName);
  expect(hydrated.profile).toBeTruthy();
  console.log(`✅ 7. 로컬 복원 확인 (creature.name=${hydrated.creature.name})`);

  // ── 8) 콘솔 에러 없음
  const hardErrs = consoleErrors.filter(e => !/favicon|404/.test(e));
  expect(hardErrs, `콘솔 에러: ${hardErrs.join(' | ')}`).toEqual([]);
  console.log('✅ 8. 콘솔 clean');
});
