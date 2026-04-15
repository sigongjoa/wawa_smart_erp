import { test, expect } from '@playwright/test';

const BASE = 'https://wawa-smart-erp.pages.dev';

test.describe('회의 녹음/요약 기능', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto(`${BASE}/#/login`);
    await page.waitForLoadState('networkidle');

    // 학원 선택
    const academySelect = page.locator('select').first();
    await academySelect.waitFor({ timeout: 10000 });
    await academySelect.selectOption({ label: /알파/ });

    // 이름 선택 + PIN
    await page.waitForTimeout(1000);
    const nameSelect = page.locator('select').nth(1);
    await nameSelect.selectOption({ label: /서재용/ });
    await page.fill('input[type="password"]', '1141');
    await page.click('button[type="submit"]');
    await page.waitForURL(/#\/timer/, { timeout: 10000 });
  });

  test('사이드바에 회의 메뉴 표시', async ({ page }) => {
    const meetingNav = page.locator('a[href="#/meeting"]');
    await expect(meetingNav).toBeVisible();
    await expect(meetingNav).toContainText('회의');
  });

  test('회의 페이지 접근 + 빈 상태', async ({ page }) => {
    await page.click('a[href="#/meeting"]');
    await page.waitForURL(/#\/meeting/);

    // 페이지 제목
    await expect(page.locator('h2')).toContainText('회의록');

    // 새 회의 버튼
    const newBtn = page.locator('button:has-text("새 회의")');
    await expect(newBtn).toBeVisible();
  });

  test('텍스트 입력으로 회의 요약 생성 (E2E)', async ({ page }) => {
    await page.click('a[href="#/meeting"]');
    await page.waitForURL(/#\/meeting/);

    // 새 회의 버튼 클릭
    await page.click('button:has-text("새 회의")');
    await page.waitForTimeout(500);

    // 제목 입력
    await page.fill('input[placeholder*="학습 방향"]', 'E2E 테스트 회의');

    // 참석자 입력
    await page.fill('input[placeholder*="서재용"]', '서재용, 테스트선생');

    // 텍스트 입력 모드 전환
    await page.click('button:has-text("텍스트 입력")');

    // 녹취록 입력
    const transcript = `서재용: 이번 주 수학 시험 결과가 나왔습니다. 전체적으로 평균이 올랐어요.
테스트선생: 특히 중3 반이 많이 올랐네요. 함수 단원 보충이 효과가 있었던 것 같아요.
서재용: 네, 다음 주부터는 기말고사 대비 시작해야 합니다. 테스트선생님이 중3 기말 대비 자료 준비해주세요.
테스트선생: 네, 금요일까지 준비하겠습니다.`;

    await page.fill('textarea', transcript);

    // AI 요약 생성 버튼 클릭
    await page.click('button:has-text("AI 요약 생성")');

    // 처리 중 상태 표시 확인
    await expect(page.locator('button:has-text("AI 요약")')).toBeDisabled();

    // 완료 대기 (최대 30초)
    await page.waitForURL(/#\/meeting/, { timeout: 30000 });
    await page.waitForTimeout(2000);

    // 목록에 회의가 표시되는지 확인
    const meetingCard = page.locator('.meeting-card').first();
    await expect(meetingCard).toBeVisible({ timeout: 10000 });
    await expect(meetingCard).toContainText('E2E 테스트 회의');
    await expect(meetingCard.locator('.meeting-status--done')).toBeVisible();
  });

  test('회의 상세 보기 + 요약/액션 확인', async ({ page }) => {
    await page.click('a[href="#/meeting"]');
    await page.waitForURL(/#\/meeting/);
    await page.waitForTimeout(1000);

    // 첫 번째 회의 클릭
    const firstCard = page.locator('.meeting-card').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForTimeout(1000);

      // 요약 섹션 확인
      const summarySection = page.locator('.meeting-section:has-text("요약")');
      await expect(summarySection).toBeVisible({ timeout: 5000 });

      // 할일 목록 섹션
      const actionsSection = page.locator('.meeting-section:has-text("할일")');
      if (await actionsSection.isVisible()) {
        const actionItems = page.locator('.meeting-action-item');
        expect(await actionItems.count()).toBeGreaterThan(0);
      }

      // 보드에 게시 버튼
      const publishBtn = page.locator('button:has-text("보드에 게시")');
      await expect(publishBtn).toBeVisible();

      // 녹취록 원문 토글
      const transcriptToggle = page.locator('summary:has-text("녹취록")');
      if (await transcriptToggle.isVisible()) {
        await transcriptToggle.click();
        await expect(page.locator('.meeting-transcript')).toBeVisible();
      }
    }
  });

  test('회의 삭제', async ({ page }) => {
    await page.click('a[href="#/meeting"]');
    await page.waitForURL(/#\/meeting/);
    await page.waitForTimeout(1000);

    const cards = page.locator('.meeting-card');
    const initialCount = await cards.count();

    if (initialCount > 0) {
      // 첫 번째 회의 열기
      await cards.first().click();
      await page.waitForTimeout(1000);

      // 삭제 버튼 (confirm 다이얼로그 자동 수락)
      page.on('dialog', (dialog) => dialog.accept());
      await page.click('button:has-text("삭제")');
      await page.waitForTimeout(2000);

      // 목록으로 돌아가서 개수 확인
      const newCount = await page.locator('.meeting-card').count();
      expect(newCount).toBeLessThan(initialCount);
    }
  });
});
