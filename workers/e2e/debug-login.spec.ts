/**
 * 로그인 페이지 디버깅
 */

import { test } from '@playwright/test';

test('로그인 페이지 상세 확인', async ({ page }) => {
  console.log('\n=== 페이지 접근 ===');

  const consoleLogs: string[] = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  await page.context().clearCookies();
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

  // 페이지 로드 후 대기
  await page.waitForTimeout(3000);

  // 페이지 정보
  const url = page.url();
  const title = await page.title();
  const html = await page.content();

  console.log(`📄 URL: ${url}`);
  console.log(`📄 Title: ${title}`);
  console.log(`📄 HTML length: ${html.length}`);
  console.log(`📄 HTML contains <select: ${html.includes('<select')}`);
  console.log(`📄 HTML contains form-group: ${html.includes('form-group')}`);

  // 페이지에 있는 모든 엘리먼트 확인
  const bodyHtml = await page.locator('body').innerHTML();
  const selectMatches = bodyHtml.match(/<select/g);
  console.log(`\n🔍 <select 태그 개수: ${selectMatches?.length || 0}`);

  // 페이지에서 div 확인
  const divCount = await page.locator('div').count();
  console.log(`🔍 div 엘리먼트: ${divCount}개`);

  // label 확인
  const labels = await page.locator('label').allTextContents();
  console.log(`\n🔍 Label 텍스트:`);
  labels.forEach((l, i) => {
    console.log(`   [${i}] ${l.trim()}`);
  });

  // input 확인
  const inputs = page.locator('input');
  const inputCount = await inputs.count();
  console.log(`\n🔍 Input 엘리먼트: ${inputCount}개`);
  for (let i = 0; i < inputCount; i++) {
    const type = await inputs.nth(i).getAttribute('type');
    const placeholder = await inputs.nth(i).getAttribute('placeholder');
    console.log(`   [${i}] type="${type}" placeholder="${placeholder}"`);
  }

  // 콘솔 로그 확인
  console.log(`\n📋 콘솔 로그 (${consoleLogs.length}개):`);
  consoleLogs.slice(0, 10).forEach((log, i) => {
    console.log(`   [${i}] ${log}`);
  });

  // 직접 선택자로 select 시도
  console.log(`\n🔍 선택자 테스트:`);
  const selectByTag = await page.locator('select').count();
  const selectByClass = await page.locator('.search-input[type="select"]').count();
  const selectByAttr = await page.locator('[type="select"]').count();

  console.log(`   - select 태그: ${selectByTag}개`);
  console.log(`   - .search-input select: ${selectByClass}개`);
  console.log(`   - [type="select"]: ${selectByAttr}개`);
});
