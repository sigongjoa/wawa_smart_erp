import { test, expect } from '@playwright/test';

/**
 * Student → Exam Setup → Grade Entry → Parent Report Generation Flow
 * E2E Tests covering the complete monthly exam and grading workflow
 */

const API_URL = (process.env.LIVE_API_URL || '').startsWith('http')
  ? process.env.LIVE_API_URL
  : 'https://api.wawa.app';

// Test data fixtures
const TEST_ADMIN = { name: '김상현', pin: '1234' };
const TEST_STUDENT_NAME = `E2E_테스트_${Date.now()}`;
const TEST_EXAM_MONTH = '2026-04';
const TEST_EXAM_DATE = '2026-04-15';

test.describe.serial('📊 Student → Exam → Grade → Report Complete Flow', () => {
  let adminToken: string;
  let academyId: string;
  let studentId: string;
  let examId: string;

  test.beforeAll(async () => {
    console.log(`\n🔗 Using API URL: ${API_URL}`);
  });

  // 관리자 로그인
  test('UC-001: Admin Login and Get Academy Info', async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        name: TEST_ADMIN.name,
        pin: TEST_ADMIN.pin,
      },
    });

    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    expect(loginData.success).toBe(true);
    expect(loginData.data?.accessToken).toBeTruthy();
    expect(loginData.data?.user?.role).toBe('admin');

    adminToken = loginData.data.accessToken;
    academyId = loginData.data?.user?.academyId || 'acad-1';

    console.log('✅ Admin logged in successfully');
    console.log(`   Token: ${adminToken.substring(0, 20)}...`);
    console.log(`   Academy: ${academyId}`);
  });

  // 학생 생성
  test('UC-002: Create Test Student', async ({ request }) => {
    expect(adminToken).toBeTruthy();

    const createResponse = await request.post(`${API_URL}/api/student`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        name: TEST_STUDENT_NAME,
        grade: '1학년',
        contact: '010-1234-5678',
        guardian_contact: '010-9876-5432',
        status: 'active',
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    expect(createData.success).toBe(true);
    expect(createData.data?.id).toBeTruthy();
    expect(createData.data?.name).toBe(TEST_STUDENT_NAME);

    studentId = createData.data.id;

    console.log('✅ Student created successfully');
    console.log(`   Student ID: ${studentId}`);
    console.log(`   Name: ${TEST_STUDENT_NAME}`);
  });

  // 학생 목록 조회 확인
  test('UC-003: Verify Student in List', async ({ request }) => {
    expect(adminToken).toBeTruthy();
    expect(studentId).toBeTruthy();

    const listResponse = await request.get(`${API_URL}/api/student`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(listResponse.status()).toBe(200);
    const listData = await listResponse.json();
    expect(listData.success).toBe(true);
    expect(Array.isArray(listData.data)).toBe(true);

    const foundStudent = listData.data.find(
      (s: any) => s.id === studentId
    );
    expect(foundStudent).toBeTruthy();
    expect(foundStudent.name).toBe(TEST_STUDENT_NAME);

    console.log('✅ Student found in list');
    console.log(`   Total students: ${listData.data.length}`);
  });

  // 시험 생성 (활성 상태로)
  test('UC-004: Create Active Exam with Month Setting', async ({ request }) => {
    expect(adminToken).toBeTruthy();

    const createExamResponse = await request.post(
      `${API_URL}/api/grader/exams`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          name: '4월 월말고사',
          exam_month: TEST_EXAM_MONTH,
          date: TEST_EXAM_DATE,
          total_score: 100,
          is_active: true,
        },
      }
    );

    expect(createExamResponse.status()).toBe(201);
    const examData = await createExamResponse.json();
    expect(examData.success).toBe(true);
    expect(examData.data?.id).toBeTruthy();
    expect(examData.data?.exam_month).toBe(TEST_EXAM_MONTH);
    expect(examData.data?.is_active).toBe(true);

    examId = examData.data.id;

    console.log('✅ Exam created with month setting');
    console.log(`   Exam ID: ${examId}`);
    console.log(`   Exam Month: ${TEST_EXAM_MONTH}`);
    console.log(`   Active: ${examData.data.is_active}`);
  });

  // 활성 시험 조회
  test('UC-005: Retrieve Current Active Exam', async ({ request }) => {
    expect(adminToken).toBeTruthy();

    const currentExamResponse = await request.get(
      `${API_URL}/api/grader/exams/current`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }
    );

    expect(currentExamResponse.status()).toBe(200);
    const currentExam = await currentExamResponse.json();
    expect(currentExam.success).toBe(true);
    expect(currentExam.data?.is_active).toBe(true);
    expect(currentExam.data?.exam_month).toBe(TEST_EXAM_MONTH);

    console.log('✅ Current active exam retrieved');
    console.log(`   Current Exam ID: ${currentExam.data.id}`);
    console.log(`   Month: ${currentExam.data.exam_month}`);
  });

  // 성적 입력 (올바른 월)
  test('UC-006: Enter Grade for Current Month (Valid)', async ({ request }) => {
    expect(adminToken).toBeTruthy();
    expect(studentId).toBeTruthy();
    expect(examId).toBeTruthy();

    const gradeResponse = await request.post(
      `${API_URL}/api/grader/grades`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          student_id: studentId,
          exam_id: examId,
          score: 85,
          comments: '우수한 성적',
        },
      }
    );

    expect(gradeResponse.status()).toBe(201);
    const gradeData = await gradeResponse.json();
    expect(gradeData.success).toBe(true);
    expect(gradeData.data?.id).toBeTruthy();
    expect(gradeData.data?.score).toBe(85);
    expect(gradeData.data?.year_month).toBe(TEST_EXAM_MONTH);

    console.log('✅ Grade entered successfully for current month');
    console.log(`   Grade ID: ${gradeData.data.id}`);
    console.log(`   Score: ${gradeData.data.score}`);
    console.log(`   Year-Month: ${gradeData.data.year_month}`);
  });

  // 다른 월의 시험으로 성적 입력 시도 (실패해야 함)
  test('UC-007: Grade Entry Fails When Exam Month Mismatch', async ({
    request,
  }) => {
    expect(adminToken).toBeTruthy();
    expect(studentId).toBeTruthy();

    // 다른 월의 시험 생성
    const otherExamResponse = await request.post(
      `${API_URL}/api/grader/exams`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          name: '3월 월말고사',
          exam_month: '2026-03',
          date: '2026-03-15',
          total_score: 100,
          is_active: false,
        },
      }
    );

    expect(otherExamResponse.status()).toBe(201);
    const otherExamData = await otherExamResponse.json();
    const otherExamId = otherExamData.data.id;

    // 현재 활성 시험이 4월이므로, 3월 시험으로 성적 입력 시도 시 실패해야 함
    const failGradeResponse = await request.post(
      `${API_URL}/api/grader/grades`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          student_id: studentId,
          exam_id: otherExamId,
          score: 75,
          comments: '테스트',
        },
      }
    );

    expect(failGradeResponse.status()).toBe(400);
    const failData = await failGradeResponse.json();
    expect(failData.success).toBe(false);
    expect(failData.message).toContain('설정된 시험 월');

    console.log('✅ Grade entry correctly rejected for wrong month');
    console.log(`   Error: ${failData.message}`);
  });

  // 리포트 전송 설정
  test('UC-008: Configure Report Send Date Range', async ({ request }) => {
    expect(adminToken).toBeTruthy();

    const configResponse = await request.post(
      `${API_URL}/api/report/send-config`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          start_date: '2026-04-20',
          end_date: '2026-04-30',
        },
      }
    );

    expect(configResponse.status()).toBe(201);
    const configData = await configResponse.json();
    expect(configData.success).toBe(true);
    expect(configData.data?.start_date).toBe('2026-04-20');
    expect(configData.data?.end_date).toBe('2026-04-30');

    console.log('✅ Report send config created');
    console.log(`   Start Date: ${configData.data.start_date}`);
    console.log(`   End Date: ${configData.data.end_date}`);
  });

  // 리포트 설정 조회
  test('UC-009: Retrieve Report Send Configuration', async ({ request }) => {
    expect(adminToken).toBeTruthy();

    const getConfigResponse = await request.get(
      `${API_URL}/api/report/send-config`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }
    );

    expect(getConfigResponse.status()).toBe(200);
    const configData = await getConfigResponse.json();
    expect(configData.success).toBe(true);
    expect(configData.data?.start_date).toBeTruthy();
    expect(configData.data?.end_date).toBeTruthy();

    console.log('✅ Report send config retrieved');
    console.log(`   Config ID: ${configData.data.id}`);
  });

  // 학생 정보 수정
  test('UC-010: Update Student Information', async ({ request }) => {
    expect(adminToken).toBeTruthy();
    expect(studentId).toBeTruthy();

    const updateResponse = await request.patch(
      `${API_URL}/api/student/${studentId}`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          name: TEST_STUDENT_NAME,
          grade: '2학년',
          contact: '010-1111-2222',
          guardian_contact: '010-3333-4444',
          status: 'active',
        },
      }
    );

    expect(updateResponse.status()).toBe(200);
    const updateData = await updateResponse.json();
    expect(updateData.success).toBe(true);
    expect(updateData.data?.grade).toBe('2학년');

    console.log('✅ Student information updated');
    console.log(`   Grade: ${updateData.data.grade}`);
    console.log(`   Contact: ${updateData.data.contact}`);
  });

  // 개별 학생 조회
  test('UC-011: Retrieve Individual Student Details', async ({ request }) => {
    expect(adminToken).toBeTruthy();
    expect(studentId).toBeTruthy();

    const getResponse = await request.get(
      `${API_URL}/api/student/${studentId}`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }
    );

    expect(getResponse.status()).toBe(200);
    const studentData = await getResponse.json();
    expect(studentData.success).toBe(true);
    expect(studentData.data?.id).toBe(studentId);
    expect(studentData.data?.name).toBe(TEST_STUDENT_NAME);

    console.log('✅ Student details retrieved');
    console.log(`   Student: ${studentData.data.name}`);
    console.log(`   Grade: ${studentData.data.grade}`);
    console.log(`   Status: ${studentData.data.status}`);
  });

  // 시험 목록 조회
  test('UC-012: List All Exams for Academy', async ({ request }) => {
    expect(adminToken).toBeTruthy();

    const listResponse = await request.get(`${API_URL}/api/grader/exams`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(listResponse.status()).toBe(200);
    const examList = await listResponse.json();
    expect(examList.success).toBe(true);
    expect(Array.isArray(examList.data)).toBe(true);

    const currentExam = examList.data.find((e: any) => e.is_active);
    expect(currentExam).toBeTruthy();
    expect(currentExam.exam_month).toBe(TEST_EXAM_MONTH);

    console.log('✅ Exam list retrieved');
    console.log(`   Total exams: ${examList.data.length}`);
    console.log(`   Active exam: ${currentExam.name} (${currentExam.exam_month})`);
  });

  // 시험 정보 수정
  test('UC-013: Update Exam Information', async ({ request }) => {
    expect(adminToken).toBeTruthy();
    expect(examId).toBeTruthy();

    const updateResponse = await request.patch(
      `${API_URL}/api/grader/exams/${examId}`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          name: '4월 중간고사 (수정됨)',
          exam_month: TEST_EXAM_MONTH,
          date: TEST_EXAM_DATE,
          total_score: 100,
          is_active: true,
        },
      }
    );

    expect(updateResponse.status()).toBe(200);
    const updateData = await updateResponse.json();
    expect(updateData.success).toBe(true);
    expect(updateData.data?.name).toContain('수정됨');

    console.log('✅ Exam information updated');
    console.log(`   Name: ${updateData.data.name}`);
  });

  // 시험 활성화 상태 변경
  test('UC-014: Deactivate and Reactivate Exam', async ({ request }) => {
    expect(adminToken).toBeTruthy();
    expect(examId).toBeTruthy();

    // 비활성화
    const deactivateResponse = await request.patch(
      `${API_URL}/api/grader/exams/${examId}`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          name: '4월 중간고사 (수정됨)',
          exam_month: TEST_EXAM_MONTH,
          date: TEST_EXAM_DATE,
          total_score: 100,
          is_active: false,
        },
      }
    );

    expect(deactivateResponse.status()).toBe(200);
    let deactivateData = await deactivateResponse.json();
    expect(deactivateData.data?.is_active).toBe(false);

    console.log('✅ Exam deactivated');

    // 재활성화
    const reactivateResponse = await request.patch(
      `${API_URL}/api/grader/exams/${examId}`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          name: '4월 중간고사 (수정됨)',
          exam_month: TEST_EXAM_MONTH,
          date: TEST_EXAM_DATE,
          total_score: 100,
          is_active: true,
        },
      }
    );

    expect(reactivateResponse.status()).toBe(200);
    deactivateData = await reactivateResponse.json();
    expect(deactivateData.data?.is_active).toBe(true);

    console.log('✅ Exam reactivated');
  });

  // 권한 검증 (일반 사용자는 성적 입력 불가)
  test('UC-015: Authorization Check - Non-Admin Cannot Enter Grades', async ({
    request,
  }) => {
    // 인증 없이 성적 입력 시도
    const unauthorizedResponse = await request.post(
      `${API_URL}/api/grader/grades`,
      {
        data: {
          student_id: studentId,
          exam_id: examId,
          score: 90,
          comments: '테스트',
        },
      }
    );

    expect(unauthorizedResponse.status()).toBe(401);
    const unauthorizedData = await unauthorizedResponse.json();
    expect(unauthorizedData.success).toBe(false);

    console.log('✅ Unauthorized grade entry correctly rejected');
  });

  // 데이터 정합성 검증
  test('UC-016: Data Consistency Verification', async ({ request }) => {
    expect(adminToken).toBeTruthy();
    expect(studentId).toBeTruthy();

    // 학생 정보 조회
    const studentResponse = await request.get(
      `${API_URL}/api/student/${studentId}`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }
    );
    const student = await studentResponse.json();

    // 활성 시험 조회
    const examResponse = await request.get(
      `${API_URL}/api/grader/exams/current`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }
    );
    const exam = await examResponse.json();

    // 리포트 설정 조회
    const configResponse = await request.get(
      `${API_URL}/api/report/send-config`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }
    );
    const config = await configResponse.json();

    expect(student.data?.id).toBe(studentId);
    expect(exam.data?.exam_month).toBe(TEST_EXAM_MONTH);
    expect(config.data?.start_date).toBeTruthy();

    console.log('✅ Data consistency verified');
    console.log(`   Student: ${student.data.name}`);
    console.log(`   Exam Month: ${exam.data.exam_month}`);
    console.log(`   Report Period: ${config.data.start_date} ~ ${config.data.end_date}`);
  });
});
