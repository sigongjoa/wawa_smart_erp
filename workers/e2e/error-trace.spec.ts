/**
 * 에러 위치 추적
 */

import { test } from '@playwright/test';

const ADMIN = {
  name: '서재용 개발자',
  pin: '1141',
};

test('에러 위치 추적', async ({ page }) => {
  const errors: any[] = [];

  // 모든 에러 캡처
  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack,
      type: 'pageerror'
    });
    console.log(`❌ ${error.message}`);
    console.log(error.stack);
  });

  // 콘솔 메시지 캡처
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[ERROR] ${msg.text()}`);
    }
  });

  // 로그인
  await page.goto('http://localhost:5174');
  await page.locator('input[placeholder*="예:"]').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();

  await page.waitForTimeout(3000);
  console.log('✅ 로그인 완료');

  // 월말평가 클릭
  console.log('\n=== 월말평가 페이지 접근 ===');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(4000);

  // 에러 출력
  console.log(`\n📊 수집된 에러 (${errors.length}개):`);
  errors.forEach((err, i) => {
    console.log(`\n[${i + 1}] ${err.message}`);
    if (err.stack) {
      const lines = err.stack.split('\n').slice(0, 5);
      lines.forEach(line => console.log(`    ${line}`));
    }
  });

  // 페이지 소스에서 에러 문자열 찾기
  const html = await page.content();
  if (html.includes('Cannot read properties')) {
    console.log('\n📌 페이지 HTML에서 발견');
  }
});
