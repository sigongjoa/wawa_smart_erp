import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/ppt-screenshots-live.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'https://wawa-smart-erp.pages.dev' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
