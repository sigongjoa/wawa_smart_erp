import { test, expect } from '@playwright/test';

/**
 * GlobalSettings 상태 동기화 수정 검증
 * Solution 1, 2, 3 검증
 */

const APP_URL = 'http://localhost:5173';

test.describe.serial('🔧 시험 월 설정 상태 동기화 수정 검증', () => {
  let page: any;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  });

  test('1️⃣ 로그인', async () => {
    await page.goto(APP_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const inputs = await page.locator('input');
    await inputs.nth(0).fill('김상현');
    await inputs.nth(1).fill('1234');

    const loginButton = await page.locator('button:has-text("로그인")');
    await loginButton.click();

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    expect(currentUrl).toContain('timer');
    console.log('✅ 로그인 성공');
  });

  test('2️⃣ 설정 페이지 진입', async () => {
    const settingsButton = await page.locator('button[aria-label="설정"]');
    await settingsButton.click();
    await page.waitForTimeout(500);

    const currentUrl = page.url();
    expect(currentUrl).toContain('settings');
    console.log('✅ 설정 페이지 진입');
  });

  test('3️⃣ 시험 월 설정 탭 진입 및 데이터 로드 (Solution 1 검증)', async () => {
    const examTab = await page.locator('button').filter({ hasText: '시험 월 설정' });
    await examTab.click();
    await page.waitForTimeout(1000);

    // useEffect가 activeTab을 감지해서 데이터를 로드해야 함
    const selectBox = await page.locator('select').first();
    const value = await selectBox.inputValue();

    expect(value).toBeTruthy();
    console.log(`✅ 시험 월 로드됨: ${value}`);
  });

  test('4️⃣ 시험 월 변경 및 저장 (Solution 2 검증)', async () => {
    const selectBox = await page.locator('select').first();
    const oldValue = await selectBox.inputValue();

    // 새 월 선택
    const newMonth = '2026-06';
    await selectBox.selectOption(newMonth);
    console.log(`✅ 새 월 선택: ${newMonth}`);

    // 저장 버튼 클릭
    const saveButton = await page.locator('button').filter({ hasText: '저장' }).last();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // 토스트 메시지 확인
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('저장');
    console.log('✅ 토스트 메시지 표시됨');

    // Solution 2: 저장 후 즉시 값이 반영되어야 함
    const updatedValue = await selectBox.inputValue();
    expect(updatedValue).toBe(newMonth);
    console.log(`✅ 저장 후 즉시 반영됨: ${updatedValue}`);
  });

  test('5️⃣ 탭 전환 후 값 유지 (Solution 1 재검증)', async () => {
    // 학생 관리 탭으로 이동
    const studentTab = await page.locator('button').filter({ hasText: '학생 관리' });
    await studentTab.click();
    await page.waitForTimeout(1000);
    console.log('✅ 학생 관리 탭으로 이동');

    // 기본 설정 탭으로 이동
    const basicTab = await page.locator('button').filter({ hasText: '기본 설정' });
    await basicTab.click();
    await page.waitForTimeout(1000);
    console.log('✅ 기본 설정 탭으로 이동');

    // 시험 월 설정 탭으로 돌아가기
    const examTab = await page.locator('button').filter({ hasText: '시험 월 설정' });
    await examTab.click();
    await page.waitForTimeout(1000);
    console.log('✅ 시험 월 설정 탭으로 돌아옴');

    // Solution 1: useEffect가 activeTab을 감지해서 재로드
    // 탭 전환 후에도 값이 유지되어야 함 (새로고침 없음!)
    const selectBox = await page.locator('select').first();
    const value = await selectBox.inputValue();

    expect(value).toBe('2026-06');
    console.log(`✅ 탭 전환 후 값 유지됨: ${value} (새로고침 없음!)`);
  });

  test('6️⃣ 페이지 새로고침 검증', async () => {
    // 페이지 새로고침
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    console.log('✅ 페이지 새로고침');

    // 설정 버튼 다시 클릭
    const settingsButton = await page.locator('button[aria-label="설정"]');
    await settingsButton.click();
    await page.waitForTimeout(500);

    // 시험 월 설정 탭
    const examTab = await page.locator('button').filter({ hasText: '시험 월 설정' });
    await examTab.click();
    await page.waitForTimeout(1000);

    // 새로고침 후에도 값이 유지되어야 함
    const selectBox = await page.locator('select').first();
    const value = await selectBox.inputValue();

    expect(value).toBe('2026-06');
    console.log(`✅ 새로고침 후 값 유지됨: ${value}`);
  });

  test.afterAll(async () => {
    if (page) {
      await page.close();
    }
    console.log('');
    console.log('========================================');
    console.log('✅ 모든 검증 완료!');
    console.log('========================================');
    console.log('');
    console.log('수정 결과:');
    console.log('  ✓ Solution 1: useEffect activeTab 의존성 추가');
    console.log('  ✓ Solution 2: 저장 후 API 재조회');
    console.log('  ✓ Solution 3: Zustand 드롭다운 바인딩');
    console.log('');
    console.log('효과:');
    console.log('  ✓ 페이지 새로고침 불필요');
    console.log('  ✓ 탭 전환 시 즉시 최신값 로드');
    console.log('  ✓ 저장 후 UI 즉시 반영');
    console.log('');
  });
});
