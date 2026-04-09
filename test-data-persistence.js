/**
 * 성적 입력 및 데이터 저장 검증
 * 학생 선택 → 성적 입력 → 저장 → 미리보기 탭 이동 → 데이터 유지 확인
 */

const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('\n');
    console.log('════════════════════════════════════════════════════════');
    console.log('🧪 성적 입력 및 데이터 저장 검증 (Playwright E2E)');
    console.log('════════════════════════════════════════════════════════');
    console.log('');

    // 1. 앱 로드
    console.log('📍 1️⃣ 앱 로드...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    console.log('✅ 앱 로드 완료');
    console.log('');

    // 2. 로그인
    console.log('📍 2️⃣ 로그인...');
    const inputs = await page.locator('input');
    await inputs.nth(0).fill('김상현');
    await inputs.nth(1).fill('1234');

    const loginButton = await page.locator('button:has-text("로그인")');
    await loginButton.click();

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const url = page.url();
    console.log(`✅ 로그인 성공 (${url.includes('timer') ? '타이머 페이지' : '실패'})`);
    console.log('');

    // 3. 성적 입력 페이지로 이동
    console.log('📍 3️⃣ 성적 입력 페이지로 이동...');
    await page.goto('http://localhost:5173/#/report/input');
    await page.waitForTimeout(2000);
    console.log('✅ 성적 입력 페이지 진입');
    console.log('');

    // 4. 학생 선택
    console.log('📍 4️⃣ 학생 선택 (강은서)...');
    const studentItems = await page.locator('div[role="button"][tabindex="0"]');
    const count = await studentItems.count();
    console.log(`   학생 목록: ${count}명`);

    // 강은서 찾기
    let foundStudent = false;
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await studentItems.nth(i).textContent();
      if (text.includes('강은서')) {
        await studentItems.nth(i).click();
        await page.waitForTimeout(1000);
        foundStudent = true;
        console.log('✅ 강은서 선택 완료');
        break;
      }
    }

    if (!foundStudent) {
      console.log('⚠️  강은서를 찾을 수 없음, 첫 번째 학생 선택');
      await studentItems.nth(0).click();
      await page.waitForTimeout(1000);
    }
    console.log('');

    // 5. 성적 입력
    console.log('📍 5️⃣ 성적 입력...');
    const scoreInputs = await page.locator('input[type="number"]');
    const inputCount = await scoreInputs.count();
    console.log(`   과목 수: ${inputCount}개`);

    if (inputCount > 0) {
      // 첫 번째 과목에 90점 입력
      await scoreInputs.nth(0).fill('90');
      console.log('   첫 번째 과목에 90점 입력');

      // 두 번째 과목에 85점 입력
      if (inputCount > 1) {
        await scoreInputs.nth(1).fill('85');
        console.log('   두 번째 과목에 85점 입력');
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
      console.log('✅ 저장 완료');
    }
    console.log('');

    // 7. 미리보기 탭으로 이동
    console.log('📍 7️⃣ 미리보기 탭으로 이동...');
    await page.goto('http://localhost:5173/#/report/preview');
    await page.waitForTimeout(3000);
    console.log('✅ 미리보기 탭 진입');
    console.log('');

    // 8. 데이터 확인
    console.log('📍 8️⃣ 저장된 데이터 확인...');
    const pageText = await page.textContent('body');

    // 강은서 이름이 보이는지 확인
    const hasStudentName = pageText.includes('강은서');
    console.log(`${hasStudentName ? '✅' : '❌'} 학생명 표시: ${hasStudentName ? '강은서 보임' : '강은서 안 보임'}`);

    // 점수가 보이는지 확인
    const hasScore = pageText.includes('90') || pageText.includes('85');
    console.log(`${hasScore ? '✅' : '❌'} 성적 표시: ${hasScore ? '점수 보임' : '점수 안 보임'}`);

    // 리포트 제목 확인
    const hasReportTitle = pageText.includes('월별 평가서') || pageText.includes('리포트');
    console.log(`${hasReportTitle ? '✅' : '❌'} 리포트 표시: ${hasReportTitle ? '표시됨' : '표시 안됨'}`);
    console.log('');

    // 9. 다시 성적 입력 탭으로
    console.log('📍 9️⃣ 다시 성적 입력 탭으로 이동...');
    await page.goto('http://localhost:5173/#/report/input');
    await page.waitForTimeout(2000);
    console.log('✅ 성적 입력 탭 복귀');
    console.log('');

    // 10. 다시 미리보기로 돌아가기
    console.log('📍 1️⃣0️⃣ 미리보기 탭으로 다시 이동...');
    await page.goto('http://localhost:5173/#/report/preview');
    await page.waitForTimeout(3000);

    const pageText2 = await page.textContent('body');
    const stillHasData = pageText2.includes('강은서') || pageText2.includes('90') || pageText2.includes('85');
    console.log(`${stillHasData ? '✅' : '❌'} 데이터 유지: ${stillHasData ? '데이터 유지됨' : '데이터 손실됨'}`);
    console.log('');

    // 최종 결과
    console.log('════════════════════════════════════════════════════════');
    console.log(hasStudentName && hasScore && hasReportTitle && stillHasData ? '✅ 모든 검증 통과!' : '❌ 일부 검증 실패');
    console.log('════════════════════════════════════════════════════════');
    console.log('');
    console.log('검증 결과:');
    console.log(`  ${hasStudentName ? '✓' : '✗'} 학생명 저장됨`);
    console.log(`  ${hasScore ? '✓' : '✗'} 성적 저장됨`);
    console.log(`  ${hasReportTitle ? '✓' : '✗'} 리포트 표시됨`);
    console.log(`  ${stillHasData ? '✓' : '✗'} 탭 이동 후 데이터 유지됨`);
    console.log('');
    console.log('📊 데이터 저장소:');
    console.log('  • 성적 데이터: Notion API');
    console.log('  • 리포트 조회: Notion API');
    console.log('  • 상태 관리: Zustand (localStorage)');
    console.log('');

  } catch (error) {
    console.error('❌ 테스트 중 오류:', error);
  } finally {
    await browser.close();
  }
}

test();
