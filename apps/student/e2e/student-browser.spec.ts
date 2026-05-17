/**
 * 학생용 개념가차 브라우저 E2E 테스트
 *
 * 실제 브라우저에서 UI를 조작하여 전체 학습 플로우를 검증합니다.
 *   1. 로그인 페이지 → PIN 로그인
 *   2. 홈 → 가차 카드 학습
 *   3. 홈 → 증명 순서배치
 *   4. 홈 → 증명 빈칸채우기
 *   5. 로그아웃
 *
 * 사전조건: API로 테스트 학생 + 카드 + 증명을 생성한 뒤 브라우저 테스트 실행
 *
 * 실행:
 *   cd apps/student
 *   STUDENT_URL=https://6f84d999.wawa-learn.pages.dev \
 *   API_URL=https://wawa-smart-erp-api.zeskywa499.workers.dev \
 *   npx playwright test e2e/student-browser.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

const API = process.env.API_URL || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
  academyName: process.env.E2E_ACADEMY_NAME || 'E2E',
};
const UNIQUE = `ui${Date.now().toString(36)}`;
const STUDENT_NAME = `ui학생-${UNIQUE}`;
const STUDENT_PIN = '1234';

// ── 공유 상태 (API로 세팅) ──
let adminToken = '';
let studentId = '';
let cardIds: string[] = [];
let proofId = '';

// ── API 헬퍼 ──
async function apiPost(path: string, body: any, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(path: string, token: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function apiPut(path: string, body: any, token: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiDelete(path: string, token: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

// ── 테스트 데이터 셋업 (API) ──
test.describe.serial('학생앱 브라우저 E2E', () => {

  test('0. 테스트 데이터 준비 (API)', async () => {
    // 1) 관리자 로그인
    const loginRes = await apiPost('/api/auth/login', {
      slug: TEACHER.slug,
      name: TEACHER.name,
      pin: TEACHER.pin,
    });
    adminToken = loginRes.data?.accessToken;
    expect(adminToken).toBeTruthy();
    console.log('✅ 관리자 로그인');

    // 2) 테스트 학생 생성
    const stuRes = await apiPost('/api/gacha/students', {
      name: STUDENT_NAME,
      grade: '중1',
      pin: STUDENT_PIN,
    }, adminToken);
    studentId = stuRes.data?.id;
    expect(studentId).toBeTruthy();
    console.log(`✅ 학생 생성: ${STUDENT_NAME} (${studentId})`);

    // 3) 카드 3장 생성
    for (let i = 1; i <= 3; i++) {
      const cardRes = await apiPost('/api/gacha/cards', {
        type: 'text',
        question: `UI테스트 문제${i} ${UNIQUE}`,
        answer: `정답${i}`,
        topic: 'UI테스트',
      }, adminToken);
      cardIds.push(cardRes.data?.id);
    }
    expect(cardIds).toHaveLength(3);
    console.log(`✅ 카드 3장 생성`);

    // 4) 증명 생성 + 단계 등록
    const proofRes = await apiPost('/api/proof', {
      title: `UI증명-${UNIQUE}`,
      grade: '중1',
      difficulty: 2,
      description: 'UI 테스트용 증명',
    }, adminToken);
    proofId = proofRes.data?.id;
    expect(proofId).toBeTruthy();

    const steps = ['가정을 세운다', '삼각형 ABC를 그린다', '내각의 합을 구한다', '180도임을 보인다'];
    await apiPut(`/api/proof/${proofId}/steps`, {
      steps: steps.map((content, i) => ({ step_order: i + 1, content })),
    }, adminToken);
    console.log(`✅ 증명 생성 (4단계): ${proofId}`);

    // 5) 학생에 증명 배정
    await apiPost(`/api/proof/${proofId}/assign`, {
      student_ids: [studentId],
    }, adminToken);
    console.log('✅ 증명 배정 완료');
  });

  // ── 브라우저 테스트 ──

  test('1. 로그인 페이지 로드', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.locator('.login-title')).toContainText('WAWA Learn');
    await expect(page.locator('.login-academy-select')).toBeVisible();
    await expect(page.locator('input[placeholder="이름"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="PIN"]')).toBeVisible();
    console.log('✅ 로그인 페이지 정상 로드');
  });

  test('2. 잘못된 PIN으로 로그인 실패', async ({ page }) => {
    await page.goto('/#/login');
    await page.click('.login-academy-select');
    await page.click(`.academy-item:has-text("${TEACHER.academyName}")`);
    await page.fill('input[placeholder="이름"]', STUDENT_NAME);
    await page.fill('input[placeholder*="PIN"]', '9999');
    await page.click('.login-btn');

    // 에러 메시지 표시
    await expect(page.locator('.login-error')).toBeVisible({ timeout: 10000 });
    console.log('✅ 잘못된 PIN → 에러 표시');
  });

  test('3. 정상 로그인 → 홈 이동', async ({ page }) => {
    await page.goto('/#/login');
    await page.click('.login-academy-select');
    await page.click(`.academy-item:has-text("${TEACHER.academyName}")`);
    await page.fill('input[placeholder="이름"]', STUDENT_NAME);
    await page.fill('input[placeholder*="PIN"]', STUDENT_PIN);
    await page.click('.login-btn');

    // 홈 페이지로 이동 확인
    await expect(page.locator('.home-page')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h1')).toContainText(STUDENT_NAME);
    console.log('✅ 로그인 성공 → 홈 페이지');
  });

  test('4. 홈 → 가차 카드 학습', async ({ page }) => {
    // 로그인
    await loginAsStudent(page);

    // 가차 카드 버튼 클릭
    await page.click('.home-mode-card:has-text("가차 카드")');
    await expect(page.locator('.gacha-page, .card-container, [class*="gacha"]')).toBeVisible({ timeout: 10000 });
    console.log('✅ 가차 카드 페이지 진입');
  });

  test('5. 홈 → 증명 순서배치', async ({ page }) => {
    await loginAsStudent(page);

    // 배정된 증명 목록이 로드될 때까지 대기
    await expect(page.locator('.home-proof-list')).toBeVisible({ timeout: 15000 });

    // 순서배치 버튼 클릭
    const orderBtn = page.locator('button:has-text("순서배치")').first();
    await expect(orderBtn).toBeVisible({ timeout: 5000 });
    await orderBtn.click();

    // 순서배치 페이지 로드 확인 (URL 변경)
    await page.waitForURL(/#\/proof\/.*\/ordering/, { timeout: 10000 });
    console.log('✅ 순서배치 페이지 진입');
  });

  test('6. 홈 → 증명 빈칸채우기', async ({ page }) => {
    await loginAsStudent(page);

    // 배정된 증명 목록이 로드될 때까지 대기
    await expect(page.locator('.home-proof-list')).toBeVisible({ timeout: 15000 });

    // 빈칸채우기 버튼 클릭
    const fillBtn = page.locator('button:has-text("빈칸채우기")').first();
    await expect(fillBtn).toBeVisible({ timeout: 5000 });
    await fillBtn.click();

    // 빈칸채우기 페이지 로드 확인 (URL 변경)
    await page.waitForURL(/#\/proof\/.*\/fillblank/, { timeout: 10000 });
    console.log('✅ 빈칸채우기 페이지 진입');
  });

  test('7. 로그아웃', async ({ page }) => {
    await loginAsStudent(page);

    // 로그아웃 버튼 클릭
    await page.click('button:has-text("로그아웃")');

    // 로그인 페이지로 돌아감
    await expect(page.locator('.login-page')).toBeVisible({ timeout: 10000 });
    console.log('✅ 로그아웃 → 로그인 페이지');
  });

  // ── 정리 ──
  test('8. 테스트 데이터 정리 (API)', async () => {
    // 증명 배정 해제
    await apiDelete(`/api/proof/${proofId}/assign/${studentId}`, adminToken);
    // 증명 삭제
    await apiDelete(`/api/proof/${proofId}`, adminToken);
    // 카드 삭제
    for (const id of cardIds) {
      await apiDelete(`/api/gacha/cards/${id}`, adminToken);
    }
    // 학생 삭제
    await apiDelete(`/api/gacha/students/${studentId}`, adminToken);
    console.log('✅ 테스트 데이터 정리 완료');
  });
});

// ── 로그인 헬퍼 ──
async function loginAsStudent(page: Page) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click(`.academy-item:has-text("${TEACHER.academyName}")`);
  await page.fill('input[placeholder="이름"]', STUDENT_NAME);
  await page.fill('input[placeholder*="PIN"]', STUDENT_PIN);
  await page.click('.login-btn');
  await expect(page.locator('.home-page')).toBeVisible({ timeout: 15000 });
}
