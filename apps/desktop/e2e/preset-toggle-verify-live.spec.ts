import { test, expect } from '@playwright/test';

// 프리셋 적용 → scope 토글이 실제로 바뀌는지 검증 (사용자 요청)
// 로그인: 서재용/1141/alpha (admin). 프리셋 2개 생성→적용→검증→삭제(정리).
const BASE = 'https://wawa-smart-erp.pages.dev';

test.setTimeout(180000);

test('프리셋 적용 시 scope 토글이 켜지는지 검증', async ({ page }) => {
  const log: string[] = [];
  page.on('console', m => log.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => log.push(`[PAGEERR] ${e.message}`));

  // ── 로그인 ──
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#login-academy option').length > 1, { timeout: 20000 });
  await page.locator('#login-academy').selectOption('alpha');
  await page.waitForTimeout(1000);
  await page.fill('#login-name', '서재용');
  await page.fill('#login-pin', '1141');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  // ── /exams 이동 ──
  await page.goto(BASE + '/#/exams', { waitUntil: 'domcontentloaded' });
  const mineBtn = page.locator('.scope-toggle button', { hasText: '내 학생' });
  const allBtn = page.locator('.scope-toggle button', { hasText: '모두 보기' });
  await expect(mineBtn).toBeVisible({ timeout: 20000 });
  log.push(`[TOGGLE 존재] 내학생/모두 버튼 렌더됨 (admin)`);

  const presetTrigger = page.locator('.exam-dropdown-trigger', { hasText: '프리셋' });
  const uniq = Date.now(); // 파일 스코프 밖: import된 값 아님 → OK (Date는 브라우저 아닌 노드)
  const NAME_ALL = `E2E_ALL_${uniq}`;
  const NAME_MINE = `E2E_MINE_${uniq}`;

  // 프리셋 생성 헬퍼
  async function createPreset(name: string, scopeLabel: '내 학생' | '모두 보기') {
    await presetTrigger.click();
    await page.locator('.exam-preset-save', { hasText: '현재 화면 저장' }).click();
    await page.fill('#preset-name', name);
    // 모달 내 scope 라디오 선택
    await page.locator('label', { hasText: scopeLabel }).locator('input[name="preset-scope"]').check();
    await page.locator('.btn-primary', { hasText: '저장' }).click();
    await page.waitForTimeout(1500);
  }

  await createPreset(NAME_ALL, '모두 보기');
  await createPreset(NAME_MINE, '내 학생');

  // ── 검증 1: 토글을 '내 학생'으로 두고, ALL 프리셋 적용 → '모두 보기'가 켜져야 함 ──
  await mineBtn.click();
  await page.waitForTimeout(500);
  const beforeMine = await mineBtn.getAttribute('aria-pressed');
  const beforeAll = await allBtn.getAttribute('aria-pressed');
  log.push(`[적용 전] 내학생aria=${beforeMine} 모두aria=${beforeAll} (내학생이 true여야 baseline)`);

  await presetTrigger.click();
  await page.locator('.exam-preset-row__main', { hasText: NAME_ALL }).click();
  await page.waitForTimeout(1200);
  const afterMine1 = await mineBtn.getAttribute('aria-pressed');
  const afterAll1 = await allBtn.getAttribute('aria-pressed');
  log.push(`[ALL 프리셋 적용 후] 내학생aria=${afterMine1} 모두aria=${afterAll1} (모두가 true여야 정상)`);

  // ── 검증 2: MINE 프리셋 적용 → '내 학생'이 켜져야 함 ──
  await presetTrigger.click();
  await page.locator('.exam-preset-row__main', { hasText: NAME_MINE }).click();
  await page.waitForTimeout(1200);
  const afterMine2 = await mineBtn.getAttribute('aria-pressed');
  const afterAll2 = await allBtn.getAttribute('aria-pressed');
  log.push(`[MINE 프리셋 적용 후] 내학생aria=${afterMine2} 모두aria=${afterAll2} (내학생이 true여야 정상)`);

  await page.screenshot({ path: '/tmp/claude-0/-mnt-g-vine-academy-wawa-smart-erp/be98ee41-1395-4c8f-a7a9-4af7cd1ea856/scratchpad/preset-toggle.png', fullPage: true });

  // ── 정리: 생성한 프리셋 삭제 ──
  for (const nm of [NAME_ALL, NAME_MINE]) {
    try {
      await presetTrigger.click();
      page.once('dialog', d => d.accept());
      await page.locator('.exam-preset-row', { hasText: nm }).locator('.exam-preset-row__icon-btn').last().click();
      await page.waitForTimeout(1000);
    } catch (e) { log.push(`[정리 실패] ${nm}: ${(e as Error).message}`); }
  }

  console.log('\n===== 결과 =====');
  log.forEach(l => console.log(l));

  // 어서션 (실패해도 위 로그로 실제 상태 확인 가능)
  expect(afterAll1, 'ALL 프리셋 적용 후 "모두 보기" 토글이 켜져야 함').toBe('true');
  expect(afterMine2, 'MINE 프리셋 적용 후 "내 학생" 토글이 켜져야 함').toBe('true');
});
