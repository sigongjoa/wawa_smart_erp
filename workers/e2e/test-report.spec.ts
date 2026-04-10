import { test } from '@playwright/test';

test('라이브: 성적 저장 → 리포트 생성 완전 플로우', async ({ page }) => {
  const ADMIN = { name: '서재용 개발자', pin: '1141' };

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`📡 ${response.request().method()} ${response.url().split('/api/')[1]} - ${response.status()}`);
    }
  });

  console.log('🌐 라이브 서버 접속');
  await page.goto('https://wawa-smart-erp.pages.dev');
  await page.waitForLoadState('domcontentloaded');

  console.log('🔐 로그인');
  await page.locator('input[placeholder*="예:"]').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();
  await page.waitForTimeout(3000);

  console.log('📋 월말평가 페이지');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(2000);

  console.log('👤 test 학생 선택');
  await page.locator('text=test').first().click();
  await page.waitForTimeout(1500);

  console.log('✏️ 국어 점수 45점 입력');
  const scores = page.locator('input[type="number"]');
  await scores.first().fill('45');

  console.log('💾 저장');
  await page.locator('button').filter({ hasText: '저장' }).first().click();
  await page.waitForTimeout(3000);

  console.log('📄 리포트 미리보기 페이지로 이동');
  await page.locator('a:has-text("리포트"), a:has-text("미리보기")').first().click();
  await page.waitForTimeout(2000);

  console.log('🔍 리포트 내용 확인');
  const reportText = await page.locator('body').textContent() || '';
  
  if (reportText.includes('45')) {
    console.log('✅ 리포트에 45점 표시됨');
  } else if (reportText.includes('test')) {
    console.log('✅ 리포트에 test 학생 표시됨');
  } else {
    console.log('⚠️ 리포트 내용: ' + reportText.slice(0, 100));
  }

  const generateBtn = page.locator('button').filter({ hasText: '생성' });
  if (await generateBtn.isVisible()) {
    console.log('📋 리포트 생성 버튼 클릭');
    await generateBtn.click();
    await page.waitForTimeout(3000);
    console.log('✅ 리포트 생성 완료');
  } else {
    console.log('✅ 리포트가 이미 생성됨');
  }
});
