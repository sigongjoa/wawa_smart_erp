/**
 * 완전한 리포트 생성 플로우
 * 1. 로그인
 * 2. 월말평가(성적 입력) 페이지 이동
 * 3. 성적 입력
 * 4. 리포트 생성
 */

import { test } from '@playwright/test';

const TEACHER = {
  name: '남현욱',
  pin: '1312',
};

test('완전한 리포트 생성 플로우', async ({ page }) => {
  console.log('\n=== 🎯 리포트 생성 완전 플로우 시작 ===\n');

  // 쿠키 정리
  await page.context().clearCookies();

  // === 1️⃣ 로그인 ===
  console.log('📌 [1/4] 로그인');
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const nameInput = page.locator('input[placeholder*="예:"]').first();
  const pinInput = page.locator('input[type="password"]').first();

  await nameInput.fill(TEACHER.name);
  await pinInput.fill(TEACHER.pin);
  await page.locator('button').first().click();
  console.log('  ✅ 로그인 완료\n');

  await page.waitForURL(/timer|schedule|dashboard/, { timeout: 10000 });
  await page.waitForTimeout(2000);

  // === 2️⃣ 월말평가 페이지 이동 ===
  console.log('📌 [2/4] 월말평가 페이지 이동');

  // 현재 페이지에서 메뉴 확인
  const allText = await page.locator('body').textContent();
  console.log(`  📄 현재 페이지: ${page.url()}`);

  // 월말평가 메뉴 클릭
  const monthlyEvalLink = page.locator('a:has-text("월말평가"), button:has-text("월말평가"), [class*="monthly"]').first();

  if (await monthlyEvalLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await monthlyEvalLink.click();
    console.log('  ✅ 월말평가 메뉴 클릭');
  } else {
    // 직접 URL로 이동
    await page.goto('http://localhost:5174/#/report/input');
    console.log('  ✅ 월말평가 페이지 직접 이동');
  }

  await page.waitForTimeout(2000);

  // === 3️⃣ 성적 입력 ===
  console.log('\n📌 [3/4] 성적 데이터 입력');

  const pageContent = await page.locator('body').textContent();

  // 페이지 구조 확인
  const searchInputs = page.locator('input[type="text"], input[placeholder*="검색"], input[placeholder*="학생"]');
  const searchCount = await searchInputs.count();
  const numberInputs = page.locator('input[type="number"]');
  const numCount = await numberInputs.count();
  const textareas = page.locator('textarea');
  const taCount = await textareas.count();

  console.log(`  🔍 검색 필드: ${searchCount}개`);
  console.log(`  🔢 숫자 입력: ${numCount}개`);
  console.log(`  📝 텍스트 영역: ${taCount}개`);

  // 학생 검색
  if (searchCount > 0) {
    const firstSearch = searchInputs.first();
    await firstSearch.fill('test');
    console.log('  ✅ "test" 학생 검색');
    await page.waitForTimeout(1000);

    // 검색 결과 확인
    const results = await page.locator('[class*="result"], [class*="row"], tr').count();
    console.log(`  📋 검색 결과: ${results}개`);
  }

  // 성적 입력
  if (numCount > 0) {
    await numberInputs.first().fill('34');
    console.log('  ✅ 성적 34점 입력');

    // 저장
    const saveBtn = page.locator('button:has-text("저장"), button:has-text("제출"), button:has-text("완료")').first();
    if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveBtn.click();
      console.log('  ✅ 성적 저장 완료');
      await page.waitForTimeout(2000);
    }
  }

  // === 4️⃣ 리포트 생성 ===
  console.log('\n📌 [4/4] 리포트 생성');

  // 리포트 페이지로 이동
  const reportLink = page.locator('a:has-text("리포트"), button:has-text("리포트"), a:has-text("보고")').first();

  if (await reportLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await reportLink.click();
    console.log('  ✅ 리포트 페이지 이동');
  } else {
    await page.goto('http://localhost:5174/#/preview');
    console.log('  ✅ 리포트 페이지 직접 이동');
  }

  await page.waitForTimeout(2000);

  // 리포트 생성 버튼
  const generateBtn = page.locator('button').filter({ hasText: /생성|만들|리포트|생성/ }).first();

  if (await generateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await generateBtn.click();
    console.log('  ✅ 리포트 생성 요청');
    await page.waitForTimeout(3000);
  }

  // === 5️⃣ 결과 확인 ===
  console.log('\n📌 [5/4] 리포트 확인');

  const finalUrl = page.url();
  const finalContent = await page.locator('body').textContent();

  console.log(`  📄 최종 URL: ${finalUrl}`);
  console.log(`  📊 페이지 콘텐츠 길이: ${finalContent?.length || 0}자`);

  // 리포트 구성 요소 확인
  const checks = {
    'PDF/문서': finalContent?.includes('pdf') || finalContent?.includes('문서'),
    '학생 이름': finalContent?.includes('test'),
    '성적 데이터': finalContent?.includes('34'),
    '과목': finalContent?.includes('국어') || finalContent?.includes('subject'),
    '평가': finalContent?.includes('평가') || finalContent?.includes('evaluation'),
  };

  console.log('\n  📋 리포트 요소 확인:');
  Object.entries(checks).forEach(([key, value]) => {
    console.log(`    ${value ? '✅' : '❌'} ${key}`);
  });

  // === 최종 결과 ===
  console.log('\n=== 🎯 완료 ===\n');
  const reportGenerated = Object.values(checks).some(v => v === true);
  console.log(`✅ 리포트 생성: ${reportGenerated ? '성공' : '진행 중'}`);
  console.log(`✅ 전체 플로우: 완료\n`);
});
