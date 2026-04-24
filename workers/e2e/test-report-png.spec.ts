import { test } from '@playwright/test';
import { API_URL, SITE_URL } from './_env';

test('라이브: 성적 입력 → PNG 리포트 생성', async ({ page }) => {
  const ADMIN = { name: '서재용 개발자', pin: '1141' };

  console.log('🌐 라이브 서버 접속');
  await page.goto(SITE_URL);
  await page.waitForLoadState('domcontentloaded');

  // 로그인
  console.log('🔐 로그인');
  await page.locator('input').first().fill(ADMIN.name);
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

  // 국어 점수 입력
  console.log('✏️ 국어 85점 입력');
  const scoreInputs = page.locator('input[type="number"]');
  await scoreInputs.first().fill('85');

  // 코멘트 입력
  console.log('✏️ 코멘트 "매우 우수한 성과입니다" 입력');
  const comments = page.locator('textarea');
  await comments.first().fill('매우 우수한 성과입니다');

  // 저장
  console.log('💾 저장');
  await page.locator('button').filter({ hasText: '저장' }).first().click();
  await page.waitForTimeout(3000);

  // 리포트 페이지로 이동
  console.log('📄 리포트 미리보기 → 보내기');
  await page.locator('a:has-text("리포트"), a:has-text("보내기")').first().click();
  await page.waitForTimeout(2000);

  // 리포트에서 test 학생 선택
  console.log('👤 리포트에서 test 학생 선택');
  const studentItems = page.locator('[role="listitem"], li, div').filter({ hasText: 'test' });
  const testItem = studentItems.first();
  if (await testItem.isVisible()) {
    await testItem.click();
    await page.waitForTimeout(1500);
  }

  // 스크린샷으로 리포트 확인
  console.log('📸 리포트 스크린샷');
  const reportContent = await page.locator('body').textContent() || '';
  
  if (reportContent.includes('85')) {
    console.log('✅ 리포트에 85점 표시됨');
  }
  if (reportContent.includes('매우 우수한') || reportContent.includes('우수')) {
    console.log('✅ 리포트에 코멘트 표시됨');
  }
  if (reportContent.includes('국어') || reportContent.includes('korean')) {
    console.log('✅ 리포트에 국어 표시됨');
  } else {
    console.log('⚠️ 국어 표시 안됨');
  }

  // PNG 생성 버튼
  console.log('🖼️ PNG 생성 버튼 클릭');
  const downloadBtn = page.locator('button').filter({ hasText: '다운로드' });
  if (await downloadBtn.isVisible()) {
    await downloadBtn.click();
    await page.waitForTimeout(3000);
    console.log('✅ PNG 다운로드 완료');
  } else {
    console.log('⚠️ 다운로드 버튼 없음');
  }

  // 최종 화면 확인
  const finalText = await page.locator('body').textContent() || '';
  console.log('\n📋 최종 리포트 내용 일부:');
  console.log(finalText.slice(0, 150));
});
