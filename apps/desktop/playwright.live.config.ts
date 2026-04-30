import { defineConfig, devices } from '@playwright/test';

/**
 * 외부 배포 환경 대상 Playwright 설정 — 로컬 webServer 띄우지 않음.
 * 사용:
 *   DESKTOP_URL=https://wawa-smart-erp.pages.dev \
 *     npx playwright test --config=playwright.live.config.ts e2e/medterm-admin-smoke-live.spec.ts
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*-live.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: process.env.DESKTOP_URL || 'https://wawa-smart-erp.pages.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
