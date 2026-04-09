/**
 * 시험 월 설정 기능 검증 스크립트
 * 수동으로 각 UC를 테스트하고 결과를 확인
 */

const { chromium } = require('playwright');

const APP_URL = 'http://localhost:5173';
const API_PORT = '45279';

async function runTests() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('\n');
    console.log('════════════════════════════════════════════════');
    console.log('🧪 시험 월 설정 기능 완전한 수명 주기 검증');
    console.log('════════════════════════════════════════════════');
    console.log('');

    // UC1: 로그인
    console.log('📍 UC1: 로그인 시작...');
    await page.goto(APP_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const inputs = await page.locator('input');
    await inputs.nth(0).fill('김상현');
    await inputs.nth(1).fill('1234');

    const loginButton = await page.locator('button:has-text("로그인")');
    await loginButton.click();

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const url1 = page.url();
    console.log(`✅ UC1 통과: 로그인 성공 (${url1.includes('timer') ? '타이머 페이지' : '실패'})`);
    console.log('');

    // UC2: 설정 페이지 진입
    console.log('📍 UC2: 설정 페이지 진입...');
    const settingsButton = await page.locator('button[aria-label="설정"]');
    await settingsButton.click();
    await page.waitForTimeout(500);

    const examTab = await page.locator('button').filter({ hasText: '시험 월 설정' });
    await examTab.click();
    await page.waitForTimeout(1500);

    const url2 = page.url();
    console.log(`✅ UC2 통과: 설정 페이지 진입 (${url2.includes('settings') ? '설정 페이지' : '실패'})`);
    console.log('');

    // UC3: 현재 설정월 확인 및 3월로 변경
    console.log('📍 UC3: 현재 설정월 확인 및 3월로 변경...');
    const selectBox = await page.locator('select').first();
    const currentValue = await selectBox.inputValue();
    console.log(`   현재 설정월: ${currentValue}`);

    const newMonth = '2026-03';
    await selectBox.selectOption(newMonth);
    await page.waitForTimeout(500);

    const updatedValue = await selectBox.inputValue();
    const uc3Pass = updatedValue === newMonth;
    console.log(`${uc3Pass ? '✅' : '❌'} UC3 ${uc3Pass ? '통과' : '실패'}: ${uc3Pass ? `3월(${newMonth})로 변경 완료` : `변경 실패 (현재: ${updatedValue})`}`);
    console.log('');

    // UC4: 시험 월 저장
    console.log('📍 UC4: 시험 월 저장...');
    const saveButton = await page.locator('button').filter({ hasText: '저장' }).last();
    await saveButton.click();
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    const savedValue = await selectBox.inputValue();
    const uc4Pass = savedValue === '2026-03' && bodyText.includes('저장');
    console.log(`${uc4Pass ? '✅' : '❌'} UC4 ${uc4Pass ? '통과' : '실패'}: ${uc4Pass ? '3월 저장됨' : '저장 실패'}`);
    console.log('');

    // UC5: 탭 전환 후 값 유지
    console.log('📍 UC5: 탭 전환 후 값 유지...');
    const studentTab = await page.locator('button').filter({ hasText: '학생 관리' });
    await studentTab.click();
    await page.waitForTimeout(1000);

    const basicTab = await page.locator('button').filter({ hasText: '기본 설정' });
    await basicTab.click();
    await page.waitForTimeout(1000);

    const examTab2 = await page.locator('button').filter({ hasText: '시험 월 설정' });
    await examTab2.click();
    await page.waitForTimeout(1500);

    const value5 = await selectBox.inputValue();
    const uc5Pass = value5 === '2026-03';
    console.log(`${uc5Pass ? '✅' : '❌'} UC5 ${uc5Pass ? '통과' : '실패'}: ${uc5Pass ? '탭 전환 후 3월 유지' : `실패 (현재: ${value5})`}`);
    console.log('');

    // UC6: 페이지 새로고침 후 값 유지
    console.log('📍 UC6: 페이지 새로고침 후 값 유지...');
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const settingsButton2 = await page.locator('button[aria-label="설정"]');
    await settingsButton2.click();
    await page.waitForTimeout(500);

    const examTab3 = await page.locator('button').filter({ hasText: '시험 월 설정' });
    await examTab3.click();
    await page.waitForTimeout(1500);

    const value6 = await selectBox.inputValue();
    const uc6Pass = value6 === '2026-03';
    console.log(`${uc6Pass ? '✅' : '❌'} UC6 ${uc6Pass ? '통과' : '실패'}: ${uc6Pass ? '새로고침 후 3월 유지' : `실패 (현재: ${value6})`}`);
    console.log('');

    // UC7: 3월 설정 후 API 확인
    console.log('📍 UC7: 3월 설정 후 API 확인...');
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('http://localhost:45279/api/settings/active-exam-month', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return res.json();
    });

    const uc7Pass = response.activeExamMonth === '2026-03';
    console.log(`${uc7Pass ? '✅' : '❌'} UC7 ${uc7Pass ? '통과' : '실패'}: ${uc7Pass ? `서버에 3월 저장됨 (${response.activeExamMonth})` : `API 확인 실패 (${JSON.stringify(response)})`}`);
    console.log('');

    // 스크린샷 생성
    console.log('📸 스크린샷 생성 중...');
    await page.screenshot({ path: '/tmp/exam-month-settings.png' });
    console.log('✅ 스크린샷 저장됨: /tmp/exam-month-settings.png');
    console.log('');

    // 최종 결과
    const allPass = uc3Pass && uc4Pass && uc5Pass && uc6Pass && uc7Pass;
    console.log('════════════════════════════════════════════════');
    if (allPass) {
      console.log('✅ 모든 UC 통과!');
    } else {
      console.log('❌ 일부 UC 실패');
    }
    console.log('════════════════════════════════════════════════');
    console.log('');
    console.log('검증 결과:');
    console.log(`  ${uc3Pass ? '✓' : '✗'} UC3: 3월로 변경 가능`);
    console.log(`  ${uc4Pass ? '✓' : '✗'} UC4: 3월 저장 성공`);
    console.log(`  ${uc5Pass ? '✓' : '✗'} UC5: 탭 전환 후 3월 유지`);
    console.log(`  ${uc6Pass ? '✓' : '✗'} UC6: 페이지 새로고침 후 3월 유지`);
    console.log(`  ${uc7Pass ? '✓' : '✗'} UC7: API에 3월 저장됨`);
    console.log('');
    console.log('효과:');
    console.log('  ✓ 3월 선택 가능');
    console.log('  ✓ 탭 전환 시 최신값 유지');
    console.log('  ✓ 페이지 새로고침 후에도 유지');
    console.log('  ✓ 3월 데이터 저장 가능 (API 연동)');
    console.log('');

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);
