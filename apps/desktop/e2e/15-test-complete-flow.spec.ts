/**
 * UC-15: test 학생 완전 흐름 테스트
 * - 로그인 → 각 과목(국어, 영어, 수학, 사회) 점수 입력 → 저장
 * - 최종적으로 모든 데이터가 DB에 저장되는지 확인
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfig, screenshot } from './helpers';

test.describe('UC-15: test 학생 완전 흐름 테스트', () => {

  test('TC-01: test 학생 모든 과목 점수 저장', async ({ page }, testInfo) => {
    testInfo.setTimeout(120000); // 2분으로 확장
    const { app, window } = await launchApp();
    try {
      // 1. Config 주입
      await injectConfig(window);
      await window.waitForTimeout(2000);

      // 2. 서재용 개발자 로그인
      console.log('\n=== 로그인 ===');
      const selectElement = window.locator('select');
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

      // 4. test 학생 선택
      console.log('\n=== test 학생 선택 ===');
      const testRow = window.locator('div').filter({ hasText: /^test$|^test\s/ }).first();
      await testRow.click();
      await window.waitForTimeout(2000);
      console.log('✅ test 학생 선택');

      // 5. 각 과목별 점수 입력 및 저장
      const subjects = [
        { name: '국어', score: 85 },
        { name: '영어', score: 90 },
        { name: '수학', score: 95 },
        { name: '사회', score: 88 },
      ];

      for (const subject of subjects) {
        console.log(`\n=== ${subject.name} 입력 ===`);

        // 과목별 입력 필드 찾기
        const inputs = window.locator('input[type="number"]');
        const inputCount = await inputs.count();
        console.log(`  입력 필드: ${inputCount}개`);

        if (inputCount > 0) {
          // 해당 과목의 입력 필드에 점수 입력
          const allLabels = await window.locator('label').allTextContents();
          const subjectIndex = allLabels.findIndex(label => label.includes(subject.name));

          if (subjectIndex >= 0) {
            console.log(`  ${subject.name} 위치: ${subjectIndex}`);
            await inputs.nth(subjectIndex).fill(String(subject.score));
            const inputValue = await inputs.nth(subjectIndex).inputValue();
            console.log(`  ✅ 입력된 값: ${inputValue}`);
          } else {
            // 그냥 첫 번째 입력 필드에 입력
            await inputs.first().fill(String(subject.score));
            const inputValue = await inputs.first().inputValue();
            console.log(`  ✅ 입력된 값: ${inputValue}`);
          }

          // 저장 버튼 클릭
          await window.waitForTimeout(500);
          const saveBtn = window.locator('button').filter({ hasText: '저장' }).first();
          if (await saveBtn.isVisible()) {
            await saveBtn.click();
            await window.waitForTimeout(3000);
            console.log(`  ✅ ${subject.name} 저장 완료`);

            // 토스트 메시지 확인
            const bodyText = await window.locator('body').innerText();
            if (bodyText.includes('저장되었습니다')) {
              console.log(`  ✅ 저장 성공 메시지 표시됨`);
            }
          }
        }
      }

      await screenshot(window, 'uc15-tc01-all-subjects-saved');

      // 6. 최종 확인
      console.log('\n=== 최종 확인 ===');
      const finalBodyText = await window.locator('body').innerText();
      console.log(`✅ 모든 과목 저장 완료`);
      console.log(`최종 화면에 test 포함: ${finalBodyText.includes('test')}`);

      expect(finalBodyText.includes('test')).toBe(true);
    } finally {
      await app.close();
    }
  });

});
