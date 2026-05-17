/**
 * 페인포인트 데크용 — 12장의 증거 스크린샷 (P1-P6, D1-D6)
 *
 * 각 페인포인트마다 실제 앱의 해당 화면을 띄우고, 의미 있는 요소를
 * element.screenshot() 또는 page.screenshot({ clip }) 로 잘라 저장한다.
 *
 * 결과 위치: docs/screenshots/painpoints/{p1-p6,d1-d6}.png
 */
import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';
const OUT = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots', 'painpoints');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };

async function login(page: Page, name = '하이머딩거') {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');

  const sel = page.locator('select').first();
  await sel.waitFor({ state: 'visible', timeout: 10000 });
  // 학원 옵션이 로드될 때까지 대기 (placeholder 외 1개 이상)
  await page.waitForFunction(() => {
    const s = document.querySelector('select') as HTMLSelectElement | null;
    return !!s && s.options.length > 1;
  }, null, { timeout: 10000 }).catch(() => {});

  // 'test-canyon' 우선, 실패시 두 번째 옵션
  try {
    await sel.selectOption({ value: 'test-canyon' });
  } catch {
    await sel.selectOption({ index: 1 }).catch(() => {});
  }
  await page.waitForTimeout(300);

  await page.locator('#login-name').fill(name);
  await page.locator('#login-pin').fill('1234');
  await page.locator('button[type="submit"]').click();

  // 로그인 후 메인 라우트로 이동했는지 검증
  await page.waitForURL(/#\/(timer|board|student|absence|report|settings|exams|materials|meeting|gacha)/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);

  // 마지막 가드: 여전히 로그인 폼이 보이면 한 번 더 시도
  if (await page.locator('#login-name').isVisible({ timeout: 500 }).catch(() => false)) {
    await page.locator('#login-name').fill(name);
    await page.locator('#login-pin').fill('1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);
  }
}

async function shotElement(page: Page, locator: any, name: string, padding = 12) {
  await page.waitForTimeout(500);
  try {
    const box = await locator.boundingBox();
    if (!box) throw new Error('no box');
    const clip = {
      x: Math.max(0, box.x - padding),
      y: Math.max(0, box.y - padding),
      width: Math.min(VIEWPORT.width, box.width + padding * 2),
      height: Math.min(VIEWPORT.height, box.height + padding * 2),
    };
    await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
    console.log(`  ✅ ${name}.png  (${Math.round(clip.width)}×${Math.round(clip.height)})`);
  } catch (e) {
    // Fallback: viewport-centered crop
    const clip = { x: 0, y: 80, width: VIEWPORT.width, height: 620 };
    await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
    console.log(`  ⚠ ${name}.png  (fallback viewport crop)`);
  }
}

async function shotClip(page: Page, name: string, clip: { x: number; y: number; width: number; height: number }) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
  console.log(`  ✅ ${name}.png  (manual clip ${clip.width}×${clip.height})`);
}

test.use({ viewport: VIEWPORT });

test.describe('페인포인트 증거 스크린샷', () => {
  test.setTimeout(360_000);

  test('P1 · 학생 진도 파악 → 학생 프로필', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/student`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const card = page.locator('button.student-card').first();
    if (await card.isVisible({ timeout: 4000 }).catch(() => false)) {
      await card.click();
      await page.waitForTimeout(2000);
    }
    // 프로필의 메인 대시보드 영역
    const main = page.locator('.dashboard-row, .student-profile-page, main').first();
    await shotElement(page, main, 'p1-student-progress');
  });

  test('P2 · 자습 타이머 → 타이머 카드 그리드', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/timer`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 타이머 본문 (필터바 + 학생 카드들)
    const target = page.locator('main, .timer-page, body').first();
    await shotClip(page, 'p2-timer-grid', { x: 0, y: 60, width: 1440, height: 700 });
  });

  test('P3 · 보드 시스템 → 할일 카드', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/board`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shotClip(page, 'p3-board-todos', { x: 0, y: 60, width: 1440, height: 720 });
  });

  test('P4 · 학부모 상담 → 학생 통합 프로필', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/student`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const card = page.locator('button.student-card').first();
    if (await card.isVisible({ timeout: 4000 }).catch(() => false)) {
      await card.click();
      await page.waitForTimeout(2200);
    }
    await shotClip(page, 'p4-student-profile-full', { x: 0, y: 0, width: 1440, height: 900 });
  });

  test('P5 · 월말 리포트 → 리포트 미리보기', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/report`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 학생 선택 시도
    const row = page.locator('tr.send-row').first();
    if (await row.isVisible({ timeout: 3500 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(1800);
    }
    await shotClip(page, 'p5-report-preview', { x: 0, y: 60, width: 1440, height: 760 });
  });

  test('P6 · 보강 트래킹 → 미보강 필터', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/absence`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1800);

    const pending = page.locator('button.filter-btn:has-text("미보강")').first();
    if (await pending.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pending.click();
      await page.waitForTimeout(1400);
    }
    await shotClip(page, 'p6-absence-pending', { x: 0, y: 60, width: 1440, height: 720 });
  });

  // ─── 원장 D1-D6 ─────────────────────────────────────
  test('D1 · 보강 KPI → 전체 absence 페이지', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/absence`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // 필터바와 카운트가 보이는 상단 영역
    await shotClip(page, 'd1-absence-kpi', { x: 0, y: 60, width: 1440, height: 520 });
  });

  test('D2 · 선생 교체 인수인계 → 학생 메모 히스토리', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/student`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const card = page.locator('button.student-card').first();
    if (await card.isVisible({ timeout: 4000 }).catch(() => false)) {
      await card.click();
      await page.waitForTimeout(2200);
    }
    // 페이지 하단 (메모/이력 영역이 아래에 있을 가능성)
    await shotClip(page, 'd2-student-memo', { x: 0, y: 280, width: 1440, height: 620 });
  });

  test('D3 · 원장 대시보드 → 타이머 전체 학생 그리드', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/timer`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2200);
    await shotClip(page, 'd3-academy-overview', { x: 0, y: 60, width: 1440, height: 760 });
  });

  test('D4 · 알림톡 자동 → 설정 페이지', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1800);
    await shotClip(page, 'd4-settings-notify', { x: 0, y: 60, width: 1440, height: 760 });
  });

  test('D5 · 학부모 리포트 → 미리보기 카드', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/report`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const row = page.locator('tr.send-row').first();
    if (await row.isVisible({ timeout: 3500 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(2000);
    }
    // 우측 미리보기 영역 위주로 (좌측 학생 리스트 제외 가능성)
    await shotClip(page, 'd5-report-card', { x: 380, y: 60, width: 1060, height: 760 });
  });

  test('D6 · 시험 관리 → exam 페이지', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/exams`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shotClip(page, 'd6-exams-main', { x: 0, y: 60, width: 1440, height: 760 });
  });
});
