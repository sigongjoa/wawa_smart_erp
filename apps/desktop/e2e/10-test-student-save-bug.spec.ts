/**
 * UC-10: test 학생 vs 다른 학생 비교 테스트
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfigAndLogin, screenshot } from './helpers';

test.describe('UC-10: 학생 선택 및 저장 버그 비교', () => {

  test('TC-01: 다른 학생(강은서) 선택 테스트', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // 월말평가 > 성적 입력
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);

      // 강은서 선택
      const gangRow = window.locator('div').filter({ hasText: '강은서' }).first();
      const exists = await gangRow.isVisible().catch(() => false);
      console.log(`강은서 행 찾음: ${exists}`);

      if (exists) {
        await gangRow.click();
        await window.waitForTimeout(2000);

        // 입력 필드 확인
        const inputs = window.locator('input[type="number"]');
        const inputCount = await inputs.count();
        console.log(`강은서 선택 후 입력 필드 개수: ${inputCount}`);

        if (inputCount > 0) {
          await inputs.first().fill('99');
          const value = await inputs.first().inputValue();
          console.log(`입력된 값: ${value}`);

          // 저장 버튼 클릭
          const saveBtn = window.locator('button').filter({ hasText: '저장' }).first();
          if (await saveBtn.isVisible().catch(() => false)) {
            console.log('강은서 저장 버튼 클릭');
            await saveBtn.click();
            await window.waitForTimeout(3000);
            console.log('✅ 강은서 저장 완료');
          }
        }
      }

      await screenshot(window, 'uc10-tc01-gangeunseo');
      expect(inputCount).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  test('TC-02: test 학생 선택 테스트', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // 월말평가 > 성적 입력
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);

      // test 학생 선택
      const testRow = window.locator('div').filter({ hasText: /^test$|^test\s/ }).first();
      const exists = await testRow.isVisible().catch(() => false);
      console.log(`test 행 찾음: ${exists}`);

      if (exists) {
        const testText = await testRow.innerText();
        console.log(`test 행 텍스트: ${testText.substring(0, 50)}`);
        
        await testRow.click();
        await window.waitForTimeout(2000);

        // 입력 필드 확인
        const inputs = window.locator('input[type="number"]');
        const inputCount = await inputs.count();
        console.log(`test 선택 후 입력 필드 개수: ${inputCount}`);

        const bodyText = await window.locator('body').innerText();
        console.log(`'학생을 선택해주세요' 포함: ${bodyText.includes('학생을 선택해주세요')}`);

        if (inputCount > 0) {
          await inputs.first().fill('34');
          const value = await inputs.first().inputValue();
          console.log(`입력된 값: ${value}`);

          // 저장 버튼 클릭
          const saveBtn = window.locator('button').filter({ hasText: '저장' }).first();
          if (await saveBtn.isVisible().catch(() => false)) {
            console.log('test 저장 버튼 클릭');
            await saveBtn.click();
            await window.waitForTimeout(3000);
            console.log('✅ test 저장 완료');
          }
        } else {
          console.log('❌ test 학생은 선택되지 않음!');
        }
      }

      await screenshot(window, 'uc10-tc02-test-student');
    } finally {
      await app.close();
    }
  });

});
