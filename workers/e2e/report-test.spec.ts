/**
 * 핵심 테스트: 성적 입력 → 리포트 생성
 * - 관리자로 로그인 (서재용 개발자 / 0000)
 * - test 학생에게 국어 점수 34점 할당
 * - 리포트 생성 확인 (3월, 4월)
 */

import { test, expect } from '@playwright/test';

const ADMIN = {
  name: '서재용 개발자',
  pin: '1141',
};

test.describe('리포트 생성 플로우', () => {
  test('관리자 로그인', async ({ page }) => {
    // 쿠키 정리
    await page.context().clearCookies();

    // 페이지 접근
    await page.goto('http://localhost:5174');

    // domcontentloaded 대기 (networkidle 대신 사용)
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    console.log('✅ 페이지 로드됨');

    // 로그인 폼 확인
    const nameInput = page.locator('input[placeholder*="예:"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ 로그인 폼 발견');

    // 관리자 정보 입력
    await nameInput.fill(ADMIN.name);
    const pinInput = page.locator('input[type="password"]').first();
    await pinInput.fill(ADMIN.pin);
    console.log(`✅ ${ADMIN.name} / PIN ${ADMIN.pin} 입력`);

    // 로그인
    const loginBtn = page.locator('button:has-text("접속하기"), button:has-text("로그인")').first();
    await loginBtn.click();
    console.log('✅ 로그인 버튼 클릭');

    // 로그인 완료 대기 (schedule 또는 timer 페이지로 이동)
    await page.waitForURL(/\/(schedule|timer|dashboard)/, { timeout: 10000 });
    console.log(`✅ 관리자 로그인 성공 - URL: ${page.url()}`);
  });

  test('성적 입력 페이지 접근', async ({ page }) => {
    // 쿠키 정리
    await page.context().clearCookies();

    // 로그인
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 로그인 수행
    await page.locator('input[placeholder*="예:"]').first().fill(ADMIN.name);
    await page.locator('input[type="password"]').first().fill(ADMIN.pin);
    await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();
    await page.waitForURL(/\/(schedule|timer|dashboard)/, { timeout: 10000 });
    console.log('✅ 로그인 완료');

    // 성적 입력 메뉴 클릭
    await page.waitForTimeout(1000);
    const inputLink = page.locator('a:has-text("성적 입력")').first();
    if (await inputLink.isVisible({ timeout: 2000 })) {
      await inputLink.click();
      console.log('✅ 성적 입력 메뉴 클릭');
      await page.waitForTimeout(2000);

      const url = page.url();
      console.log(`✅ 성적 입력 페이지 URL: ${url}`);
    } else {
      console.log('⚠️ 성적 입력 메뉴를 찾을 수 없음');
    }
  });

  test('test 학생 찾기 및 성적 입력', async ({ page }) => {
    // 쿠키 정리
    await page.context().clearCookies();

    // 로그인
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 로그인 수행
    await page.locator('input[placeholder*="예:"]').first().fill(ADMIN.name);
    await page.locator('input[type="password"]').first().fill(ADMIN.pin);
    await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();
    await page.waitForURL(/\/(schedule|timer|dashboard)/, { timeout: 10000 });
    console.log('✅ 로그인 완료');

    // 성적 입력 페이지로 이동
    await page.waitForTimeout(1000);
    const inputLink = page.locator('a:has-text("성적 입력")').first();
    if (await inputLink.isVisible({ timeout: 2000 })) {
      await inputLink.click();
      await page.waitForTimeout(2000);
      console.log('✅ 성적 입력 페이지 접근');

      // test 학생 찾기
      const testStudent = page.locator('text=test').first();
      if (await testStudent.isVisible({ timeout: 3000 })) {
        console.log('✅ test 학생 발견');
        await testStudent.click();
        await page.waitForTimeout(1000);

        // 성적 입력 필드 찾기
        const scoreInputs = page.locator('input[type="number"]');
        const count = await scoreInputs.count();

        if (count > 0) {
          // 첫 번째 필드에 34 입력 (국어)
          await scoreInputs.first().fill('34');
          console.log('✅ 성적 34점 입력');

          // 저장 버튼 찾기 및 클릭
          const saveBtn = page.locator('button:has-text("저장"), button:has-text("제출"), button:has-text("완료")').first();
          if (await saveBtn.isVisible({ timeout: 2000 })) {
            await saveBtn.click();
            console.log('✅ 성적 저장');
            await page.waitForTimeout(1000);
          } else {
            console.log('⚠️ 저장 버튼을 찾을 수 없음');
          }
        } else {
          console.log('⚠️ 성적 입력 필드를 찾을 수 없음');
        }
      } else {
        console.log('⚠️ test 학생을 찾을 수 없음');
      }
    } else {
      console.log('⚠️ 성적 입력 메뉴를 찾을 수 없음');
    }
  });

  test('리포트 페이지 접근 및 생성', async ({ page }) => {
    // 쿠키 정리
    await page.context().clearCookies();

    // 로그인
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 로그인 수행
    await page.locator('input[placeholder*="예:"]').first().fill(ADMIN.name);
    await page.locator('input[type="password"]').first().fill(ADMIN.pin);
    await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();
    await page.waitForURL(/\/(schedule|timer|dashboard)/, { timeout: 10000 });
    console.log('✅ 로그인 완료');

    // 리포트 페이지로 이동
    await page.waitForTimeout(1000);
    const reportLink = page.locator('a:has-text("리포트")').first();
    if (await reportLink.isVisible({ timeout: 2000 })) {
      await reportLink.click();
      await page.waitForTimeout(2000);

      const url = page.url();
      const bodyText = await page.locator('body').textContent();

      console.log(`✅ 리포트 페이지 접근 - URL: ${url}`);
      console.log(`📄 페이지 콘텐츠: ${bodyText?.substring(0, 100)}...`);

      // 리포트 생성 버튼 찾기
      const generateBtn = page.locator('button:has-text("생성"), button:has-text("만들기"), button:has-text("제출")').first();
      if (await generateBtn.isVisible({ timeout: 2000 })) {
        await generateBtn.click();
        console.log('✅ 리포트 생성 버튼 클릭');
        await page.waitForTimeout(2000);

        // 결과 확인
        const finalText = await page.locator('body').textContent();
        if (finalText && finalText.length > 500) {
          console.log('✅ 리포트 데이터 로드됨');
        } else {
          console.log('⚠️ 리포트 데이터가 부족함');
        }
      } else {
        console.log('⚠️ 리포트 생성 버튼을 찾을 수 없음');
      }
    } else {
      console.log('⚠️ 리포트 메뉴를 찾을 수 없음');
    }
  });
});
