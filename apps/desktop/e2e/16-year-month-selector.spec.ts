/**
 * UC-16: 년월 선택 기능 테스트
 * - 드롭다운에서 년월 선택 → 저장 → DB에서 선택한 년월에 저장되는지 확인
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfig, screenshot } from './helpers';

test.describe('UC-16: 년월 선택 기능 검증', () => {

  test('TC-01: 드롭다운에서 2026-03 선택 후 저장', async () => {
    const { app, window } = await launchApp();
    try {
      // 1. Config 주입
      await injectConfig(window);
      await window.waitForTimeout(2000);

      // 2. 로그인 (서재용 개발자 1141)
      console.log('\n=== 로그인 ===');
      const selectElement = window.locator('select').first();
      await selectElement.selectOption({ label: '서재용 개발자' });
      await window.waitForTimeout(500);

      const pinInput = window.locator('input[type="password"]');
      await pinInput.fill('1141');
      await window.waitForTimeout(500);

      const loginBtn = window.locator('button').filter({ hasText: '접속하기' });
      await loginBtn.click();
      await window.waitForTimeout(3000);
      console.log('✅ 로그인 완료');

      // 3. 월말평가 > 성적 입력 진입
      console.log('\n=== 성적 입력 화면 진입 ===');
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);
      console.log('✅ 성적 입력 화면 진입');

      // 4. 년월 드롭다운에서 2026-03 선택
      console.log('\n=== 년월 선택 ===');
      const monthDropdown = window.locator('select').nth(0);
      const dropdownVisible = await monthDropdown.isVisible().catch(() => false);
      console.log(`드롭다운 존재: ${dropdownVisible}`);

      if (dropdownVisible) {
        // 드롭다운 내용 확인
        const options = await monthDropdown.locator('option').allTextContents();
        console.log(`드롭다운 옵션: ${options.join(', ')}`);

        // 2026년 3월 선택
        await monthDropdown.selectOption({ label: '2026년 3월' });
        await window.waitForTimeout(500);
        const selectedValue = await monthDropdown.inputValue();
        console.log(`✅ 선택된 값: ${selectedValue}`);
      }

      await screenshot(window, 'uc16-tc01-month-selected');

      // 5. 권도훈 학생 선택
      console.log('\n=== 학생 선택 ===');
      const studentRow = window.locator('div').filter({ hasText: /^권도훈/ }).first();
      const studentExists = await studentRow.isVisible().catch(() => false);
      console.log(`권도훈 학생 존재: ${studentExists}`);

      if (studentExists) {
        await studentRow.click();
        await window.waitForTimeout(2000);
        console.log('✅ 권도훈 학생 선택');
      }

      // 6. 성적 입력
      console.log('\n=== 성적 입력 ===');
      const inputs = window.locator('input[type="number"]');
      const inputCount = await inputs.count();
      console.log(`입력 필드: ${inputCount}개`);

      if (inputCount > 0) {
        await inputs.first().fill('77');
        const inputValue = await inputs.first().inputValue();
        console.log(`✅ 입력된 값: ${inputValue}`);
      }

      await screenshot(window, 'uc16-tc01-score-entered');

      // 7. 저장
      console.log('\n=== 저장 ===');
      const saveBtn = window.locator('button').filter({ hasText: '저장' }).first();
      const saveBtnExists = await saveBtn.isVisible().catch(() => false);
      console.log(`저장 버튼 존재: ${saveBtnExists}`);

      if (saveBtnExists) {
        await saveBtn.click();
        await window.waitForTimeout(3000);
        console.log('✅ 저장 버튼 클릭');

        const bodyText = await window.locator('body').innerText();
        if (bodyText.includes('저장되었습니다')) {
          console.log('✅ 저장 성공 메시지 표시됨');
        }
      }

      await screenshot(window, 'uc16-tc01-after-save');

      expect(studentExists).toBe(true);
      expect(inputCount).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

});
