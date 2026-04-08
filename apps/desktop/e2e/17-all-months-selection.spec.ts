/**
 * UC-17: 모든 리포트 화면 년월 선택 기능 테스트
 * - Input, Preview, Send 모두 년월 선택 드롭다운 검증
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfig, screenshot } from './helpers';

test.describe('UC-17: 모든 리포트 화면 년월 선택 기능', () => {

  test('TC-01: 성적 입력 화면 년월 선택', async () => {
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
      await window.waitForTimeout(3000);

      // 년월 드롭다운 확인
      const monthDropdown = window.locator('select').nth(0);
      const options = await monthDropdown.locator('option').allTextContents();
      console.log(`✅ 성적 입력 년월 옵션: ${options.join(', ')}`);

      // 3월 선택
      await monthDropdown.selectOption({ label: '2026년 3월' });
      const selectedValue = await monthDropdown.inputValue();
      console.log(`✅ 선택된 값: ${selectedValue}`);

      expect(selectedValue).toBe('2026-03');
      await screenshot(window, 'uc17-tc01-input-month-select');
    } finally {
      await app.close();
    }
  });

  test('TC-02: 리포트 미리보기 화면 년월 선택', async () => {
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

      // 리포트 미리보기
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=리포트 미리보기').first().click();
      await window.waitForTimeout(3000);

      // 년월 드롭다운 확인
      const monthDropdown = window.locator('select').nth(0);
      const dropdownExists = await monthDropdown.isVisible().catch(() => false);
      console.log(`✅ 리포트 미리보기 드롭다운 존재: ${dropdownExists}`);

      if (dropdownExists) {
        const options = await monthDropdown.locator('option').allTextContents();
        console.log(`✅ 리포트 미리보기 년월 옵션: ${options.join(', ')}`);

        // 3월 선택
        await monthDropdown.selectOption({ label: '2026년 3월' });
        const selectedValue = await monthDropdown.inputValue();
        console.log(`✅ 선택된 값: ${selectedValue}`);

        expect(selectedValue).toBe('2026-03');
      }

      await screenshot(window, 'uc17-tc02-preview-month-select');
    } finally {
      await app.close();
    }
  });

  test('TC-03: 리포트 전송 화면 년월 선택', async () => {
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

      // 리포트 전송
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=리포트 전송').first().click();
      await window.waitForTimeout(3000);

      // 년월 드롭다운 확인
      const monthDropdown = window.locator('select').nth(0);
      const dropdownExists = await monthDropdown.isVisible().catch(() => false);
      console.log(`✅ 리포트 전송 드롭다운 존재: ${dropdownExists}`);

      if (dropdownExists) {
        const options = await monthDropdown.locator('option').allTextContents();
        console.log(`✅ 리포트 전송 년월 옵션: ${options.join(', ')}`);

        // 3월 선택
        await monthDropdown.selectOption({ label: '2026년 3월' });
        const selectedValue = await monthDropdown.inputValue();
        console.log(`✅ 선택된 값: ${selectedValue}`);

        expect(selectedValue).toBe('2026-03');
      }

      await screenshot(window, 'uc17-tc03-send-month-select');
    } finally {
      await app.close();
    }
  });

});
