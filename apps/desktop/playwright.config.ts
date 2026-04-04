import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['list'],
  ],
  // Electron 테스트는 각 spec 파일에서 _electron.launch()로 앱을 직접 실행합니다.
  // baseURL / webServer 불필요
});
