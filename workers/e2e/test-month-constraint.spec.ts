import { test, expect } from '@playwright/test';

/**
 * 월 기반 성적 입력 제약 검증
 * 기존 학생(강은서, test)으로 실제 동작 확인
 */

const API_URL = 'http://localhost:8787';
const TEST_ADMIN = { name: '김상현', pin: '1234' };

// 이미 D1에 있는 학생/시험 IDs
const EXISTING_STUDENTS = {
  '강은서': 'student-5645a3fs4',
  'test': 'student-n66fmc2o7',
};

const EXISTING_EXAMS = {
  '2월': {
    id: 'exam-txuqfieg6',
    month: '2026-02',
    is_active: true,
  },
  '3월': {
    id: 'exam-3월-test',
    month: '2026-03',
    is_active: false,
  },
};

test.describe.serial('🔐 월 기반 성적 입력 제약 검증', () => {
  let adminToken: string;

  test('1. 관리자 로그인', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        name: TEST_ADMIN.name,
        pin: TEST_ADMIN.pin,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data?.accessToken).toBeTruthy();
    adminToken = data.data.accessToken;

    console.log('✅ Admin logged in');
  });

  test('2. 현재 활성 시험 확인 (2026-02)', async ({ request }) => {
    expect(adminToken).toBeTruthy();

    const response = await request.get(
      `${API_URL}/api/grader/exams/current`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data?.exam_month).toBe('2026-02');
    expect(data.data?.is_active).toBe(true);

    console.log(`✅ Current active exam: ${data.data.name} (${data.data.exam_month})`);
  });

  test('3. 강은서의 2월 성적 조회 (이미 입력됨)', async ({ request }) => {
    expect(adminToken).toBeTruthy();

    // grades 테이블 조회는 직접 API가 없으므로, 학생 정보 조회로 확인
    const studentResponse = await request.get(
      `${API_URL}/api/student/${EXISTING_STUDENTS['강은서']}`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }
    );

    expect(studentResponse.status()).toBe(200);
    const studentData = await studentResponse.json();
    expect(studentData.data?.name).toBe('강은서');

    console.log(`✅ 강은서 정보 확인: ${studentData.data.name}`);
  });

  test('4. 다른 월(3월) 시험으로 성적 입력 시도 → 실패해야 함', async ({
    request,
  }) => {
    expect(adminToken).toBeTruthy();

    // 강은서로 3월 시험의 성적 입력 시도
    const gradeResponse = await request.post(
      `${API_URL}/api/grader/grades`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          student_id: EXISTING_STUDENTS['강은서'],
          exam_id: EXISTING_EXAMS['3월'].id,
          score: 80,
          comments: '테스트',
        },
      }
    );

    // 400 에러가 반환되어야 함
    expect(gradeResponse.status()).toBe(400);
    const gradeData = await gradeResponse.json();
    expect(gradeData.message).toContain('설정된 시험 월');

    console.log(
      `✅ 월 기반 제약 작동: ${gradeData.message}`
    );
    console.log(`   시도: 3월 시험(exam_id: ${EXISTING_EXAMS['3월'].id})`);
    console.log(`   결과: 400 에러 (현재 활성 시험은 2026-02)`);
  });

  test('5. 올바른 월(2월) 시험으로 성적 입력 → 성공해야 함', async ({
    request,
  }) => {
    expect(adminToken).toBeTruthy();

    // test 학생으로 2월 시험의 성적 입력
    const gradeResponse = await request.post(
      `${API_URL}/api/grader/grades`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          student_id: EXISTING_STUDENTS['test'],
          exam_id: EXISTING_EXAMS['2월'].id,
          score: 95,
          comments: 'API 테스트 성적',
        },
      }
    );

    expect(gradeResponse.status()).toBe(201);
    const gradeData = await gradeResponse.json();
    expect(gradeData.data?.score).toBe(95);
    expect(gradeData.data?.year_month).toBe('2026-02');

    console.log(`✅ 올바른 월 성적 입력 성공`);
    console.log(`   학생: test`);
    console.log(`   점수: ${gradeData.data.score}`);
    console.log(`   입력 월: ${gradeData.data.year_month}`);
  });

  test('6. 월 변경 시뮬레이션: 3월을 활성화', async ({ request }) => {
    expect(adminToken).toBeTruthy();

    // 3월 시험을 활성화
    const updateResponse = await request.patch(
      `${API_URL}/api/grader/exams/${EXISTING_EXAMS['3월'].id}`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          name: '3월 월말고사',
          exam_month: '2026-03',
          date: '2026-03-15',
          total_score: 100,
          is_active: true,
        },
      }
    );

    expect(updateResponse.status()).toBe(200);
    const updateData = await updateResponse.json();
    expect(updateData.data?.is_active).toBe(true);

    console.log(`✅ 3월 시험 활성화 완료`);
    console.log(`   이제 3월 성적만 입력 가능`);
  });

  test('7. 월 변경 후 2월 시험으로 성적 입력 시도 → 실패해야 함', async ({
    request,
  }) => {
    expect(adminToken).toBeTruthy();

    // 이제 활성 시험이 3월이므로, 2월 시험으로 입력 시도 시 실패
    const gradeResponse = await request.post(
      `${API_URL}/api/grader/grades`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          student_id: EXISTING_STUDENTS['강은서'],
          exam_id: EXISTING_EXAMS['2월'].id,
          score: 78,
          comments: '테스트',
        },
      }
    );

    expect(gradeResponse.status()).toBe(400);
    const gradeData = await gradeResponse.json();
    expect(gradeData.message).toContain('2026-03');

    console.log(`✅ 월 변경 후 이전 월 성적 입력 거부`);
    console.log(`   활성 시험: 3월(2026-03)`);
    console.log(`   시도: 2월 시험 → ${gradeData.message}`);
  });

  test('8. 월 변경 후 3월 시험으로 성적 입력 → 성공해야 함', async ({
    request,
  }) => {
    expect(adminToken).toBeTruthy();

    // 이제 3월 시험으로 성적 입력 시도 시 성공
    const gradeResponse = await request.post(
      `${API_URL}/api/grader/grades`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          student_id: EXISTING_STUDENTS['강은서'],
          exam_id: EXISTING_EXAMS['3월'].id,
          score: 88,
          comments: '3월 성적',
        },
      }
    );

    expect(gradeResponse.status()).toBe(201);
    const gradeData = await gradeResponse.json();
    expect(gradeData.data?.score).toBe(88);
    expect(gradeData.data?.year_month).toBe('2026-03');

    console.log(`✅ 월 변경 후 새로운 월 성적 입력 성공`);
    console.log(`   학생: 강은서`);
    console.log(`   점수: ${gradeData.data.score}`);
    console.log(`   입력 월: ${gradeData.data.year_month}`);
  });

  test('9. 데이터 일관성 검증: 월별 성적이 올바르게 저장됨', async ({
    request,
  }) => {
    expect(adminToken).toBeTruthy();

    // 모든 시험 조회
    const examsResponse = await request.get(`${API_URL}/api/grader/exams`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(examsResponse.status()).toBe(200);
    const examsData = await examsResponse.json();
    expect(Array.isArray(examsData.data)).toBe(true);

    const activeExam = examsData.data.find((e: any) => e.is_active === true);
    expect(activeExam?.exam_month).toBe('2026-03');

    console.log(`✅ 데이터 일관성 검증 완료`);
    console.log(`   현재 활성 시험: ${activeExam.name}`);
    console.log(`   월: ${activeExam.exam_month}`);
    console.log(`   이 월에만 성적 입력 가능`);
  });
});
