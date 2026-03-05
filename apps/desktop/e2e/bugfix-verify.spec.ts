import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(__dirname, 'test-config.json');
const NOTION_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const REPORT_DIR = path.join(__dirname, '../../reports/bugfix-verify');
const ASSETS_DIR = path.join(REPORT_DIR, 'assets');

function ensureDirs() {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

async function shot(page: Page, name: string): Promise<string> {
  const filePath = path.join(ASSETS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  📸 ${name}.png`);
  return filePath;
}

async function setupConfig(page: Page) {
  const isSetup = await page.locator('text=시스템 초기 설정').isVisible({ timeout: 5000 }).catch(() => false);
  if (!isSetup) return;
  console.log('  [setup] 초기 설정 화면 감지 — 설정 파일 업로드');
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
  const tempPath = path.join(__dirname, '_temp_bugfix_config.json');
  fs.writeFileSync(tempPath, JSON.stringify(configForUpload, null, 2));
  await page.locator('input[type="file"][accept=".json"]').setInputFiles(tempPath);
  await page.waitForTimeout(3000);
  const spinner = page.locator('text=Notion 데이터 연동 중');
  if (await spinner.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  [setup] Notion 연동 중...');
    await spinner.waitFor({ state: 'hidden', timeout: 120000 });
  }
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  await page.waitForTimeout(3000);
  console.log('  [setup] 완료');
}

async function login(page: Page) {
  const isLogin = await page.locator('text=WAWA ERP 로그인').isVisible({ timeout: 10000 }).catch(() => false);
  if (!isLogin) {
    console.log('  [login] 로그인 화면 없음 — 이미 로그인 상태이거나 설정 불완전');
    return;
  }
  console.log('  [login] 로그인 화면 감지');
  const teacherSelect = page.locator('select.search-input').first();
  await teacherSelect.waitFor({ state: 'visible', timeout: 20000 });
  for (let i = 0; i < 20; i++) {
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
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(5000);
  console.log('  [login] 로그인 완료');
}

const results: Array<{ name: string; status: 'PASS' | 'FAIL'; note: string }> = [];

function pass(name: string, note = '') {
  results.push({ name, status: 'PASS', note });
  console.log(`  ✅ PASS: ${name}`);
}
function fail(name: string, note = '') {
  results.push({ name, status: 'FAIL', note });
  console.log(`  ❌ FAIL: ${name} — ${note}`);
}

// ============================================================
test('버그픽스 검증: 초성검색 + C라벨 제거', async ({ page }) => {
  test.setTimeout(600000);
  ensureDirs();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForTimeout(2000);

  await setupConfig(page);
  await login(page);

  // ── 1. 성적 입력 - 초성 검색 테스트 ──────────────────────
  console.log('\n[1] 성적 입력 초성 검색 테스트');
  await page.goto('/#/report/input');
  await page.waitForTimeout(6000);

  // 로그인 완료 후 사이드바가 보이는지 확인
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30000 });
  console.log('  [input] 사이드바 확인 완료');

  const inputSearch = page.locator('input[placeholder="학생 검색..."]').first();
  await inputSearch.waitFor({ state: 'visible', timeout: 30000 });

  // 일반 검색
  await inputSearch.fill('정지효');
  await page.waitForTimeout(800);
  const fullNameResult = page.locator('div').filter({ hasText: /^정지효$/ }).first();
  const fullNameVisible = await fullNameResult.isVisible({ timeout: 3000 }).catch(() => false);
  await shot(page, '01_성적입력_일반검색_정지효');
  if (fullNameVisible) pass('성적입력 일반검색(정지효)');
  else fail('성적입력 일반검색(정지효)', '정지효 항목이 보이지 않음');

  // 초성 검색
  await inputSearch.fill('');
  await page.waitForTimeout(300);
  await inputSearch.fill('ㅈㅈㅎ');
  await page.waitForTimeout(800);
  const chosungResult = page.locator('div').filter({ hasText: /^정지효$/ }).first();
  const chosungVisible = await chosungResult.isVisible({ timeout: 3000 }).catch(() => false);
  await shot(page, '02_성적입력_초성검색_ㅈㅈㅎ');
  if (chosungVisible) pass('성적입력 초성검색(ㅈㅈㅎ→정지효)');
  else fail('성적입력 초성검색(ㅈㅈㅎ→정지효)', '초성 검색 결과 없음');

  // ── 2. 리포트 미리보기 - 초성 검색 테스트 ────────────────
  console.log('\n[2] 리포트 미리보기 초성 검색 테스트');
  await page.goto('/#/report/preview');
  await page.waitForTimeout(6000);

  const previewSearch = page.locator('input[placeholder="학생 검색..."]').first();
  await previewSearch.waitFor({ state: 'visible', timeout: 30000 });

  await previewSearch.fill('ㅈㅈㅎ');
  await page.waitForTimeout(800);
  const previewChosungResult = page.locator('div').filter({ hasText: /^정지효$/ }).first();
  const previewChosungVisible = await previewChosungResult.isVisible({ timeout: 3000 }).catch(() => false);
  await shot(page, '03_미리보기_초성검색_ㅈㅈㅎ');
  if (previewChosungVisible) pass('미리보기 초성검색(ㅈㅈㅎ→정지효)');
  else fail('미리보기 초성검색(ㅈㅈㅎ→정지효)', '초성 검색 결과 없음');

  // ── 3. 리포트 미리보기 - C 라벨 제거 확인 ───────────────
  console.log('\n[3] 리포트 C라벨 제거 확인');
  await previewSearch.fill('정지효');
  await page.waitForTimeout(800);
  const jihyo = page.locator('div').filter({ hasText: /^정지효$/ }).first();
  if (await jihyo.isVisible({ timeout: 5000 }).catch(() => false)) {
    await jihyo.click();
    await page.waitForTimeout(3000);
    await shot(page, '04_미리보기_정지효_리포트');

    // 난이도 badge가 없어야 함
    const diffBadge = page.locator('.report-paper .badge-c, .report-paper .badge-a, .report-paper .badge-b, .report-paper .badge-d, .report-paper .badge-e, .report-paper .badge-f');
    const badgeCount = await diffBadge.count();
    if (badgeCount === 0) pass('리포트 난이도 라벨 제거', 'badge 없음 확인');
    else fail('리포트 난이도 라벨 제거', `badge ${badgeCount}개 아직 남아있음`);
  } else {
    fail('리포트 C라벨 확인', '정지효를 미리보기에서 찾을 수 없음');
    await shot(page, '04_미리보기_학생없음');
  }

  // ── 최종 결과 저장 ─────────────────────────────────────
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n[결과] 총 ${results.length}건: PASS ${passCount} / FAIL ${failCount}`);

  fs.writeFileSync(
    path.join(REPORT_DIR, 'results.json'),
    JSON.stringify({ results, passCount, failCount, total: results.length }, null, 2)
  );

  expect(failCount).toBe(0);
});
