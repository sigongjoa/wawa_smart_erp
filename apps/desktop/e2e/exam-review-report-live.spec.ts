/**
 * ExamManagementPage의 정기고사 리뷰 리포트 컬럼 검증
 * - 헤더 "리포트" 컬럼 노출
 * - 중간/기말 토글 동작
 * - 각 학생 row에 "작성됨/미작성" 셀 표시
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};

test.setTimeout(90_000);
test.use({ baseURL: BASE });

test('ExamManagementPage에 정기고사 리포트 컬럼 + 토글 동작', async ({ page }) => {
  // 로그인
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const opts = document.querySelectorAll('#login-academy option');
    return opts.length > 1;
  }, { timeout: 15_000 });
  await page.locator('#login-academy').selectOption(TEACHER.slug);
  await page.waitForTimeout(600);
  await page.fill('#login-name', TEACHER.name);
  await page.fill('#login-pin', TEACHER.pin);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('#/login'), { timeout: 15_000 });

  // /#/exams 진입
  await page.goto('/#/exams', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /정기고사 관리/ })).toBeVisible({ timeout: 15_000 });

  // 리포트 stat 라인 (테이블 empty여도 렌더됨)
  await expect(page.locator('.exam-stat').filter({ hasText: /리포트:/ })).toBeVisible({ timeout: 10_000 });

  // 테이블이 있으면 헤더에 "리포트" 컬럼 포함
  const headerCount = await page.locator('.exam-table thead th').count();
  if (headerCount > 0) {
    const headerCells = (await page.locator('.exam-table thead th').allTextContents()).map(s => s.trim());
    expect(headerCells, '리포트 컬럼 헤더 노출').toContain('리포트');
  }

  // 리뷰 유형 토글
  const toggle = page.locator('.exam-review-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle.locator('.exam-review-toggle-btn').filter({ hasText: '중간' })).toBeVisible();
  await expect(toggle.locator('.exam-review-toggle-btn').filter({ hasText: '기말' })).toBeVisible();

  // 기본 "기말" active
  await expect(toggle.locator('.exam-review-toggle-btn.is-active')).toHaveText('기말');

  // 중간으로 토글
  await toggle.locator('.exam-review-toggle-btn').filter({ hasText: '중간' }).click();
  await expect(toggle.locator('.exam-review-toggle-btn.is-active')).toHaveText('중간');

  // 리포트 stat 표시
  await expect(page.locator('.exam-stat').filter({ hasText: /리포트:/ })).toBeVisible();

  // 데이터 행에 리포트 셀 존재 (데이터 있으면 검증)
  const reportCells = page.locator('.exam-cell-report');
  const hasRows = await reportCells.count();
  if (hasRows > 0) {
    // 최소 "작성됨" or "미작성" 중 하나는 렌더
    const any = page.locator('.exam-report-link, .exam-report-pending').first();
    await expect(any).toBeVisible();
  }

  console.log(`✅ 리포트 컬럼 통과 — cells=${hasRows}`);
});
