/**
 * IR 유즈케이스 덱용 스크린샷 캡처
 * 10개 유즈케이스 × 실제 운영 화면
 */
import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'https://wawa-smart-erp.pages.dev';
const OUT = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots', 'usecase');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page: any, name: string, fullPage = false) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  ✅ ${name}.png`);
}

async function login(page: any, name: string, pin = '1234') {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const sel = page.locator('select').first();
  if (await sel.isVisible({ timeout: 5000 }).catch(() => false)) {
    await sel.selectOption({ value: 'test-canyon' });
    await page.waitForTimeout(400);
  }
  await page.locator('#login-name').fill(name);
  await page.locator('#login-pin').fill(pin);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);
  await page.waitForLoadState('networkidle');
}

test.describe('IR Use Case Screenshots', () => {
  test.setTimeout(600_000);

  test('capture all use cases', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // ── 로그인 화면 (UC-2 컨텍스트) ──
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, '00-login');

    // 로그인
    const sel = page.locator('select').first();
    if (await sel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sel.selectOption({ value: 'test-canyon' });
      await page.waitForTimeout(400);
    }
    await page.locator('#login-name').fill('하이머딩거');
    await page.locator('#login-pin').fill('1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);
    await page.waitForLoadState('networkidle');

    // ── UC-1: 원장 대시보드 ──
    await page.goto(`${BASE}/#/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, 'uc1-dashboard');

    // ── UC-4: 타이머 / 출결 ──
    await page.goto(`${BASE}/#/timer`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1800);
    await shot(page, 'uc4-timer');

    // ── UC-5: 보드 / 할일 ──
    await page.goto(`${BASE}/#/board`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, 'uc5-board');

    // ── UC-6: 학생 관리 / 프로필 ──
    await page.goto(`${BASE}/#/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, 'uc6-students');

    // 첫 학생 프로필
    const firstStudent = page.locator('.student-card, [data-testid^="student-"], a[href*="/student/"]').first();
    if (await firstStudent.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstStudent.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1800);
      await shot(page, 'uc6-student-profile');
    }

    // ── UC-7: AI 리포트 ──
    await page.goto(`${BASE}/#/reports`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, 'uc7-reports');

    // 리포트 전송 페이지
    const sendLink = page.locator('a[href*="send"], button:has-text("전송")').first();
    if (await sendLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sendLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1800);
      await shot(page, 'uc7-report-send');
    }

    // ── UC-8: 결석 관리 ──
    await page.goto(`${BASE}/#/absence`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, 'uc8-absence');

    // ── UC-10: 가챠 ──
    await page.goto(`${BASE}/#/gacha`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, 'uc10-gacha');

    // ── 시험 관리 (bonus) ──
    await page.goto(`${BASE}/#/exam-management`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, 'uc-exam-mgmt');

    // ── 학원 관리 / 초대 (UC-2) ──
    await page.goto(`${BASE}/#/academy`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, 'uc2-academy');

    console.log(`\n✅ Screenshots saved to: ${OUT}`);
  });
});
