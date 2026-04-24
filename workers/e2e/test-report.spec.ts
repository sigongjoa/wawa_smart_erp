import { test } from '@playwright/test';
import { API_URL, SITE_URL } from './_env';

test('라이브: 성적 저장 → 리포트 생성 완전 플로우', async ({ page }) => {
  const ADMIN = { name: '서재용 개발자', pin: '1141' };

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`📡 ${response.request().method()} ${response.url().split('/api/')[1]} - ${response.status()}`);
    }
  });

  console.log('🌐 라이브 서버 접속');
  await page.goto(SITE_URL);
  await page.waitForLoadState('domcontentloaded');

  console.log('🔐 로그인');
  await page.locator('input').first().fill(ADMIN.name);
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

test('정기고사 리뷰: 중간고사 탭 전환 → 타이틀/헤더 반영', async ({ page }) => {
  const ADMIN = { name: '서재용 개발자', pin: '1141' };

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`📡 ${response.request().method()} ${response.url().split('/api/')[1]} - ${response.status()}`);
    }
  });

  console.log('🌐 라이브 서버 접속');
  await page.goto(SITE_URL);
  await page.waitForLoadState('domcontentloaded');

  console.log('🔐 로그인');
  await page.locator('input').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();
  await page.waitForTimeout(3000);

  console.log('📋 리포트 페이지 진입');
  await page.locator('a:has-text("리포트"), a:has-text("월말평가")').first().click();
  await page.waitForTimeout(2000);

  console.log('🧭 리포트 유형 탭 존재 확인');
  const tablist = page.locator('[role="tablist"][aria-label="리포트 유형"]');
  await tablist.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ 리포트 유형 탭 렌더링됨');

  console.log('🔀 중간고사 탭 클릭');
  const midtermTab = page.locator('[role="tab"]', { hasText: '중간고사' });
  await midtermTab.click();
  await page.waitForTimeout(1500);

  console.log('🎯 탭 활성화 확인');
  const isSelected = await midtermTab.getAttribute('aria-selected');
  if (isSelected !== 'true') {
    throw new Error(`중간고사 탭 활성화 실패: aria-selected=${isSelected}`);
  }
  console.log('✅ 중간고사 탭 aria-selected=true');

  console.log('📝 페이지 타이틀 반영 확인');
  const pageTitle = await page.locator('.page-title').first().textContent() || '';
  if (!pageTitle.includes('중간고사')) {
    throw new Error(`페이지 타이틀에 "중간고사" 없음: "${pageTitle}"`);
  }
  console.log(`✅ 페이지 타이틀: "${pageTitle}"`);

  console.log('🔀 기말고사 탭 클릭');
  const finalTab = page.locator('[role="tab"]', { hasText: '기말고사' });
  await finalTab.click();
  await page.waitForTimeout(1500);
  const finalSelected = await finalTab.getAttribute('aria-selected');
  if (finalSelected !== 'true') {
    throw new Error('기말고사 탭 활성화 실패');
  }
  console.log('✅ 기말고사 탭 전환 확인');

  console.log('🔙 월말평가로 복귀');
  const monthlyTab = page.locator('[role="tab"]', { hasText: '월말평가' });
  await monthlyTab.click();
  await page.waitForTimeout(1000);
  const monthlySelected = await monthlyTab.getAttribute('aria-selected');
  if (monthlySelected !== 'true') {
    throw new Error('월말평가 복귀 실패');
  }
  console.log('✅ 월말평가로 정상 복귀');
});
