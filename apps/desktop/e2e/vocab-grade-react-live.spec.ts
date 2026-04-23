/**
 * /vocab/grade 가 React 페이지로 로드되는지 검증 (구 static HTML 대체됨)
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};

test.setTimeout(60_000);
test.use({ baseURL: BASE });

test('사이드바 "출제·채점" → React /vocab/grade (ERP Layout 유지)', async ({ page }) => {
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

  // 사이드바 그룹 펼치기 + 출제·채점 클릭
  const vocabGroup = page.locator('button.sidebar-nav-group-toggle', { hasText: '학습 (영단어)' });
  await vocabGroup.click();
  const gradeLink = page.locator('.app-sidebar a, .app-sidebar nav a', { hasText: '출제·채점' });
  await expect(gradeLink.first()).toBeVisible({ timeout: 5_000 });
  await gradeLink.first().click();

  await page.waitForURL(/#\/vocab\/grading$/, { timeout: 10_000 });

  // ERP Layout 유지
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await expect(page.locator('.app-content')).toBeVisible();

  // 페이지 타이틀 (VocabAdminPage)
  await expect(page.getByRole('heading', { name: '학습 (영단어)' })).toBeVisible();

  // 서브 탭의 "출제·채점"이 active
  await expect(page.locator('.vocab-subtab--active', { hasText: '출제·채점' })).toBeVisible();

  // React 페이지 UI (빈 상태 or 기존 printJob 상태 — 어느 쪽이든 React 요소여야 함)
  const hasEmpty = await page.locator('.vocab-grade-empty-title').count();
  const hasStudents = await page.locator('.vocab-grade-students').count();
  expect(hasEmpty + hasStudents).toBeGreaterThan(0);

  // 구버전 title이 아님
  const title = await page.title();
  expect(title).not.toContain('채점하기 — Word Gacha');

  // 헤더에 primary action "시험지 만들기" 있음
  await expect(
    page.locator('.vocab-header-action').getByRole('button', { name: /시험지 만들기/ })
  ).toBeVisible();

  console.log(`✅ /vocab/grade React 페이지 로드 — empty=${hasEmpty}, students=${hasStudents}`);
});
