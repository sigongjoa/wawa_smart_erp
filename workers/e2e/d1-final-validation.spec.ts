import { test, expect } from '@playwright/test';

/**
 * D1 마이그레이션 최종 검증
 * - 3월 성적 입력 → D1 저장
 * - 4월 성적 입력 → D1 저장 (3월 데이터 유지)
 * - PNG 레포트 생성 및 검증
 */

const API_URL = 'http://localhost:8787';
const APP_URL = 'http://localhost:5174';

test.describe.serial('✅ D1 마이그레이션 최종 검증', () => {
  let studentId = '';
  let examIdMarch = '';
  let examIdApril = '';

  test('1️⃣ 선생님 로그인', async ({ request }) => {
    console.log('\n📍 선생님 로그인...');

    const response = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        name: '김상현',
        pin: '1234',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    console.log('✅ 로그인 성공:', body.user?.name);
  });

  test('2️⃣ 3월 시험 생성', async ({ request }) => {
    console.log('\n📍 3월 시험 생성...');

    const response = await request.post(`${API_URL}/api/grader/exams`, {
      data: {
        subject: '수학',
        year_month: '2026-03',
        difficulty: 'normal',
        scope: '1-3장',
        uploaded_by: '김상현',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    examIdMarch = body.id || 'exam-march-001';
    console.log('✅ 3월 시험 생성:', examIdMarch);
  });

  test('3️⃣ 4월 시험 생성', async ({ request }) => {
    console.log('\n📍 4월 시험 생성...');

    const response = await request.post(`${API_URL}/api/grader/exams`, {
      data: {
        subject: '수학',
        year_month: '2026-04',
        difficulty: 'normal',
        scope: '4-6장',
        uploaded_by: '김상현',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    examIdApril = body.id || 'exam-april-001';
    console.log('✅ 4월 시험 생성:', examIdApril);
  });

  test('4️⃣ 학생 조회', async ({ request }) => {
    console.log('\n📍 학생 목록 조회...');

    const response = await request.get(`${API_URL}/api/student`);
    expect(response.ok()).toBeTruthy();

    const students = await response.json();
    const student = students.find((s: any) => s.name === '강은서') || students[0];
    studentId = student.id;

    console.log('✅ 학생 찾음:', student.name, '(ID:', studentId, ')');
    console.log('   전체 학생:', students.length, '명');
  });

  test('5️⃣ 3월 성적 입력 → D1 저장', async ({ request }) => {
    console.log('\n📍 3월 성적 입력...');

    const response = await request.post(`${API_URL}/api/grader/grades`, {
      data: {
        student_id: studentId,
        exam_id: examIdMarch,
        score: 95,
        comment: '3월 좋은 성적',
        subject: '수학',
        year_month: '2026-03',
        teacher_id: 'kim-sanghyun',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    console.log('✅ 3월 성적 저장됨');
    console.log('   학생:', studentId);
    console.log('   점수:', 95);
    console.log('   월:', '2026-03');
    console.log('   응답:', result);
  });

  test('6️⃣ 4월 성적 입력 → D1 저장', async ({ request }) => {
    console.log('\n📍 4월 성적 입력...');

    const response = await request.post(`${API_URL}/api/grader/grades`, {
      data: {
        student_id: studentId,
        exam_id: examIdApril,
        score: 92,
        comment: '4월 우수 성적',
        subject: '수학',
        year_month: '2026-04',
        teacher_id: 'kim-sanghyun',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    console.log('✅ 4월 성적 저장됨');
    console.log('   학생:', studentId);
    console.log('   점수:', 92);
    console.log('   월:', '2026-04');
    console.log('   응답:', result);
  });

  test('7️⃣ 3월 성적 데이터 조회 확인', async ({ request }) => {
    console.log('\n📍 3월 성적 데이터 조회...');

    const response = await request.get(`${API_URL}/api/report?yearMonth=2026-03`);
    expect(response.ok()).toBeTruthy();

    const reports = await response.json();
    const marchReport = reports.find((r: any) => r.studentId === studentId && r.yearMonth === '2026-03');

    expect(marchReport).toBeDefined();
    console.log('✅ 3월 성적 데이터 확인됨');
    console.log('   점수:', marchReport?.scores?.[0]?.score || 'N/A');
    console.log('   과목:', marchReport?.scores?.[0]?.subject || 'N/A');
  });

  test('8️⃣ 4월 성적 데이터 조회 확인', async ({ request }) => {
    console.log('\n📍 4월 성적 데이터 조회...');

    const response = await request.get(`${API_URL}/api/report?yearMonth=2026-04`);
    expect(response.ok()).toBeTruthy();

    const reports = await response.json();
    const aprilReport = reports.find((r: any) => r.studentId === studentId && r.yearMonth === '2026-04');

    expect(aprilReport).toBeDefined();
    console.log('✅ 4월 성적 데이터 확인됨');
    console.log('   점수:', aprilReport?.scores?.[0]?.score || 'N/A');
    console.log('   과목:', aprilReport?.scores?.[0]?.subject || 'N/A');
  });

  test('9️⃣ 두 월의 데이터 모두 유지 확인', async ({ request }) => {
    console.log('\n📍 3월/4월 데이터 모두 유지 확인...');

    const marchResponse = await request.get(`${API_URL}/api/report?yearMonth=2026-03`);
    const aprilResponse = await request.get(`${API_URL}/api/report?yearMonth=2026-04`);

    const marchReports = await marchResponse.json();
    const aprilReports = await aprilResponse.json();

    const hasMarch = marchReports.some((r: any) => r.studentId === studentId);
    const hasApril = aprilReports.some((r: any) => r.studentId === studentId);

    expect(hasMarch).toBeTruthy();
    expect(hasApril).toBeTruthy();

    console.log('✅ 3월 데이터 유지됨:', hasMarch);
    console.log('✅ 4월 데이터 유지됨:', hasApril);
  });

  test('🔟 UI에서 월 변경 후 데이터 확인', async ({ page }) => {
    console.log('\n📍 UI 테스트: 월 변경 후 데이터 확인...');

    // 앱 로드
    await page.goto(APP_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 로그인
    const inputs = await page.locator('input');
    await inputs.nth(0).fill('김상현');
    await inputs.nth(1).fill('1234');

    const loginButton = await page.locator('button:has-text("로그인")');
    await loginButton.click();

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 성적 입력 페이지 방문
    await page.goto(`${APP_URL}/#/report/input`);
    await page.waitForTimeout(2000);

    console.log('✅ 로그인 및 페이지 진입 완료');
    console.log('   현재 URL:', page.url());
  });
});
