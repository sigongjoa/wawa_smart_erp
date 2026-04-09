/**
 * 완전한 리포트 생성 플로우
 * - 월말평가 메뉴 접근
 * - test 학생 찾기 및 성적 입력 (국어 34점)
 * - 리포트 생성
 */

import { test } from '@playwright/test';

const ADMIN = {
  name: '서재용 개발자',
  pin: '1141',
};

test('월말평가 → 성적 입력 → 리포트 생성 플로우', async ({ page }) => {
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
  console.log('\n=== 2️⃣ 월말평가 메뉴 접근 ===');
  const evalLink = page.locator('a:has-text("월말평가")').first();
  if (await evalLink.isVisible({ timeout: 2000 })) {
    await evalLink.click();
    await page.waitForTimeout(3000);
    console.log(`✅ 월말평가 페이지로 이동 - URL: ${page.url()}`);

    // 페이지 내용 확인
    const bodyText = await page.locator('body').textContent();
    console.log(`📄 페이지 내용: ${bodyText?.substring(0, 150)}`);

    // 현재 페이지의 모든 링크 확인
    const links = await page.locator('a').allTextContents();
    const buttons = await page.locator('button').allTextContents();

    console.log(`\n📌 페이지 내 링크:`);
    links.forEach((link, i) => {
      if (link.trim().length > 0 && link.trim().length < 30) {
        console.log(`   [${i + 1}] ${link.trim()}`);
      }
    });

    console.log(`\n🔘 페이지 내 버튼:`);
    buttons.forEach((btn, i) => {
      if (btn.trim().length > 0 && btn.trim().length < 30) {
        console.log(`   [${i + 1}] ${btn.trim()}`);
      }
    });

    // 학생 찾기
    console.log('\n=== 3️⃣ test 학생 찾기 ===');
    const testStudent = page.locator('text=test').first();
    if (await testStudent.isVisible({ timeout: 3000 })) {
      console.log('✅ test 학생 발견');
      await testStudent.click();
      await page.waitForTimeout(1500);

      // 성적 입력 필드 확인
      const scoreInputs = page.locator('input[type="number"]');
      const count = await scoreInputs.count();
      console.log(`📊 성적 입력 필드: ${count}개`);

      if (count > 0) {
        console.log('\n=== 4️⃣ 성적 입력 (국어 34점) ===');
        const firstInput = scoreInputs.first();
        await firstInput.fill('34');
        console.log('✅ 국어 점수 34점 입력');

        // 저장 버튼 찾기
        const saveBtn = page.locator('button:has-text("저장"), button:has-text("제출"), button:has-text("완료")').first();
        if (await saveBtn.isVisible({ timeout: 2000 })) {
          await saveBtn.click();
          console.log('✅ 성적 저장');
          await page.waitForTimeout(2000);
        } else {
          console.log('⚠️ 저장 버튼을 찾을 수 없음');
        }
      }
    } else {
      console.log('⚠️ test 학생을 찾을 수 없음');

      // 페이지에 있는 모든 텍스트 출력
      const allText = await page.locator('body').textContent();
      console.log(`📄 페이지 전체 텍스트: ${allText?.substring(0, 300)}`);
    }

    // 리포트 생성 메뉴/버튼 찾기
    console.log('\n=== 5️⃣ 리포트 생성 ===');
    const reportLink = page.locator('a:has-text("리포트")').first();
    const reportBtn = page.locator('button:has-text("리포트"), button:has-text("생성"), button:has-text("만들기")').first();

    if (await reportLink.isVisible({ timeout: 2000 })) {
      await reportLink.click();
      await page.waitForTimeout(2000);
      console.log(`✅ 리포트 페이지로 이동 - URL: ${page.url()}`);
    } else if (await reportBtn.isVisible({ timeout: 2000 })) {
      await reportBtn.click();
      await page.waitForTimeout(2000);
      console.log('✅ 리포트 생성 버튼 클릭');
    } else {
      console.log('⚠️ 리포트 생성 옵션을 찾을 수 없음');
    }

    // 최종 결과 확인
    const finalUrl = page.url();
    const finalText = await page.locator('body').textContent();
    console.log(`\n📄 최종 URL: ${finalUrl}`);
    console.log(`📄 최종 페이지 내용: ${finalText?.substring(0, 100)}`);
  } else {
    console.log('❌ 월말평가 메뉴를 찾을 수 없음');
  }
});
