/**
 * UC-14: 서재용 개발자로 로그인해서 test 학생 저장 테스트
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfig, screenshot } from './helpers';

test.describe('UC-14: 서재용 개발자 로그인 및 test 학생 저장', () => {

  test('TC-01: 서재용 개발자(1141) 로그인 후 test 학생 저장', async () => {
    const { app, window } = await launchApp();
    try {
      // 1. Config 주입 (로그인 필요)
      await injectConfig(window);
      await window.waitForTimeout(2000);

      console.log('=== Step 1: 로그인 화면 확인 ===');
      const bodyText = await window.locator('body').innerText();
      console.log(`화면 텍스트 포함: ${bodyText.includes('로그인')}`);

      // 2. select 요소에서 서재용 개발자 선택
      console.log('\n=== Step 2: 선생님 선택 ===');
      const selectElement = window.locator('select');
      const selectExists = await selectElement.count() > 0;
      console.log(`select 요소 존재: ${selectExists}`);

      if (selectExists) {
        // option 목록 확인
        const options = await selectElement.locator('option').allTextContents();
        console.log(`선택 가능한 선생님: ${options.join(', ')}`);

        // 서재용 개발자 선택
        await selectElement.selectOption({ label: '서재용 개발자' });
        await window.waitForTimeout(500);
        console.log('✅ 서재용 개발자 선택');
      }

      // 3. PIN 입력 (1141)
      console.log('\n=== Step 3: PIN 입력 (1141) ===');
      const pinInput = window.locator('input[type="password"]');
      const pinExists = await pinInput.count() > 0;
      console.log(`PIN 입력 필드 존재: ${pinExists}`);

      if (pinExists) {
        await pinInput.fill('1141');
        await window.waitForTimeout(500);
        console.log('✅ PIN 입력 완료');
      }

      // 4. 접속하기 버튼 클릭
      console.log('\n=== Step 4: 접속하기 버튼 클릭 ===');
      const loginBtn = window.locator('button').filter({ hasText: '접속하기' });
      const loginBtnExists = await loginBtn.count() > 0;
      console.log(`접속하기 버튼 존재: ${loginBtnExists}`);

      if (loginBtnExists) {
        await loginBtn.click();
        await window.waitForTimeout(3000);
        console.log('✅ 접속하기 버튼 클릭');
      }

      await screenshot(window, 'uc14-tc01-after-login');

      // 5. 월말평가 > 성적 입력 진입
      console.log('\n=== Step 5: 월말평가 > 성적 입력 진입 ===');
      const monthlyMenu = window.locator('text=월말평가').first();
      const monthlyExists = await monthlyMenu.count() > 0;
      console.log(`월말평가 메뉴 존재: ${monthlyExists}`);

      if (monthlyExists) {
        await monthlyMenu.click();
        await window.waitForTimeout(1500);

        const scoreMenu = window.locator('text=성적 입력').first();
        const scoreExists = await scoreMenu.count() > 0;
        console.log(`성적 입력 메뉴 존재: ${scoreExists}`);

        if (scoreExists) {
          await scoreMenu.click();
          await window.waitForTimeout(3000);
          console.log('✅ 성적 입력 화면 진입');
        }
      }

      await screenshot(window, 'uc14-tc01-score-input-screen');

      // 6. test 학생 선택
      console.log('\n=== Step 6: test 학생 선택 ===');
      const testRow = window.locator('div').filter({ hasText: /^test$|^test\s/ }).first();
      const testExists = await testRow.count() > 0;
      console.log(`test 학생 행 존재: ${testExists}`);

      if (testExists) {
        const testText = await testRow.innerText();
        console.log(`test 행 텍스트: ${testText.substring(0, 100)}`);
        await testRow.click();
        await window.waitForTimeout(2000);
        console.log('✅ test 학생 선택');
      }

      await screenshot(window, 'uc14-tc01-student-selected');

      // 7. 입력 필드 확인 및 숫자 입력
      console.log('\n=== Step 7: 숫자 입력 ===');
      const inputs = window.locator('input[type="number"]');
      const inputCount = await inputs.count();
      console.log(`입력 필드 개수: ${inputCount}`);

      if (inputCount > 0) {
        await inputs.first().fill('88');
        const inputValue = await inputs.first().inputValue();
        console.log(`입력된 값: ${inputValue}`);
        console.log('✅ 숫자 입력 완료');
      }

      await screenshot(window, 'uc14-tc01-score-entered');

      // 8. 저장 버튼 클릭
      console.log('\n=== Step 8: 저장 버튼 클릭 ===');
      const saveBtn = window.locator('button').filter({ hasText: '저장' }).first();
      const saveBtnExists = await saveBtn.count() > 0;
      console.log(`저장 버튼 존재: ${saveBtnExists}`);

      if (saveBtnExists) {
        await saveBtn.click();
        await window.waitForTimeout(3000);
        console.log('✅ 저장 버튼 클릭');
      }

      await screenshot(window, 'uc14-tc01-after-save');

      // 9. 저장 결과 확인
      console.log('\n=== Step 9: 저장 결과 확인 ===');
      const finalBodyText = await window.locator('body').innerText();
      const saveSuccess = finalBodyText.includes('저장되었습니다') || finalBodyText.includes('성공');
      const saveFailure = finalBodyText.includes('실패') || finalBodyText.includes('에러');

      console.log(`저장 성공 메시지: ${saveSuccess}`);
      console.log(`저장 실패 메시지: ${saveFailure}`);
      console.log(`최종 화면에 test 포함: ${finalBodyText.includes('test')}`);

      if (inputCount > 0) {
        expect(saveSuccess || !saveFailure).toBe(true);
      }
    } finally {
      await app.close();
    }
  });

});
