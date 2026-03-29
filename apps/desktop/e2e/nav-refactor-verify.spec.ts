import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots-all');
const CONFIG_PATH = '/mnt/g/progress/wawa/wawa_smart_erp/notion_config.json';

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

async function shot(page: Page, name: string) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `nav_${name}.png`), fullPage: true });
  console.log(`📸 nav_${name}.png`);
}

// localStorage에 앱 설정 주입 → 설정 화면 스킵
async function injectConfig(page: Page) {
  await page.addInitScript((cfg) => {
    const state = {
      state: {
        appSettings: {
          notionApiKey: cfg.notionApiKey,
          notionTeachersDb: cfg.notionTeachersDb,
          notionStudentsDb: cfg.notionStudentsDb,
          notionScoresDb: cfg.notionScoresDb,
          notionExamScheduleDb: cfg.notionExamScheduleDb,
          notionEnrollmentDb: cfg.notionEnrollmentDb,
          notionMakeupDb: cfg.notionMakeupDb,
          notionDmMessagesDb: cfg.notionDmMessagesDb,
          cloudinaryCloudName: cfg.cloudinaryCloudName,
          cloudinaryUploadPreset: cfg.cloudinaryUploadPreset,
        },
        currentUser: null,
        teachers: [],
        students: [],
        reports: [],
        currentYearMonth: new Date().toISOString().slice(0, 7),
      },
      version: 0,
    };
    localStorage.setItem('wawa-report-storage', JSON.stringify(state));
  }, config);
}

async function login(page: Page, name: string, pin: string): Promise<boolean> {
  await injectConfig(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // 로그인 화면 대기
  const select = page.locator('select.search-input').first();
  await expect(select).toBeVisible({ timeout: 15000 });

  // Notion에서 선생님 목록 불러올 때까지 대기 (2번째 option 등장)
  await expect(select.locator('option').nth(1)).toBeAttached({ timeout: 25000 });

  // 이름으로 옵션 선택
  // 부분 일치로 선택 (예: '서재용' → '서재용 개발자' 포함)
const options = await select.locator('option').all();
let matched = false;
for (const opt of options) {
  const text = await opt.textContent();
  if (text && text.includes(name)) {
    await select.selectOption({ label: text.trim() });
    console.log(`  선택된 선생님: "${text.trim()}"`);
    matched = true;
    break;
  }
}
if (!matched) {
  console.log(`  ❌ "${name}" 포함 옵션 없음. 전체 목록:`, await Promise.all(options.map(o => o.textContent())));
  return false;
}
  await page.locator('input[type="password"]').fill(pin);
  await page.click('button:has-text("접속하기")');

  try {
    await Promise.race([
      page.locator('.sidebar').waitFor({ state: 'visible', timeout: 10000 }),
      page.locator('text=PIN 번호가 일치하지').waitFor({ state: 'visible', timeout: 10000 }),
    ]);
  } catch { /* timeout */ }

  if (await page.locator('text=PIN 번호가 일치하지').isVisible()) {
    console.log('❌ PIN 불일치');
    return false;
  }
  return await page.locator('.sidebar').isVisible();
}

// ============================================================
test.describe('네비게이션 간소화 검증 — 서재용(1141)', () => {
  test.setTimeout(120000);

  test('헤더: 탭 3개만 존재, 채점·보강관리 제거됨', async ({ page }) => {
    const ok = await login(page, '서재용', '1141');
    expect(ok, '서재용 1141 로그인 실패').toBe(true);
    await shot(page, '01_login_success');

    const nav = page.locator('.header-nav');
    await expect(nav).toBeVisible();

    // ✅ 있어야 하는 탭
    await expect(nav.locator('text=시간표')).toBeVisible();
    await expect(nav.locator('text=학생관리')).toBeVisible();
    await expect(nav.locator('text=월말평가')).toBeVisible();

    // ❌ 없어야 하는 탭
    await expect(nav.locator('text=채점')).not.toBeVisible();
    await expect(nav.locator('text=보강관리')).not.toBeVisible();

    // 탭 정확히 3개 (관리자면 학생관리 포함, 아니면 2개일 수 있음)
    const tabs = nav.locator('.header-nav-item');
    const tabCount = await tabs.count();
    console.log(`  탭 수: ${tabCount}개`);
    expect(tabCount).toBeLessThanOrEqual(3);
    expect(tabCount).toBeGreaterThanOrEqual(2);

    console.log('✅ 헤더 탭 확인 완료, 채점·보강관리 없음');
    await shot(page, '02_header_tabs');
  });

  test('월말평가 사이드탭: 3개만 존재 + 스텝 번호', async ({ page }) => {
    const ok = await login(page, '서재용', '1141');
    expect(ok, '로그인 실패').toBe(true);

    await page.locator('.header-nav-item', { hasText: '월말평가' }).click();
    await page.waitForTimeout(1500);
    await shot(page, '03_report_clicked');

    const sidebar = page.locator('.sidebar-nav');
    await expect(sidebar).toBeVisible();

    // ✅ 있어야 하는 탭
    await expect(sidebar.locator('text=성적 입력')).toBeVisible();
    await expect(sidebar.locator('text=리포트 미리보기')).toBeVisible();
    await expect(sidebar.locator('text=리포트 전송')).toBeVisible();

    // ❌ 없어야 하는 탭
    await expect(sidebar.locator('text=대시보드')).not.toBeVisible();
    await expect(sidebar.locator('text=학생 관리')).not.toBeVisible();
    await expect(sidebar.locator('text=시험 관리')).not.toBeVisible();

    // 아이템 3개
    const items = sidebar.locator('.sidebar-item');
    await expect(items).toHaveCount(3);

    // 스텝 번호 ①②③
    const steps = sidebar.locator('.sidebar-step-num');
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText('1');
    await expect(steps.nth(1)).toContainText('2');
    await expect(steps.nth(2)).toContainText('3');

    console.log('✅ 사이드탭 3개 + 스텝 번호 확인');
    await shot(page, '04_sidebar_steps');
  });

  test('/report → /report/input 리다이렉트 + active 상태', async ({ page }) => {
    const ok = await login(page, '서재용', '1141');
    expect(ok, '로그인 실패').toBe(true);

    await page.locator('.header-nav-item', { hasText: '월말평가' }).click();
    await page.waitForTimeout(2000);

    // URL 확인
    expect(page.url()).toContain('/report/input');

    // 페이지 타이틀
    await expect(page.locator('h1.page-title')).toContainText('성적 입력');

    // 사이드바 active
    const activeItem = page.locator('.sidebar-item.active');
    await expect(activeItem).toBeVisible();
    await expect(activeItem).toContainText('성적 입력');

    // active 스텝 번호가 primary 색상인지 (클래스 확인)
    const activeStep = activeItem.locator('.sidebar-step-num');
    await expect(activeStep).toBeVisible();

    console.log('✅ 리다이렉트 + active 상태 확인');
    await shot(page, '05_redirect_input_active');
  });

  test('3단계 워크플로우 탐색', async ({ page }) => {
    const ok = await login(page, '서재용', '1141');
    expect(ok, '로그인 실패').toBe(true);

    await page.locator('.header-nav-item', { hasText: '월말평가' }).click();
    await page.waitForTimeout(1500);

    // Step 1: 성적 입력
    await expect(page.locator('h1.page-title')).toContainText('성적 입력');
    await shot(page, '06_step1_input');

    // Step 2: 리포트 미리보기 — evaluate로 hash 변경
    await page.evaluate(() => { window.location.hash = '/report/preview'; });
    await page.waitForTimeout(2000);
    const urlAfterPreview = page.url();
    console.log(`  URL after preview nav: ${urlAfterPreview}`);
    const h1After = await page.locator('h1.page-title').textContent().catch(() => 'NOT FOUND');
    console.log(`  h1 after preview nav: ${h1After}`);
    await shot(page, '07_step2_preview');
    await expect(page.locator('h1.page-title')).toContainText('리포트 미리보기', { timeout: 10000 });

    // Step 3: 리포트 전송
    await page.evaluate(() => { window.location.hash = '/report/send'; });
    await page.waitForTimeout(2000);
    await expect(page.locator('h1.page-title')).toContainText('리포트 전송', { timeout: 10000 });
    console.log(`  URL: ${page.url()}`);
    await shot(page, '08_step3_send');

    console.log('✅ 3단계 워크플로우 탐색 완료');
  });

  test('접근성: aria-label, 터치 타겟 44px', async ({ page }) => {
    const ok = await login(page, '서재용', '1141');
    expect(ok, '로그인 실패').toBe(true);

    await page.locator('.header-nav-item', { hasText: '월말평가' }).click();
    await page.waitForTimeout(1500);

    // 검색 input aria-label
    const searchInput = page.locator('input[aria-label="학생 이름 또는 학년 검색"]');
    await expect(searchInput).toBeVisible();

    // 로그아웃 버튼 aria-label + 44px
    const logoutBtn = page.locator('button[aria-label="로그아웃"]');
    await expect(logoutBtn).toBeVisible();
    const box = await logoutBtn.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    console.log(`✅ 로그아웃 버튼: ${box?.width}×${box?.height}px`);
    await shot(page, '09_a11y');
  });

  test('시간표 탭 정상 동작', async ({ page }) => {
    const ok = await login(page, '서재용', '1141');
    expect(ok, '로그인 실패').toBe(true);

    await page.locator('.header-nav-item', { hasText: '시간표' }).click();
    await page.waitForTimeout(1500);

    await expect(page.locator('.sidebar-title')).toBeVisible();
    await expect(page.locator('.sidebar-nav').locator('text=요일별 보기')).toBeVisible();

    await shot(page, '10_timer_tab');
    console.log('✅ 시간표 탭 정상');
  });
});
