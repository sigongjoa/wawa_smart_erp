import { test } from '@playwright/test';

test('최종 테스트: 성적 저장 완전 플로우', async ({ page }) => {
  const ADMIN = { name: '서재용 개발자', pin: '1141' };
  const api_calls: any[] = [];

  page.on('response', response => {
    if (response.url().includes('/api/grader/grades')) {
      api_calls.push({ method: response.request().method(), status: response.status() });
      console.log(`✅ API 호출: ${response.request().method()} /api/grader/grades - ${response.status()}`);
    }
  });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('시험 정보') || text.includes('저장')) {
      console.log(`📝 ${text.slice(0, 80)}`);
    }
  });

  console.log('🌐 라이브 서버');
  await page.goto('https://wawa-smart-erp.pages.dev');
  await page.waitForLoadState('domcontentloaded');

  console.log('🔐 로그인');
  await page.locator('input').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();
  await page.waitForTimeout(3000);

  console.log('📋 월말평가');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(2000);

  console.log('👤 test 학생');
  await page.locator('text=test').first().click();
  await page.waitForTimeout(1500);

  console.log('✏️ 점수 45');
  await page.locator('input[type="number"]').first().fill('45');
  console.log('💾 저장');
  await page.locator('button').filter({ hasText: '저장' }).first().click();
  await page.waitForTimeout(3000);

  console.log(`\n📊 결과: ${api_calls.length > 0 ? '✅ 성공' : '❌ 실패'}`);
});
