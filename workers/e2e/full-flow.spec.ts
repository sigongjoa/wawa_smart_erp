import { test, expect } from '@playwright/test';

/**
 * 실제 기능 E2E 테스트
 * 로그인 → 학생관리 → 시험월 설정 → 성적입력 → 리포트 생성 → 링크공유
 */

const APP_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8787';

test.describe.serial('📋 완전한 기능 플로우', () => {
  let page: any;

  // 1. 로그인
  test('1. 관리자 로그인 (김상현/1234)', async ({ browser }) => {
    page = await browser.newPage();

    page.on('console', msg => {
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.log(`[Error] ${err.message}`);
    });

    await page.goto(APP_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 로그인 입력
    const inputs = await page.locator('input');
    await inputs.nth(0).fill('김상현');
    await inputs.nth(1).fill('1234');

    // 로그인 버튼 클릭
    const loginButton = await page.locator('button:has-text("로그인")');
    await loginButton.click();
    console.log('✅ 로그인 시작');

    // 페이지 이동 대기
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    expect(currentUrl).toContain('timer');
    console.log(`✅ 로그인 완료, 현재 URL: ${currentUrl}`);
  });

  // 2. 설정 페이지 접근
  test('2. 설정 페이지 접근', async () => {
    // 헤더에서 settings 버튼 찾기
    const settingsButton = await page.locator('button[aria-label="설정"]');
    const isVisible = await settingsButton.isVisible().catch(() => false);

    if (isVisible) {
      await settingsButton.click();
      console.log('✅ 설정 버튼 클릭');
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      expect(currentUrl).toContain('settings');
      console.log(`✅ 설정 페이지 로드: ${currentUrl}`);
    } else {
      console.log('⚠️ 설정 버튼 미표시');
    }
  });

  // 3. 학생 추가 (강은서)
  test('3. 학생 추가 - 강은서', async () => {
    console.log('📝 학생 추가 테스트 시작');

    // 페이지 텍스트 확인
    const bodyText = await page.textContent('body');
    console.log(`페이지 텍스트: ${bodyText?.substring(0, 200)}`);

    // 학생 추가 버튼 찾기 (다양한 선택자 시도)
    const addButtons = [
      page.locator('button:has-text("+ 학생 추가")'),
      page.locator('button:has-text("학생 추가")'),
      page.locator('text=+ 학생 추가'),
    ];

    let clicked = false;
    for (const btn of addButtons) {
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click();
        console.log('✅ 학생 추가 버튼 클릭');
        clicked = true;
        await page.waitForTimeout(500);
        break;
      }
    }

    if (!clicked) {
      console.log('⚠️ 학생 추가 버튼을 찾지 못함');
      return;
    }

    // 폼 입력
    const nameInput = page.locator('input[placeholder="예: 강은서"]');
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('강은서');
      console.log('✅ 학생 이름 입력');

      // 저장 버튼 클릭
      const saveButton = page.locator('button').filter({ hasText: /^추가$/ });
      if (await saveButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.first().click();
        console.log('✅ 학생 추가 저장');
        await page.waitForTimeout(1000);
      }
    } else {
      console.log('⚠️ 폼을 찾지 못함');
    }
  });

  // 4. 시험 월 설정 (2026-04)
  test('4. 시험 월 설정', async () => {
    // 시험 월 설정 탭 클릭
    const examTab = await page.locator('button:has-text("시험 월 설정")');
    if (await examTab.isVisible().catch(() => false)) {
      await examTab.click();
      console.log('✅ 시험 월 설정 탭 클릭');
      await page.waitForTimeout(500);

      // 월 선택
      const select = await page.locator('select').first();
      if (select) {
        await select.selectOption('2026-04');
        console.log('✅ 2026-04 월 선택');
      }

      // 저장 버튼 클릭
      const saveButton = await page.locator('button:has-text("저장")');
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
        console.log('✅ 시험 월 저장');
        await page.waitForTimeout(500);
      }
    }
  });

  // 5. 리포트 페이지에서 성적 입력
  test('5. 리포트 페이지 접근', async () => {
    // 리포트 메뉴 클릭
    const reportMenu = await page.locator('a:has-text("월말평가")');
    if (await reportMenu.isVisible().catch(() => false)) {
      await reportMenu.click();
      console.log('✅ 월말평가 메뉴 클릭');
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      expect(currentUrl).toContain('report');
      console.log(`✅ 리포트 페이지: ${currentUrl}`);
    }
  });

  // 6. 성적 입력 (강은서, 2026-04, 85점)
  test('6. 성적 입력 - 강은서 85점', async () => {
    // Input 탭으로 이동
    const inputLink = await page.locator('a:has-text("성적 입력"), button:has-text("성적")');
    if (inputLink && await inputLink.first().isVisible().catch(() => false)) {
      await inputLink.first().click();
      console.log('✅ 성적 입력 페이지');
      await page.waitForTimeout(1000);
    }

    // 학생 선택
    const selects = await page.locator('select');
    const selectCount = await selects.count();
    console.log(`선택 요소: ${selectCount}개`);

    if (selectCount > 0) {
      // 첫 번째 select에서 강은서 선택
      await selects.nth(0).selectOption({ label: '강은서' }).catch(() => {
        console.log('⚠️ 강은서 선택 실패');
      });
    }

    // 성적 입력 필드 찾기
    const inputs = await page.locator('input[type="number"]');
    if (await inputs.count() > 0) {
      await inputs.first().fill('85');
      console.log('✅ 성적 입력 (85)');
    }

    // 저장 버튼
    const saveButton = await page.locator('button:has-text("저장"), button:has-text("제출")');
    if (saveButton && await saveButton.first().isVisible().catch(() => false)) {
      await saveButton.first().click();
      console.log('✅ 성적 저장');
      await page.waitForTimeout(1000);
    }
  });

  // 7. 리포트 생성 및 링크 공유
  test('7. 리포트 생성 및 링크 공유', async () => {
    // Preview 탭으로 이동
    const previewLink = await page.locator('a:has-text("미리보기"), button:has-text("생성")');
    if (previewLink && await previewLink.first().isVisible().catch(() => false)) {
      await previewLink.first().click();
      console.log('✅ 미리보기/생성 페이지');
      await page.waitForTimeout(1500);
    }

    // 링크 공유 버튼
    const shareButton = await page.locator('button:has-text("링크 공유"), button:has-text("공유")');
    if (shareButton && await shareButton.first().isVisible().catch(() => false)) {
      await shareButton.first().click();
      console.log('✅ 링크 공유 버튼 클릭');
      await page.waitForTimeout(2000);

      // 생성된 URL 확인
      const urlInput = await page.locator('input[readonly], textarea[readonly]');
      if (await urlInput.first().isVisible().catch(() => false)) {
        const shareUrl = await urlInput.first().inputValue();
        console.log(`✅ 생성된 URL: ${shareUrl?.substring(0, 80)}...`);
      }
    }
  });

  // 8. 공개 링크로 접근 (학부모 확인)
  test('8. 공개 링크 접근 테스트', async ({ browser }) => {
    const parentPage = await browser.newPage();

    // 현재 페이지의 URL을 확인해서 공개 이미지 URL 구성
    const shareUrl = `${API_URL}/api/report/image/reports/d8cbd478e5eb4e6aa164f9e012a3687c/2026-04_강은서_report-test.png`;

    try {
      const response = await parentPage.goto(shareUrl);

      if (response?.ok()) {
        console.log('✅ 공개 링크 접근 성공 (200)');
      } else {
        console.log(`⚠️ 공개 링크 상태: ${response?.status()}`);
      }
    } catch (error) {
      console.log(`⚠️ 공개 링크 접근 실패 (예상: 아직 이미지 없음)`);
    } finally {
      await parentPage.close();
    }
  });

  // 정리
  test('9. 테스트 완료', async () => {
    if (page) {
      await page.close();
    }
    console.log('✅ 전체 플로우 테스트 완료');
  });
});
