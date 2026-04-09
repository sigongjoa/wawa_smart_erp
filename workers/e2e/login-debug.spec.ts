/**
 * 로그인 디버그 - 실제로 어디로 이동하는지 확인
 */

import { test } from '@playwright/test';

const ADMIN = {
  name: '서재용 개발자',
  pin: '0000',
};

test('로그인 후 실제 이동 위치 확인', async ({ page }) => {
  // 쿠키 정리
  await page.context().clearCookies();

  // 콘솔 로그 수집
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // 에러 캡처
  page.on('pageerror', err => {
    console.log(`❌ 페이지 에러: ${err.message}`);
  });

  // 페이지 접근
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  console.log(`📄 초기 URL: ${page.url()}`);

  // 로그인 폼 입력
  const nameInput = page.locator('input[placeholder*="예:"]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(ADMIN.name);

  const pinInput = page.locator('input[type="password"]').first();
  await pinInput.fill(ADMIN.pin);
  console.log('✅ 로그인 정보 입력 완료');

  // 로그인 버튼 클릭
  const loginBtn = page.locator('button:has-text("접속하기"), button:has-text("로그인")').first();
  await loginBtn.click();
  console.log('✅ 로그인 버튼 클릭');

  // 네트워크 요청 대기 (하지만 타임아웃 짧게)
  await page.waitForTimeout(3000);

  // 현재 상태 확인
  const currentUrl = page.url();
  console.log(`📄 현재 URL: ${currentUrl}`);

  // 페이지 내용 확인
  const bodyText = await page.locator('body').textContent();
  console.log(`📄 페이지 콘텐츠 길이: ${bodyText?.length}`);
  console.log(`📄 페이지 첫 200자: ${bodyText?.substring(0, 200)}`);

  // 로컬 스토리지 확인
  const localStorage = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        items[key] = window.localStorage.getItem(key) || '';
      }
    }
    return items;
  });
  console.log(`💾 로컬 스토리지: ${JSON.stringify(localStorage, null, 2)}`);

  // 수집된 콘솔 로그 출력
  console.log(`\n📋 수집된 콘솔 로그 (${consoleLogs.length}개):`);
  consoleLogs.slice(0, 20).forEach((log, i) => {
    console.log(`   [${i + 1}] ${log}`);
  });

  // API 요청 모니터링
  const responses: { url: string; status: number; ok: boolean }[] = [];
  page.on('response', response => {
    if (response.url().includes('api')) {
      responses.push({
        url: response.url(),
        status: response.status(),
        ok: response.ok(),
      });
    }
  });

  // 잠시 후 API 응답 확인
  await page.waitForTimeout(2000);
  console.log(`\n📡 API 응답:`);
  responses.forEach((r, i) => {
    console.log(`   [${i + 1}] ${r.status} ${r.ok ? '✅' : '❌'} ${r.url}`);
  });
});
