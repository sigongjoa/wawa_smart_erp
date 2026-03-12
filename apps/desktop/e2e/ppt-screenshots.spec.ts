import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(__dirname, 'test-config.json');
const NOTION_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export const PPT_SCREENSHOT_DIR = path.join(__dirname, '../ppt-screenshots');

async function shot(page: Page, name: string) {
  if (!fs.existsSync(PPT_SCREENSHOT_DIR)) {
    fs.mkdirSync(PPT_SCREENSHOT_DIR, { recursive: true });
  }
  const filePath = path.join(PPT_SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  📸 저장: ${name}.png`);
  return filePath;
}

async function setupConfig(page: Page) {
  const setupTitle = page.locator('text=시스템 초기 설정');
  if (await setupTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
    const configForUpload = {
      notionApiKey: NOTION_CONFIG.notionApiKey,
      notionTeachersDb: NOTION_CONFIG.notionTeachersDb,
      notionStudentsDb: NOTION_CONFIG.notionStudentsDb,
      notionScoresDb: NOTION_CONFIG.notionScoresDb,
      notionExamScheduleDb: NOTION_CONFIG.notionExamScheduleDb,
      notionEnrollmentDb: NOTION_CONFIG.notionEnrollmentDb,
      notionMakeupDb: NOTION_CONFIG.notionMakeupDb,
      notionDmMessagesDb: NOTION_CONFIG.notionDmMessagesDb,
    };
    const tempPath = path.join(__dirname, '_temp_ppt_config.json');
    fs.writeFileSync(tempPath, JSON.stringify(configForUpload, null, 2));
    await page.locator('input[type="file"][accept=".json"]').setInputFiles(tempPath);
    await page.waitForTimeout(2000);
    const spinner = page.locator('text=Notion 데이터 연동 중');
    if (await spinner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 60000 });
    }
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    await page.waitForTimeout(2000);
  }
}

async function login(page: Page, teacherName: string, pin: string) {
  const loginTitle = page.locator('text=WAWA ERP 로그인');
  if (await loginTitle.isVisible({ timeout: 5000 }).catch(() => false)) {
    const teacherSelect = page.locator('select.search-input').first();
    await teacherSelect.waitFor({ state: 'visible', timeout: 15000 });

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      if (await teacherSelect.locator('option').count() > 1) break;
    }

    const targetOption = teacherSelect.locator(`option:has-text("${teacherName}")`);
    if (await targetOption.count() > 0) {
      const val = await targetOption.first().getAttribute('value');
      if (val) await teacherSelect.selectOption(val);
    }

    await page.locator('input[type="password"]').fill(pin);
    await page.locator('button:has-text("접속하기")').click();
    await page.waitForTimeout(5000);
  }
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30000 });
}

async function waitForLoad(page: Page, timeout = 3000) {
  await page.waitForTimeout(1500);
  const spinner = page.locator('.spinner');
  if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
    await spinner.waitFor({ state: 'hidden', timeout }).catch(() => {});
  }
  await page.waitForTimeout(800);
}

// ============================================================
test('PPT용 앱 스크린샷 캡처', async ({ page }) => {
  test.setTimeout(600000);

  // 출력 폴더 초기화
  if (fs.existsSync(PPT_SCREENSHOT_DIR)) {
    for (const f of fs.readdirSync(PPT_SCREENSHOT_DIR)) {
      if (f.endsWith('.png')) fs.unlinkSync(path.join(PPT_SCREENSHOT_DIR, f));
    }
  }

  // ── 1. 초기 설정 화면 ──────────────────────────────────
  console.log('\n[1] 초기 설정 화면');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForTimeout(2000);

  // 설정 화면이 보이면 캡처
  const isSetupPage = await page.locator('text=시스템 초기 설정').isVisible({ timeout: 3000 }).catch(() => false);
  if (isSetupPage) {
    await shot(page, '01_초기설정_화면');
  }

  // ── 2. 설정 후 로그인 화면 ────────────────────────────
  console.log('[2] 로그인 화면');
  await setupConfig(page);
  await page.waitForTimeout(1000);

  const isLoginPage = await page.locator('text=WAWA ERP 로그인').isVisible({ timeout: 5000 }).catch(() => false);
  if (isLoginPage) {
    // 선생님 드롭다운 로딩 대기
    const teacherSelect = page.locator('select.search-input').first();
    await teacherSelect.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      if (await teacherSelect.locator('option').count() > 1) break;
    }
    await shot(page, '02_로그인_화면');
  }

  // ── 3. 로그인 완료 후 메인 화면 ─────────────────────────
  console.log('[3] 로그인 → 메인 화면');
  await login(page, '서재용', '1141');
  await shot(page, '03_메인_화면_로그인완료');

  // ── 4. 리포트 대시보드 ───────────────────────────────
  console.log('[4] 리포트 대시보드');
  await page.goto('/#/report');
  await waitForLoad(page, 5000);
  await shot(page, '04_리포트_대시보드');

  // ── 5. 시험 관리 페이지 ───────────────────────────────
  console.log('[5] 시험 관리');
  await page.goto('/#/report/exams');
  await waitForLoad(page, 8000);
  await shot(page, '05_시험관리_목록');

  // 시험 일정 탭
  const scheduleTab = page.locator('[data-testid="tab-schedules"], button:has-text("시험 일정")').first();
  if (await scheduleTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await scheduleTab.click();
    await page.waitForTimeout(1000);
    await shot(page, '05b_시험관리_일정탭');
  }

  // ── 6. 점수 입력 - 학생 목록 ─────────────────────────
  console.log('[6] 점수 입력 - 학생 목록');
  await page.goto('/#/report/input');
  await waitForLoad(page, 8000);
  await shot(page, '06_점수입력_학생목록');

  // ── 7. 점수 입력 - 정지효 학생 선택 ─────────────────────
  console.log('[7] 점수 입력 - 정지효 학생 선택');
  await page.waitForSelector('.badge', { timeout: 30000 }).catch(() => {});

  // 정지효 검색 후 클릭
  const searchInput = page.locator('input.search-input, input[placeholder*="검색"]').first();
  if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchInput.fill('정지효');
    await page.waitForTimeout(1000);
  }

  const jihyoItem = page.locator('div:has(> div > div:text-is("정지효"))').first();
  const jihyoExists = await jihyoItem.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`  정지효 발견: ${jihyoExists}`);

  if (jihyoExists) {
    await jihyoItem.click();
    await page.waitForTimeout(2000);
    await shot(page, '07_점수입력_정지효_선택');

    // 점수 입력
    const scoreInputs = page.locator('input[type="number"]');
    const inputCount = await scoreInputs.count();
    console.log(`  점수 입력란 ${inputCount}개`);
    if (inputCount > 0) {
      await scoreInputs.first().fill('88');
      if (inputCount > 1) await scoreInputs.nth(1).fill('95');
      if (inputCount > 2) await scoreInputs.nth(2).fill('82');
      if (inputCount > 3) await scoreInputs.nth(3).fill('91');
      await page.waitForTimeout(500);
      await shot(page, '08_점수입력_정지효_점수입력중');

      // 저장 버튼 클릭 → 토스트 알림 캡처
      const saveBtn = page.locator('button:has-text("저장")').first();
      if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        // 토스트가 뜨는 타이밍에 캡처
        await page.waitForTimeout(800);
        await shot(page, '08b_점수입력_저장완료_토스트');
        console.log('  📸 저장: 08b_점수입력_저장완료_토스트.png');
        await page.waitForTimeout(1500);
      }
    }
  } else {
    // 정지효 없으면 첫 번째 학생으로 대체
    const studentItems = page.locator('div').filter({ has: page.locator('.badge') });
    const count = await studentItems.count();
    console.log(`  대체 학생 아이템 ${count}개`);
    if (count > 0) {
      await studentItems.first().click();
      await page.waitForTimeout(2000);
      await shot(page, '07_점수입력_정지효_선택');
    }
  }

  // ── 8. 성적표 미리보기 ────────────────────────────────
  console.log('[8] 성적표 미리보기');
  await page.goto('/#/report/preview');
  await waitForLoad(page, 8000);
  await shot(page, '09_성적표_미리보기');

  // 첫 번째 학생 클릭
  const previewStudents = page.locator('[class*="student"]').first();
  if (await previewStudents.isVisible({ timeout: 5000 }).catch(() => false)) {
    await previewStudents.click();
    await page.waitForTimeout(3000);
    await shot(page, '09b_성적표_차트_상세');
  }

  // ── 9. 전역 설정 ─────────────────────────────────────
  console.log('[9] 전역 설정');
  await page.goto('/#/settings');
  await waitForLoad(page, 3000);
  await shot(page, '10_전역설정');

  // ── 10. 사이드바 확대 ────────────────────────────────
  console.log('[10] 사이드바 메뉴');
  await page.goto('/#/report/input');
  await waitForLoad(page, 3000);
  // 사이드바만 크롭
  const sidebar = page.locator('.sidebar');
  if (await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sidebar.screenshot({ path: path.join(PPT_SCREENSHOT_DIR, '11_사이드바_메뉴.png') });
    console.log('  📸 저장: 11_사이드바_메뉴.png');
  }

  console.log(`\n✅ PPT 스크린샷 캡처 완료! → ${PPT_SCREENSHOT_DIR}`);
});
