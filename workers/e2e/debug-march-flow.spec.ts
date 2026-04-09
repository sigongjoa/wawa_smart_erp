/**
 * March 2026 데이터 입력검증 디버그 테스트
 * 3월 데이터 마이그레이션 후 플로우 테스트
 */

import { test, expect } from '@playwright/test';

const ADMIN = {
  name: '서재용 개발자',
  pin: '1141',
};

test('🔍 March 2026 Input Validation Debug', async ({ page }) => {
  console.log('\n=== 1️⃣ 로그인 ===');

  // 로그인
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  await page.locator('input[placeholder*="예:"]').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();

  await page.waitForTimeout(3000);
  console.log(`✅ 로그인 완료 - URL: ${page.url()}`);

  // 콘솔 에러 수집
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`❌ Console Error: ${msg.text()}`);
    }
  });

  // 월말평가 메뉴 클릭
  console.log('\n=== 2️⃣ 월말평가 페이지 접근 ===');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(3000);

  console.log(`✅ 월말평가 페이지 로드 - URL: ${page.url()}`);

  // 월 드롭다운 찾기
  console.log('\n=== 3️⃣ 3월 선택 ===');
  const monthOptions = page.locator('select, button[role="combobox"]');
  const monthCount = await monthOptions.count();
  console.log(`📊 Found ${monthCount} month selectors`);

  // 달 선택 시도 - 여러 방법
  let found = false;
  
  // 방법1: select 태그
  const selectElements = page.locator('select');
  if (await selectElements.count() > 0) {
    console.log('Found select element');
    await selectElements.first().selectOption('2026-03');
    found = true;
  }

  // 방법2: 텍스트로 찾기
  if (!found) {
    const marchButton = page.locator('button:has-text("3월"), div:has-text("3월")').first();
    if (await marchButton.isVisible()) {
      await marchButton.click();
      console.log('✅ Clicked March button');
      found = true;
    }
  }

  await page.waitForTimeout(2000);

  // 현재 페이지 상태 확인
  const bodyText = await page.locator('body').textContent();
  console.log(`\n📄 Page contains:
    - "3월": ${bodyText?.includes('3월')}
    - "강은서": ${bodyText?.includes('강은서')}
    - "학생 검색": ${bodyText?.includes('학생 검색')}
  `);

  // 학생 찾기
  console.log('\n=== 4️⃣ 강은서 학생 선택 ===');
  const studentSearchInput = page.locator('input[placeholder*="학생"]');
  if (await studentSearchInput.isVisible()) {
    await studentSearchInput.fill('강은서');
    await page.waitForTimeout(1000);
    console.log('✅ Searched for 강은서');
  }

  const eunSeoStudent = page.locator('text=강은서').first();
  if (await eunSeoStudent.isVisible()) {
    await eunSeoStudent.click();
    console.log('✅ Selected 강은서');
    await page.waitForTimeout(1500);
  }

  // 성적 입력 필드 확인
  console.log('\n=== 5️⃣ 성적 입력 필드 확인 ===');
  const scoreInputs = page.locator('input[type="number"]');
  const scoreCount = await scoreInputs.count();
  console.log(`📊 Found ${scoreCount} score input fields`);

  if (scoreCount > 0) {
    console.log('\n=== 6️⃣ 성적 입력 시도 ===');

    // 첫 번째 입력 필드에 유효한 점수 입력
    const firstInput = scoreInputs.first();
    
    // 입력 전 상태 확인
    const label = await firstInput.evaluate(el => {
      return el.parentElement?.textContent || el.previousElementSibling?.textContent || 'unknown';
    });
    console.log(`📝 First field label: ${label.substring(0, 50)}`);

    try {
      await firstInput.fill('85');
      console.log('✅ Entered score 85');
      await page.waitForTimeout(500);

      // Toast 메시지 확인
      const toast = page.locator('[role="alert"], .toast, .notification');
      const toastVisible = await toast.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (toastVisible) {
        const toastText = await toast.textContent();
        console.log(`⚠️ Toast message: ${toastText}`);
      }

      // 콘솔 로그 확인
      await page.waitForTimeout(500);
    } catch (error) {
      console.log(`❌ Error entering score: ${error}`);
    }

    // 저장 버튼 찾기
    console.log('\n=== 7️⃣ 저장 시도 ===');
    const saveBtn = page.locator('button:has-text("저장"), button:has-text("제출")').first();
    
    if (await saveBtn.isVisible({ timeout: 2000 })) {
      console.log('Found save button, clicking...');
      await saveBtn.click();
      await page.waitForTimeout(2000);

      // 저장 후 메시지 확인
      const alertToast = page.locator('[role="alert"], .toast, .notification');
      const alertTexts: string[] = [];
      const alertCount = await alertToast.count();
      
      for (let i = 0; i < alertCount; i++) {
        const text = await alertToast.nth(i).textContent();
        if (text) {
          alertTexts.push(text);
          console.log(`🔔 Toast ${i + 1}: ${text}`);
        }
      }

      // 입력검증 오류 확인
      if (alertTexts.some(t => t.includes('검증') || t.includes('Validation'))) {
        console.log('\n❌ FOUND VALIDATION ERROR!');
        console.log(alertTexts.filter(t => t.includes('검증') || t.includes('Validation')));
      }
    } else {
      console.log('⚠️ Save button not found');
    }
  }

  console.log('\n=== 📊 최종 상태 ===');
  console.log(`Console Errors collected: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:');
    consoleErrors.forEach(e => console.log(`  - ${e}`));
  }
});
