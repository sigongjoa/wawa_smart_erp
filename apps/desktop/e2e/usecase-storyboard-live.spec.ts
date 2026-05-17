/**
 * Use Case storyboard 보조 스크린샷 — 4개 시나리오의 step-by-step 흐름.
 *
 * UC1: 결석 → 보강 → 완료
 * UC2: 시험 → 성적 → 리포트
 * UC3: 타이머 → 체크인 → 진도
 * UC4: 학생 메모 → 상담 → 인수인계
 *
 * 결과 위치: docs/screenshots/usecases/uc{1-4}-{step}.png
 */
import { test, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';
const OUT = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots', 'usecases');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };

async function login(page: Page, name = '하이머딩거') {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  const sel = page.locator('select').first();
  await sel.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => {
    const s = document.querySelector('select') as HTMLSelectElement | null;
    return !!s && s.options.length > 1;
  }, null, { timeout: 10000 }).catch(() => {});
  try { await sel.selectOption({ value: 'test-canyon' }); }
  catch { await sel.selectOption({ index: 1 }).catch(() => {}); }
  await page.waitForTimeout(300);
  await page.locator('#login-name').fill(name);
  await page.locator('#login-pin').fill('1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/(timer|board|student|absence|report|settings|exams|materials|meeting|gacha)/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  if (await page.locator('#login-name').isVisible({ timeout: 500 }).catch(() => false)) {
    await page.locator('#login-name').fill(name);
    await page.locator('#login-pin').fill('1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);
  }
}

async function shotClip(page: Page, name: string, clip: { x: number; y: number; width: number; height: number }) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
  console.log(`  ✅ ${name}.png  (${clip.width}×${clip.height})`);
}

test.use({ viewport: VIEWPORT });

test.describe('UC storyboard 캡처', () => {
  test.setTimeout(360_000);

  // UC1 step1 — 결석 추가 모달
  test('UC1-1 · 결석 추가 입력', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/absence`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const addBtn = page.locator('button:has-text("결석 추가")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1200);
      // 모달 + 폼이 보이는 영역
      await shotClip(page, 'uc1-1-add', { x: 0, y: 0, width: 1440, height: 900 });
    } else {
      await shotClip(page, 'uc1-1-add', { x: 0, y: 60, width: 1440, height: 760 });
    }
  });

  // UC1 step3 — 완료 처리된 보강 (완료 탭)
  test('UC1-3 · 보강 완료 상태', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/absence`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const doneTab = page.locator('button.filter-btn:has-text("완료")').first();
    if (await doneTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await doneTab.click();
      await page.waitForTimeout(1500);
    }
    await shotClip(page, 'uc1-3-done', { x: 0, y: 60, width: 1440, height: 720 });
  });

  // UC2 step2 — 성적 입력 (시험 탭에서 성적 페이지로)
  test('UC2-2 · 성적 입력', async ({ page }) => {
    await login(page);
    // 성적 입력 라우트 후보들 시도
    const candidates = ['/#/exam-scores', '/#/scores', '/#/grade', '/#/exams'];
    for (const r of candidates) {
      await page.goto(`${BASE}${r}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1200);
      const hasScoreInput = await page.locator('input[type="number"], input[placeholder*="점수"], input[placeholder*="점"]').first().isVisible({ timeout: 1500 }).catch(() => false);
      if (hasScoreInput) break;
    }
    // 가장 가능성 높은 데이터가 있을 영역
    await shotClip(page, 'uc2-2-grade', { x: 0, y: 60, width: 1440, height: 760 });
  });

  // UC3 step2 — 타이머에서 체크인 (수업 진행 패널)
  test('UC3-2 · 수업 진행 패널', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/timer`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // 첫 번째 대기 학생 카드 클릭 → 수업 시작
    const firstStudent = page.locator('.timer-page button, [class*="student"]').first();
    if (await firstStudent.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstStudent.click({ trial: true }).catch(() => {});
    }
    await page.waitForTimeout(1200);
    // 우측 수업 진행 패널 클립
    await shotClip(page, 'uc3-2-checkin', { x: 600, y: 100, width: 840, height: 700 });
  });

  // UC3 step3 — 학생 진도 (직접 학생 ID로 접근)
  test('UC3-3 · 학생 진도', async ({ page }) => {
    await login(page);
    // 먼저 학생 리스트로 이동해 첫 학생 ID 추출
    await page.goto(`${BASE}/#/student`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1800);
    // tr 안의 student id 찾기 — 수정 버튼 클릭 대신 데이터에서 추출
    const id = await page.evaluate(() => {
      const tr = document.querySelector('tbody tr');
      if (!tr) return null;
      // data-id, data-student-id 등 후보
      const dataId = tr.getAttribute('data-id') || tr.getAttribute('data-student-id');
      if (dataId) return dataId;
      // a[href*="/student/"] 검색
      const a = document.querySelector('a[href*="/student/"]') as HTMLAnchorElement | null;
      if (a) {
        const m = a.href.match(/\/student\/([^/?#]+)/);
        if (m) return m[1];
      }
      return null;
    });
    if (id) {
      await page.goto(`${BASE}/#/student/${id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
    await shotClip(page, 'uc3-3-progress', { x: 0, y: 60, width: 1440, height: 760 });
  });

  // UC4 step2 — 학생 메모 영역
  test('UC4-2 · 학생 메모', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/student`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1800);
    const id = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/student/"]') as HTMLAnchorElement | null;
      if (a) {
        const m = a.href.match(/\/student\/([^/?#]+)/);
        if (m) return m[1];
      }
      const tr = document.querySelector('tbody tr');
      return tr?.getAttribute('data-id') || tr?.getAttribute('data-student-id') || null;
    });
    if (id) {
      await page.goto(`${BASE}/#/student/${id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
    // 페이지 중앙~하단 (메모 영역 가능성)
    await shotClip(page, 'uc4-2-memo', { x: 0, y: 320, width: 1440, height: 580 });
  });

  // UC4 step3 — 학생 히스토리
  test('UC4-3 · 학생 히스토리', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/student`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1800);
    const id = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/student/"]') as HTMLAnchorElement | null;
      if (a) {
        const m = a.href.match(/\/student\/([^/?#]+)/);
        if (m) return m[1];
      }
      const tr = document.querySelector('tbody tr');
      return tr?.getAttribute('data-id') || tr?.getAttribute('data-student-id') || null;
    });
    if (id) {
      await page.goto(`${BASE}/#/student/${id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(800);
    }
    await shotClip(page, 'uc4-3-history', { x: 0, y: 0, width: 1440, height: 760 });
  });
});
