import { defineConfig, devices } from '@playwright/test';

// `*-live.spec.ts` 는 prod (pages.dev / worker)에 직접 PIN 로그인까지 수행 → KV 무료 한도 위협.
// 기본 실행에서는 제외하고, 환경변수 E2E_LIVE=1 가 명시될 때만 포함. (`npm run e2e:live`)
const RUN_LIVE = process.env.E2E_LIVE === '1';
const STUDENT_URL = process.env.STUDENT_URL || 'https://6f84d999.wawa-learn.pages.dev';

export default defineConfig({
  testDir: './e2e',
  testIgnore: RUN_LIVE ? undefined : '**/*-live.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: STUDENT_URL,
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
