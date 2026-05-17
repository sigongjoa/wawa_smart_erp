import { defineConfig, devices } from '@playwright/test';

// `*-live.spec.ts` 는 prod worker/D1/KV에 직접 붙어 PIN 로그인까지 수행 → KV 무료 한도 위협.
// 기본 실행에서는 제외하고, 환경변수 E2E_LIVE=1 가 명시될 때만 매칭. (`npm run test:e2e:live`)
const RUN_LIVE = process.env.E2E_LIVE === '1';

export default defineConfig({
  testDir: './e2e',
  testMatch: RUN_LIVE ? '**/*-live.spec.ts' : '**/*.spec.ts',
  testIgnore: RUN_LIVE ? undefined : '**/*-live.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  outputDir: '.playwright/results',
  reporter: [
    ['html', { outputFolder: '.playwright/html-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',
  },
  webServer: RUN_LIVE ? undefined : {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
