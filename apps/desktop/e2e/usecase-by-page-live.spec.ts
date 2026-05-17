/**
 * 페이지별 + 기능별 유즈케이스 스크린샷
 */
import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'https://wawa-smart-erp.pages.dev';
const OUT = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots', 'pages');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page: any, name: string, fullPage = false) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  ✅ ${name}.png`);
}

async function visit(page: any, route: string, name: string) {
  await page.goto(`${BASE}/#${route}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, name);
}

async function clickIfExists(page: any, selector: string, name: string, wait = 1200) {
  const loc = page.locator(selector).first();
  if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
    await loc.click().catch(() => {});
    await page.waitForTimeout(wait);
    await shot(page, name);
    return true;
  }
  return false;
}

test.describe('Page-by-Page Use Cases', () => {
  test.setTimeout(900_000);

  test('capture all pages and features', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 로그인
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, '01-login-form');

    const sel = page.locator('select').first();
    if (await sel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sel.selectOption({ value: 'test-canyon' });
      await page.waitForTimeout(400);
      await shot(page, '02-login-academy-selected');
    }
    await page.locator('#login-name').fill('하이머딩거');
    await page.locator('#login-pin').fill('1234');
    await shot(page, '03-login-filled');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);

    // ── Timer ──
    await visit(page, '/timer', '10-timer-main');
    await clickIfExists(page, 'button:has-text("체크인"), button:has-text("시작")', '11-timer-checkin');

    // ── Board ──
    await visit(page, '/board', '20-board-main');
    await clickIfExists(page, 'button:has-text("추가"), button:has-text("새 할일"), button:has-text("+")', '21-board-add-todo');

    // ── Student ──
    await visit(page, '/student', '30-student-list');
    const firstStudent = page.locator('.student-card, [data-testid^="student-"], a[href*="/student/"]').first();
    if (await firstStudent.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstStudent.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2000);
      await shot(page, '31-student-profile');
      // 탭이 있다면 순회
      const tabs = ['출결', '성적', '리포트', '메모', '보강'];
      for (let i = 0; i < tabs.length; i++) {
        const t = page.locator(`button:has-text("${tabs[i]}"), [role="tab"]:has-text("${tabs[i]}")`).first();
        if (await t.isVisible({ timeout: 1500 }).catch(() => false)) {
          await t.click().catch(() => {});
          await page.waitForTimeout(1000);
          await shot(page, `32-student-tab-${i + 1}-${tabs[i]}`);
        }
      }
    }

    // ── Absence / Makeup ──
    await visit(page, '/absence', '40-absence-main');
    for (const [label, idx] of [['미보강', 1], ['보강예정', 2], ['보강완료', 3]] as const) {
      const btn = page.locator(`button:has-text("${label}")`).first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(1000);
        await shot(page, `41-absence-filter-${idx}-${label}`);
      }
    }
    await clickIfExists(page, 'button:has-text("결석 등록"), button:has-text("+ 결석")', '42-absence-add');

    // ── Materials ──
    await visit(page, '/materials', '50-materials-main');
    await clickIfExists(page, 'button:has-text("교재 추가"), button:has-text("+ 추가")', '51-materials-add');

    // ── Meeting ──
    await visit(page, '/meeting', '60-meeting-main');
    await clickIfExists(page, 'button:has-text("회의 생성"), button:has-text("새 회의"), button:has-text("+")', '61-meeting-create');

    // ── Report ──
    await visit(page, '/report', '70-report-main');
    await clickIfExists(page, 'button:has-text("리포트 생성"), button:has-text("AI 생성")', '71-report-generate');

    // ── Exams ──
    await visit(page, '/exams', '80-exams-main');
    await clickIfExists(page, 'button:has-text("시험 추가"), button:has-text("정기고사")', '81-exams-add');

    // ── Exam Papers ──
    await visit(page, '/exam-papers', '85-exam-papers');

    // ── Gacha ──
    await visit(page, '/gacha', '90-gacha-student');
    await visit(page, '/gacha/cards', '91-gacha-cards');
    await clickIfExists(page, 'button:has-text("카드 추가"), button:has-text("+ 카드")', '92-gacha-card-add');
    await visit(page, '/gacha/proofs', '93-gacha-proofs');
    await visit(page, '/gacha/dashboard', '94-gacha-dashboard');

    // ── Settings ──
    await visit(page, '/settings', 'A0-settings');

    console.log(`\n✅ Saved to ${OUT}`);
  });
});
