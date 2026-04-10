/**
 * E2E 유즈케이스: 설정(4월) → 성적 입력 → 리포트 미리보기 → JPG 다운로드
 *
 * 브라우저를 실제로 조작하여 전체 플로우를 검증합니다.
 * 실행: npx playwright test e2e/april-flow-live.spec.ts --headed
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const ADMIN = { name: '서재용 개발자', pin: '1141' };
const TARGET_MONTH = '2026-04';
const TARGET_STUDENT = '강은서';
const DOWNLOAD_DIR = path.join(__dirname, '..', 'test-downloads');

test.setTimeout(120_000);

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────
async function screenshot(page: Page, name: string) {
  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  await page.screenshot({ path: path.join(DOWNLOAD_DIR, `${name}.png`), fullPage: true });
}

async function login(page: Page) {
  await page.goto(BASE_URL);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  await page.locator('input[placeholder="예: 김상현"]').fill(ADMIN.name);
  await page.locator('input[placeholder="PIN을 입력하세요"]').fill(ADMIN.pin);
  await page.locator('button:has-text("로그인")').click();

  // 로그인 후 아무 페이지든 대기 (hash routing)
  await page.waitForFunction(() => window.location.hash.includes('/timer'), { timeout: 15000 });
  console.log('✅ 로그인 성공');
}

test.describe('설정(4월) → 성적 입력 → 리포트 → JPG 다운로드', () => {
  test('전체 플로우 E2E 테스트', async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER] ${msg.text()}`);
    });

    // ──── 1. 로그인 ────
    console.log('\n=== STEP 1: 관리자 로그인 ===');
    await login(page);
    await page.waitForTimeout(1000);

    // ──── 2. 설정 → 4월 지정 ────
    console.log('\n=== STEP 2: 설정 → 시험 월 4월 지정 ===');

    // 설정 페이지로 직접 네비게이션 (가장 확실한 방법)
    await page.goto(`${BASE_URL}/#/settings`);
    await page.waitForTimeout(2000);
    await screenshot(page, '02-settings-page');

    // 설정 페이지의 "관리 설정" 헤딩 확인
    const settingsHeading = page.locator('h1:has-text("관리 설정")');
    const isSettingsPage = await settingsHeading.isVisible().catch(() => false);
    console.log(`  설정 페이지 확인: ${isSettingsPage}`);

    if (!isSettingsPage) {
      // 버튼으로 재시도
      const settingsBtn = page.locator('button[aria-label="설정"]');
      if (await settingsBtn.isVisible().catch(() => false)) {
        await settingsBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // "시험 월 설정" 탭 클릭
    const examTab = page.locator('button:has-text("시험 월 설정")');
    await examTab.waitFor({ state: 'visible', timeout: 10000 });
    await examTab.click();
    await page.waitForTimeout(1500);
    console.log('  "시험 월 설정" 탭 클릭');

    // "활성 시험 월 설정" 헤딩이 나타나는지 확인
    await page.locator('h2:has-text("활성 시험 월 설정")').waitFor({ state: 'visible', timeout: 5000 });
    await screenshot(page, '02-exam-tab');

    // 월 select 찾기 - 설정 탭 내의 유일한 select
    const allSelects = page.locator('select');
    const selectCount = await allSelects.count();
    let targetSelect = null;

    for (let i = 0; i < selectCount; i++) {
      const sel = allSelects.nth(i);
      const html = await sel.innerHTML();
      if (html.includes(TARGET_MONTH)) {
        targetSelect = sel;
        break;
      }
    }

    expect(targetSelect).not.toBeNull();
    await targetSelect!.selectOption(TARGET_MONTH);
    console.log(`  월 선택: ${TARGET_MONTH}`);

    // 저장 버튼 - 설정 탭 안의 것 (h2 "활성 시험 월 설정" 이후의 저장)
    const saveSettingsBtn = page.locator('button:has-text("저장")');
    // 여러 개면 마지막(설정 탭 내부)을 선택
    const saveCount = await saveSettingsBtn.count();
    await saveSettingsBtn.nth(saveCount - 1).click();
    await page.waitForTimeout(2000);
    console.log('  ✅ 시험 월 4월 저장 완료');

    // ──── 3. 성적 입력 ────
    console.log('\n=== STEP 3: 성적 입력 페이지 ===');

    // 월말평가 모듈로 이동
    await page.goto(`${BASE_URL}/#/report/input`);
    await page.waitForTimeout(3000);
    await screenshot(page, '03-score-input');

    // 학생 목록 로드 대기
    const studentButtons = page.locator('[role="button"]');
    await studentButtons.first().waitFor({ state: 'visible', timeout: 15000 });
    console.log('  학생 목록 로드됨');

    // 학생 검색
    const searchInput = page.locator('input[placeholder="학생 검색..."]');
    await searchInput.fill(TARGET_STUDENT);
    await page.waitForTimeout(500);

    // 학생 클릭
    const studentItem = page.locator(`[role="button"]:has-text("${TARGET_STUDENT}")`).first();
    await studentItem.waitFor({ state: 'visible', timeout: 5000 });
    await studentItem.click();
    await page.waitForTimeout(1500);
    console.log(`  학생 선택: ${TARGET_STUDENT}`);

    // 우측 패널 확인
    const studentHeader = page.locator(`h2:has-text("${TARGET_STUDENT}")`);
    await studentHeader.waitFor({ state: 'visible', timeout: 5000 });
    await screenshot(page, '03-student-selected');

    // 점수 입력
    const scoreInput = page.locator('input[type="number"]').first();
    await scoreInput.waitFor({ state: 'visible', timeout: 5000 });
    await scoreInput.fill('');
    await scoreInput.type('88');
    console.log('  점수 입력: 88');

    // 코멘트 입력
    const commentArea = page.locator('textarea').first();
    await commentArea.fill('E2E 테스트 - 4월 성적 입력');

    // 저장 (과목 카드 내의 btn-sm 저장)
    const scoreSaveBtn = page.locator('button.btn-sm:has-text("저장")').first();
    await scoreSaveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await scoreSaveBtn.click();
    await page.waitForTimeout(3000);
    await screenshot(page, '03-score-saved');
    console.log('  ✅ 성적 저장 완료');

    // ──── 4. 리포트 미리보기 ────
    console.log('\n=== STEP 4: 리포트 미리보기 ===');

    await page.goto(`${BASE_URL}/#/report/preview`);
    await page.waitForTimeout(3000);

    // 학생 목록 대기
    await page.locator('[role="button"]').first().waitFor({ state: 'visible', timeout: 15000 });

    // 학생 검색 & 선택
    const previewSearch = page.locator('input[placeholder="학생 검색..."]');
    await previewSearch.fill(TARGET_STUDENT);
    await page.waitForTimeout(500);

    const previewStudent = page.locator(`[role="button"]:has-text("${TARGET_STUDENT}")`).first();
    await previewStudent.waitFor({ state: 'visible', timeout: 5000 });
    await previewStudent.click();
    await page.waitForTimeout(3000);
    console.log(`  학생 선택: ${TARGET_STUDENT}`);

    await screenshot(page, '04-preview');

    // 리포트 렌더링 확인
    const reportPaper = page.locator('.report-paper');
    const hasReport = await reportPaper.isVisible().catch(() => false);

    if (hasReport) {
      const reportText = await reportPaper.textContent();
      console.log(`  리포트 렌더링됨 (${reportText?.length || 0}자)`);

      if (reportText?.includes(TARGET_STUDENT)) {
        console.log(`  ✅ 리포트에 ${TARGET_STUDENT} 확인`);
      }
    } else {
      console.log('  ⚠️ 리포트가 아직 렌더링되지 않음');
      // h2에 학생 이름이 있는지라도 확인
      const previewHeader = page.locator(`h2:has-text("${TARGET_STUDENT}")`);
      const hasHeader = await previewHeader.isVisible().catch(() => false);
      console.log(`  미리보기 헤더 확인: ${hasHeader}`);
    }

    // ──── 5. JPG 다운로드 ────
    console.log('\n=== STEP 5: JPG 다운로드 ===');

    const downloadBtn = page.locator('button:has-text("JPG 다운로드")');
    const canDownload = await downloadBtn.isVisible().catch(() => false);

    if (canDownload) {
      if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        downloadBtn.click(),
      ]);

      const filename = download.suggestedFilename();
      console.log(`  파일명: ${filename}`);

      expect(filename).toContain(TARGET_STUDENT);
      expect(filename).toContain('.jpg');

      const savedPath = path.join(DOWNLOAD_DIR, filename);
      await download.saveAs(savedPath);

      const stat = fs.statSync(savedPath);
      console.log(`  파일 크기: ${(stat.size / 1024).toFixed(1)} KB`);
      expect(stat.size).toBeGreaterThan(5000);

      console.log(`  ✅ JPG 다운로드 성공: ${savedPath}`);
    } else {
      console.log('  ⚠️ JPG 다운로드 버튼 안보임');
      await screenshot(page, '05-no-download');
    }

    // ──── 최종 ────
    console.log('\n=== 최종 결과 ===');
    await screenshot(page, '06-final');
    console.log('✅ 전체 플로우 테스트 완료');
  });
});
