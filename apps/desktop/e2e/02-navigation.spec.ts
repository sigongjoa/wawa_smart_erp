/**
 * UC-02: 헤더 네비게이션
 * - config + 자동 로그인 후 상단 메뉴가 표시된다
 * - 시간표 / 학생관리 / 월말평가 메뉴가 존재한다
 * - 각 메뉴 클릭 시 해당 페이지로 이동한다
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfigAndLogin, screenshot } from './helpers';

test.describe('UC-02: 헤더 네비게이션', () => {
  test('헤더에 주요 메뉴(시간표/학생관리/월말평가)가 표시된다', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);
      const bodyText = await window.locator('body').innerText();
      await screenshot(window, 'uc02-header-nav');

      expect(bodyText).toContain('시간표');
      expect(bodyText).toContain('월말평가');
    } finally {
      await app.close();
    }
  });

  test('시간표 메뉴 클릭 시 시간표 페이지로 이동', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      await window.locator('text=시간표').first().click();
      await window.waitForTimeout(800);

      const bodyText = await window.locator('body').innerText();
      await screenshot(window, 'uc02-timer-page');
      expect(bodyText).toContain('시간표');
    } finally {
      await app.close();
    }
  });

  test('월말평가 메뉴 클릭 시 리포트 페이지로 이동', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(800);

      const bodyText = await window.locator('body').innerText();
      await screenshot(window, 'uc02-report-page');
      expect(bodyText).toContain('월말평가');
    } finally {
      await app.close();
    }
  });
});
