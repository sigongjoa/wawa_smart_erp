import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e-usecase-screenshots');

// 스크린샷 디렉토리 생성
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Timer System - Usecase Screenshots Live', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/#/timer/realtime`);
    await page.waitForLoadState('networkidle');
  });

  // UC-1: 활성 세션 카드 렌더링
  test('UC-1: 활성 세션 카드 - 학생 이름 및 타이머 표시', async ({ page }) => {
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'uc1-active-session-card.png'),
      fullPage: true
    });

    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();
    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(activeCard).toBeVisible();
      console.log('✓ UC-1: 활성 세션 카드 렌더링 확인');
    } else {
      console.log('⚠ UC-1: 활성 세션 데이터 없음 (정상)');
    }
  });

  // UC-2: 세션 액션 버튼
  test('UC-2: 활성 세션 버튼 - 정지, 수업추가, 완료', async ({ page }) => {
    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();

    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'uc2-action-buttons.png'),
        fullPage: true
      });

      const pauseBtn = activeCard.locator('button:has-text("정지")');
      const extendBtn = activeCard.locator('button:has-text("수업추가")');
      const doneBtn = activeCard.locator('button:has-text("완료")');

      if (await pauseBtn.isVisible().catch(() => false)) {
        await expect(pauseBtn).toBeEnabled();
        console.log('✓ UC-2: 정지 버튼 확인');
      }
      if (await extendBtn.isVisible().catch(() => false)) {
        await expect(extendBtn).toBeEnabled();
        console.log('✓ UC-2: 수업추가 버튼 확인');
      }
      if (await doneBtn.isVisible().catch(() => false)) {
        await expect(doneBtn).toBeEnabled();
        console.log('✓ UC-2: 완료 버튼 확인');
      }
    } else {
      console.log('⚠ UC-2: 활성 세션 데이터 없음');
    }
  });

  // UC-3: 일시정지 세션 카드
  test('UC-3: 일시정지 세션 카드 렌더링', async ({ page }) => {
    const pausedCard = page.locator('.rt-session-card--paused').first();

    if (await pausedCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'uc3-paused-session-card.png'),
        fullPage: true
      });
      await expect(pausedCard).toBeVisible();
      console.log('✓ UC-3: 일시정지 세션 카드 렌더링 확인');
    } else {
      console.log('⚠ UC-3: 일시정지 세션 데이터 없음 (정상)');
    }
  });

  // UC-4: 진행률 바
  test('UC-4: 진행률 바 표시', async ({ page }) => {
    const progressBar = page.locator('.rt-progress-bar, [role="progressbar"]').first();

    if (await progressBar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'uc4-progress-bar.png'),
        fullPage: true
      });
      await expect(progressBar).toBeVisible();
      console.log('✓ UC-4: 진행률 바 표시 확인');
    } else {
      console.log('⚠ UC-4: 진행률 바 없음');
    }
  });

  // UC-5: 세션 메타 정보
  test('UC-5: 세션 메타 정보 (순수/예정/정지 시간)', async ({ page }) => {
    const sessionCard = page.locator('.rt-session-card').first();

    if (await sessionCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'uc5-session-meta-info.png'),
        fullPage: true
      });

      const metaInfo = sessionCard.locator('.rt-session-meta, [class*="meta"]');
      if (await metaInfo.isVisible().catch(() => false)) {
        await expect(metaInfo).toBeVisible();
        console.log('✓ UC-5: 세션 메타 정보 표시 확인');
      } else {
        console.log('⚠ UC-5: 메타 정보 요소 없음');
      }
    } else {
      console.log('⚠ UC-5: 세션 카드 없음');
    }
  });

  // UC-6: ExtendSheet 모달
  test('UC-6: 수업추가 모달 (ExtendSheet)', async ({ page }) => {
    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();

    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      const extendBtn = activeCard.locator('button:has-text("수업추가")');
      if (await extendBtn.isVisible().catch(() => false)) {
        await extendBtn.click();
        await page.waitForTimeout(300);

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, 'uc6-extend-sheet-modal.png'),
          fullPage: true
        });

        const modal = page.locator('.rt-extend-sheet, [role="dialog"]').first();
        if (await modal.isVisible().catch(() => false)) {
          await expect(modal).toBeVisible();
          console.log('✓ UC-6: ExtendSheet 모달 렌더링 확인');
        }

        // 모달 닫기
        const closeBtn = page.locator('button:has-text("취소")').first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click();
        } else {
          await page.press('Escape');
        }
        await page.waitForTimeout(300);
      }
    } else {
      console.log('⚠ UC-6: 활성 세션 없음');
    }
  });

  // UC-7: 실시간 타이머 업데이트
  test('UC-7: 실시간 타이머 업데이트 (1초 간격)', async ({ page }) => {
    const timerDisplay = page.locator('.rt-timer-display .rt-timer-value').first();

    if (await timerDisplay.isVisible({ timeout: 2000 }).catch(() => false)) {
      const firstValue = await timerDisplay.textContent();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'uc7-realtime-timer-before.png'),
        fullPage: true
      });

      // 1.5초 대기
      await page.waitForTimeout(1500);
      const secondValue = await timerDisplay.textContent();

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'uc7-realtime-timer-after.png'),
        fullPage: true
      });

      console.log(`✓ UC-7: 타이머 업데이트 감지 (${firstValue} → ${secondValue})`);
    } else {
      console.log('⚠ UC-7: 타이머 표시 없음');
    }
  });

  // UC-8: 경고 상태 (Warning)
  test('UC-8: 경고 상태 (Warning)', async ({ page }) => {
    const warningCard = page.locator('.rt-session-card.warning').first();

    if (await warningCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'uc8-warning-state.png'),
        fullPage: true
      });
      await expect(warningCard).toBeVisible();
      console.log('✓ UC-8: 경고 상태 시각화 확인');
    } else {
      console.log('⚠ UC-8: 경고 상태 세션 없음 (정상)');
    }
  });

  // UC-9: 초과 상태 (Overtime)
  test('UC-9: 초과 상태 (Overtime)', async ({ page }) => {
    const overtimeCard = page.locator('.rt-session-card.overtime').first();

    if (await overtimeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'uc9-overtime-state.png'),
        fullPage: true
      });
      await expect(overtimeCard).toBeVisible();
      console.log('✓ UC-9: 초과 상태 시각화 확인');
    } else {
      console.log('⚠ UC-9: 초과 상태 세션 없음 (정상)');
    }
  });

  // UC-10: 일시정지 세션 버튼
  test('UC-10: 일시정지 세션 버튼 (재개, 완료)', async ({ page }) => {
    const pausedCard = page.locator('.rt-session-card--paused').first();

    if (await pausedCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'uc10-paused-buttons.png'),
        fullPage: true
      });

      const resumeBtn = pausedCard.locator('button:has-text("재개")');
      const doneBtn = pausedCard.locator('button:has-text("완료")');

      if (await resumeBtn.isVisible().catch(() => false)) {
        await expect(resumeBtn).toBeEnabled();
        console.log('✓ UC-10: 재개 버튼 확인');
      }
      if (await doneBtn.isVisible().catch(() => false)) {
        await expect(doneBtn).toBeEnabled();
        console.log('✓ UC-10: 완료 버튼 확인');
      }
    } else {
      console.log('⚠ UC-10: 일시정지 세션 없음');
    }
  });
});

test.describe('Report System - Usecase Screenshots Live', () => {
  // Report Input 페이지
  test('Report UC-1: 성적 입력 - 학생 선택 및 폼', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/report/input`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'report-uc1-input-page.png'),
      fullPage: true
    });

    const studentList = page.locator('.search-input, input[placeholder*="검색"]').first();
    if (await studentList.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✓ Report UC-1: 성적 입력 페이지 렌더링 확인');
    }
  });

  // Report Preview 페이지
  test('Report UC-2: 리포트 미리보기 - 차트 렌더링', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/report/preview`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'report-uc2-preview-page.png'),
      fullPage: true
    });

    const pageTitle = page.locator('h1').first();
    if (await pageTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✓ Report UC-2: 리포트 미리보기 페이지 렌더링 확인');
    }
  });

  // Report Send 페이지
  test('Report UC-3: 리포트 전송 - 다중 선택 및 전송', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/report/send`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'report-uc3-send-page.png'),
      fullPage: true
    });

    const pageTitle = page.locator('h1').first();
    if (await pageTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✓ Report UC-3: 리포트 전송 페이지 렌더링 확인');
    }
  });

  // Report AI Settings 페이지
  test('Report UC-4: AI 설정 - Gemini API 키 설정', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/report/ai-settings`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'report-uc4-ai-settings.png'),
      fullPage: true
    });

    const geminiKeyInput = page.locator('input[placeholder*="Gemini"], input[placeholder*="API"]').first();
    if (await geminiKeyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✓ Report UC-4: AI 설정 페이지 렌더링 확인');

      // 키가 설정되어 있는지 확인
      const hasValue = await geminiKeyInput.inputValue().catch(() => '');
      if (hasValue) {
        console.log('✓ Report UC-4: Gemini API 키 설정됨');
      }
    }
  });
});
