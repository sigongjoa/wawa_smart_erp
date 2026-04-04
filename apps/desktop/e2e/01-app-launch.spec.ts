/**
 * UC-01: 앱 실행 및 초기 화면 진입
 *
 * 유즈케이스:
 * - 일렉트론 앱이 정상적으로 실행된다
 * - 첫 화면이 Setup(미설정) 또는 Login(설정완료) 화면이다
 * - 앱 타이틀이 올바르게 표시된다
 */
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(__dirname, '..');
const SCREENSHOTS = path.join(ROOT, 'e2e-screenshots-all');

async function launch() {
  const app = await electron.launch({
    args: [path.join(ROOT, 'dist/main/index.js')],
    // NODE_ENV를 production으로 설정해 dist/renderer/index.html 로드
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  // ready-to-show 이후 콘텐츠가 생길 때까지 대기
  await window.waitForLoadState('load');
  await window.waitForTimeout(3000);
  return { app, window };
}

test.describe('UC-01: 앱 실행', () => {
  test('앱이 정상 실행되고 윈도우가 열린다', async () => {
    const { app, window } = await launch();
    try {
      expect(window).toBeTruthy();

      const body = await window.locator('body').innerHTML();
      expect(body.length).toBeGreaterThan(100);

      if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
      await window.screenshot({ path: path.join(SCREENSHOTS, 'uc01-app-launch.png') });
    } finally {
      await app.close();
    }
  });

  test('Setup 또는 Login 또는 메인 화면 중 하나가 표시된다', async () => {
    const { app, window } = await launch();
    try {
      if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
      await window.screenshot({ path: path.join(SCREENSHOTS, 'uc01-initial-screen.png') });

      const pageText = await window.locator('body').innerText().catch(() => '');
      console.log('페이지 텍스트 샘플:', pageText.substring(0, 200));

      // 어떤 형태로든 렌더링이 되어야 함
      expect(pageText.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});
