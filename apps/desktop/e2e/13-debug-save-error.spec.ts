/**
 * UC-13: saveScore 함수 에러 디버깅
 * React onChange 이벤트 제대로 trigger하기
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfigAndLogin, screenshot } from './helpers';

test.describe('UC-13: saveScore 에러 디버깅', () => {

  test('TC-01: 서재용으로 로그인 후 수학 점수 저장 - onChange 제대로 trigger', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      const consoleLogs: string[] = [];
      window.on('console', (msg) => {
        const text = msg.text();
        consoleLogs.push(`[${msg.type()}] ${text}`);
        if (text.includes('saveScore') || text.includes('❌') || text.includes('✅')) {
          console.log(`[${msg.type().toUpperCase()}] ${text}`);
        }
      });

      // 월말평가 > 성적 입력
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);

      // test 학생 선택
      const testRow = window.locator('div').filter({ hasText: /^test$|^test\s/ }).first();
      await testRow.click();
      await window.waitForTimeout(2000);

      // 수학 점수 입력 (첫 번째 input)
      const scoreInputs = window.locator('input[type="number"]');
      const firstInput = scoreInputs.first();

      console.log('\n========== 점수 입력 ==========');
      
      // fill() 후 change 이벤트 trigger
      await firstInput.fill('77');
      await firstInput.evaluate((el: HTMLInputElement) => {
        // React의 onChange를 trigger하기 위해 input event dispatch
        const event = new Event('input', { bubbles: true });
        el.dispatchEvent(event);
      });
      
      await window.waitForTimeout(300);

      const currentValue = await firstInput.inputValue();
      console.log(`입력된 값: ${currentValue}`);

      // 저장 버튼 클릭
      const saveBtn = window.locator('button').filter({ hasText: '저장' }).first();
      
      console.log('\n========== 저장 버튼 클릭 ==========');
      await saveBtn.click();
      await window.waitForTimeout(5000);
      console.log('========== 저장 완료 ==========\n');

      // 스크린샷 (저장 직후)
      await screenshot(window, 'uc13-tc01-after-save');

      // 콘솔에서 saveScore 관련 로그 필터링
      const saveScoreLogs = consoleLogs.filter(l => 
        l.includes('saveScore') || l.includes('❌') || l.includes('✅')
      );

      console.log('\n=== saveScore 로그 ===');
      saveScoreLogs.forEach(log => console.log(log));

      expect(currentValue).toBe('77');
    } finally {
      await app.close();
    }
  });

});
