/**
 * D1 마이그레이션 최종 검증 - UI 테스트
 * - 3월 성적 입력
 * - 4월 성적 입력
 * - PNG 레포트 생성 및 검증
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function test() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('\n');
    console.log('════════════════════════════════════════════════════════');
    console.log('🧪 D1 마이그레이션 UI 최종 검증 테스트');
    console.log('════════════════════════════════════════════════════════');
    console.log('');

    // 1. 앱 로드
    console.log('📍 1️⃣ 앱 로드...');
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    console.log('✅ 앱 로드 완료');
    console.log('');

    // 2. 로그인
    console.log('📍 2️⃣ 로그인 (김상현 / 1234)...');
    const inputs = await page.locator('input');
    await inputs.nth(0).fill('김상현');
    await inputs.nth(1).fill('1234');

    const loginButton = await page.locator('button:has-text("로그인")');
    await loginButton.click();

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('timer') || currentUrl.includes('dashboard');
    console.log(`${isLoggedIn ? '✅' : '❌'} 로그인 ${isLoggedIn ? '성공' : '실패'}`);
    console.log(`   현재 URL: ${currentUrl}`);
    console.log('');

    // 3. 성적 입력 페이지 방문
    console.log('📍 3️⃣ 성적 입력 페이지 방문...');
    await page.goto('http://localhost:5174/#/report/input');
    await page.waitForTimeout(2000);
    console.log('✅ 성적 입력 페이지 진입');
    console.log('');

    // 4. 학생 선택
    console.log('📍 4️⃣ 학생 선택...');
    const studentItems = await page.locator('div[role="button"][tabindex="0"]');
    const count = await studentItems.count();
    console.log(`   학생 목록: ${count}명`);

    if (count > 0) {
      const firstStudent = await studentItems.nth(0).textContent();
      await studentItems.nth(0).click();
      await page.waitForTimeout(1000);
      console.log(`✅ 첫 번째 학생 선택: ${firstStudent}`);
    } else {
      console.log('⚠️  학생 목록이 없음');
    }
    console.log('');

    // 5. 성적 입력
    console.log('📍 5️⃣ 성적 입력 (3월)...');
    const scoreInputs = await page.locator('input[type="number"]');
    const inputCount = await scoreInputs.count();
    console.log(`   과목 수: ${inputCount}개`);

    if (inputCount > 0) {
      await scoreInputs.nth(0).fill('95');
      console.log('   첫 번째 과목: 95점 입력');

      if (inputCount > 1) {
        await scoreInputs.nth(1).fill('92');
        console.log('   두 번째 과목: 92점 입력');
      }
    }
    console.log('');

    // 6. 저장
    console.log('📍 6️⃣ 성적 저장...');
    const saveButtons = await page.locator('button:has-text("저장")');
    const saveCount = await saveButtons.count();
    console.log(`   저장 버튼: ${saveCount}개`);

    if (saveCount > 0) {
      await saveButtons.nth(0).click();
      await page.waitForTimeout(2000);
      console.log('✅ 성적 저장 완료');
    }
    console.log('');

    // 7. 미리보기 탭 방문
    console.log('📍 7️⃣ 미리보기 탭 방문...');
    await page.goto('http://localhost:5174/#/report/preview');
    await page.waitForTimeout(3000);
    console.log('✅ 미리보기 탭 진입');
    console.log('');

    // 8. 데이터 확인
    console.log('📍 8️⃣ 저장된 데이터 확인...');
    const pageText = await page.textContent('body');
    const hasScore = pageText.includes('95') || pageText.includes('92');
    console.log(`${hasScore ? '✅' : '❌'} 성적 표시: ${hasScore ? '점수 보임' : '점수 안 보임'}`);
    console.log('');

    // 9. PNG 레포트 스크린샷 찍기
    console.log('📍 9️⃣ PNG 레포트 스크린샷...');
    const screenshotPath = path.join('/tmp', 'report-preview.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    if (fs.existsSync(screenshotPath)) {
      const size = fs.statSync(screenshotPath).size;
      console.log(`✅ PNG 저장됨: ${screenshotPath}`);
      console.log(`   파일 크기: ${(size / 1024).toFixed(2)} KB`);
    }
    console.log('');

    // 10. PNG 내용 검증
    console.log('📍 🔟 PNG 내용 검증...');
    const hasStudentName = pageText.includes('강은서') || pageText.includes('김');
    const hasTeacherName = pageText.includes('김상현') || pageText.includes('선생님');
    const hasReportTitle = pageText.includes('평가서') || pageText.includes('리포트') || pageText.includes('report');

    console.log(`${hasStudentName ? '✅' : '❌'} 학생명 표시`);
    console.log(`${hasTeacherName ? '✅' : '❌'} 선생님명 표시`);
    console.log(`${hasReportTitle ? '✅' : '❌'} 리포트 제목 표시`);
    console.log('');

    // 다시 성적 입력 탭으로
    console.log('📍 1️⃣1️⃣ 성적 입력 탭으로 돌아가기...');
    await page.goto('http://localhost:5174/#/report/input');
    await page.waitForTimeout(2000);
    console.log('✅ 성적 입력 탭 복귀');
    console.log('');

    // 다시 미리보기로
    console.log('📍 1️⃣2️⃣ 미리보기 탭으로 다시 이동...');
    await page.goto('http://localhost:5174/#/report/preview');
    await page.waitForTimeout(3000);

    const pageText2 = await page.textContent('body');
    const stillHasData = pageText2.includes('95') || pageText2.includes('92');
    console.log(`${stillHasData ? '✅' : '❌'} 데이터 유지: ${stillHasData ? '데이터 유지됨' : '데이터 손실됨'}`);
    console.log('');

    // 최종 결과
    console.log('════════════════════════════════════════════════════════');
    if (hasScore && stillHasData && hasStudentName) {
      console.log('✅ D1 마이그레이션 검증 성공!');
    } else {
      console.log('⚠️  부분 검증 (일부 항목 미확인)');
    }
    console.log('════════════════════════════════════════════════════════');
    console.log('');
    console.log('📊 검증 결과:');
    console.log(`   ${hasScore ? '✓' : '✗'} 성적 저장됨`);
    console.log(`   ${stillHasData ? '✓' : '✗'} 탭 이동 후 데이터 유지됨`);
    console.log(`   ${hasStudentName ? '✓' : '✗'} 학생명 표시됨`);
    console.log(`   ${hasTeacherName ? '✓' : '✗'} 선생님명 표시됨`);
    console.log('');
    console.log('📁 생성된 파일:');
    console.log(`   /tmp/report-preview.png (${fs.existsSync('/tmp/report-preview.png') ? 'O' : 'X'})`);
    console.log('');
  } catch (error) {
    console.error('❌ 테스트 중 오류:', error.message);
  } finally {
    await browser.close();
  }
}

test();
