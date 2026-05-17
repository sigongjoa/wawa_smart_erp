/**
 * Vocab Gacha 학생앱 E2E (브라우저)
 *
 * 1. 관리자(API)로 학생/단어/문법 데이터 생성
 * 2. 학생 브라우저: 로그인 → 홈에 영단어 카드 표시 확인
 * 3. /vocab 페이지: 내 단어 목록 표시
 * 4. /vocab 페이지: 새 단어 추가
 * 5. /vocab 페이지: 문법 질문 추가
 * 6. /vocab 페이지: 교과서 탭
 * 7. 정리
 *
 * 실행:
 *   cd apps/student
 *   STUDENT_URL=https://wawa-learn.pages.dev \
 *   API_URL=https://wawa-smart-erp-api.zeskywa499.workers.dev \
 *   npx playwright test e2e/vocab-flow.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

const API = process.env.API_URL || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
  academyName: process.env.E2E_ACADEMY_NAME || 'E2E',
};
const UNIQUE = `vc${Date.now().toString(36)}`;
const STUDENT_NAME = `vocab학생-${UNIQUE}`;
const STUDENT_PIN = '1234';

let adminToken = '';
let studentId = '';
const wordIds: string[] = [];
let grammarId = '';

async function apiPost(path: string, body: any, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return res.json();
}
async function apiDelete(path: string, token: string) {
  const res = await fetch(`${API}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  return res.status;
}

test.describe.serial('Vocab Gacha 학생앱 E2E', () => {

  test('0. 데이터 준비 (API)', async () => {
    const loginRes = await apiPost('/api/auth/login', {
      slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin,
    });
    adminToken = loginRes.data?.accessToken;
    expect(adminToken).toBeTruthy();

    const stuRes = await apiPost('/api/gacha/students', {
      name: STUDENT_NAME, grade: '중1', pin: STUDENT_PIN,
    }, adminToken);
    studentId = stuRes.data?.id;
    expect(studentId).toBeTruthy();
    console.log(`✅ 학생 생성: ${STUDENT_NAME}`);

    // 단어 3개 (approved 상태로 생성)
    for (let i = 1; i <= 3; i++) {
      const wRes = await apiPost('/api/vocab/words', {
        student_id: studentId,
        english: `e2eword${i}-${UNIQUE}`,
        korean: `시험단어${i}`,
        status: 'approved',
      }, adminToken);
      const id = wRes.data?.id;
      expect(id).toBeTruthy();
      wordIds.push(id);
    }
    console.log(`✅ 단어 3개 생성`);

    const gRes = await apiPost('/api/vocab/grammar', {
      question: `e2e문법질문-${UNIQUE}`,
      answer: '테스트답변',
      student_id: studentId,
    }, adminToken);
    grammarId = gRes.data?.id;
    expect(grammarId).toBeTruthy();
    console.log(`✅ 문법 Q&A 생성`);
  });

  test('1. 로그인 → 홈에 영단어 카드 노출', async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.locator('.home-mode-card:has-text("영단어")')).toBeVisible();
  });

  test('2. 영단어 카드 클릭 → /vocab 진입', async ({ page }) => {
    await loginAsStudent(page);
    await page.click('.home-mode-card:has-text("영단어")');
    await page.waitForURL(/#\/vocab/, { timeout: 10000 });
  });

  test('3. 내 단어 목록 표시', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/#/vocab');
    // API 호출로 단어 로드 대기
    await expect(page.getByText(`e2eword1-${UNIQUE}`)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(`e2eword2-${UNIQUE}`)).toBeVisible();
    await expect(page.getByText(`e2eword3-${UNIQUE}`)).toBeVisible();
    console.log('✅ 단어 3개 모두 노출');
  });

  test('4. 학생이 새 단어 직접 추가', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/#/vocab');

    const addEng = `addbystu-${UNIQUE}`;
    const addKor = `학생추가단어-${UNIQUE}`;

    // 추가 form 토글
    await page.click('button:has-text("+ 단어 추가")');
    await page.fill('input[placeholder="영단어"]', addEng);
    await page.fill('input[placeholder="뜻"]', addKor);
    await page.locator('.add-form button:has-text("추가")').click();

    await expect(page.getByText(addEng)).toBeVisible({ timeout: 10000 });
    console.log('✅ 학생 단어 추가 → 목록 반영');
  });

  test('5. 문법 탭 → 답변된 Q&A 노출', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/#/vocab');
    await page.locator('.tabs button:has-text("문법 Q&A")').click();
    await expect(page.getByText(`e2e문법질문-${UNIQUE}`)).toBeVisible({ timeout: 10000 });
    console.log('✅ 문법 Q&A 노출');
  });

  test('6. 교재 탭 노출', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/#/vocab');
    await page.locator('.tabs button:has-text("교재")').click();
    await expect(page.locator('.textbook-list')).toBeVisible({ timeout: 5000 });
    console.log('✅ 교재 탭 렌더');
  });

  test('7. 정리 (API)', async () => {
    for (const id of wordIds) {
      await apiDelete(`/api/vocab/words/${id}`, adminToken);
    }
    if (grammarId) await apiDelete(`/api/vocab/grammar/${grammarId}`, adminToken);
    if (studentId) await apiDelete(`/api/gacha/students/${studentId}`, adminToken);
    console.log('✅ 정리 완료');
  });
});

async function loginAsStudent(page: Page) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click(`.academy-item:has-text("${TEACHER.academyName}")`);
  await page.fill('input[placeholder="이름"]', STUDENT_NAME);
  await page.fill('input[placeholder*="PIN"]', STUDENT_PIN);
  await page.click('.login-btn');
  await expect(page.locator('.home-page')).toBeVisible({ timeout: 15000 });
}
