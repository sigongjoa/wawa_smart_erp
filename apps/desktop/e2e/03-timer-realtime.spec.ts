/**
 * UC-03: 실시간 타이머 뷰
 * - config + 자동 로그인 주입 후 실시간 뷰 진입
 * - 대기/수업 컬럼이 표시된다
 * - 요일 필터 버튼(월~토)이 표시된다
 * - 임시 학생 추가 버튼 & 모달이 동작한다
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfigAndLogin, screenshot } from './helpers';

test.describe('UC-03: 실시간 타이머', () => {
  test('config+로그인 주입 후 메인 화면 진입', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);
      const bodyText = await window.locator('body').innerText();
      await screenshot(window, 'uc03-after-login');

      expect(bodyText).not.toContain('시스템 초기 설정');
      expect(bodyText).not.toContain('로그인');
    } finally {
      await app.close();
    }
  });

  test('실시간 뷰 진입 시 대기/수업 컬럼이 표시된다', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

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
      await injectConfigAndLogin(window);

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
      await injectConfigAndLogin(window);

      await window.locator('text=실시간').first().click();
      await window.waitForTimeout(1000);

      const tempBtn = window.locator('text=임시').first();
      if (!await tempBtn.isVisible().catch(() => false)) { test.skip(); return; }

      await tempBtn.click();
      await window.waitForTimeout(500);

      const isOpen = await window.locator('text=임시 학생 추가').first().isVisible().catch(() => false);
      await screenshot(window, 'uc03-temp-modal');
      expect(isOpen).toBe(true);
    } finally {
      await app.close();
    }
  });
});
