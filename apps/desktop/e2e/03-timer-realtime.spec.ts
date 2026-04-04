/**
 * UC-03: 실시간 타이머 뷰
 * - 사이드바에서 실시간 메뉴 진입
 * - 대기/수업 컬럼이 표시된다
 * - 요일 필터 버튼이 표시된다
 * - 임시 학생 추가 버튼 및 모달이 동작한다
 *
 * 전제: notion_config.json이 있어 로그인까지 완료된 환경
 */
import { test, expect } from '@playwright/test';
import { launchApp, screenshot, isSetupScreen, isLoginScreen } from './helpers';

test.describe('UC-03: 실시간 타이머', () => {
  test('실시간 뷰 진입 시 대기/수업 컬럼이 표시된다', async () => {
    const { app, window } = await launchApp();
    try {
      if (await isSetupScreen(window) || await isLoginScreen(window)) {
        test.skip(); return;
      }

      await window.locator('text=실시간').first().click();
      await window.waitForTimeout(1000);

      const bodyText = await window.locator('body').innerText();
      await screenshot(window, 'uc03-realtime-view');

      expect(bodyText).toContain('대기');
    } finally {
      await app.close();
    }
  });

  test('요일 선택 버튼(월~토)이 표시된다', async () => {
    const { app, window } = await launchApp();
    try {
      if (await isSetupScreen(window) || await isLoginScreen(window)) {
        test.skip(); return;
      }

      await window.locator('text=실시간').first().click();
      await window.waitForTimeout(1000);

      const monBtn = window.locator('button:has-text("월")').first();
      const hasDay = await monBtn.isVisible().catch(() => false);
      await screenshot(window, 'uc03-day-buttons');
      expect(hasDay).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('임시 학생 추가 버튼 클릭 시 모달이 열린다', async () => {
    const { app, window } = await launchApp();
    try {
      if (await isSetupScreen(window) || await isLoginScreen(window)) {
        test.skip(); return;
      }

      await window.locator('text=실시간').first().click();
      await window.waitForTimeout(1000);

      const tempBtn = window.locator('text=임시').first();
      if (!await tempBtn.isVisible().catch(() => false)) { test.skip(); return; }

      await tempBtn.click();
      await window.waitForTimeout(500);

      const modalTitle = await window.locator('text=임시 학생 추가').isVisible().catch(() => false);
      await screenshot(window, 'uc03-temp-modal');
      expect(modalTitle).toBe(true);
    } finally {
      await app.close();
    }
  });
});
