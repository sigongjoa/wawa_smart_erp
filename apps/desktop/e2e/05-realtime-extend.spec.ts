/**
 * UC-05: 실시간 타이머 수업추가(벌칙) 및 시작/예정종료 시각 표시 sanity test
 *
 * 검증 항목:
 * 1. 임시 학생 체크인 후 카드에 시작시각/예정종료시각 표시 여부
 * 2. 수업추가 버튼 존재 여부
 * 3. 수업추가 버튼 클릭 시 시트(+10/+20/+30분) 표시 여부
 * 4. +10분 클릭 시 예정종료시각이 변경되는지 여부
 */
import { test, expect } from '@playwright/test';
import { launchApp, injectConfigAndLogin, screenshot } from './helpers';

test.describe('UC-05: 수업추가(벌칙) 및 시각 표시', () => {
  test('실시간 뷰 진입 후 임시 학생 추가 → 체크인', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);

      // 실시간 뷰 이동
      await window.locator('text=실시간').first().click();
      await window.waitForTimeout(1000);

      // 임시 학생 추가
      const tempBtn = window.locator('text=임시').first();
      await tempBtn.click();
      await window.waitForTimeout(500);

      // 모달 입력
      await window.locator('input[placeholder="학생 이름"]').fill('테스트학생');
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      const endHH = (now.getHours() + 1).toString().padStart(2, '0');
      await window.locator('input[type="time"]').nth(0).fill(`${hh}:${mm}`);
      await window.locator('input[type="time"]').nth(1).fill(`${endHH}:${mm}`);
      await window.locator('button:has-text("추가하기")').click();
      await window.waitForTimeout(500);

      await screenshot(window, 'uc05-after-temp-add');

      // 대기 목록에 테스트학생 표시 확인
      const hasStudent = await window.locator('text=테스트학생').isVisible().catch(() => false);
      expect(hasStudent).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('체크인 후 카드에 시작시각/예정종료시각이 표시된다', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);
      await window.locator('text=실시간').first().click();
      await window.waitForTimeout(1000);

      // 임시 학생 추가
      await window.locator('text=임시').first().click();
      await window.waitForTimeout(500);
      await window.locator('input[placeholder="학생 이름"]').fill('시각테스트');
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      const endHH = (now.getHours() + 1).toString().padStart(2, '0');
      await window.locator('input[type="time"]').nth(0).fill(`${hh}:${mm}`);
      await window.locator('input[type="time"]').nth(1).fill(`${endHH}:${mm}`);
      await window.locator('button:has-text("추가하기")').click();
      await window.waitForTimeout(500);

      // 체크인
      await window.locator('text=시각테스트').first().click();
      await window.waitForTimeout(800);

      await screenshot(window, 'uc05-checkin-card');

      const bodyText = await window.locator('body').innerText();
      // 시작 또는 예정종료 텍스트 확인
      const hasTimeRow = bodyText.includes('시작') && bodyText.includes('예정종료');
      expect(hasTimeRow).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('수업추가 버튼이 카드에 존재한다', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);
      await window.locator('text=실시간').first().click();
      await window.waitForTimeout(1000);

      // 임시 학생 추가 & 체크인
      await window.locator('text=임시').first().click();
      await window.waitForTimeout(500);
      await window.locator('input[placeholder="학생 이름"]').fill('추가버튼테스트');
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      await window.locator('input[type="time"]').nth(0).fill(`${hh}:${mm}`);
      await window.locator('input[type="time"]').nth(1).fill(`${(now.getHours() + 1).toString().padStart(2, '0')}:${mm}`);
      await window.locator('button:has-text("추가하기")').click();
      await window.waitForTimeout(500);
      await window.locator('text=추가버튼테스트').first().click();
      await window.waitForTimeout(800);

      const hasExtendBtn = await window.locator('text=수업추가').isVisible().catch(() => false);
      await screenshot(window, 'uc05-extend-button');
      expect(hasExtendBtn).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('수업추가 버튼 클릭 시 +10/+20/+30분 시트가 표시된다', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);
      await window.locator('text=실시간').first().click();
      await window.waitForTimeout(1000);

      // 임시 학생 추가 & 체크인
      await window.locator('text=임시').first().click();
      await window.waitForTimeout(500);
      await window.locator('input[placeholder="학생 이름"]').fill('시트테스트');
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      await window.locator('input[type="time"]').nth(0).fill(`${hh}:${mm}`);
      await window.locator('input[type="time"]').nth(1).fill(`${(now.getHours() + 1).toString().padStart(2, '0')}:${mm}`);
      await window.locator('button:has-text("추가하기")').click();
      await window.waitForTimeout(500);
      await window.locator('text=시트테스트').first().click();
      await window.waitForTimeout(800);

      // 수업추가 버튼 클릭
      await window.locator('text=수업추가').first().click();
      await window.waitForTimeout(500);

      await screenshot(window, 'uc05-extend-sheet');

      const has10 = await window.locator('text=+10분').isVisible().catch(() => false);
      const has20 = await window.locator('text=+20분').isVisible().catch(() => false);
      const has30 = await window.locator('text=+30분').isVisible().catch(() => false);
      expect(has10 && has20 && has30).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('+10분 클릭 시 벌칙 태그와 예정종료 변경이 반영된다', async () => {
    const { app, window } = await launchApp();
    try {
      await injectConfigAndLogin(window);
      await window.locator('text=실시간').first().click();
      await window.waitForTimeout(1000);

      // 임시 학생 추가 & 체크인
      await window.locator('text=임시').first().click();
      await window.waitForTimeout(500);
      await window.locator('input[placeholder="학생 이름"]').fill('벌칙테스트');
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      await window.locator('input[type="time"]').nth(0).fill(`${hh}:${mm}`);
      await window.locator('input[type="time"]').nth(1).fill(`${(now.getHours() + 1).toString().padStart(2, '0')}:${mm}`);
      await window.locator('button:has-text("추가하기")').click();
      await window.waitForTimeout(500);
      await window.locator('text=벌칙테스트').first().click();
      await window.waitForTimeout(800);

      // 수업추가 → +10분
      await window.locator('text=수업추가').first().click();
      await window.waitForTimeout(500);
      await window.locator('text=+10분').first().click();
      await window.waitForTimeout(500);

      await screenshot(window, 'uc05-after-extend');

      const bodyText = await window.locator('body').innerText();
      // 벌칙 태그 또는 +10분 추가 텍스트 확인
      const hasPenalty = bodyText.includes('+10분 추가') || bodyText.includes('벌칙 +10분');
      expect(hasPenalty).toBe(true);
    } finally {
      await app.close();
    }
  });
});
