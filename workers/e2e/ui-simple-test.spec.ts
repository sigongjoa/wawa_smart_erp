import { test, expect } from '@playwright/test';

test('웹앱 로드 및 페이지 상태 확인', async ({ page }) => {
  // 페이지 접속
  await page.goto('http://localhost:5173');

  // 콘솔 에러 확인
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // 페이지 로드 대기
  await page.waitForLoadState('networkidle');

  // 페이지 타이틀 확인
  const title = await page.title();
  console.log(`페이지 타이틀: ${title}`);

  // HTML body 내용 확인
  const html = await page.content();
  console.log(`페이지 크기: ${html.length} bytes`);
  console.log(`페이지 내용 (처음 1000자):`);
  console.log(html.substring(0, 1000));

  // 특정 요소 찾기
  const root = await page.locator('#root');
  const rootHtml = await root.innerHTML();
  console.log(`\nRoot element HTML (처음 2000자):`);
  console.log(rootHtml.substring(0, 2000));

  // 텍스트 콘텐츠
  const bodyText = await page.textContent('body');
  console.log(`\nBody 텍스트 (처음 500자):`);
  console.log(bodyText?.substring(0, 500));
});
