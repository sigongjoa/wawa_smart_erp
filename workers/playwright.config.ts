import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'html',
  use: {
    // 프로덕션 URL 로 자동 fallback 금지 — 환경 미지정이면 로컬을 때린다.
    // prod 를 진짜 테스트해야 하면 `API_URL=https://... pnpm test:e2e` 로 명시.
    baseURL: process.env.API_URL || 'http://localhost:8787',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
