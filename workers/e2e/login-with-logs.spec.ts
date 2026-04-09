/**
 * 로그인 상세 디버그 - 모든 로그와 네트워크 요청 추적
 */

import { test } from '@playwright/test';

const ADMIN = {
  name: '서재용 개발자',
  pin: '1141',
};

test('로그인 상세 디버그', async ({ page }) => {
  // 콘솔 로그 수집
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const logStr = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(logStr);
    console.log(logStr);
  });

  // 네트워크 요청 추적
  const requests: { method: string; url: string; status?: number; error?: string }[] = [];
  page.on('request', req => {
    if (req.url().includes('api')) {
      requests.push({ method: req.method(), url: req.url() });
    }
  });

  page.on('response', res => {
    if (res.url().includes('api')) {
      const req = requests.find(r => r.url === res.url());
      if (req) {
        req.status = res.status();
      }
    }
  });

  // 에러 추적
  page.on('pageerror', err => {
    console.log(`❌ 페이지 에러: ${err.message}`);
  });

  // 페이지 접근
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  console.log('✅ 페이지 로드됨');

  // 로그인
  const nameInput = page.locator('input[placeholder*="예:"]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(ADMIN.name);

  const pinInput = page.locator('input[type="password"]').first();
  await pinInput.fill(ADMIN.pin);
  console.log(`✅ 로그인 정보 입력: ${ADMIN.name} / ${ADMIN.pin}`);

  // 로그인 버튼 클릭
  const loginBtn = page.locator('button:has-text("접속하기"), button:has-text("로그인")').first();
  await loginBtn.click();
  console.log('✅ 로그인 버튼 클릭');

  // 네트워크 요청 기다리기 (최대 5초)
  await page.waitForTimeout(5000);

  // 결과 확인
  const currentUrl = page.url();
  console.log(`\n📄 현재 URL: ${currentUrl}`);
  console.log(`📋 네트워크 요청:`);
  requests.forEach((r, i) => {
    console.log(`   [${i + 1}] ${r.status || '?'} ${r.method} ${r.url}`);
  });

  console.log(`\n📋 콘솔 로그 (${consoleLogs.length}개):`);
  consoleLogs.slice(-30).forEach((log, i) => {
    console.log(`   ${log}`);
  });

  // 페이지 텍스트 출력
  const bodyText = await page.locator('body').textContent();
  const hasError = bodyText?.includes('에러') || bodyText?.includes('Error') || bodyText?.includes('실패');
  const hasLoading = bodyText?.includes('로그인 중') || bodyText?.includes('로딩');

  console.log(`\n📊 페이지 상태:`);
  console.log(`   - 내용 길이: ${bodyText?.length}`);
  console.log(`   - 에러 메시지: ${hasError ? '있음' : '없음'}`);
  console.log(`   - 로딩 중: ${hasLoading ? '있음' : '없음'}`);

  // 로컬 스토리지 확인
  const tokens = await page.evaluate(() => {
    return {
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken'),
    };
  });
  console.log(`\n💾 토큰:`);
  console.log(`   - accessToken: ${tokens.accessToken ? tokens.accessToken.substring(0, 20) + '...' : 'null'}`);
  console.log(`   - refreshToken: ${tokens.refreshToken ? tokens.refreshToken.substring(0, 20) + '...' : 'null'}`);
});
