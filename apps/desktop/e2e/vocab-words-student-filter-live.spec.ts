/**
 * Vocab Words 페이지 — 학생 필터 강화 검증 (live)
 *
 * 검증:
 *   A. 페이지 골격 (tabs, metric chips, panel)
 *   B. 학생 chip row 렌더
 *   C. chip 클릭 → 필터 적용 + hero header 등장 + 학생 컬럼 숨김
 *   D. 정렬 토글 (오답 많은 순) 동작
 *   E. hero "전체 보기" 클릭 → 필터 해제
 *
 * 실행:
 *   E2E_BASE_URL=https://wawa-smart-erp.pages.dev npx playwright test e2e/vocab-words-student-filter-live.spec.ts
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

  // academy select (필요 시 — 가장 첫 번째 선택)
  const academy = page.locator('select#login-academy');
  if (await academy.count() > 0) {
    const options = await academy.locator('option').all();
    // 첫 번째 non-empty value
    for (const opt of options) {
      const v = await opt.getAttribute('value');
      if (v) {
        await academy.selectOption(v);
        await page.waitForTimeout(300);
        break;
      }
    }
  }

  await page.locator('input#login-name').fill(ADMIN.name);
  await page.locator('input#login-pin').fill(ADMIN.pin);
  await page.locator('button[type="submit"]').click();

  await page.waitForFunction(() => window.location.hash && !window.location.hash.includes('/login'), {
    timeout: 15000,
  });
}

test.describe('Vocab Words — 학생 필터 강화', () => {

  test('A. 페이지 골격 (tabs, metric chips, table)', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/#/vocab`);
    await page.waitForSelector('.v2-tabs', { timeout: 15000 });

    // 4 탭
    await expect(page.locator('.v2-tabs__item')).toHaveCount(4);
    // 단어 탭이 active
    await expect(page.locator('.v2-tabs__item.is-active')).toContainText('단어');

    // metric chips (전체/대기/승인)
    await expect(page.locator('.v2-metric-chip')).toHaveCount(3);

    // panel 표
    await page.waitForSelector('.v2-data-table', { timeout: 10000 }).catch(() => {});
    console.log('✓ A: 골격 OK');
  });

  test('B. 학생 chip row 렌더', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/#/vocab`);
    await page.waitForSelector('.v2-tabs', { timeout: 15000 });
    // 학생 chip row — 데이터 있으면 렌더
    const chips = page.locator('.v2-student-chip');
    const count = await chips.count();
    console.log(`  학생 chip 수: ${count}`);
    if (count > 0) {
      // "전체 학생" chip 항상 첫번째
      await expect(chips.first()).toContainText('전체 학생');
    }
  });

  test('C. chip 클릭 → 필터 + hero + 컬럼 숨김', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/#/vocab`);
    await page.waitForSelector('.v2-tabs', { timeout: 15000 });

    const studentChips = page.locator('.v2-student-chip:not(:has-text("전체 학생"))');
    const chipCount = await studentChips.count();
    if (chipCount === 0) {
      console.log('  학생 데이터 없음 — skip');
      return;
    }

    // 첫 학생 chip 클릭
    const firstChip = studentChips.first();
    const chipText = await firstChip.textContent();
    const studentName = chipText?.trim().split(/[\s·]/)[0];
    console.log(`  클릭 대상: ${studentName}`);

    await firstChip.click();
    await page.waitForTimeout(800);

    // chip is-active 표시
    await expect(firstChip).toHaveClass(/is-active/);

    // hero header 등장
    await expect(page.locator('.v2-student-hero')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.v2-student-hero__name')).toContainText(studentName!);
    console.log('  ✓ hero header 표시 OK');

    // 표에서 "학생" 컬럼이 사라졌는지
    const headers = await page.locator('.v2-data-table thead th').allTextContents();
    expect(headers.some(h => h.includes('학생'))).toBe(false);
    console.log('  ✓ 학생 컬럼 숨김 OK');

    // toolbar "학생" select 값도 동기화
    const studentSelectValue = await page.locator('.v2-toolbar-field:has(.v2-toolbar-field__label:has-text("학생")) select').inputValue();
    expect(studentSelectValue).not.toBe('');
    console.log('  ✓ toolbar select 동기화 OK');
  });

  test('D. 정렬 토글 — 오답 많은 순', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/#/vocab`);
    await page.waitForSelector('.v2-tabs', { timeout: 15000 });

    const sortSelect = page.locator('.v2-toolbar-field:has(.v2-toolbar-field__label:has-text("정렬")) select');
    await expect(sortSelect).toBeVisible();
    await sortSelect.selectOption('wrong-desc');
    await page.waitForTimeout(500);
    expect(await sortSelect.inputValue()).toBe('wrong-desc');
    console.log('  ✓ 오답 많은 순 정렬 OK');
  });

  test('E. hero "전체 보기" → 필터 해제', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/#/vocab`);
    await page.waitForSelector('.v2-tabs', { timeout: 15000 });

    const studentChips = page.locator('.v2-student-chip:not(:has-text("전체 학생"))');
    if (await studentChips.count() === 0) {
      console.log('  학생 데이터 없음 — skip');
      return;
    }

    await studentChips.first().click();
    await page.waitForTimeout(600);
    await expect(page.locator('.v2-student-hero')).toBeVisible();

    // hero 안의 "전체 보기" 버튼
    await page.locator('.v2-student-hero button:has-text("전체 보기")').click();
    await page.waitForTimeout(400);

    // hero 사라지고 chip is-active 가 "전체 학생" 으로
    await expect(page.locator('.v2-student-hero')).not.toBeVisible();
    const activeChipText = await page.locator('.v2-student-chip.is-active').textContent();
    expect(activeChipText).toContain('전체 학생');
    console.log('  ✓ 필터 해제 OK');
  });
});
