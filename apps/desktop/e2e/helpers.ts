import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(__dirname, '../../../notion_config.json');
const NOTION_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots-all');

export async function takeScreenshot(page: Page, name: string) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

/** localStorage에 config 직접 주입 + 로그인까지 완료 */
export async function ensureReady(page: Page) {
  // 1) config를 localStorage에 직접 주입
  const storagePayload = JSON.stringify({
    state: {
      currentUser: null,
      currentYearMonth: new Date().toISOString().slice(0, 7),
      appSettings: {
        notionApiKey: NOTION_CONFIG.notionApiKey,
        notionTeachersDb: NOTION_CONFIG.notionTeachersDb,
        notionStudentsDb: NOTION_CONFIG.notionStudentsDb,
        notionScoresDb: NOTION_CONFIG.notionScoresDb,
        notionExamScheduleDb: NOTION_CONFIG.notionExamScheduleDb,
        notionEnrollmentDb: NOTION_CONFIG.notionEnrollmentDb,
        notionMakeupDb: NOTION_CONFIG.notionMakeupDb,
        notionDmMessagesDb: NOTION_CONFIG.notionDmMessagesDb,
        cloudinaryCloudName: NOTION_CONFIG.cloudinaryCloudName || '',
        cloudinaryUploadPreset: NOTION_CONFIG.cloudinaryUploadPreset || '',
      },
    },
    version: 0,
  });

  await page.addInitScript((payload) => {
    localStorage.setItem('wawa-report-storage', payload);
  }, storagePayload);

  // 2) 페이지 로드
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // 3) 로그인 화면이면 로그인
  const loginTitle = page.locator('text=WAWA ERP 로그인');
  if (await loginTitle.isVisible({ timeout: 5000 }).catch(() => false)) {
    const teacherSelect = page.locator('select.search-input').first();
    await teacherSelect.waitFor({ state: 'visible', timeout: 15000 });

    // 선생님 목록 로드 대기
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      if (await teacherSelect.locator('option').count() > 1) break;
    }

    const targetOption = teacherSelect.locator('option:has-text("서재용")');
    if (await targetOption.count() > 0) {
      const val = await targetOption.first().getAttribute('value');
      if (val) await teacherSelect.selectOption(val);
    }

    await page.locator('input[type="password"]').fill('1141');
    await page.locator('button:has-text("접속하기")').click();
    await page.waitForTimeout(5000);
  }

  // 4) 로그인 후 메인 페이지 도달 대기
  await page.waitForTimeout(2000);
}
