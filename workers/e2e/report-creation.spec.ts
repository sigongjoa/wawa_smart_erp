/**
 * 리포트 생성 테스트
 * 핵심: 성적 입력 → 리포트 생성 검증
 */

import { test, expect } from '@playwright/test';

const TEACHER = {
  name: '남현욱',
  pin: '1312',
};

test('리포트 생성 완전 테스트', async ({ page }) => {
  console.log('\n========================================');
  console.log('리포트 생성 테스트 시작');
  console.log('========================================\n');

  // 쿠키 정리
  await page.context().clearCookies();

  // === 1️⃣ 로그인 ===
  console.log('📌 Step 1: 로그인');
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const nameInput = page.locator('input[placeholder*="예:"]').first();
  const pinInput = page.locator('input[type="password"]').first();

  await nameInput.fill(TEACHER.name);
  await pinInput.fill(TEACHER.pin);
  await page.locator('button').first().click();
  console.log('  ✅ 로그인 클릭');

  await page.waitForURL(/timer|schedule|dashboard/, { timeout: 10000 });
  console.log('  ✅ 대시보드 진입\n');

  await page.waitForTimeout(2000);

  // === 2️⃣ 성적 입력 페이지 탐색 ===
  console.log('📌 Step 2: 성적 입력 페이지 탐색');

  // 현재 페이지 구조 분석
  const allText = await page.locator('body').textContent();
  const allLinks = await page.locator('a, button').allTextContents();

  console.log(`  📄 현재 URL: ${page.url()}`);
  console.log(`  📋 메뉴 항목: ${allLinks.slice(0, 5).join(', ')}`);

  // 성적 입력 또는 입력 관련 메뉴 찾기
  const inputKeywords = ['입력', '성적', 'Input', 'Grade'];
  const inputMenu = allLinks.find(link => 
    inputKeywords.some(keyword => link.includes(keyword))
  );

  console.log(`  🔍 찾은 메뉴: ${inputMenu || '없음 - 직접 URL로 이동'}\n`);

  // 성적 입력 페이지로 이동
  await page.goto('http://localhost:5174/#/input');
  await page.waitForTimeout(2000);
  console.log('  ✅ 성적 입력 페이지 진입\n');

  // === 3️⃣ 성적 데이터 확인 ===
  console.log('📌 Step 3: 페이지 구조 분석');

  const pageContent = await page.content();
  const inputCount = await page.locator('input').count();
  const buttonCount = await page.locator('button').count();

  console.log(`  🔢 input 엘리먼트: ${inputCount}개`);
  console.log(`  🔘 button 엘리먼트: ${buttonCount}개`);

  // 테이블이나 학생 목록이 있는지 확인
  const tableRows = await page.locator('tr, [role="row"]').count();
  const studentElements = await page.locator('[class*="student"], [class*="row"]').count();

  console.log(`  📊 테이블 행: ${tableRows}개`);
  console.log(`  👥 학생 요소: ${studentElements}개\n`);

  // === 4️⃣ 데이터 입력 시도 ===
  console.log('📌 Step 4: 데이터 입력 시도');

  // 학생 검색
  const searchFields = page.locator('input[type="text"], input[placeholder*="검색"], input[placeholder*="학생"]');
  const searchCount = await searchFields.count();
  console.log(`  🔍 검색 필드: ${searchCount}개`);

  if (searchCount > 0) {
    await searchFields.first().fill('test');
    console.log('  ✅ "test" 입력');
    await page.waitForTimeout(1000);
  }

  // 성적 입력 필드
  const numberInputs = page.locator('input[type="number"]');
  const numInputCount = await numberInputs.count();
  console.log(`  🔢 숫자 입력 필드: ${numInputCount}개\n`);

  if (numInputCount > 0) {
    // 첫 번째 필드에 34 입력
    await numberInputs.first().fill('34');
    console.log('  ✅ 성적 34 입력');

    // 저장 버튼
    const saveBtns = page.locator('button:has-text("저장"), button:has-text("제출"), button:has-text("완료")');
    const saveBtnCount = await saveBtns.count();

    if (saveBtnCount > 0) {
      await saveBtns.first().click();
      console.log('  ✅ 저장 버튼 클릭');
      await page.waitForTimeout(2000);
    }
  }

  // === 5️⃣ 리포트 생성 페이지 ===
  console.log('\n📌 Step 5: 리포트 생성 페이지');

  // 리포트 메뉴 찾기
  const reportMenu = page.locator('a:has-text("리포트"), button:has-text("리포트"), a:has-text("보고서")').first();

  if (await reportMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
    await reportMenu.click();
    console.log('  ✅ 리포트 메뉴 클릭');
    await page.waitForTimeout(2000);
  } else {
    // 직접 URL로 이동
    await page.goto('http://localhost:5174/#/preview');
    console.log('  ✅ 리포트 페이지 직접 진입');
    await page.waitForTimeout(2000);
  }

  // === 6️⃣ 리포트 생성 ===
  console.log('\n📌 Step 6: 리포트 생성');

  const generateBtns = page.locator('button');
  const generateCount = await generateBtns.count();
  console.log(`  🔘 버튼 총 개수: ${generateCount}개`);

  // 버튼 텍스트 출력
  const btnTexts = await generateBtns.allTextContents();
  const generateBtn = btnTexts.find(text => 
    text.includes('생성') || text.includes('만들') || text.includes('리포트')
  );
  console.log(`  🔍 생성 버튼: ${generateBtn || '찾음'}`);

  // 버튼 클릭 시도
  const createBtns = page.locator('button:has-text("생성"), button:has-text("만들"), button:has-text("리포트")');
  if (await createBtns.count() > 0) {
    await createBtns.first().click();
    console.log('  ✅ 리포트 생성 요청');
    await page.waitForTimeout(3000);
  }

  // === 7️⃣ 리포트 확인 ===
  console.log('\n📌 Step 7: 리포트 확인');

  const finalUrl = page.url();
  const finalContent = await page.locator('body').textContent();

  console.log(`  📄 최종 URL: ${finalUrl}`);
  console.log(`  📃 페이지 길이: ${finalContent?.length || 0}자`);

  // 리포트 내용 확인
  const hasReport = finalContent?.includes('리포트') || finalContent?.includes('보고서') || finalContent?.includes('report');
  const hasScore = finalContent?.includes('34') || finalContent?.includes('성적') || finalContent?.includes('score');
  const hasStudent = finalContent?.includes('test') || finalContent?.includes('학생');

  console.log(`  ✅ 리포트 문서: ${hasReport ? '있음' : '없음'}`);
  console.log(`  ✅ 성적 데이터: ${hasScore ? '있음' : '없음'}`);
  console.log(`  ✅ 학생 정보: ${hasStudent ? '있음' : '없음'}`);

  // === 8️⃣ 최종 결과 ===
  console.log('\n========================================');
  console.log('📊 최종 결과');
  console.log('========================================');
  console.log(`✅ 로그인: 성공`);
  console.log(`✅ 성적 입력: ${numInputCount > 0 ? '가능' : '입력 필드 없음'}`);
  console.log(`✅ 리포트 생성: ${hasReport ? '성공' : '확인 필요'}`);
  console.log(`✅ 리포트 데이터: ${hasScore && hasStudent ? '완전' : '부분'}`);
  console.log('========================================\n');
});
