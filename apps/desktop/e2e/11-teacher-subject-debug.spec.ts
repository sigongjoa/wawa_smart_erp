/**
 * 선생님 과목 및 test 학생 정보 진단
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfigAndLogin, screenshot } from './helpers';

test.describe('선생님 과목 및 데이터 진단', () => {

  test('TC-01: localStorage의 선생님 과목 정보 확인', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      const userData = await window.evaluate(() => {
        const stateStr = localStorage.getItem('wawa-report-storage');
        if (!stateStr) return null;
        const state = JSON.parse(stateStr);
        return state.state?.currentUser;
      });

      console.log('\n=== localStorage 현재 사용자 정보 ===');
      console.log('선생님 이름:', userData?.teacher?.name);
      console.log('담당 과목:', userData?.teacher?.subjects);
      console.log('isAdmin:', userData?.teacher?.isAdmin);
    } finally {
      await app.close();
    }
  });

  test('TC-02: 실제 Notion에서 가져온 선생님 목록 확인', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);
      await window.waitForTimeout(3000);

      const teachers = await window.evaluate(() => {
        const stateStr = localStorage.getItem('wawa-report-storage');
        if (!stateStr) return null;
        // fetchAllData가 실행되어 teachers가 로드되어야 함
        // 근데 reportStore에는 teachers가 저장되지 않음
        return null;
      });

      console.log('\n=== Notion에서 가져온 선생님 정보 ===');
      console.log('(localStorage에 저장되지 않으므로 스크린샷으로 확인 필요)');

      // 화면에 표시된 선생님 이름 캡처
      const bodyText = await window.locator('body').innerText();
      const lines = bodyText.split('\n');
      const teacherLine = lines.find(l => l.includes('선생님'));
      console.log('화면에 표시된 선생님:', teacherLine);

      await screenshot(window, '11-tc02-teacher-info');
    } finally {
      await app.close();
    }
  });

  test('TC-03: test 학생의 과목 구성 확인', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // 월말평가 > 성적 입력
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);

      const bodyText = await window.locator('body').innerText();
      
      // test 학생 라인 찾기
      const lines = bodyText.split('\n');
      const testIndex = lines.findIndex(l => l.startsWith('test'));
      
      console.log('\n=== test 학생 정보 ===');
      if (testIndex >= 0) {
        // test 주변 5줄 출력
        for (let i = Math.max(0, testIndex - 1); i < Math.min(lines.length, testIndex + 5); i++) {
          console.log(`${i}: ${lines[i]}`);
        }
      }

      // test 학생 선택
      const testRow = window.locator('div').filter({ hasText: /^test$|^test\s/ }).first();
      await testRow.click();
      await window.waitForTimeout(2000);

      // 과목별 점수 입력 필드 개수
      const scoreInputs = window.locator('input[type="number"]');
      const inputCount = await scoreInputs.count();
      console.log(`\ntest 학생 선택 후 점수 입력 필드: ${inputCount}개`);

      // 각 과목 섹션 확인
      const subjects = window.locator('text=/^(국어|영어|수학|사회)$/');
      const subjectCount = await subjects.count();
      console.log(`표시되는 과목 필드: ${subjectCount}개`);

      // 실제 과목명 추출
      const allBody = await window.locator('body').innerText();
      const subjectMatches = allBody.match(/(국어|영어|수학|사회)/g);
      const uniqueSubjects = [...new Set(subjectMatches || [])];
      console.log('보이는 과목들:', uniqueSubjects);

      await screenshot(window, '11-tc03-test-student-subjects');
    } finally {
      await app.close();
    }
  });

});
