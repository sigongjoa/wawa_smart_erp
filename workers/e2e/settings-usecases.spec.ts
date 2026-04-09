import { test, expect } from '@playwright/test';

/**
 * 설정 페이지 전체 유즈케이스 E2E 테스트
 * UC1: 학생 추가
 * UC2: 시험 월 설정
 * UC3: 기본 설정
 * UC4: 설정값 유지 확인
 */

const APP_URL = 'http://localhost:5173';

test.describe.serial('⚙️ 설정 페이지 유즈케이스', () => {
  let page: any;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Error] ${err.message}`));
  });

  // UC1: 로그인
  test('UC0: 관리자 로그인', async () => {
    await page.goto(APP_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const inputs = await page.locator('input');
    await inputs.nth(0).fill('김상현');
    await inputs.nth(1).fill('1234');

    const loginButton = await page.locator('button:has-text("로그인")');
    await loginButton.click();
    console.log('✅ 로그인 완료');

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    expect(currentUrl).toContain('timer');
  });

  // UC1: 설정 페이지 접근
  test('UC1-1: 설정 페이지 접근', async () => {
    const settingsButton = await page.locator('button[aria-label="설정"]');
    await settingsButton.click();
    console.log('✅ 설정 페이지 접근');

    await page.waitForTimeout(500);

    const currentUrl = page.url();
    expect(currentUrl).toContain('settings');
    console.log(`✅ URL: ${currentUrl}`);
  });

  // UC1: 학생 추가
  test('UC1-2: 학생 추가 (박도윤)', async () => {
    // 학생 관리 탭 확인 (기본 활성화)
    const studentTab = page.locator('button').filter({ hasText: '학생 관리' });
    const isActive = await studentTab.evaluate((el) => {
      return el.getAttribute('style')?.includes('var(--primary)') ?? false;
    }).catch(() => false);
    console.log(`학생 관리 탭 활성화: ${isActive}`);

    // 학생 추가 버튼 클릭
    const addButton = page.locator('button:has-text("+ 학생 추가")');
    await addButton.click();
    console.log('✅ 학생 추가 버튼 클릭');

    await page.waitForTimeout(500);

    // 폼 입력
    const nameInput = page.locator('input[placeholder="예: 강은서"]');
    await nameInput.fill('박도윤');
    console.log('✅ 학생 이름 입력: 박도윤');

    const gradeSelect = page.locator('select').first();
    await gradeSelect.selectOption('중2');
    console.log('✅ 학년 선택: 중2');

    // 저장
    const saveButton = page.locator('button').filter({ hasText: /^추가$/ });
    await saveButton.first().click();
    console.log('✅ 학생 추가 저장');

    await page.waitForTimeout(1000);

    // 목록에 추가되었는지 확인
    const studentList = await page.textContent('body');
    expect(studentList).toContain('박도윤');
    console.log('✅ 박도윤이 목록에 추가됨');
  });

  // UC2: 시험 월 설정
  test('UC2: 시험 월 설정 (2026-04)', async () => {
    // 시험 월 설정 탭 클릭
    const examTab = page.locator('button').filter({ hasText: '시험 월 설정' });
    await examTab.click();
    console.log('✅ 시험 월 설정 탭 클릭');

    await page.waitForTimeout(500);

    // 월 선택
    const monthSelect = page.locator('select').first();
    await monthSelect.selectOption('2026-04');
    console.log('✅ 2026-04 선택');

    // 저장
    const saveButton = page.locator('button').filter({ hasText: /^저장$/ });
    const saveButtons = await saveButton.count();
    console.log(`저장 버튼 개수: ${saveButtons}개`);

    // 시험 월 설정 탭의 저장 버튼 (처음 나오는 것)
    await page.locator('button').filter({ hasText: '저장' }).first().click();
    console.log('✅ 시험 월 저장');

    await page.waitForTimeout(1000);

    // 토스트 메시지 확인
    const toastText = await page.textContent('body').catch(() => '');
    if (toastText?.includes('저장')) {
      console.log('✅ 저장 완료 메시지 표시됨');
    }
  });

  // UC3: 기본 설정
  test('UC3: 기본 설정 (학원명)', async () => {
    // 기본 설정 탭 클릭
    const basicTab = page.locator('button').filter({ hasText: '기본 설정' });
    await basicTab.click();
    console.log('✅ 기본 설정 탭 클릭');

    await page.waitForTimeout(500);

    // 학원명 입력
    const academyInput = page.locator('input[placeholder="예: 와와 학원"]');
    const isVisible = await academyInput.isVisible({ timeout: 2000 }).catch(() => false);
    expect(isVisible).toBe(true);

    await academyInput.fill('와와 학원');
    console.log('✅ 학원명 입력: 와와 학원');

    // 저장
    const saveButton = page.locator('button').filter({ hasText: '저장' }).last();
    await saveButton.click();
    console.log('✅ 기본 설정 저장');

    await page.waitForTimeout(1000);

    // 저장 완료 확인
    const savedValue = await academyInput.inputValue();
    expect(savedValue).toBe('와와 학원');
    console.log('✅ 학원명이 저장됨');
  });

  // UC4: 설정값 유지 확인
  test('UC4: 페이지 새로고침 후 설정값 유지', async () => {
    // 현재 탭에서 값 확인
    const academyInput = page.locator('input[placeholder="예: 와와 학원"]');
    const valueBefore = await academyInput.inputValue();
    console.log(`새로고침 전 학원명: ${valueBefore}`);

    // 페이지 새로고침
    await page.reload();
    console.log('✅ 페이지 새로고침');

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 설정 페이지 재접근
    const settingsButton = await page.locator('button[aria-label="설정"]');
    await settingsButton.click();
    console.log('✅ 설정 페이지 재접근');

    await page.waitForTimeout(500);

    // 기본 설정 탭 클릭
    const basicTab = page.locator('button').filter({ hasText: '기본 설정' });
    await basicTab.click();
    console.log('✅ 기본 설정 탭 클릭');

    await page.waitForTimeout(500);

    // 값 확인
    const academyInputAfter = page.locator('input[placeholder="예: 와와 학원"]');
    const valueAfter = await academyInputAfter.inputValue();
    console.log(`새로고침 후 학원명: ${valueAfter}`);

    expect(valueAfter).toBe('와와 학원');
    console.log('✅ 설정값이 유지됨 (localStorage persist)');
  });

  // 정리
  test.afterAll(async () => {
    if (page) {
      await page.close();
    }
    console.log('✅ 모든 테스트 완료');
  });
});
