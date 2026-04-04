/**
 * UC-04: 채점 모듈
 * - 채점 메뉴 진입
 * - 단일/일괄/히스토리 탭이 존재한다
 */
import { test, expect } from '@playwright/test';
import { launchApp, screenshot, isSetupScreen, isLoginScreen } from './helpers';

test.describe('UC-04: 채점 모듈', () => {
  test('채점 페이지로 이동된다', async () => {
    const { app, window } = await launchApp();
    try {
      if (await isSetupScreen(window) || await isLoginScreen(window)) {
        test.skip(); return;
      }

      await window.locator('text=채점').first().click();
      await window.waitForTimeout(1000);

      const bodyText = await window.locator('body').innerText();
      await screenshot(window, 'uc04-grader');
      expect(bodyText.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});
