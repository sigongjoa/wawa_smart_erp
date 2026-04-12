import { test } from '@playwright/test';

test('라이브 서버 로그인 및 데이터 조회', async ({ page }) => {
  const ADMIN = { name: '서재용 개발자', pin: '1141' };
  const logs: any[] = [];

  page.on('console', msg => {
    logs.push(msg.text());
  });

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`🌐 ${response.request().method()} ${response.url()}`);
      console.log(`   Status: ${response.status()}`);
      response.json().then(data => {
        console.log(`   Response: ${JSON.stringify(data).slice(0, 100)}`);
      }).catch(() => {});
    }
  });

  console.log('🔗 라이브 서버 접속: https://wawa-smart-erp.pages.dev');
  await page.goto('https://wawa-smart-erp.pages.dev');
  await page.waitForLoadState('domcontentloaded');

  // 로그인
  console.log('🔐 로그인 시작');
  await page.locator('input').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();
  await page.waitForTimeout(3000);
  console.log('✅ 로그인 완료');

  // 월말평가 페이지
  console.log('📋 월말평가 페이지 접속');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(3000);

  console.log('\n========== API 로그 ==========');
  logs.filter(l => l.includes('🌐') || l.includes('Status')).forEach(l => console.log(l));
});
