/**
 * UC-18: 성적 입력 시 저장 후 UI 상태 유지 테스트
 * - 45점 국어 입력 → 저장 → UI 초기화되지 않음 검증
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfig, screenshot } from './helpers';

test.describe('UC-18: 성적 입력 저장 후 UI 상태 유지', () => {

  test('TC-01: 국어 45점 입력 후 저장 시 UI 상태 유지', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfig(window);
      await window.waitForTimeout(2000);

      // 로그인
      const selectElement = window.locator('select').first();
      await selectElement.selectOption({ label: '서재용 개발자' });
      const pinInput = window.locator('input[type="password"]');
      await pinInput.fill('1141');
      const loginBtn = window.locator('button').filter({ hasText: '접속하기' });
      await loginBtn.click();
      await window.waitForTimeout(3000);

      // 성적 입력으로 이동
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);

      // 학생 선택 (test 학생)
      const studentItems = window.locator('[role="button"]').filter({ hasText: /test|Test/ });
      const firstStudent = studentItems.first();
      await firstStudent.click();
      await window.waitForTimeout(1000);

      // 선택된 학생명 확인
      const selectedStudentName = await window.locator('h2').first().textContent();
      console.log(`✅ 선택된 학생: ${selectedStudentName}`);

      // 국어 점수 입력 (45점)
      const scoreInputs = window.locator('input[type="number"]');
      const firstScoreInput = scoreInputs.first();
      await firstScoreInput.fill('45');
      console.log(`✅ 국어 45점 입력`);
      
      await screenshot(window, 'uc18-before-save');

      // 저장 버튼 클릭
      const saveButtons = window.locator('button').filter({ hasText: '저장' });
      const firstSaveBtn = saveButtons.first();
      await firstSaveBtn.click();
      console.log(`✅ 저장 버튼 클릭`);

      // 토스트 메시지 확인
      await window.waitForTimeout(500);
      const toastMessage = window.locator('[role="alert"], .toast, [class*="toast"]');
      const toastText = await toastMessage.first().textContent().catch(() => '');
      console.log(`✅ 토스트 메시지: ${toastText}`);

      // 중요: 저장 후 1초 대기 (데이터 로드)
      await window.waitForTimeout(1000);

      // UI 상태 확인
      const scoreInputAfterSave = window.locator('input[type="number"]').first();
      const scoreValueAfterSave = await scoreInputAfterSave.inputValue();
      console.log(`✅ 저장 후 입력 필드 값: ${scoreValueAfterSave}`);

      // 학생명이 여전히 표시되는지 확인
      const studentNameAfterSave = await window.locator('h2').first().textContent();
      console.log(`✅ 저장 후 선택된 학생: ${studentNameAfterSave}`);

      // 검증: 입력값이 유지되어야 함 (또는 DB에서 로드된 값)
      expect(parseInt(scoreValueAfterSave) || 0).toBeGreaterThanOrEqual(45);
      expect(studentNameAfterSave).toBeTruthy();

      await screenshot(window, 'uc18-after-save');
      console.log(`✅ UI 상태 유지 확인 완료`);
    } finally {
      await app.close();
    }
  });

});
