/**
 * 메뉴 디버그 - 실제 사용 가능한 메뉴 항목 확인
 */

import { test } from '@playwright/test';

test('네비게이션 메뉴 확인', async ({ page }) => {
  const ADMIN = {
    name: '서재용 개발자',
    pin: '1141',
  };

  // 로그인
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // 로그인 수행
  await page.locator('input[placeholder*="예:"]').first().fill(ADMIN.name);
  await page.locator('input[type="password"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("접속하기"), button:has-text("로그인")').first().click();

  // 대시보드 로드 대기
  await page.waitForTimeout(3000);

  console.log('\n=== 네비게이션 메뉴 분석 ===');

  // 모든 링크 찾기
  const allLinks = await page.locator('a').allTextContents();
  console.log(`\n📌 모든 링크 (${allLinks.length}개):`);
  allLinks.forEach((link, i) => {
    if (link.trim().length > 0) {
      console.log(`   [${i + 1}] ${link.trim()}`);
    }
  });

  // 모든 버튼 찾기
  const allButtons = await page.locator('button').allTextContents();
  console.log(`\n🔘 모든 버튼 (${allButtons.length}개):`);
  allButtons.forEach((btn, i) => {
    if (btn.trim().length > 0 && btn.trim().length < 50) {
      console.log(`   [${i + 1}] ${btn.trim()}`);
    }
  });

  // nav 엘리먼트 내 텍스트
  const navText = await page.locator('nav').allTextContents();
  console.log(`\n🧭 Navigation 요소:`);
  navText.forEach((text, i) => {
    if (text.trim().length > 0) {
      console.log(`   ${text.trim().substring(0, 100)}`);
    }
  });

  // 현재 URL 및 페이지 제목
  console.log(`\n📄 현재 상태:`);
  console.log(`   - URL: ${page.url()}`);
  console.log(`   - 제목: ${await page.title()}`);

  // 사이드바나 메뉴 구조 확인
  const menuContainer = await page.locator('[class*="menu"], [class*="sidebar"], [class*="nav"]').allTextContents();
  console.log(`\n📋 메뉴 컨테이너 텍스트:`);
  menuContainer.slice(0, 5).forEach((text, i) => {
    console.log(`   [${i + 1}] ${text.trim().substring(0, 80)}`);
  });
});
