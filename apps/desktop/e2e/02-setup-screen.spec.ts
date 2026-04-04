/**
 * UC-02: Setup 화면 (notion_config.json 미설정 상태)
 *
 * 유즈케이스:
 * - 설정 파일이 없으면 Setup 화면이 표시된다
 * - 파일 선택/드래그앤드롭 업로드 UI가 존재한다
 * - 다시 시도 버튼이 존재한다
 */
import { test, expect } from '@playwright/test';
import { launchApp, screenshot, isSetupScreen } from './helpers';

test.describe('UC-02: Setup 화면', () => {
  test('설정 미완료 시 초기 설정 화면이 표시된다', async () => {
    const { app, window } = await launchApp();
    try {
      const onSetup = await isSetupScreen(window);
      await screenshot(window, 'uc02-setup-screen');

      if (!onSetup) {
        // 이미 설정된 환경이면 이 테스트 스킵
        test.skip();
        return;
      }

      const bodyText = await window.locator('body').innerText();
      expect(bodyText).toContain('시스템 초기 설정');
    } finally {
      await app.close();
    }
  });

  test('파일 업로드 UI가 존재한다', async () => {
    const { app, window } = await launchApp();
    try {
      const onSetup = await isSetupScreen(window);
      if (!onSetup) { test.skip(); return; }

      const hasUpload = await window.locator('text=파일 선택').isVisible().catch(() => false)
        || await window.locator('text=드래그').isVisible().catch(() => false);

      await screenshot(window, 'uc02-upload-ui');
      expect(hasUpload).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('다시 시도 버튼이 존재한다', async () => {
    const { app, window } = await launchApp();
    try {
      const onSetup = await isSetupScreen(window);
      if (!onSetup) { test.skip(); return; }

      const retryBtn = window.locator('text=다시 시도');
      const hasRetry = await retryBtn.isVisible().catch(() => false);
      await screenshot(window, 'uc02-retry-btn');
      expect(hasRetry).toBe(true);
    } finally {
      await app.close();
    }
  });
});
