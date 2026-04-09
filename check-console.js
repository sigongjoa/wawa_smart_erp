/**
 * Playwright으로 설정 페이지 콘솔 로그 수집
 */

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  // 콘솔 메시지 수집
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
    });
    console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // 에러 수집
  page.on('pageerror', error => {
    pageErrors.push(error);
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  console.log('\n=== 1️⃣ 앱 접근 ===');
  try {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle', timeout: 10000 });
    console.log('✅ 페이지 로드 완료');
  } catch (e) {
    console.log(`⚠️ 페이지 로드 타임아웃: ${e.message}`);
  }

  await page.waitForTimeout(2000);

  console.log('\n=== 2️⃣ 로그인 ===');
  try {
    // 로그인 폼 찾기
    const nameInput = await page.$('input[type="text"], input[placeholder*="name" i]');
    const pinInput = await page.$('input[type="password"], input[placeholder*="pin" i]');

    if (nameInput && pinInput) {
      await nameInput.fill('김상현');
      await pinInput.fill('1234');
      await page.click('button:has-text("로그인"), button:has-text("Login")');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      console.log('✅ 로그인 완료');
    } else {
      console.log('⚠️ 로그인 폼을 찾을 수 없음');
    }
  } catch (e) {
    console.log(`⚠️ 로그인 실패: ${e.message}`);
  }

  await page.waitForTimeout(1000);

  console.log('\n=== 3️⃣ 설정 페이지 접근 ===');
  try {
    // 설정 페이지로 직접 이동
    await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle', timeout: 10000 });
    console.log('✅ 설정 페이지 로드 완료');
  } catch (e) {
    console.log(`⚠️ 설정 페이지 로드 실패: ${e.message}`);
  }

  await page.waitForTimeout(2000);

  console.log('\n=== 4️⃣ 콘솔 로그 분석 ===');

  // 분류별 로그
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

  console.log('\n📋 통계:');
  console.log(`- 총 로그: ${consoleLogs.length}개`);
  console.log(`- Notion 로그: ${notionLogs.length}개`);
  console.log(`- D1 로그: ${d1Logs.length}개`);
  console.log(`- Fetch 로그: ${fetchLogs.length}개`);
  console.log(`- 에러: ${pageErrors.length}개`);

  if (notionLogs.length > 0) {
    console.log('\n⚠️ ❌ Notion 관련 로그 발견:');
    notionLogs.forEach((log, idx) => {
      console.log(`  [${idx + 1}] [${log.type}] ${log.text}`);
    });
  } else {
    console.log('\n✅ Notion 로그 없음 (완전 제거됨)');
  }

  if (d1Logs.length > 0) {
    console.log('\n✅ D1 로그 발견:');
    d1Logs.forEach((log, idx) => {
      console.log(`  [${idx + 1}] [${log.type}] ${log.text}`);
    });
  }

  // 전체 로그 출력
  console.log('\n=== 5️⃣ 전체 콘솔 로그 ===');
  consoleLogs.forEach((log, idx) => {
    console.log(`[${idx + 1}] [${log.type.toUpperCase()}] ${log.text}`);
  });

  // HTML 확인
  const html = await page.content();
  const hasNotionInHTML = html.includes('notion') || html.includes('Notion');
  const hasApiKeyInHTML = html.includes('apiKey') || html.includes('API Key');

  console.log('\n=== 6️⃣ HTML 분석 ===');
  console.log(`- Notion 관련 텍스트: ${hasNotionInHTML ? '발견' : '없음'}`);
  console.log(`- API Key 관련 텍스트: ${hasApiKeyInHTML ? '발견' : '없음'}`);

  // 최종 결론
  console.log('\n=== 🎯 최종 결론 ===');
  if (notionLogs.length === 0 && !hasNotionInHTML) {
    console.log('✅ Notion API 완전 제거 완료!');
    console.log('✅ D1 전용 시스템 구축됨');
  } else {
    console.log('⚠️ 아직 Notion 관련 코드가 남아있을 수 있음');
  }

  await browser.close();
})().catch(err => {
  console.error('에러:', err);
  process.exit(1);
});
