/**
 * E2E — AskAI 화면 (UC-01 학생 텍스트 질문)
 *
 * STUDENT_URL = http://localhost:5175 (vite dev) 또는 배포된 URL.
 * /api/ask-ai/* 는 mock route로 가로챔 (실제 Claude 호출 없이).
 */

import { test, expect } from '@playwright/test';

const MOCK_RESPONSE = {
  success: true,
  data: {
    conversation_id: 'mock-conv-1',
    response: {
      steps: [
        { kind: 'explain', title: '표본평균은 변수다', body_md: '매번 표본을 뽑을 때마다 평균이 바뀜.' },
        { kind: 'checkpoint', question: '여기까지 OK?' },
        { kind: 'explain', title: 'V(X̄) 계산', body_md: '$V(\\bar X) = \\sigma^2/n$' },
      ],
      references: [{ unit: '확통 III-1 §2.1', page: 11, quote: '표본의 정의' }],
      confidence: 'high',
      needs_teacher: false,
    },
    quota_remaining: { questions: 21, photos: 10 },
  },
  timestamp: new Date().toISOString(),
};

test.describe('AskAI — UC-01 학생 텍스트 질문', () => {
  test.beforeEach(async ({ page, context }) => {
    // 인증 우회 — localStorage에 가짜 토큰 또는 스킵 (실제는 mock auth 필요)
    // 여기서는 직접 페이지 방문 + API mock
    await context.route('**/api/ask-ai/ask', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RESPONSE),
      });
    });
  });

  test('질문 입력 → 응답 → step block 렌더 + checkpoint 표시', async ({ page }) => {
    await page.goto('/#/ask-ai');

    // 페이지 로드
    await expect(page.getByRole('heading', { name: /설명 AI/ })).toBeVisible();

    // 질문 입력
    await page.getByLabel('질문 입력').fill('표본평균 분산이 왜 σ²/n 인가요?');
    await page.getByRole('button', { name: '물어보기' }).click();

    // 응답 step 렌더
    await expect(page.getByText('표본평균은 변수다')).toBeVisible();
    await expect(page.getByText(/매번 표본을 뽑을/)).toBeVisible();

    // checkpoint 표시
    await expect(page.getByText(/여기까지 OK/)).toBeVisible();

    // checkpoint button 노출
    await expect(page.getByRole('button', { name: '응, 다음' })).toBeVisible();

    // 다음 단계는 잠금 상태 (locked)
    const lockedStep = page.locator('.askai-step.is-locked');
    await expect(lockedStep).toHaveCount(1);
  });

  test('checkpoint 통과 → 다음 step 활성화', async ({ page }) => {
    await page.goto('/#/ask-ai');
    await page.getByLabel('질문 입력').fill('test');
    await page.getByRole('button', { name: '물어보기' }).click();

    // 첫 checkpoint 통과
    await page.getByRole('button', { name: '응, 다음' }).click();

    // 잠금 해제 (locked → 일반 또는 done)
    await expect(page.locator('.askai-step.is-locked')).toHaveCount(0);
  });

  test('빈 질문 → 보내기 disabled', async ({ page }) => {
    await page.goto('/#/ask-ai');
    const btn = page.getByRole('button', { name: '물어보기' });
    await expect(btn).toBeDisabled();

    await page.getByLabel('질문 입력').fill('hi');
    await expect(btn).toBeEnabled();

    await page.getByLabel('질문 입력').fill('');
    await expect(btn).toBeDisabled();
  });

  test('새 질문 버튼 → 폼 reset', async ({ page }) => {
    await page.goto('/#/ask-ai');
    await page.getByLabel('질문 입력').fill('test');
    await page.getByRole('button', { name: '물어보기' }).click();

    await expect(page.getByText('표본평균은 변수다')).toBeVisible();

    await page.getByRole('button', { name: '새 질문' }).click();
    await expect(page.getByLabel('질문 입력')).toBeVisible();
    await expect(page.getByLabel('질문 입력')).toHaveValue('');
  });
});
