/**
 * PPT 유즈케이스 가이드용 — 상세 인터랙션 스크린샷
 * 협곡점 하이머딩거 로그인 → 각 기능별 실제 조작 스크린샷
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'https://wawa-smart-erp.pages.dev';
const DIR = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots');

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

async function shot(page: any, name: string, fullPage = true) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage });
  console.log(`  ✅ ${name}.png`);
}

async function login(page: any, name: string) {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const sel = page.locator('select').first();
  if (await sel.isVisible({ timeout: 5000 }).catch(() => false)) {
    await sel.selectOption({ value: 'test-canyon' });
    await page.waitForTimeout(500);
  }
  await page.locator('#login-name').fill(name);
  await page.locator('#login-pin').fill('1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
}

// ═══════════════════════════════════════════════
test.describe('PPT 스크린샷 — 상세 인터랙션', () => {
  test.setTimeout(300_000); // 5분

  test('수업 — 타이머 시작/정지/재개/퇴근', async ({ page }) => {
    await login(page, '하이머딩거');

    // 1) 타이머 기본 화면
    await page.goto(`${BASE}/#/timer`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shot(page, '01-timer-home');

    // 2) 학생 카드 클릭 → 수업 시작 (럭스)
    const waitingCard = page.locator('[data-testid^="waiting-card-"]').first();
    if (await waitingCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await waitingCard.click();
      await page.waitForTimeout(2000);
      await shot(page, '01-timer-session-started');
    }

    // 3) 정지 버튼 클릭 → 사유 선택 바텀시트
    const pauseBtn = page.locator('button:has-text("정지")').first();
    if (await pauseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pauseBtn.click();
      await page.waitForTimeout(800);
      await shot(page, '01-timer-pause-sheet');

      // 사유 선택 (화장실)
      const reasonBtn = page.locator('.rt-pause-option:has-text("화장실")').first();
      if (await reasonBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await reasonBtn.click();
        await page.waitForTimeout(1500);
        await shot(page, '01-timer-paused');
      }
    }

    // 4) 재개 버튼
    const resumeBtn = page.locator('button:has-text("재개")').first();
    if (await resumeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resumeBtn.click();
      await page.waitForTimeout(1500);
      await shot(page, '01-timer-resumed');
    }

    // 5) 완료 버튼 (첫 번째만)
    const doneBtn = page.locator('.rt-action-btn--done').first();
    if (await doneBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await doneBtn.click();
      await page.waitForTimeout(2000);
      await shot(page, '01-timer-session-done');
    }

    // 퇴근 스크린샷은 세션 상태에 의존하므로 스킵
    // (이미 정지/재개/완료 인터랙션 스크린샷은 충분)
  });

  test('평가 — 성적입력/코멘트/리포트 미리보기', async ({ page }) => {
    await login(page, '하이머딩거');

    await page.goto(`${BASE}/#/report`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shot(page, '02-report-home');

    // 학생 선택 (럭스)
    const studentRow = page.locator('tr.send-row:has-text("럭스")').first();
    if (await studentRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studentRow.click();
      await page.waitForTimeout(2000);
      await shot(page, '02-report-student-selected');
    }

    // 성적 입력 (첫 번째 과목)
    const scoreInput = page.locator('input.rpt-score-input').first();
    if (await scoreInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoreInput.fill('85');
      await scoreInput.blur();
      await page.waitForTimeout(1500);
      await shot(page, '02-report-score-entered');
    }

    // 코멘트 입력
    const commentArea = page.locator('textarea.rpt-comment').first();
    if (await commentArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentArea.fill('방정식 기초가 많이 개선되었습니다. 연립방정식으로 넘어가도 좋을 것 같습니다.');
      await page.waitForTimeout(1500);
      await shot(page, '02-report-comment-written');
    }

    // JPG 다운로드 → 리포트 프리뷰가 나타남
    const downloadBtn = page.locator('button:has-text("JPG 다운로드")').first();
    if (await downloadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 다운로드 이벤트 핸들링
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
        downloadBtn.click(),
      ]);
      await page.waitForTimeout(3000);
      await shot(page, '02-report-preview');

      // 다운로드된 파일 저장
      if (download) {
        const savePath = path.join(DIR, '02-report-downloaded.jpg');
        await download.saveAs(savePath);
        console.log(`  ✅ 02-report-downloaded.jpg (실제 리포트)`);
      }
    }

    // 카카오톡 공유 버튼
    const shareBtn = page.locator('button:has-text("카카오톡 공유")').first();
    if (await shareBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shareBtn.click();
      await page.waitForTimeout(3000);
      await shot(page, '02-report-share');
    }
  });

  test('교재 — 프린트 관리', async ({ page }) => {
    await login(page, '하이머딩거');

    await page.goto(`${BASE}/#/materials`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shot(page, '03-materials-home');

    // 미완료 필터
    const incompleteFilter = page.locator('button:has-text("미완료")').first();
    if (await incompleteFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await incompleteFilter.click();
      await page.waitForTimeout(1500);
      await shot(page, '03-materials-incomplete');
    }

    // 완료 필터
    const completeFilter = page.locator('button:has-text("완료")').first();
    if (await completeFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await completeFilter.click();
      await page.waitForTimeout(1500);
      await shot(page, '03-materials-completed');
    }
  });

  test('보강 — 결석/보강 관리 인터랙션', async ({ page }) => {
    await login(page, '하이머딩거');

    await page.goto(`${BASE}/#/absence`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shot(page, '04-absence-home');

    // 미보강 필터
    const pendingFilter = page.locator('button.filter-btn:has-text("미보강")').first();
    if (await pendingFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingFilter.click();
      await page.waitForTimeout(1500);
      await shot(page, '04-absence-pending');
    }

    // 보강예정 필터
    const scheduledFilter = page.locator('button.filter-btn:has-text("보강예정")').first();
    if (await scheduledFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scheduledFilter.click();
      await page.waitForTimeout(1500);
      await shot(page, '04-absence-scheduled');
    }

    // 전체로 돌아가기
    const allFilter = page.locator('button.filter-btn:has-text("전체")').first();
    if (await allFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await allFilter.click();
      await page.waitForTimeout(1500);
    }

    // 보강일 지정 — 미보강 항목에 날짜 넣고 지정
    const dateInput = page.locator('input.date-input').first();
    if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateInput.fill('2026-04-19');
      await page.waitForTimeout(800);
      await shot(page, '04-absence-date-entered');

      const assignBtn = page.locator('button:has-text("지정")').first();
      if (await assignBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await assignBtn.click();
        await page.waitForTimeout(2000);
        await shot(page, '04-absence-scheduled-done');
      }
    }
  });

  test('학생 — 프로필 & 피드백', async ({ page }) => {
    await login(page, '하이머딩거');

    await page.goto(`${BASE}/#/student`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shot(page, '05-student-list');

    // 학생 카드 클릭 (야스오)
    const yasuo = page.locator('button.student-card:has-text("야스오")').first();
    if (await yasuo.isVisible({ timeout: 3000 }).catch(() => false)) {
      await yasuo.click();
      await page.waitForTimeout(2500);
      await shot(page, '05-student-profile-yasuo');

      // 12개월 토글
      const yearBtn = page.locator('button:has-text("12개월")').first();
      if (await yearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await yearBtn.click();
        await page.waitForTimeout(1500);
        await shot(page, '05-student-profile-12month');
      }
    }

    // 뒤로 → 이즈리얼 프로필
    await page.goto(`${BASE}/#/student`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const ezreal = page.locator('button.student-card:has-text("이즈리얼")').first();
    if (await ezreal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ezreal.click();
      await page.waitForTimeout(2500);
      await shot(page, '05-student-profile-ezreal');
    }
  });

  test('보드 — 공지/할일 관리', async ({ page }) => {
    await login(page, '하이머딩거');

    await page.goto(`${BASE}/#/board`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shot(page, '06-board-home');

    // 할일 체크박스 토글 (첫 번째 미완료 항목)
    const checkbox = page.locator('button.board-check:not(.board-check--done)').first();
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkbox.click();
      await page.waitForTimeout(1500);
      await shot(page, '06-board-task-checked');
    }

    // + 공지 작성 버튼 → 모달
    const noticeBtn = page.locator('button:has-text("공지 작성")').first();
    if (await noticeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await noticeBtn.click();
      await page.waitForTimeout(1500);
      await shot(page, '06-board-notice-modal');

      // 취소
      const cancelBtn = page.locator('.modal-content button:has-text("취소")').first();
      if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // + 할일 버튼 → 모달
    const todoBtn = page.locator('button:has-text("+ 할일")').first();
    if (await todoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await todoBtn.click();
      await page.waitForTimeout(1500);
      await shot(page, '06-board-todo-modal');
    }
  });
});
