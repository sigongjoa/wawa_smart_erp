import { ElectronApplication, Page } from 'playwright';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

export const ROOT = path.resolve(__dirname, '..');
export const SCREENSHOTS = path.join(ROOT, 'e2e-screenshots-all');

// notion_config.json은 프로젝트 루트에 있음
const CONFIG_PATH = path.resolve(ROOT, '../../notion_config.json');

export async function launchApp(): Promise<{ app: ElectronApplication; window: Page }> {
  const electronApp = await electron.launch({
    args: [path.join(ROOT, 'dist/main/index.js')],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('load');
  await window.waitForTimeout(2000);
  if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
  return { app: electronApp, window };
}

const MOCK_ADMIN_TEACHER = {
  id: '2f973635-f415-8005-8252-d04c24c1c929', // Notion DB의 실제 선생님 UUID
  name: '테스트선생님',
  subjects: ['수학', '영어'],
  pin: '0000',
  isAdmin: true,
};

const MOCK_CURRENT_USER = {
  teacher: MOCK_ADMIN_TEACHER,
  loginAt: new Date().toISOString(),
};

/**
 * notion_config.json을 localStorage에 주입하고 페이지를 새로고침.
 * Setup 화면을 건너뛰고 바로 로그인 화면 또는 메인으로 진입합니다.
 */
export async function injectConfig(window: Page): Promise<void> {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`notion_config.json not found at: ${CONFIG_PATH}`);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  const storageValue = JSON.stringify({
    state: { appSettings: config, currentUser: null },
    version: 0,
  });

  await window.evaluate((val) => {
    localStorage.setItem('wawa-report-storage', val);
  }, storageValue);

  await window.reload();
  await window.waitForLoadState('load');
  await window.waitForTimeout(3000);
}

/**
 * config 주입 + 어드민 선생님으로 자동 로그인.
 * teachers 목록과 currentUser를 모두 주입해 로그인 화면을 건너뜁니다.
 */
export async function injectConfigAndLogin(window: Page): Promise<void> {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`notion_config.json not found at: ${CONFIG_PATH}`);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  const storageValue = JSON.stringify({
    state: {
      appSettings: config,
      teachers: [MOCK_ADMIN_TEACHER],
      currentUser: MOCK_CURRENT_USER,
    },
    version: 0,
  });

  await window.evaluate((val) => {
    localStorage.setItem('wawa-report-storage', val);
  }, storageValue);

  await window.reload();
  await window.waitForLoadState('load');
  await window.waitForTimeout(3000);
}

export async function screenshot(window: Page, name: string) {
  if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
  await window.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true });
}

export async function isSetupScreen(window: Page): Promise<boolean> {
  const text = await window.locator('body').innerText().catch(() => '');
  return text.includes('시스템 초기 설정') || text.includes('파일 선택');
}

export async function isLoginScreen(window: Page): Promise<boolean> {
  const text = await window.locator('body').innerText().catch(() => '');
  return text.includes('로그인') && !text.includes('시스템 초기 설정');
}
