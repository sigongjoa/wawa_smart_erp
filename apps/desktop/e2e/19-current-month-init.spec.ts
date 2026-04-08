/**
 * UC-19: 앱 시작 시 현재 월로 초기화 테스트
 * - 앱 시작 → 현재 월(4월)부터 최근 6개월 표시 검증
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfig, screenshot } from './helpers';

test.describe('UC-19: 앱 시작 시 현재 월 초기화', () => {

  test('TC-01: 성적 입력 화면 - 현재 월(4월) 드롭다운 확인', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfig(window);
      await window.waitForTimeout(2000);

      // 로그인
      const selectElement = window.locator('select').first();
      await selectElement.selectOption({ label: '서재용 개발자' });
      const pinInput = window.locator('input[type="password"]');
      await pinInput.fill('1141');
      const loginBtn = window.locator('button').filter({ hasText: '접속하기' });
      await loginBtn.click();
      await window.waitForTimeout(3000);

      // 성적 입력
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(2000);

      // 년월 드롭다운 확인
      const monthDropdown = window.locator('select').nth(0);
      const options = await monthDropdown.locator('option').allTextContents();
      console.log(`✅ 년월 옵션: ${options.join(', ')}`);

      // 첫 번째 옵션이 4월인지 확인 (현재 월)
      const firstOption = options[0];
      console.log(`✅ 첫 번째 옵션: ${firstOption}`);

      // 드롭다운 선택값 확인
      const selectedValue = await monthDropdown.inputValue();
      console.log(`✅ 선택된 값: ${selectedValue}`);
      
      // 2026-04가 선택되어 있어야 함
      expect(selectedValue).toBe('2026-04');
      
      // 첫 번째 옵션에 "4월"이 포함되어 있어야 함
      expect(firstOption).toContain('4월');

      await screenshot(window, 'uc19-tc01-current-month');
      console.log(`✅ 현재 월 초기화 확인 완료`);
    } finally {
      await app.close();
    }
  });

});
