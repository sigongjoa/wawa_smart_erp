import { test, expect } from '@playwright/test';

/**
 * 시험 월 설정 API 통합 테스트
 * UC1: 관리자가 시험 월 설정
 * UC2: 선생님이 활성 시험 월 조회
 * UC3: 설정된 월과 다른 월로 성적 입력 시도 (400 에러)
 * UC4: 설정된 월로 성적 입력 (성공)
 * UC5: 페이지 새로고침 후 설정값 유지
 */

const APP_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8787';

test.describe.serial('⚙️ 시험 월 설정 (D1 저장)', () => {
  let page: any;
  let adminToken: string;
  let studentId: string;
  let examId_March: string;
  let examId_April: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Error] ${err.message}`));

    // 관리자 로그인 (API)
    const loginRes = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { name: '김상현', pin: '1234' }
    });
    const loginData = await loginRes.json();
    adminToken = loginData.data.accessToken;
    console.log('✅ 관리자 로그인');
  });

  test('UC1: 관리자가 시험 월 설정 (2026-04)', async () => {
    const response = await page.request.post(
      `${API_URL}/api/settings/active-exam-month`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: { activeExamMonth: '2026-04' }
      }
    );

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.activeExamMonth).toBe('2026-04');
    console.log('✅ 시험 월 설정 저장: 2026-04');
  });

  test('UC2: 선생님이 활성 시험 월 조회', async () => {
    const response = await page.request.get(
      `${API_URL}/api/settings/active-exam-month`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data.activeExamMonth).toBe('2026-04');
    console.log('✅ 활성 시험 월 조회: 2026-04');
  });

  test('UC3: 설정된 월(4월)과 다른 월(3월) 시험 생성 및 성적 입력 시도', async () => {
    // 3월 시험 생성
    const examRes = await page.request.post(
      `${API_URL}/api/grader/exams`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          name: '3월 수학',
          exam_month: '2026-03',
          date: '2026-03-15',
          total_score: 100,
          is_active: false
        }
      }
    );
    expect(examRes.status()).toBe(201);
    const examData = await examRes.json();
    examId_March = examData.data.id;
    console.log('✅ 3월 시험 생성');

    // 강은서 학생 ID 조회
    const studentRes = await page.request.get(
      `${API_URL}/api/student`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }
    );
    const students = await studentRes.json();
    studentId = students.find((s: any) => s.name === '강은서')?.id;
    console.log(`✅ 학생 ID 조회: ${studentId}`);

    // 다른 월(3월) 시험에 성적 입력 시도 → 400 에러 예상
    const gradeRes = await page.request.post(
      `${API_URL}/api/grader/grades`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          student_id: studentId,
          exam_id: examId_March,
          score: 85
        }
      }
    );

    expect(gradeRes.status()).toBe(400);
    const gradeData = await gradeRes.json();
    expect(gradeData.error).toContain('2026-04');
    console.log('✅ 다른 월 성적 입력 거절 (400 에러)');
  });

  test('UC4: 설정된 월(4월) 시험 생성 및 성적 입력 성공', async () => {
    // 4월 시험 생성
    const examRes = await page.request.post(
      `${API_URL}/api/grader/exams`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          name: '4월 수학',
          exam_month: '2026-04',
          date: '2026-04-15',
          total_score: 100,
          is_active: true
        }
      }
    );
    expect(examRes.status()).toBe(201);
    const examData = await examRes.json();
    examId_April = examData.data.id;
    console.log('✅ 4월 시험 생성');

    // 4월 시험에 성적 입력 → 성공
    const gradeRes = await page.request.post(
      `${API_URL}/api/grader/grades`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          student_id: studentId,
          exam_id: examId_April,
          score: 92
        }
      }
    );

    expect(gradeRes.status()).toBe(201);
    const gradeData = await gradeRes.json();
    expect(gradeData.data.score).toBe(92);
    console.log('✅ 4월 성적 입력 성공: 92점');
  });

  test('UC5: 페이지 새로고침 후 설정값 유지 (D1 저장 확인)', async () => {
    // 웹앱 열기
    await page.goto(APP_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 로그인
    const inputs = await page.locator('input');
    await inputs.nth(0).fill('김상현');
    await inputs.nth(1).fill('1234');
    const loginButton = await page.locator('button:has-text("로그인")');
    await loginButton.click();

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 설정 페이지 접근
    const settingsButton = await page.locator('button[aria-label="설정"]');
    await settingsButton.click();
    await page.waitForTimeout(500);

    // 시험 월 설정 탭 클릭
    const examTab = await page.locator('button').filter({ hasText: '시험 월 설정' });
    await examTab.click();
    await page.waitForTimeout(500);

    // 드롭다운에서 선택된 값 확인
    const selectBox = await page.locator('select').first();
    const selectedValue = await selectBox.inputValue();

    expect(selectedValue).toBe('2026-04');
    console.log(`✅ 페이지 새로고침 후 설정값 유지: ${selectedValue}`);
  });

  test.afterAll(async () => {
    if (page) {
      await page.close();
    }
    console.log('✅ 모든 테스트 완료');
  });
});
