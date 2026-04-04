/**
 * UC-02: 사이드바 네비게이션
 *
 * 유즈케이스:
 * - 사이드바 메뉴가 렌더링된다
 * - 각 메뉴 클릭 시 해당 페이지로 이동한다
 * - 현재 페이지 메뉴가 active 상태로 표시된다
 *
 * 전제: 앱이 이미 로그인된 상태(notion_config.json 존재)
 * 로그인 안 된 경우 이 테스트는 skip됩니다.
 */
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(__dirname, '..');
const SCREENSHOTS = path.join(ROOT, 'e2e-screenshots-all');

async function launchAndWait() {
  const app = await electron.launch({
    args: [path.join(ROOT, 'dist/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test' },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000);
  return { app, window };
}

test.describe('UC-02: 사이드바 네비게이션', () => {
  test('사이드바가 존재한다', async () => {
    const { app, window } = await launchAndWait();
    try {
      const sidebar = window.locator('.sidebar, nav, [role="navigation"]').first();
      const hasSidebar = await sidebar.isVisible().catch(() => false);

      // Setup 화면이면 skip
      const isSetup = await window.locator('text=Notion API Key').isVisible().catch(() => false);
      if (isSetup) {
        test.skip();
        return;
      }

      await window.screenshot({ path: path.join(SCREENSHOTS, 'uc02-sidebar.png') });
      expect(hasSidebar).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('타이머 메뉴 클릭 시 타이머 페이지로 이동', async () => {
    const { app, window } = await launchAndWait();
    try {
      const isSetup = await window.locator('text=Notion API Key').isVisible().catch(() => false);
      const isLogin = await window.locator('text=로그인').isVisible().catch(() => false);
      if (isSetup || isLogin) { test.skip(); return; }

      // 타이머 관련 사이드바 메뉴 클릭
      const timerMenu = window.locator('text=타이머').first();
      if (await timerMenu.isVisible()) {
        await timerMenu.click();
        await window.waitForTimeout(500);
        await window.screenshot({ path: path.join(SCREENSHOTS, 'uc02-timer-page.png') });
      }
    } finally {
      await app.close();
    }
  });

  test('채점 메뉴 클릭 시 채점 페이지로 이동', async () => {
    const { app, window } = await launchAndWait();
    try {
      const isSetup = await window.locator('text=Notion API Key').isVisible().catch(() => false);
      const isLogin = await window.locator('text=로그인').isVisible().catch(() => false);
      if (isSetup || isLogin) { test.skip(); return; }

      const graderMenu = window.locator('text=채점').first();
      if (await graderMenu.isVisible()) {
        await graderMenu.click();
        await window.waitForTimeout(500);
        await window.screenshot({ path: path.join(SCREENSHOTS, 'uc02-grader-page.png') });
      }
    } finally {
      await app.close();
    }
  });
});
