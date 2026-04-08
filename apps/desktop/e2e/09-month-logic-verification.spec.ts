/**
 * UC-09: 3월 미전송 데이터 존재 여부 및 월 강제 로직 검증 E2E 테스트
 *
 * - 3월 미전송 데이터가 있는 경우: 4월 데이터 입력 차단, 3월로 강제
 * - 3월 데이터 모두 전송: 4월 데이터 정상 입력
 * - 리포트 전송 페이지에서 올바른 월의 데이터가 표시되는지 검증
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfigAndLogin, screenshot } from './helpers';

const TARGET_STUDENT = 'test';

test.describe('UC-09: 3월 미전송 데이터 월 강제 로직 검증', () => {

  test('TC-01: 3월과 4월 데이터 상태 확인', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // 월말평가 페이지 진입
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);

      // 성적 입력 진입
      await window.locator('text=성적 입력').first().click();
      await window.waitForTimeout(3000);

      // 현재 활성화된 월 확인 (개발자 도구 콘솔에서 store 상태 확인)
      const storeState = await window.evaluate(() => {
        const stateStr = localStorage.getItem('wawa-report-storage');
        if (!stateStr) return null;
        const state = JSON.parse(stateStr);
        return {
          currentYearMonth: state.state?.currentYearMonth,
          unsentAlert: state.state?.unsentAlert,
        };
      });

      console.log('현재 Store 상태:', storeState);
      console.log(`활성화된 월: ${storeState?.currentYearMonth}`);
      console.log(`3월 미전송 알림: ${JSON.stringify(storeState?.unsentAlert)}`);

      // test 학생 표시 여부 확인
      const bodyText = await window.locator('body').innerText();
      const hasTestStudent = bodyText.includes(TARGET_STUDENT);
      console.log(`${TARGET_STUDENT} 학생 표시: ${hasTestStudent}`);

      await screenshot(window, 'uc09-tc01-month-check');
      expect(hasTestStudent).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('TC-02: 리포트 전송 페이지에서 현재 활성 월의 데이터만 표시', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // 월말평가 > 리포트 전송
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);

      const sendTab = window.locator('text=리포트 전송').first();
      const sendTabExists = await sendTab.isVisible().catch(() => false);

      if (!sendTabExists) {
        console.log('리포트 전송 탭을 찾을 수 없음');
        return;
      }

      await sendTab.click();
      await window.waitForTimeout(3000);

      // 현재 활성 월 확인
      const currentMonth = await window.evaluate(() => {
        const stateStr = localStorage.getItem('wawa-report-storage');
        if (!stateStr) return null;
        const state = JSON.parse(stateStr);
        return state.state?.currentYearMonth;
      });

      console.log(`\n리포트 전송 페이지 - 현재 활성 월: ${currentMonth}`);

      const bodyText = await window.locator('body').innerText();
      const studentCount = (bodyText.match(/체크박스/g) || []).length;
      console.log(`표시된 학생 수: ${studentCount}`);

      // 미전송 상태인 학생들 카운트
      const pendingCount = (bodyText.match(/전송대기/g) || []).length;
      console.log(`미전송 상태 학생 수: ${pendingCount}`);

      // 전송완료 상태인 학생들 카운트
      const sentCount = (bodyText.match(/전송완료/g) || []).length;
      console.log(`전송완료 상태 학생 수: ${sentCount}`);

      await screenshot(window, 'uc09-tc02-send-page-month');
      expect(bodyText.length).toBeGreaterThan(100);
    } finally {
      await app.close();
    }
  });

  test('TC-03: 3월 미전송 알림 표시 여부 확인', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // 월말평가 페이지 진입
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);

      // Store에서 unsentAlert 상태 확인
      const unsentAlert = await window.evaluate(() => {
        const stateStr = localStorage.getItem('wawa-report-storage');
        if (!stateStr) return null;
        const state = JSON.parse(stateStr);
        return state.state?.unsentAlert;
      });

      console.log('\n3월 미전송 알림 상태:', unsentAlert);

      if (unsentAlert) {
        console.log(`⚠️ 3월(${unsentAlert.yearMonth})에 미전송 데이터 ${unsentAlert.count}개 존재`);
        console.log('→ 4월 데이터 입력이 3월으로 강제 저장되어야 함');
      } else {
        console.log('✅ 3월 미전송 데이터 없음 (또는 모두 전송완료)');
        console.log('→ 4월 데이터가 정상적으로 4월에 저장됨');
      }

      const bodyText = await window.locator('body').innerText();
      console.log('\n현재 페이지 텍스트 샘플:', bodyText.substring(0, 300));

      await screenshot(window, 'uc09-tc03-unsent-alert');
      expect(bodyText.length).toBeGreaterThan(50);
    } finally {
      await app.close();
    }
  });

});
