/**
 * 빠른 기능 테스트
 */

import { test } from '@playwright/test';

test('로그인 및 기본 네비게이션 테스트', async ({ page }) => {
  // 쿠키 정리
  await page.context().clearCookies();

  console.log('\n=== 1️⃣ 페이지 접근 ===');
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('✅ 로그인 페이지 로드됨');

  // 입력 필드 확인
  const nameInput = page.locator('input[placeholder*="예:"]').first();
  const pinInput = page.locator('input[type="password"]').first();

  if (await nameInput.isVisible()) {
    console.log('✅ 로그인 폼 발견');

    // 남현욱으로 로그인 (이 선생님은 확인됨)
    await nameInput.fill('남현욱');
    await pinInput.fill('1312');
    console.log('✅ 남현욱 / PIN:1312 입력');

    // 로그인
    const btn = page.locator('button').first();
    await btn.click();
    console.log('✅ 로그인 버튼 클릭');

    // 네비게이션 확인
    await page.waitForTimeout(3000);
    const url = page.url();
    const bodyText = await page.locator('body').textContent();

    console.log(`\n📄 현재 URL: ${url}`);
    console.log(`📄 페이지 로드됨: ${bodyText?.substring(0, 50)}...`);

    if (url.includes('/timer') || url.includes('/schedule') || url.includes('/dashboard')) {
      console.log('✅ 로그인 성공 - 대시보드 로드됨');
    } else if (url.includes('login')) {
      console.log('❌ 로그인 실패 - 로그인 페이지 유지');
    } else {
      console.log('✅ 로그인 후 페이지 이동');
    }

    // 콘솔 로그 확인
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.waitForTimeout(1000);

    const errorLogs = consoleLogs.filter(
      log => log.includes('error') || log.includes('Error') || log.includes('401')
    );

    if (errorLogs.length > 0) {
      console.log('\n⚠️ 에러 발생:');
      errorLogs.forEach(log => console.log(`  ${log}`));
    } else {
      console.log('\n✅ 에러 없음');
    }
  } else {
    console.log('❌ 로그인 폼을 찾을 수 없음');
  }

  console.log('\n=== 테스트 완료 ===');
});
