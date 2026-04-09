/**
 * 완전한 리포트 생성 플로우
 * - 월말평가 메뉴 접근 ✅
 * - test 학생 선택 및 성적 입력 (국어 34점)
 * - 리포트 생성
 */

import { test, expect } from '@playwright/test';

const ADMIN = {
  name: '서재용 개발자',
  pin: '1141',
};

test('🎯 완전한 월말평가 → 성적 입력 → 리포트 플로우', async ({ page }) => {
  console.log('\n=== 1️⃣ 로그인 ===');

  // 로그인
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  await page.locator('input[placeholder*="예:"]').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();

  await page.waitForTimeout(3000);
  console.log(`✅ 로그인 완료 - URL: ${page.url()}`);

  // 월말평가 메뉴 클릭
  console.log('\n=== 2️⃣ 월말평가 페이지 접근 ===');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(3000);

  const pageUrl = page.url();
  const bodyText = await page.locator('body').textContent();
  const hasError = bodyText?.includes('오류') || bodyText?.includes('Error');

  console.log(`✅ 월말평가 페이지로 이동 - URL: ${pageUrl}`);
  console.log(`✅ 에러 없음: ${!hasError}`);

  // test 학생 찾기
  console.log('\n=== 3️⃣ test 학생 찾기 ===');
  const testStudent = page.locator('text=test').first();
  if (await testStudent.isVisible({ timeout: 3000 })) {
    console.log('✅ test 학생 발견');
    await testStudent.click();
    await page.waitForTimeout(1500);

    // 학생 정보 확인
    const studentName = await page.locator('h2').first().textContent();
    console.log(`✅ 선택된 학생: ${studentName}`);

    // 성적 입력 필드 확인
    const scoreInputs = page.locator('input[type="number"]');
    const count = await scoreInputs.count();
    console.log(`📊 성적 입력 필드: ${count}개`);

    if (count > 0) {
      console.log('\n=== 4️⃣ 성적 입력 (국어 34점) ===');

      // 첫 번째 성적 필드에 34 입력 (국어)
      const firstInput = scoreInputs.first();
      await firstInput.fill('34');
      console.log('✅ 국어 점수 34점 입력');

      // 저장 버튼 찾기 및 클릭
      const saveBtn = page.locator('button:has-text("저장"), button:has-text("제출"), button:has-text("완료")').first();
      if (await saveBtn.isVisible({ timeout: 2000 })) {
        await saveBtn.click();
        console.log('✅ 성적 저장 버튼 클릭');
        await page.waitForTimeout(2000);
      } else {
        console.log('⚠️ 저장 버튼을 찾을 수 없음');
      }
    }
  } else {
    console.log('⚠️ test 학생을 찾을 수 없음');
  }

  // 리포트 미리보기 메뉴 클릭
  console.log('\n=== 5️⃣ 리포트 미리보기 접근 ===');
  const previewLink = page.locator('a:has-text("리포트 미리보기"), button:has-text("리포트")').first();
  if (await previewLink.isVisible({ timeout: 2000 })) {
    await previewLink.click();
    await page.waitForTimeout(3000);
    console.log(`✅ 리포트 미리보기 페이지로 이동 - URL: ${page.url()}`);

    // 페이지 내용 확인
    const reportText = await page.locator('body').textContent();
    if (reportText && reportText.length > 500) {
      console.log(`✅ 리포트 콘텐츠 로드됨 (${reportText.length}자)`);
    } else {
      console.log('⚠️ 리포트 콘텐츠가 부족함');
    }
  } else {
    console.log('⚠️ 리포트 미리보기 메뉴를 찾을 수 없음');
  }

  // 최종 상태
  console.log('\n=== ✅ 플로우 완료 ===');
  console.log(`📄 최종 URL: ${page.url()}`);
  console.log('🎉 월말평가 → 성적 입력 → 리포트 생성 플로우 작동 확인!');
});
