import { test } from '@playwright/test';

// "내 학생"(16) vs "모두 보기"(43) 실제 목록 카운트가 바뀌는지 검증 (읽기 전용)
const BASE = 'https://wawa-smart-erp.pages.dev';
test.setTimeout(120000);

test('scope 토글이 학생 목록 카운트를 실제로 바꾸는지', async ({ page }) => {
  const log: string[] = [];
  page.on('response', async r => {
    if (r.url().includes('/api/exam-mgmt/by-month')) {
      log.push(`[API] ${r.url().split('/api/')[1]} -> ${r.status()}`);
    }
  });

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
  await mineBtn.waitFor({ state: 'visible', timeout: 20000 });

  // 헤더의 "담당 학생 N명" 텍스트 읽기 헬퍼
  async function readState(label: string) {
    await page.waitForTimeout(1500);
    const header = await page.locator('text=/담당 학생 \\d+명/').first().textContent().catch(() => '(없음)');
    const rows = await page.locator('table tbody tr').count().catch(() => -1);
    const mineAria = await mineBtn.getAttribute('aria-pressed');
    const allAria = await allBtn.getAttribute('aria-pressed');
    log.push(`[${label}] header="${header?.trim()}" tableRows=${rows} 내학생aria=${mineAria} 모두aria=${allAria}`);
  }

  await mineBtn.click();
  await readState('내 학생 클릭');
  await allBtn.click();
  await readState('모두 보기 클릭');
  await mineBtn.click();
  await readState('다시 내 학생');

  await page.screenshot({ path: '/tmp/claude-0/-mnt-g-vine-academy-wawa-smart-erp/be98ee41-1395-4c8f-a7a9-4af7cd1ea856/scratchpad/scope-count.png', fullPage: false });

  console.log('\n===== 결과 =====');
  log.forEach(l => console.log(l));
});
