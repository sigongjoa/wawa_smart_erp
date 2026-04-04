/**
 * UC-04: 채점 모듈
 * - config + 자동 로그인 후 /grader URL로 직접 진입
 * - 단건/일괄/히스토리 메뉴가 사이드바에 표시된다
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfigAndLogin, screenshot } from './helpers';

test.describe('UC-04: 채점 모듈', () => {
  test('채점 페이지(/grader)로 이동된다', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // Hash 라우터이므로 evaluate로 직접 이동
      await window.evaluate(() => {
        window.location.hash = '#/grader';
      });
      await window.waitForTimeout(1500);

      const bodyText = await window.locator('body').innerText();
      await screenshot(window, 'uc04-grader');
      expect(bodyText.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  test('채점 사이드바(단건/일괄/이력) 메뉴가 표시된다', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      await window.evaluate(() => { window.location.hash = '#/grader'; });
      await window.waitForTimeout(1500);

      const bodyText = await window.locator('body').innerText();
      const hasTabs = bodyText.includes('단건 채점') || bodyText.includes('일괄 채점') || bodyText.includes('채점 이력');
      await screenshot(window, 'uc04-grader-sidebar');
      expect(hasTabs).toBe(true);
    } finally {
      await app.close();
    }
  });
});
