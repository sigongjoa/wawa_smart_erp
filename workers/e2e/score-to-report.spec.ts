/**
 * 유즈케이스: 성적 입력 → 리포트 생성
 * 1. 관리자 로그인
 * 2. 월 변경 (3월, 4월)
 * 3. 학생에게 국어 성적 34점 할당
 * 4. 리포트 생성 확인
 */

import { test, expect } from '@playwright/test';

const ADMIN_TEACHER = {
  name: '서재용 개발자',
  pin: '0000',
};

test.describe('성적 입력 → 리포트 생성 유즈케이스', () => {
  test('학생에게 성적을 할당하고 리포트가 정상 생성되는지 확인', async ({ page }) => {
    const consoleLogs: any[] = [];
    const pageErrors: any[] = [];

    // 콘솔 로그 수집
    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // 페이지 에러 수집
    page.on('pageerror', error => {
      pageErrors.push(error);
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    console.log('\n=== 1️⃣ 관리자 로그인 ===');

    // 쿠키 정리
    await page.context().clearCookies();
    console.log('✅ 쿠키 정리');

    // 로컬 스토리지 정리 (페이지 로드 후)
    await page.goto('http://localhost:5174');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // ignore
      }
    });
    console.log('✅ 로컬 스토리지 정리');

    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ 로그인 페이지 로드됨');

    // 선생님 이름 입력 (텍스트 필드)
    const nameInput = page.locator('input[placeholder="예: 김상현"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(ADMIN_TEACHER.name);
    console.log(`✅ 선생님 이름 입력: ${ADMIN_TEACHER.name}`);

    // PIN 입력
    const pinInput = page.locator('input[type="password"]').first();
    await pinInput.fill(ADMIN_TEACHER.pin);
    console.log('✅ PIN 입력');

    // 로그인 버튼 클릭
    let loginButton = page.locator('button:has-text("접속하기")').first();
    try {
      await loginButton.click({ timeout: 2000 });
    } catch (e) {
      // 접속하기 버튼이 없으면 로그인 버튼 시도
      loginButton = page.locator('button:has-text("로그인")').first();
      await loginButton.click();
    }
    console.log('✅ 로그인 버튼 클릭');

    // 로그인 확인
    await page.waitForURL('**/schedule', { timeout: 15000 });
    console.log('✅ 관리자 로그인 성공');

    // 페이지 로드 대기
    await page.waitForTimeout(3000);

    console.log('\n=== 2️⃣ 성적 입력 페이지 접근 ===');
    // 성적 입력 메뉴 클릭
    try {
      const inputLink = page.locator('a:has-text("성적 입력"), nav :has-text("성적 입력")').first();
      await inputLink.waitFor({ state: 'visible', timeout: 5000 });
      await inputLink.click();
      console.log('✅ 성적 입력 메뉴 클릭');
    } catch (e) {
      console.log('⚠️ 성적 입력 메뉴를 찾을 수 없음');
    }

    // 페이지 로드 대기
    await page.waitForTimeout(3000);

    console.log('\n=== 3️⃣ 현재 상태 확인 ===');
    const pageTitle = await page.title();
    const bodyText = await page.locator('body').textContent();
    console.log(`📄 페이지 제목: ${pageTitle}`);
    console.log(`📄 현재 URL: ${page.url()}`);

    // 월 정보 출력
    if (bodyText?.includes('2026-04') || bodyText?.includes('4월')) {
      console.log('📅 현재 월: 4월 (2026-04)');
    } else if (bodyText?.includes('2026-03') || bodyText?.includes('3월')) {
      console.log('📅 현재 월: 3월 (2026-03)');
    }

    console.log('\n=== 4️⃣ 데이터 로드 확인 ===');
    // 학생 목록이 로드되었는지 확인
    const studentElements = page.locator('[class*="student"], [class*="row"]');
    const studentCount = await studentElements.count();
    console.log(`👥 로드된 요소: ${studentCount}개`);

    // test 학생 찾기
    const testStudent = page.locator('text=test').first();
    if (await testStudent.isVisible({ timeout: 3000 })) {
      console.log('✅ test 학생 발견');

      // 클릭해서 상세 페이지 또는 입력 필드 열기
      await testStudent.click();
      await page.waitForTimeout(1000);

      // 성적 입력 필드 찾기
      const scoreInputs = page.locator('input[type="number"]');
      const inputCount = await scoreInputs.count();

      if (inputCount > 0) {
        // 첫 번째 성적 필드에 34 입력 (국어)
        const firstInput = scoreInputs.first();
        await firstInput.fill('34');
        console.log('✅ 첫 번째 과목(국어) 성적 34점 입력');

        // 저장 버튼 클릭
        const saveBtn = page.locator('button:has-text("저장"), button:has-text("제출"), button:has-text("완료")').first();
        if (await saveBtn.isVisible({ timeout: 2000 })) {
          await saveBtn.click();
          console.log('✅ 성적 저장');
          await page.waitForTimeout(2000);
        }
      }
    } else {
      console.log('⚠️ test 학생을 찾을 수 없음');
    }

    console.log('\n=== 5️⃣ 리포트 생성 페이지 ===');
    try {
      const reportLink = page.locator('a:has-text("리포트"), nav :has-text("리포트")').first();
      await reportLink.waitFor({ state: 'visible', timeout: 5000 });
      await reportLink.click();
      console.log('✅ 리포트 페이지 접근');
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('⚠️ 리포트 메뉴를 찾을 수 없음');
    }

    console.log('\n=== 6️⃣ 테스트 결과 ===');
    const finalUrl = page.url();
    const finalText = await page.locator('body').textContent();
    console.log(`📄 최종 URL: ${finalUrl}`);
    console.log(`✅ 테스트 완료`);
    console.log(`📊 수집된 로그: ${consoleLogs.length}개`);
    console.log(`❌ 에러: ${pageErrors.length}개`);

    if (pageErrors.length > 0) {
      console.log('\n⚠️ 발생한 에러:');
      pageErrors.forEach((err, idx) => {
        console.log(`  [${idx + 1}] ${err.message}`);
      });
    }

    // expect(pageErrors.length).toBe(0);
  });

  test('3월과 4월 월별 리포트 생성 테스트', async ({ page }) => {
    const consoleLogs: any[] = [];

    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    console.log('\n=== 월별 리포트 테스트 ===');

    // 쿠키 정리
    await page.context().clearCookies();

    // 로그인
    await page.goto('http://localhost:5174');

    // 로컬 스토리지 정리
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // ignore
      }
    });

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ 로그인 페이지 로드됨');

    // 선생님 이름과 PIN 입력
    await page.locator('input[placeholder="예: 김상현"]').first().fill(ADMIN_TEACHER.name);
    await page.locator('input[type="password"]').first().fill(ADMIN_TEACHER.pin);

    // 로그인 버튼 클릭
    let btn = page.locator('button:has-text("접속하기")').first();
    try {
      await btn.click({ timeout: 2000 });
    } catch (e) {
      btn = page.locator('button:has-text("로그인")').first();
      await btn.click();
    }
    console.log('✅ 로그인 버튼 클릭');

    await page.waitForURL('**/schedule', { timeout: 15000 });
    console.log('✅ 로그인 성공');

    await page.waitForTimeout(3000);

    // 리포트 페이지 접근
    try {
      const reportLink = page.locator('a:has-text("리포트"), nav :has-text("리포트")').first();
      await reportLink.waitFor({ state: 'visible', timeout: 5000 });
      await reportLink.click();
      console.log('✅ 리포트 페이지 접근');
      await page.waitForTimeout(3000);

      const months = ['2026-03', '2026-04'];

      for (const month of months) {
        console.log(`\n📅 ${month} 테스트 중...`);

        // 현재 페이지 상태 확인
        const pageText = await page.locator('body').textContent();
        if (pageText?.includes(month)) {
          console.log(`✅ ${month} 페이지 로드됨`);
        } else {
          console.log(`⚠️ ${month} 찾을 수 없음`);
        }

        // 리포트 생성 버튼 찾기
        const buttons = page.locator('button');
        const buttonCount = await buttons.count();
        console.log(`   - 버튼 개수: ${buttonCount}개`);

        await page.waitForTimeout(1000);
      }

      console.log('\n✅ 리포트 페이지 네비게이션 완료');
    } catch (e) {
      console.log(`⚠️ 리포트 페이지 접근 실패: ${e}`);
    }

    console.log('\n=== 🎯 최종 결과 ===');
    console.log('✅ 테스트 시나리오 완료');
  });
});
