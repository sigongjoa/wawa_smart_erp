import { ElectronApplication, Page } from 'playwright';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

export const ROOT = path.resolve(__dirname, '..');
export const SCREENSHOTS = path.join(ROOT, 'e2e-screenshots-all');

export async function launchApp(): Promise<{ app: ElectronApplication; window: Page }> {
  const electronApp = await electron.launch({
    args: [path.join(ROOT, 'dist/main/index.js')],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('load');
  await window.waitForTimeout(3000);
  if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
  return { app: electronApp, window };
}

export async function screenshot(window: Page, name: string) {
  if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
  await window.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true });
}

/** Setup 화면 여부 (notion_config.json 미설정) */
export async function isSetupScreen(window: Page): Promise<boolean> {
  const text = await window.locator('body').innerText().catch(() => '');
  return text.includes('시스템 초기 설정') || text.includes('파일 선택');
}

/** 로그인 화면 여부 */
export async function isLoginScreen(window: Page): Promise<boolean> {
  const text = await window.locator('body').innerText().catch(() => '');
  return text.includes('로그인');
}
