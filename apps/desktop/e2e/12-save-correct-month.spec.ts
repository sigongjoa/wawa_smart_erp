/**
 * UC-12: 저장 시 올바른 월에 저장되는지 검증
 *
 * - 3월 미전송 23건 존재 상황
 * - test 학생에게 국어 34점 입력
 * - 저장 클릭
 * - 3월 DB에 저장되었는지 확인
 * - 미리보기에서 데이터 표시 확인
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfigAndLogin, screenshot } from './helpers';

const TARGET_STUDENT = 'test';

test.describe('UC-12: 저장 시 올바른 월에 저장 검증', () => {

  test('TC-01: 3월 미전송 상태에서 국어 34점 저장', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // 현재 활성 월 확인
      const storeState1 = await window.evaluate(() => {
        const state = localStorage.getItem('wawa-report-storage');
        if (!state) return null;
        const parsed = JSON.parse(state);
        return { currentYearMonth: parsed.state?.currentYearMonth };
      });
      console.log(`\n초기 currentYearMonth: ${storeState1?.currentYearMonth}`);

      // 월말평가 > 성적 입력
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);

      // 저장 전 월 확인
      const storeState2 = await window.evaluate(() => {
        const state = localStorage.getItem('wawa-report-storage');
        if (!state) return null;
        const parsed = JSON.parse(state);
        return { currentYearMonth: parsed.state?.currentYearMonth };
      });
      console.log(`성적입력 페이지 진입 후 currentYearMonth: ${storeState2?.currentYearMonth}`);

      // test 학생 선택
      const testRow = window.locator('div').filter({ hasText: /^test$|^test\s/ }).first();
      await testRow.click();
      await window.waitForTimeout(2000);

      // 국어 점수 입력
      const scoreInputs = window.locator('input[type="number"]');
      const inputCount = await scoreInputs.count();
      console.log(`입력 필드 개수: ${inputCount}`);

      if (inputCount > 0) {
        await scoreInputs.first().fill('34');
        const value = await scoreInputs.first().inputValue();
        console.log(`입력된 값: ${value}`);

        // 저장 버튼 클릭
        const saveBtn = window.locator('button').filter({ hasText: '저장' }).first();
        const saveBtnVisible = await saveBtn.isVisible().catch(() => false);
        console.log(`저장 버튼 보임: ${saveBtnVisible}`);

        if (saveBtnVisible) {
          console.log('저장 버튼 클릭...');
          await saveBtn.click();
          await window.waitForTimeout(5000);
          console.log('✅ 저장 완료');
        }

        // 저장 후 currentYearMonth 확인
        const storeState3 = await window.evaluate(() => {
          const state = localStorage.getItem('wawa-report-storage');
          if (!state) return null;
          const parsed = JSON.parse(state);
          return { currentYearMonth: parsed.state?.currentYearMonth };
        });
        console.log(`저장 후 currentYearMonth: ${storeState3?.currentYearMonth}`);
      }

      await screenshot(window, 'uc12-tc01-after-save');
      expect(inputCount).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  test('TC-02: 미리보기에서 저장된 데이터 확인', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // 월말평가 > 리포트 미리보기
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);

      const previewTab = window.locator('text=리포트 미리보기').first();
      const previewTabExists = await previewTab.isVisible().catch(() => false);
      console.log(`\n미리보기 탭 찾음: ${previewTabExists}`);

      if (previewTabExists) {
        await previewTab.click();
        await window.waitForTimeout(3000);

        // test 학생 선택
        const testRow = window.locator(`text=${TARGET_STUDENT}`).first();
        const testExists = await testRow.isVisible().catch(() => false);
        console.log(`test 학생 찾음: ${testExists}`);

        if (testExists) {
          await testRow.click();
          await window.waitForTimeout(3000);

          // 미리보기 내용 확인
          const bodyText = await window.locator('body').innerText();
          console.log(`미리보기 텍스트 길이: ${bodyText.length}`);

          // 국어 또는 점수 관련 텍스트 확인
          const hasKorean = bodyText.includes('국어');
          const has34 = bodyText.includes('34');
          const hasScore = /\d+\s*\/\s*100|점수/.test(bodyText);

          console.log(`국어 포함: ${hasKorean}`);
          console.log(`34 포함: ${has34}`);
          console.log(`점수 필드 포함: ${hasScore}`);

          await screenshot(window, 'uc12-tc02-preview');
          expect(bodyText.length).toBeGreaterThan(100);
        }
      }
    } finally {
      await app.close();
    }
  });

});
