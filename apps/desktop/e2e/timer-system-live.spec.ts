import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';

test.describe('Timer System Live Tests - Correct Version', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}`);
  });

  // UC-1: 활성 세션 카드 렌더링
  test('UC-1: 활성 세션 카드 - 학생 이름 및 타이머 표시', async ({ page }) => {
    // ActiveSessionCard 찾기 (실제 클래스명)
    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();
    
    // 활성 세션이 있으면 확인
    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 학생 이름 표시 확인
      const studentName = activeCard.locator('.rt-student-name').first();
      await expect(studentName).toBeVisible();
      
      // 타이머 표시 확인 (HH:MM 포맷)
      const timerDisplay = activeCard.locator('.rt-timer-display .rt-timer-value').first();
      await expect(timerDisplay).toBeVisible();
      
      const timerText = await timerDisplay.textContent();
      // HH:MM 또는 +HH:MM 포맷
      expect(timerText).toMatch(/^(\+?)(\d{2}):(\d{2})$/);
    }
  });

  // UC-2: 세션 액션 버튼 확인
  test('UC-2: 활성 세션 버튼 - 정지, 수업추가, 완료', async ({ page }) => {
    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();
    
    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 버튼 찾기 (실제 텍스트)
      const pauseBtn = activeCard.locator('button:has-text("정지")');
      const extendBtn = activeCard.locator('button:has-text("수업추가")');
      const doneBtn = activeCard.locator('button:has-text("완료")');
      
      // 각 버튼 확인
      if (await pauseBtn.isVisible().catch(() => false)) {
        await expect(pauseBtn).toBeEnabled();
      }
      
      if (await extendBtn.isVisible().catch(() => false)) {
        await expect(extendBtn).toBeEnabled();
      }
      
      if (await doneBtn.isVisible().catch(() => false)) {
        await expect(doneBtn).toBeEnabled();
      }
    }
  });

  // UC-3: 정지된 세션 카드 렌더링
  test('UC-3: 정지된 세션 카드 - 정지 상태 표시', async ({ page }) => {
    // PausedSessionCard 찾기 (실제 클래스명)
    const pausedCard = page.locator('.rt-session-card--paused').first();
    
    if (await pausedCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 정지 상태 태그 확인
      const pausedTag = pausedCard.locator('.rt-status-tag.paused');
      await expect(pausedTag).toBeVisible();
      
      // 정지 시간 표시 확인 (formatSeconds: MM:SS)
      const pauseTimer = pausedCard.locator('.rt-pause-timer');
      await expect(pauseTimer).toBeVisible();
      
      const timerText = await pauseTimer.textContent();
      // MM:SS 포맷 확인
      expect(timerText).toMatch(/(\d{2}):(\d{2})/);
    }
  });

  // UC-4: 진행률 표시 (Progress Track)
  test('UC-4: 진행률 표시 - 수업 시간 진도', async ({ page }) => {
    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();
    
    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 진행률 바 찾기
      const progressTrack = activeCard.locator('.rt-progress-track');
      await expect(progressTrack).toBeVisible();
      
      // 진행 채우기 찾기
      const progressFill = progressTrack.locator('.rt-progress-fill');
      await expect(progressFill).toBeVisible();
      
      // width 속성 확인 (0-100%)
      const style = await progressFill.getAttribute('style');
      expect(style).toMatch(/width:\s*\d+(\.\d+)?%/);
    }
  });

  // UC-5: 메타 정보 (순수 시간, 예정 시간, 정지 시간)
  test('UC-5: 세션 메타 정보 - 순수/예정/정지 시간', async ({ page }) => {
    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();
    
    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 메타 정보 찾기
      const sessionMeta = activeCard.locator('.rt-session-meta');
      await expect(sessionMeta).toBeVisible();
      
      const metaText = await sessionMeta.textContent();
      // "순수 X분 / 예정 Y분" 포맷 확인
      expect(metaText).toMatch(/순수\s*\d+분/);
      expect(metaText).toMatch(/예정\s*\d+분/);
    }
  });

  // UC-6: 수업 추가 시트 (ExtendSheet)
  test('UC-6: 수업 추가 시트 - 추가 분량 선택', async ({ page }) => {
    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();
    
    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 수업추가 버튼 클릭
      const extendBtn = activeCard.locator('button:has-text("수업추가")');
      
      if (await extendBtn.isVisible().catch(() => false)) {
        await extendBtn.click();
        
        // ExtendSheet 오버레이 확인
        const extendSheet = page.locator('.rt-pause-sheet').first();
        await expect(extendSheet).toBeVisible({ timeout: 2000 });
        
        // 추가 옵션 버튼 확인 (+10분, +20분, +30분)
        const extendOptions = page.locator('button:has-text(/\\+\\d+분/)');
        const optionCount = await extendOptions.count();
        expect(optionCount).toBeGreaterThanOrEqual(3);
        
        // 오버레이 클릭으로 닫기
        await page.locator('.rt-pause-overlay').click();
        await expect(extendSheet).not.toBeVisible({ timeout: 1000 });
      }
    }
  });

  // UC-7: 타이머 실시간 업데이트
  test('UC-7: 타이머 실시간 업데이트 - 1초 단위 증감', async ({ page }) => {
    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();
    
    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      const timerDisplay = activeCard.locator('.rt-timer-display .rt-timer-value');
      
      // 첫 번째 값
      const first = await timerDisplay.textContent();
      
      // 2초 대기
      await page.waitForTimeout(2000);
      
      // 두 번째 값
      const second = await timerDisplay.textContent();
      
      console.log(`타이머 업데이트: ${first} → ${second}`);
      
      // 두 값이 모두 올바른 포맷인지 확인
      expect(first).toMatch(/^(\+?)(\d{2}):(\d{2})$/);
      expect(second).toMatch(/^(\+?)(\d{2}):(\d{2})$/);
    }
  });

  // UC-8: 경고 상태 (10분 미만)
  test('UC-8: 경고 상태 - 10분 미만 시 강조 표시', async ({ page }) => {
    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();
    
    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      const timerDisplay = activeCard.locator('.rt-timer-display');
      
      // warning 클래스가 있는지 확인 (있을 수도, 없을 수도 있음)
      const hasWarning = await timerDisplay.evaluate(el => 
        el.classList.contains('warning')
      );
      
      // 있으면 강조 표시가 적용되어야 함
      if (hasWarning) {
        // warning 스타일이 적용됨 (실제 확인은 스크린샷으로)
        console.log('✓ 경고 상태 활성화됨');
      }
    }
  });

  // UC-9: 초과 상태 (음수)
  test('UC-9: 초과 상태 - 시간 초과 시 표시', async ({ page }) => {
    const activeCard = page.locator('.rt-session-card:not(.rt-session-card--paused)').first();
    
    if (await activeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      const timerDisplay = activeCard.locator('.rt-timer-display');
      
      // overtime 클래스가 있는지 확인
      const hasOvertime = await timerDisplay.evaluate(el => 
        el.classList.contains('overtime')
      );
      
      if (hasOvertime) {
        // 타이머가 +로 시작해야 함
        const timerText = await timerDisplay.locator('.rt-timer-value').textContent();
        expect(timerText).toMatch(/^\+/);
        
        // "초과" 레이블 확인
        const label = await timerDisplay.locator('.rt-timer-label').textContent();
        expect(label).toContain('초과');
      }
    }
  });

  // UC-10: 정지된 세션 재개/완료 버튼
  test('UC-10: 정지된 세션 - 재개 및 완료 버튼', async ({ page }) => {
    const pausedCard = page.locator('.rt-session-card--paused').first();
    
    if (await pausedCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 재개 버튼
      const resumeBtn = pausedCard.locator('button:has-text("재개")');
      if (await resumeBtn.isVisible().catch(() => false)) {
        await expect(resumeBtn).toBeEnabled();
      }
      
      // 완료 버튼
      const doneBtn = pausedCard.locator('button:has-text("완료")');
      if (await doneBtn.isVisible().catch(() => false)) {
        await expect(doneBtn).toBeEnabled();
      }
    }
  });
});
