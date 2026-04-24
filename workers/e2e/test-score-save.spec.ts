import { test } from '@playwright/test';
import { API_URL, SITE_URL } from './_env';

test('라이브 서버: 성적 저장 테스트', async ({ page }) => {
  const ADMIN = { name: '서재용 개발자', pin: '1141' };
  let apiCalls: any[] = [];

  page.on('response', response => {
    if (response.url().includes('/api/grader/grades')) {
      apiCalls.push({
        method: response.request().method(),
        status: response.status(),
        url: response.url()
      });
      console.log(`📤 성적 저장 API: ${response.status()}`);
    }
  });

  console.log('🌐 라이브 서버 접속');
  await page.goto(SITE_URL);
  await page.waitForLoadState('domcontentloaded');

  // 로그인
  console.log('🔐 로그인');
  await page.locator('input').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();
  await page.waitForTimeout(3000);

  // 월말평가 이동
  console.log('📋 월말평가 페이지');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(2000);

  // test 학생 선택
  console.log('👤 test 학생 선택');
  await page.locator('text=test').first().click();
  await page.waitForTimeout(1500);

  // 성적 입력
  console.log('✏️ 성적 45점 입력');
  const scoreInput = page.locator('input[type="number"]').first();
  await scoreInput.fill('45');

  // 저장 버튼 클릭
  console.log('💾 저장 버튼 클릭');
  await page.locator('button').filter({ hasText: '저장' }).first().click();
  await page.waitForTimeout(3000);

  console.log(`\n✅ 성적 저장 API 호출: ${apiCalls.length}건`);
  if (apiCalls.length > 0) {
    apiCalls.forEach((call, i) => {
      console.log(`  [${i+1}] ${call.method} ${call.status}`);
    });
  }
});
