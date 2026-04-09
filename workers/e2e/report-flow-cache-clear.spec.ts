/**
 * 캐시 제거 후 리포트 플로우 테스트
 */

import { test } from '@playwright/test';

const ADMIN = {
  name: '서재용 개발자',
  pin: '1141',
};

test('캐시 제거 후 월말평가 플로우', async ({ page, context }) => {
  // 캐시 제거
  await context.clearCookies();
  const cookies = await context.cookies();
  console.log(`🗑️ 캐시 제거: ${cookies.length}개 쿠키 삭제됨`);

  console.log('\n=== 1️⃣ 로그인 ===');
  await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded' });

  // 로컬 스토리지도 제거
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  console.log('✅ 로컬 스토리지 제거됨');

  // 페이지 새로고침
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // 로그인
  await page.locator('input[placeholder*="예:"]').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();

  await page.waitForTimeout(3000);
  console.log(`✅ 로그인 완료`);

  // 월말평가 메뉴 클릭
  console.log('\n=== 2️⃣ 월말평가 페이지 접근 ===');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(3000);

  // 에러 확인
  const bodyText = await page.locator('body').textContent();
  const hasError = bodyText?.includes('오류') || bodyText?.includes('Error');

  if (hasError) {
    console.log('❌ 에러 발생:');
    const errorText = bodyText?.substring(bodyText.indexOf('error'), bodyText.indexOf('error') + 200);
    console.log(errorText);

    // 다시 시도 버튼 클릭
    const retryBtn = page.locator('button:has-text("다시 시도")').first();
    if (await retryBtn.isVisible({ timeout: 1000 })) {
      console.log('\n🔄 다시 시도 버튼 클릭');
      await retryBtn.click();
      await page.waitForTimeout(2000);
    }
  } else {
    console.log('✅ 성공적으로 로드됨');
  }

  // 최종 상태
  const finalText = await page.locator('body').textContent();
  const finalHasError = finalText?.includes('오류') || finalText?.includes('Error');
  console.log(`\n📊 최종 상태:`);
  console.log(`   - URL: ${page.url()}`);
  console.log(`   - 에러: ${finalHasError ? '있음' : '없음'}`);
  console.log(`   - 콘텐츠 길이: ${finalText?.length}`);
});
