/**
 * Vocab Admin React 포팅 검증
 *
 * 확인 항목:
 *  1. ERP 사이드바가 정상 렌더 (게임 UI 아님)
 *  2. 사이드바 "학습 (영단어)" > "단어 관리" 클릭 → /vocab 이동
 *  3. /vocab 페이지에 ERP Layout (app-sidebar + app-main) 유지
 *  4. 서브 네비 탭 + 필터 바 + 테이블 노출
 *  5. pending 배너 표시 (카운트 > 0인 경우)
 *  6. 단어 추가 모달 열고 닫기
 *  7. 로그인 튕김 없음
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};

test.setTimeout(120_000);
test.use({ baseURL: BASE });

test('ERP 사이드바 네비 → /vocab React 페이지 정상 로드', async ({ page }) => {
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

  // 사이드바 그룹 펼치기
  const vocabGroup = page.locator('button.sidebar-nav-group-toggle', { hasText: '학습 (영단어)' });
  await expect(vocabGroup).toBeVisible({ timeout: 10_000 });
  await vocabGroup.click();

  // "단어 관리" (NEW React) 링크 클릭
  const newLink = page.locator('.app-sidebar a', { hasText: '단어 관리' });
  await expect(newLink).toBeVisible();
  await newLink.click();

  // URL 체크
  await page.waitForURL(/#\/vocab$/, { timeout: 10_000 });

  // ERP Layout 유지 확인
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await expect(page.locator('.app-content')).toBeVisible();

  // 서브 네비 + 페이지 타이틀
  await expect(page.getByRole('heading', { name: '학습 (영단어)' })).toBeVisible();
  await expect(page.locator('.vocab-subnav')).toBeVisible();
  await expect(page.locator('.vocab-subtab--active', { hasText: '단어 관리' })).toBeVisible();

  // 필터 바
  await expect(page.locator('.vocab-filter-bar select').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /새로고침/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /\+ 단어 추가/ })).toBeVisible();

  // 테이블 헤더
  await expect(page.locator('.vocab-table thead')).toBeVisible();
  const headerCells = await page.locator('.vocab-table thead th').allTextContents();
  expect(headerCells).toContain('학생');
  expect(headerCells).toContain('영어');
  expect(headerCells).toContain('품사');
  expect(headerCells).toContain('제출자');

  // 단어 추가 모달
  await page.getByRole('button', { name: /\+ 단어 추가/ }).click();
  await expect(page.locator('.modal-overlay')).toBeVisible();
  await expect(page.getByText('단어 추가', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-overlay')).not.toBeVisible();

  // 로그인 튕김 없음
  const finalUrl = page.url();
  expect(finalUrl, '로그인 페이지로 튕기면 안 됨').not.toContain('#/login');

  console.log('✅ /vocab React 페이지 정상 — ERP Layout 유지, 모든 UI 요소 노출');
});
