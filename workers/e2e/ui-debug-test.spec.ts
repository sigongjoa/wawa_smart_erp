import { test, expect } from '@playwright/test';

test('React 앱 로딩 디버그', async ({ page }) => {
  const consoleLogs: string[] = [];
  const pageErrors: string[] = [];
  const requests: string[] = [];

  // 콘솔 메시지 캡처
  page.on('console', msg => {
    const logMsg = `[${msg.type()}] ${msg.text()}`;
    console.log(logMsg);
    consoleLogs.push(logMsg);
  });

  // 페이지 에러 캡처
  page.on('pageerror', err => {
    const errMsg = `[PageError] ${err.message}`;
    console.log(errMsg);
    pageErrors.push(errMsg);
  });

  // 요청 캡처
  page.on('request', req => {
    requests.push(`${req.method()} ${req.url()}`);
  });

  // 페이지 접속
  console.log('페이지 접속 시작...');
  const response = await page.goto('http://localhost:5173');
  console.log(`응답 상태: ${response?.status()}`);

  // 로드 대기
  await page.waitForLoadState('domcontentloaded');
  console.log('DOM Content Loaded');

  // 약간의 시간 대기 (React 로드)
  await page.waitForTimeout(3000);

  // 최종 상태 확인
  const rootContent = await page.locator('#root').innerHTML();
  console.log(`\nRoot innerHTML length: ${rootContent.length}`);
  if (rootContent.length > 0) {
    console.log(`Root innerHTML (처음 500자): ${rootContent.substring(0, 500)}`);
  } else {
    console.log('Root가 비어있습니다!');
  }

  console.log(`\n요청 수: ${requests.length}`);
  requests.slice(0, 10).forEach(r => console.log(`  ${r}`));

  console.log(`\n콘솔 메시지: ${consoleLogs.length}개`);
  consoleLogs.forEach(log => console.log(`  ${log}`));

  console.log(`\n페이지 에러: ${pageErrors.length}개`);
  pageErrors.forEach(err => console.log(`  ${err}`));

  // 실제 에러 여부 확인
  if (pageErrors.length > 0 || rootContent.length === 0) {
    console.log('\n❌ React 앱이 제대로 로드되지 않았습니다!');

    // window 객체 상태 확인
    const windowState = await page.evaluate(() => {
      return {
        'window.React': typeof (window as any).React,
        'document.readyState': document.readyState,
        'root element exists': !!document.getElementById('root'),
      };
    });
    console.log('Window 상태:', windowState);
  } else {
    console.log('\n✅ React 앱이 정상 로드되었습니다!');
  }
});
