import { test, expect } from '@playwright/test';

/**
 * 설정 페이지 접근 문제 디버깅
 */

const APP_URL = 'http://localhost:5173';

test.describe('🔧 설정 페이지 디버깅', () => {
  let page: any;

  test('1. 로그인 및 currentUser 확인', async ({ browser }) => {
    page = await browser.newPage();

    // 콘솔 출력 캡처
    page.on('console', msg => {
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.log(`[PAGE ERROR] ${err.message}`);
    });

    await page.goto(APP_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 로그인
    const inputs = await page.locator('input');
    await inputs.nth(0).fill('김상현');
    await inputs.nth(1).fill('1234');

    const loginButton = await page.locator('button:has-text("로그인")');
    await loginButton.click();
    console.log('✅ 로그인 버튼 클릭');

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // localStorage에서 currentUser 확인
    const storageData = await page.evaluate(() => {
      const storage = localStorage.getItem('wawa-report-storage');
      return storage ? JSON.parse(storage) : null;
    });

    console.log('=== localStorage ===');
    console.log(JSON.stringify(storageData, null, 2));

    if (storageData?.state?.currentUser) {
      console.log('✅ currentUser 존재');
      console.log(`   - name: ${storageData.state.currentUser.teacher?.name}`);
      console.log(`   - isAdmin: ${storageData.state.currentUser.teacher?.isAdmin}`);
    } else {
      console.log('❌ currentUser 없음');
    }

    const currentUrl = page.url();
    console.log(`현재 URL: ${currentUrl}`);
  });

  test('2. 설정 버튼으로 접근', async () => {
    // Header에서 settings 버튼 찾기
    const settingsButton = await page.locator('button[aria-label="설정"]');
    const isVisible = await settingsButton.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`설정 버튼 보이는가: ${isVisible}`);

    if (isVisible) {
      console.log('✅ 설정 버튼 클릭');
      await settingsButton.click();
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      console.log(`클릭 후 URL: ${currentUrl}`);

      if (currentUrl.includes('/settings')) {
        console.log('✅ 설정 페이지 로드됨');

        // 페이지 제목 확인
        const title = await page.textContent('h1');
        console.log(`페이지 제목: ${title}`);

        // 탭 확인
        const tabs = await page.locator('button:has-text("학생 관리"), button:has-text("시험 월 설정")');
        const tabCount = await tabs.count();
        console.log(`탭 개수: ${tabCount}`);
      } else if (currentUrl.includes('/login') || currentUrl.includes('/timer')) {
        console.log('❌ 로그인으로 리다이렉트됨 (adminOnly 체크 실패)');

        // 현재 저장된 user 정보 다시 확인
        const storageData = await page.evaluate(() => {
          const storage = localStorage.getItem('wawa-report-storage');
          return storage ? JSON.parse(storage) : null;
        });

        console.log('=== 리다이렉트 후 localStorage ===');
        console.log(JSON.stringify(storageData, null, 2));
      }
    } else {
      console.log('⚠️ 설정 버튼을 찾을 수 없음');
      const buttons = await page.locator('button');
      const count = await buttons.count();
      console.log(`페이지의 모든 버튼 개수: ${count}`);

      // 페이지 텍스트
      const bodyText = await page.textContent('body');
      console.log(`페이지 텍스트 (처음 500자): ${bodyText?.substring(0, 500)}`);
    }
  });

  test('3. 직접 URL로 /settings 접근', async () => {
    console.log('직접 /settings URL로 이동...');
    await page.goto(`${APP_URL}/#/settings`);
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`최종 URL: ${currentUrl}`);

    if (currentUrl.includes('/settings')) {
      console.log('✅ 설정 페이지 로드됨');

      const title = await page.textContent('h1');
      console.log(`페이지 제목: ${title}`);
    } else if (currentUrl.includes('/login')) {
      console.log('❌ 로그인으로 리다이렉트됨');

      // ProtectedRoute 코드 확인
      const sourceCode = await page.evaluate(() => {
        // 브라우저 콘솔에서 접근 가능한 정보
        return {
          href: window.location.href,
          hash: window.location.hash,
        };
      });

      console.log(`Location: ${JSON.stringify(sourceCode)}`);
    }
  });

  test('4. 페이지 닫기', async () => {
    if (page) {
      await page.close();
    }
    console.log('✅ 테스트 완료');
  });
});
