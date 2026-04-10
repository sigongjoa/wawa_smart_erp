import { test, expect, Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_PATH = path.join(__dirname, '..', '.playwright', 'auth.json');
const BASE = 'https://wawa-smart-erp.pages.dev';

test.setTimeout(60000);

// 학생 테이블 로딩 대기
async function waitForStudentTable(page: Page) {
  await page.waitForSelector('.send-table tbody .send-row', { timeout: 15000 });
}

test.describe('월말평가 전송 시스템 E2E', () => {
  test.describe.configure({ mode: 'serial' });

  // ── UC1: 로그인 ──
  test('UC1: 프로덕션 로그인', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('.login-card', { timeout: 15000 });
    await page.fill('#name', '서재용 개발자');
    await page.fill('#pin', '1141');
    await page.click('button[type="submit"]');

    // 로그인 후 헤더가 보일 때까지 대기
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 20000 });

    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeTruthy();

    const dir = path.dirname(STORAGE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await page.context().storageState({ path: STORAGE_PATH });
  });

  // ── UC2: 리포트 페이지 진입 — 분할 레이아웃 렌더링 ──
  test('UC2: 리포트 페이지 분할 레이아웃 표시', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/#/report`);
    await page.waitForSelector('.report-split', { timeout: 15000 });

    // 좌측 학생 테이블 존재
    await expect(page.locator('.report-left .send-table')).toBeVisible();

    // 우측 리포트 미리보기 영역 존재
    await expect(page.locator('.report-right .report-paper')).toBeVisible();

    // 페이지 헤더에 월 뱃지 표시
    await expect(page.locator('.report-month-badge')).toBeVisible();

    // 전송 현황 진행률 표시
    await expect(page.locator('.report-progress')).toBeVisible();

    await ctx.close();
  });

  // ── UC3: 학생 테이블에 데이터 로드 ──
  test('UC3: 학생 테이블 데이터 로드', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/#/report`);
    await waitForStudentTable(page);

    // 학생 행이 1개 이상 존재
    const rows = page.locator('.send-table tbody .send-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // 각 행에 이름, 성적, 전송상태 셀 존재
    const firstRow = rows.first();
    await expect(firstRow.locator('.send-cell-name')).toBeVisible();
    await expect(firstRow.locator('.send-cell-score')).toBeVisible();
    await expect(firstRow.locator('.send-cell-status')).toBeVisible();

    // 전송 뱃지 텍스트 확인 (전송됨 or 미전송)
    const badge = firstRow.locator('.send-badge');
    const badgeText = await badge.textContent();
    expect(['전송됨', '미전송']).toContain(badgeText?.trim());

    await ctx.close();
  });

  // ── UC4: 학생 클릭 시 우측 리포트 미리보기 표시 ──
  test('UC4: 학생 선택 → 리포트 미리보기', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/#/report`);
    await waitForStudentTable(page);

    // 선택 전: 빈 상태 표시
    await expect(page.locator('.report-empty')).toBeVisible();

    // 첫 번째 학생 클릭
    await page.locator('.send-table tbody .send-row').first().click();

    // 선택된 행 하이라이트
    await expect(page.locator('.send-row--active')).toBeVisible();

    // 리포트 헤더 표시 (학원명)
    await expect(page.locator('.rpt-header')).toBeVisible({ timeout: 10000 });

    // 학생 이름 표시
    await expect(page.locator('.rpt-student-name')).toBeVisible();

    // 액션 버튼 표시
    await expect(page.locator('.report-actions')).toBeVisible();
    await expect(page.locator('button:has-text("JPG 다운로드")')).toBeVisible();
    await expect(page.locator('button:has-text("카카오톡 공유")')).toBeVisible();

    await ctx.close();
  });

  // ── UC5: 성적 입력 시 코멘트 유지 (버그 수정 검증) ──
  test('UC5: 성적 수정 후 코멘트 유지', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/#/report`);
    await waitForStudentTable(page);

    // 첫 번째 학생 선택
    await page.locator('.send-table tbody .send-row').first().click();
    await page.waitForSelector('.rpt-detail-card', { timeout: 10000 });

    // 첫 번째 과목의 코멘트 textarea에 테스트 텍스트 입력
    const comment = page.locator('.rpt-comment').first();
    const scoreInput = page.locator('.rpt-score-input').first();

    if (await comment.isVisible() && await scoreInput.isVisible()) {
      // 기존 코멘트 기록
      const originalComment = await comment.inputValue();

      // 점수 변경 후 blur
      await scoreInput.click();
      await scoreInput.fill('85');
      await comment.click(); // blur 트리거

      // 1.5초 대기 (API 저장 완료)
      await page.waitForTimeout(1500);

      // 코멘트가 그대로 유지되는지 확인
      const afterComment = await comment.inputValue();
      expect(afterComment).toBe(originalComment);
    }

    await ctx.close();
  });

  // ── UC6: 다른 학생 전환 시 리포트 갱신 ──
  test('UC6: 학생 전환 시 리포트 갱신', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/#/report`);
    await waitForStudentTable(page);

    const rows = page.locator('.send-table tbody .send-row');
    const count = await rows.count();

    if (count >= 2) {
      // 첫 번째 학생 클릭
      await rows.nth(0).click();
      await page.waitForSelector('.rpt-student-name', { timeout: 10000 });
      const name1 = await page.locator('.rpt-student-name').textContent();

      // 두 번째 학생 클릭
      await rows.nth(1).click();
      await page.waitForTimeout(500);
      const name2 = await page.locator('.rpt-student-name').textContent();

      // 이름이 변경되어야 함
      expect(name1).not.toBe(name2);

      // 두 번째 학생 행이 active
      await expect(rows.nth(1)).toHaveClass(/send-row--active/);
      // 첫 번째는 active 아님
      const firstClass = await rows.nth(0).getAttribute('class');
      expect(firstClass).not.toContain('send-row--active');
    }

    await ctx.close();
  });

  // ── UC7: 전송 현황 진행률 표시 ──
  test('UC7: 전송 현황 카운터', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/#/report`);
    await waitForStudentTable(page);

    // 전송 현황 값 (예: "0/48")
    const progressValue = page.locator('.report-progress-value');
    await expect(progressValue).toBeVisible();
    const text = await progressValue.textContent();
    expect(text).toMatch(/^\d+\/\d+$/);

    // 프로그레스 바 존재
    await expect(page.locator('.report-progress-bar')).toBeVisible();

    await ctx.close();
  });

  // ── UC8: 모바일 뷰포트 대응 ──
  test('UC8: 모바일 반응형 레이아웃', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: STORAGE_PATH,
      viewport: { width: 375, height: 812 },
    });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/#/report`);
    await waitForStudentTable(page);

    // 모바일에서도 테이블 표시
    await expect(page.locator('.send-table')).toBeVisible();

    // 학생 클릭 시 리포트도 표시 (상하 스택)
    await page.locator('.send-table tbody .send-row').first().click();
    await page.waitForSelector('.rpt-header', { timeout: 10000 });
    await expect(page.locator('.report-paper')).toBeVisible();

    await ctx.close();
  });

  // ── UC9: 에러 없이 페이지 로드 (콘솔 에러 체크) ──
  test('UC9: 콘솔 에러 없음', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_PATH });
    const page = await ctx.newPage();

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE}/#/report`);
    await page.waitForTimeout(3000);

    // TypeError, ReferenceError 등 치명적 에러 없어야 함
    const criticalErrors = errors.filter(
      (e) => e.includes('TypeError') || e.includes('ReferenceError') || e.includes('Cannot read')
    );
    expect(criticalErrors).toHaveLength(0);

    await ctx.close();
  });
});
