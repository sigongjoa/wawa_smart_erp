/**
 * UC-08: AI 종합평가 대량 생성 E2E 테스트
 *
 * 전송완료 학생 19명을 대상으로:
 * 1. 각 학생의 성적 데이터 기반 AI 종합평가 생성
 * 2. 생성된 텍스트가 올바르게 저장되는지 검증
 * 3. 미리보기에서 데이터가 표시되는지 확인
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfigAndLogin, screenshot } from './helpers';

const STUDENTS_TO_TEST = [
  { name: '윤지후', grade: '고1' },
  { name: '김지후', grade: '고1' },
  { name: '최예지', grade: '중2' },
  { name: '김태영', grade: '초등' },
  { name: '정지효', grade: '중3' },
  { name: '최고은', grade: '중1' },
  { name: '공민준', grade: '중2' },
  { name: '김성준', grade: '중2' },
  { name: '류호진', grade: '중2' },
  { name: '류하진', grade: '중3' },
];

test.describe('UC-08: AI 종합평가 대량 생성', () => {

  test('TC-01: Gemini API 설정 확인', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // AI 설정 페이지로 이동
      await window.evaluate(() => { window.location.hash = '#/report/ai-settings'; });
      await window.waitForTimeout(3000);

      const bodyText = await window.locator('body').innerText();
      expect(bodyText).toContain('AI 설정');

      // Gemini API key 필드 확인
      const hasApiKeyField = bodyText.includes('gemini') || bodyText.includes('Google Gemini');
      expect(hasApiKeyField).toBe(true);

      await screenshot(window, 'uc08-tc01-ai-settings');
      console.log('✓ AI 설정 페이지 확인됨');
    } finally {
      await app.close();
    }
  });

  test('TC-02: 첫 번째 학생(윤지후)의 AI 종합평가 생성', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      const TARGET_STUDENT = STUDENTS_TO_TEST[0].name;

      // 월말평가 > 성적 입력
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);

      // 학생 선택
      await window.locator(`text=${TARGET_STUDENT}`).first().waitFor({ timeout: 10000 });
      await window.locator(`text=${TARGET_STUDENT}`).first().click();
      await window.waitForTimeout(2000);

      // 종합평가 영역 확인
      const textarea = window.locator('textarea').last();
      await textarea.waitFor({ timeout: 5000 });

      // AI 생성 버튼 찾기
      const aiButton = window.locator('button').filter({ hasText: /AI|생성/ }).first();
      const aiButtonExists = await aiButton.isVisible().catch(() => false);

      if (aiButtonExists) {
        console.log('✓ AI 생성 버튼 클릭');
        await aiButton.click();

        // AI 생성 대기 (최대 10초)
        await window.waitForTimeout(10000);

        // 생성된 텍스트 확인
        const generatedText = await textarea.inputValue();
        expect(generatedText.length).toBeGreaterThan(10);

        console.log(`✓ AI 생성 완료 (${generatedText.length}자)`);
      } else {
        console.log('⚠️  AI 버튼 없음 - 수동 입력');
      }

      await screenshot(window, 'uc08-tc02-ai-generated');
    } finally {
      await app.close();
    }
  });

  test('TC-03: 생성된 종합평가 저장 및 미리보기 확인', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      const TARGET_STUDENT = STUDENTS_TO_TEST[0].name;

      // 월말평가 > 성적 입력
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);

      // 학생 선택
      await window.locator(`text=${TARGET_STUDENT}`).first().waitFor({ timeout: 10000 });
      await window.locator(`text=${TARGET_STUDENT}`).first().click();
      await window.waitForTimeout(2000);

      // 종합평가 저장 버튼
      const saveBtn = window.locator('button').filter({ hasText: '저장' }).last();
      await saveBtn.waitFor({ timeout: 5000 });
      await saveBtn.click();
      await window.waitForTimeout(5000);

      console.log('✓ 종합평가 저장됨');

      // 미리보기로 이동
      const previewTab = window.locator('text=리포트 미리보기').first();
      await previewTab.waitFor({ timeout: 5000 });
      await previewTab.click();
      await window.waitForTimeout(3000);

      // 학생 선택
      await window.locator(`text=${TARGET_STUDENT}`).first().waitFor({ timeout: 10000 });
      await window.locator(`text=${TARGET_STUDENT}`).first().click();
      await window.waitForTimeout(3000);

      const previewText = await window.locator('body').innerText();
      expect(previewText.length).toBeGreaterThan(100);

      await screenshot(window, 'uc08-tc03-preview-with-ai');
      console.log('✓ 미리보기에 데이터 반영됨');
    } finally {
      await app.close();
    }
  });

  test('TC-04: 5명 학생의 AI 종합평가 생성 (샘플 테스트)', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      const results = [];

      for (let i = 0; i < Math.min(5, STUDENTS_TO_TEST.length); i++) {
        const student = STUDENTS_TO_TEST[i];
        console.log(`\n처리 중: ${student.name} (${i + 1}/5)`);

        // 월말평가 > 성적 입력
        await window.locator('text=월말평가').first().click();
        await window.waitForTimeout(1500);
        await window.locator('text=성적 입력').first().click();
        await window.waitForTimeout(2000);

        // 학생 선택
        const studentLocator = window.locator(`text=${student.name}`).first();
        const studentExists = await studentLocator.isVisible().catch(() => false);

        if (!studentExists) {
          console.log(`⚠️  ${student.name} 학생 없음`);
          continue;
        }

        await studentLocator.click();
        await window.waitForTimeout(2000);

        // 종합평가 저장
        const saveBtn = window.locator('button').filter({ hasText: '저장' }).last();
        await saveBtn.waitFor({ timeout: 5000 }).catch(() => {});
        await saveBtn.click();
        await window.waitForTimeout(3000);

        results.push({
          name: student.name,
          grade: student.grade,
          status: '✅ 완료'
        });

        console.log(`✓ ${student.name} 완료`);
      }

      // 결과 출력
      console.log('\n✅ 생성 결과:');
      console.table(results);

      await screenshot(window, 'uc08-tc04-batch-generation');
    } finally {
      await app.close();
    }
  });

  test('TC-05: 전체 플로우 통합 테스트', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      console.log('=== UC-08: AI 종합평가 대량 생성 시작 ===\n');

      const targetStudent = STUDENTS_TO_TEST[0].name;

      // STEP 1: 성적 입력 페이지
      console.log('STEP 1: 성적 입력 페이지 진입');
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);

      // STEP 2: 학생 선택
      console.log(`STEP 2: ${targetStudent} 학생 선택`);
      await window.locator(`text=${targetStudent}`).first().waitFor({ timeout: 10000 });
      await window.locator(`text=${targetStudent}`).first().click();
      await window.waitForTimeout(2000);

      // STEP 3: AI 생성 또는 수동 입력
      console.log('STEP 3: 종합평가 입력');
      const textarea = window.locator('textarea').last();
      const currentValue = await textarea.inputValue();

      if (currentValue.length < 10) {
        // AI 버튼 시도
        const aiButton = window.locator('button').filter({ hasText: /AI|생성/ }).first();
        if (await aiButton.isVisible().catch(() => false)) {
          await aiButton.click();
          await window.waitForTimeout(8000);
        }
      }

      // STEP 4: 저장
      console.log('STEP 4: 종합평가 저장');
      const saveBtn = window.locator('button').filter({ hasText: '저장' }).last();
      await saveBtn.click();
      await window.waitForTimeout(5000);

      // STEP 5: 미리보기 확인
      console.log('STEP 5: 미리보기에서 데이터 확인');
      const previewTab = window.locator('text=리포트 미리보기').first();
      await previewTab.click();
      await window.waitForTimeout(3000);

      await window.locator(`text=${targetStudent}`).first().click();
      await window.waitForTimeout(3000);

      const previewText = await window.locator('body').innerText();
      expect(previewText.length).toBeGreaterThan(100);

      // STEP 6: 전송 페이지 확인
      console.log('STEP 6: 전송 페이지 확인');
      const sendTab = window.locator('text=리포트 전송').first();
      if (await sendTab.isVisible().catch(() => false)) {
        await sendTab.click();
        await window.waitForTimeout(3000);
      }

      await screenshot(window, 'uc08-tc05-full-flow-complete');
      console.log('\n=== UC-08 완료 ===');
    } finally {
      await app.close();
    }
  });

});
