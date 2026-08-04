import { test } from '@playwright/test';

// 실제 "수학 프리셋"(이번달·내 학생) 적용이 화면을 바꾸는지 증명 (읽기 전용)
// 다른 상태(모두 보기 43명)에서 시작 → 프리셋 적용 → 내 학생 16명으로 바뀌어야 함
const BASE = 'https://wawa-smart-erp.pages.dev';
test.setTimeout(120000);

test('수학 프리셋 적용이 모두보기→내학생으로 실제 전환하는지', async ({ page }) => {
  const log: string[] = [];

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

  await page.goto(BASE + '/#/exams', { waitUntil: 'domcontentloaded' });
  const mineBtn = page.locator('.scope-toggle button', { hasText: '내 학생' });
  const allBtn = page.locator('.scope-toggle button', { hasText: '모두 보기' });
  const presetTrigger = page.locator('.exam-dropdown-trigger', { hasText: '프리셋' });
  await mineBtn.waitFor({ state: 'visible', timeout: 20000 });

  async function snap(label: string) {
    await page.waitForTimeout(1500);
    const header = await page.locator('text=/담당 학생 \\d+명/').first().textContent().catch(() => '(없음)');
    const rows = await page.locator('table tbody tr').count().catch(() => -1);
    log.push(`[${label}] ${header?.trim()} / ${rows}행 / 내학생=${await mineBtn.getAttribute('aria-pressed')} 모두=${await allBtn.getAttribute('aria-pressed')}`);
  }

  // 1) 일부러 "모두 보기"로 전환
  await allBtn.click();
  await snap('출발: 모두 보기');

  // 2) "수학 프리셋" 적용
  await presetTrigger.click();
  await page.locator('.exam-preset-row__main', { hasText: '수학 프리셋' }).click();
  await snap('수학 프리셋 적용 후');

  await page.screenshot({ path: '/tmp/claude-0/-mnt-g-vine-academy-wawa-smart-erp/be98ee41-1395-4c8f-a7a9-4af7cd1ea856/scratchpad/math-preset.png', fullPage: false });
  console.log('\n===== 결과 =====');
  log.forEach(l => console.log(l));
});
