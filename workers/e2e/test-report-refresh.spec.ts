import { test } from '@playwright/test';

test('라이브: 성적 저장 후 새로고침 → 리포트 확인', async ({ page }) => {
  const ADMIN = { name: '서재용 개발자', pin: '1141' };

  console.log('🌐 라이브 서버 접속');
  await page.goto('https://wawa-smart-erp.pages.dev');
  await page.waitForLoadState('domcontentloaded');

  // 로그인
  console.log('🔐 로그인');
  await page.locator('input[placeholder*="예:"]').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();
  await page.waitForTimeout(3000);

  // 월말평가
  console.log('📋 월말평가 페이지');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(2000);

  // test 학생 선택
  console.log('👤 test 학생 선택');
  await page.locator('text=test').first().click();
  await page.waitForTimeout(1500);

  // 국어 점수 입력 (다른 점수)
  console.log('✏️ 국어 92점 입력');
  const scoreInputs = page.locator('input[type="number"]');
  await scoreInputs.first().fill('92');

  // 코멘트 입력
  console.log('✏️ 코멘트 입력');
  const comments = page.locator('textarea');
  await comments.first().fill('탁월한 학습 태도');

  // 저장
  console.log('💾 저장');
  await page.locator('button').filter({ hasText: '저장' }).first().click();
  await page.waitForTimeout(2000);

  // 리포트 미리보기로 이동
  console.log('📄 리포트 미리보기');
  await page.locator('a:has-text("리포트")').first().click();
  await page.waitForTimeout(3000);

  console.log('🔄 페이지 새로고침');
  await page.reload();
  await page.waitForTimeout(2000);

  // 리포트 내용 확인
  const reportText = await page.locator('body').textContent() || '';
  
  console.log('\n📊 리포트 내용 확인:');
  if (reportText.includes('92')) {
    console.log('✅ 92점 표시됨');
  } else {
    console.log('❌ 92점 없음');
  }

  if (reportText.includes('국어')) {
    console.log('✅ 국어 표시됨');
  } else if (reportText.includes('korean') || reportText.includes('Korean')) {
    console.log('⚠️ 영문 korean 표시됨');
  } else {
    console.log('❌ 국어 미표시');
  }

  if (reportText.includes('탁월')) {
    console.log('✅ 코멘트 표시됨');
  } else {
    console.log('⚠️ 코멘트 미표시');
  }

  // test 학생 선택 후 최종 확인
  console.log('\n🎯 리포트에서 test 학생 클릭');
  const studentLink = page.locator('text=test').first();
  if (await studentLink.isVisible()) {
    await studentLink.click();
    await page.waitForTimeout(1500);
    
    const finalText = await page.locator('body').textContent() || '';
    console.log('\n📋 최종 리포트:');
    const textSnippet = finalText.slice(0, 200).replace(/\s+/g, ' ');
    console.log(textSnippet);
  }
});
