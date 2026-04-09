/**
 * 설정 페이지 콘솔 로그 검사
 * Notion API 호출이 완전히 제거되었는지 확인
 */

import { test } from '@playwright/test';

test('설정 페이지 콘솔 로그 수집 및 출력', async ({ page }) => {
  const consoleLogs: any[] = [];
  const pageErrors: any[] = [];

  // 콘솔 메시지 수집
  page.on('console', msg => {
    const logEntry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      args: msg.args(),
    };
    consoleLogs.push(logEntry);
    console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // 에러 수집
  page.on('pageerror', error => {
    pageErrors.push(error);
    console.log(`[ERROR] ${error.message}`);
  });

  // 페이지 방문
  console.log('\n=== 로그인 ===');
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');

  // 로그인 버튼 찾기
  const loginButton = page.locator('button:has-text("로그인")').first();
  if (await loginButton.isVisible()) {
    console.log('로그인 화면 감지');

    // 로그인
    await page.fill('input[type="text"]', '김상현');
    await page.fill('input[type="password"]', '1234');
    await page.click('button:has-text("로그인")');
    await page.waitForNavigation();
  }

  console.log('\n=== 설정 페이지 접근 ===');

  // 설정 페이지로 이동
  const settingsLink = page.locator('a[href*="settings"], button[aria-label*="설정"], [data-testid="settings"]').first();

  if (await settingsLink.isVisible()) {
    await settingsLink.click();
  } else {
    // 직접 URL로 접근
    await page.goto('http://localhost:5174/settings');
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('\n=== 콘솔 로그 분석 ===');

  // Notion 관련 로그 필터링
  const notionLogs = consoleLogs.filter(log =>
    log.text.includes('[Notion') ||
    log.text.includes('Notion') ||
    log.text.includes('notion') ||
    log.text.includes('notionFetch')
  );

  const d1Logs = consoleLogs.filter(log =>
    log.text.includes('D1') ||
    log.text.includes('[D1') ||
    log.text.includes('d1')
  );

  const fetchLogs = consoleLogs.filter(log =>
    log.text.includes('fetch') ||
    log.text.includes('POST') ||
    log.text.includes('GET')
  );

  console.log('\n📋 콘솔 로그 통계:');
  console.log(`- 총 로그: ${consoleLogs.length}개`);
  console.log(`- Notion 로그: ${notionLogs.length}개`);
  console.log(`- D1 로그: ${d1Logs.length}개`);
  console.log(`- Fetch 로그: ${fetchLogs.length}개`);
  console.log(`- 에러: ${pageErrors.length}개`);

  if (notionLogs.length > 0) {
    console.log('\n⚠️ Notion 관련 로그 발견:');
    notionLogs.forEach(log => {
      console.log(`  - [${log.type}] ${log.text}`);
    });
  } else {
    console.log('\n✅ Notion 로그 없음 (완전 제거됨)');
  }

  if (d1Logs.length > 0) {
    console.log('\n✅ D1 로그 발견:');
    d1Logs.forEach(log => {
      console.log(`  - [${log.type}] ${log.text}`);
    });
  }

  // 페이지 콘텐츠 스크린샷
  await page.screenshot({ path: '/tmp/settings-page.png' });
  console.log('\n📸 스크린샷: /tmp/settings-page.png');

  // 설정 페이지 HTML 확인
  const pageHTML = await page.content();
  const hasNotionField = pageHTML.includes('notion') || pageHTML.includes('Notion');
  const hasApiKeyField = pageHTML.includes('apiKey') || pageHTML.includes('API Key');

  console.log('\n🔍 HTML 콘텐츠 분석:');
  console.log(`- Notion 필드: ${hasNotionField ? '발견' : '없음'}`);
  console.log(`- API Key 필드: ${hasApiKeyField ? '발견' : '없음'}`);

  // 모든 콘솔 로그 상세 출력
  console.log('\n=== 전체 콘솔 로그 (상세) ===');
  consoleLogs.forEach((log, idx) => {
    console.log(`[${idx + 1}] [${log.type}] ${log.text}`);
  });

  // 결과 정리
  console.log('\n=== 최종 결론 ===');
  if (notionLogs.length === 0 && !hasNotionField) {
    console.log('✅ Notion API 완전 제거 완료!');
    console.log('✅ D1 전용으로 전환됨');
  } else {
    console.log('⚠️ 아직 Notion 관련 코드가 남아있을 수 있음');
  }
});
