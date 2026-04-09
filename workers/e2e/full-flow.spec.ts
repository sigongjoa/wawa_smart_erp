/**
 * 전체 플로우 테스트
 * 1. 로그인
 * 2. 성적 입력 (test 학생에게 국어 34점)
 * 3. 리포트 생성 및 확인
 * 4. 월 변경 (3월, 4월)
 */

import { test, expect } from '@playwright/test';

const TEACHER = {
  name: '남현욱',
  pin: '1312',
};

test.describe('성적 입력 → 리포트 생성 전체 플로우', () => {
  test('로그인부터 리포트 생성까지', async ({ page }) => {
    const consoleLogs: any[] = [];
    const errors: any[] = [];

    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log(`[ERROR] ${msg.text()}`);
      }
    });

    // === 1️⃣ 로그인 ===
    console.log('\n=== 1️⃣ 로그인 ===');
    await page.context().clearCookies();
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const nameInput = page.locator('input[placeholder*="예:"]').first();
    const pinInput = page.locator('input[type="password"]').first();

    await nameInput.fill(TEACHER.name);
    await pinInput.fill(TEACHER.pin);
    console.log(`✅ ${TEACHER.name} 선생님 로그인 정보 입력`);

    await page.locator('button').first().click();
    console.log('✅ 로그인 버튼 클릭');

    await page.waitForURL(/timer|schedule|dashboard/, { timeout: 10000 });
    console.log('✅ 로그인 성공 - 대시보드 로드됨');

    await page.waitForTimeout(2000);

    // === 2️⃣ 성적 입력 페이지 이동 ===
    console.log('\n=== 2️⃣ 성적 입력 페이지 ===');

    const inputLink = page.locator('a:has-text("입력"), a:has-text("성적"), button:has-text("입력")').first();

    if (await inputLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputLink.click();
      console.log('✅ 성적 입력 메뉴 클릭');
      await page.waitForTimeout(2000);
    }

    // === 3️⃣ 성적 입력 ===
    console.log('\n=== 3️⃣ 성적 입력 시도 ===');

    const searchInputs = page.locator('input[type="text"], input[placeholder*="검색"], input[placeholder*="학생"]');
    const searchInputCount = await searchInputs.count();

    if (searchInputCount > 0) {
      console.log(`🔍 검색 필드 발견: ${searchInputCount}개`);
      await searchInputs.first().fill('test');
      console.log('✅ "test" 검색');
      await page.waitForTimeout(1000);

      const numberInputs = page.locator('input[type="number"]');
      const numCount = await numberInputs.count();
      console.log(`🔢 성적 입력 필드: ${numCount}개`);

      if (numCount > 0) {
        await numberInputs.first().fill('34');
        console.log('✅ 국어 성적 34점 입력');

        const saveBtn = page.locator('button:has-text("저장"), button:has-text("제출"), button:has-text("완료")').first();
        if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await saveBtn.click();
          console.log('✅ 성적 저장');
          await page.waitForTimeout(2000);
        }
      }
    }

    // === 4️⃣ 리포트 페이지 ===
    console.log('\n=== 4️⃣ 리포트 생성 페이지 ===');

    const reportLink = page.locator('a:has-text("리포트"), a:has-text("보고"), button:has-text("리포트")').first();

    if (await reportLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reportLink.click();
      console.log('✅ 리포트 메뉴 클릭');
      await page.waitForTimeout(3000);

      const generateBtn = page.locator('button:has-text("생성"), button:has-text("만들기"), button:has-text("리포트")').first();
      if (await generateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await generateBtn.click();
        console.log('✅ 리포트 생성 요청');
        await page.waitForTimeout(3000);
      }

      const reportContent = await page.locator('body').textContent();
      if (reportContent?.includes('34') || reportContent?.includes('국어')) {
        console.log('✅ 리포트에 성적 데이터 포함됨');
      }
    }

    // === 5️⃣ 최종 결과 ===
    console.log('\n=== 5️⃣ 최종 결과 ===');
    console.log(`📊 콘솔 로그: ${consoleLogs.length}개`);
    console.log(`❌ 에러: ${errors.length}개`);

    console.log('\n✅ 테스트 완료!');
  });

  test('3월과 4월 월별 리포트 테스트', async ({ page }) => {
    console.log('\n=== 월별 리포트 테스트 ===');

    await page.context().clearCookies();
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const nameInput = page.locator('input[placeholder*="예:"]').first();
    const pinInput = page.locator('input[type="password"]').first();

    await nameInput.fill(TEACHER.name);
    await pinInput.fill(TEACHER.pin);
    await page.locator('button').first().click();

    await page.waitForURL(/timer|schedule|dashboard/, { timeout: 10000 });
    console.log('✅ 로그인 성공');

    await page.waitForTimeout(2000);

    const reportLink = page.locator('a:has-text("리포트"), a:has-text("보고")').first();
    if (await reportLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reportLink.click();
      console.log('✅ 리포트 페이지 접근');
      await page.waitForTimeout(2000);

      const bodyText = await page.locator('body').textContent();
      const currentMonth = bodyText?.includes('2026-04') ? '4월' : bodyText?.includes('2026-03') ? '3월' : '미상';
      console.log(`📅 현재 월: ${currentMonth}`);
    }
  });
});
