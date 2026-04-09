import { test, expect } from '@playwright/test';

/**
 * 기본설정 탭 렌더링 문제 디버깅
 */

const APP_URL = 'http://localhost:5173';

test('기본설정 탭 렌더링 확인', async ({ browser }) => {
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // 로그인
  await page.goto(APP_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  const inputs = await page.locator('input');
  await inputs.nth(0).fill('김상현');
  await inputs.nth(1).fill('1234');

  const loginButton = await page.locator('button:has-text("로그인")');
  await loginButton.click();

  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // 설정 페이지 접근
  const settingsButton = await page.locator('button[aria-label="설정"]');
  await settingsButton.click();
  console.log('✅ 설정 버튼 클릭');

  await page.waitForTimeout(1000);

  // 모든 버튼 찾기
  const allButtons = await page.locator('button');
  const buttonCount = await allButtons.count();
  console.log(`=== 페이지의 모든 버튼 (${buttonCount}개) ===`);

  for (let i = 0; i < Math.min(buttonCount, 20); i++) {
    const text = await allButtons.nth(i).textContent();
    const isVisible = await allButtons.nth(i).isVisible().catch(() => false);
    console.log(`[${i}] "${text?.trim()}" (보이는가: ${isVisible})`);
  }

  // 탭 버튼 찾기
  console.log('\n=== 탭 검색 ===');
  const tabButtons = [
    { label: '학생 관리', selector: 'button:has-text("학생 관리")' },
    { label: '시험 월 설정', selector: 'button:has-text("시험 월 설정")' },
    { label: '기본 설정', selector: 'button:has-text("기본 설정")' },
  ];

  for (const tab of tabButtons) {
    const element = page.locator(tab.selector);
    const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`${tab.label}: ${isVisible ? '✅ 찾음' : '❌ 못찾음'}`);

    if (isVisible) {
      const text = await element.textContent();
      console.log(`  텍스트: "${text}"`);
    }
  }

  // HTML 구조 확인
  console.log('\n=== 페이지 HTML 구조 ===');
  const pageHTML = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const divs = document.querySelectorAll('div[style*="flex"]');
    return {
      h1: h1?.textContent,
      divCount: divs.length,
      firstDiv: divs[0]?.textContent?.substring(0, 100),
    };
  });

  console.log(`제목: ${pageHTML.h1}`);
  console.log(`flex div 개수: ${pageHTML.divCount}`);

  // 탭 내용 렌더링 확인
  console.log('\n=== 탭 내용 렌더링 ===');
  const renderingCheck = await page.evaluate(() => {
    return {
      hasStudentTab: document.body.textContent?.includes('+ 학생 추가') ?? false,
      hasExamTab: document.body.textContent?.includes('활성 시험 월 설정') ?? false,
      hasBasicTab: document.body.textContent?.includes('학원 이름') ?? false,
    };
  });

  console.log(`학생 관리 탭 렌더링: ${renderingCheck.hasStudentTab ? '✅' : '❌'}`);
  console.log(`시험 월 설정 탭 렌더링: ${renderingCheck.hasExamTab ? '✅' : '❌'}`);
  console.log(`기본 설정 탭 렌더링: ${renderingCheck.hasBasicTab ? '✅' : '❌'}`);

  // 기본 설정 탭 클릭 시도
  console.log('\n=== 기본 설정 탭 클릭 시도 ===');
  const basicTab = page.locator('button').filter({ hasText: '기본 설정' });
  const basicTabVisible = await basicTab.isVisible({ timeout: 1000 }).catch(() => false);

  if (basicTabVisible) {
    await basicTab.click();
    console.log('✅ 기본 설정 탭 클릭');
    await page.waitForTimeout(500);

    const academyNameInput = page.locator('input[placeholder="예: 와와 학원"]');
    const inputVisible = await academyNameInput.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`학원 이름 입력필드: ${inputVisible ? '✅ 보임' : '❌ 안 보임'}`);
  } else {
    console.log('❌ 기본 설정 탭을 찾을 수 없음');
  }

  await page.close();
});
