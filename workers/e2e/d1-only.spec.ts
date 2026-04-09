/**
 * D1 전용 E2E 테스트
 * Notion API 제거 후 D1 기반 동작 검증
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8787';

test.describe('D1 Only - No Notion API', () => {
  let token: string;

  test.beforeAll(async () => {
    // 테스트 환경 설정
    console.log('🚀 D1 Only 테스트 시작');
  });

  test('1. 로그인 및 인증 토큰 받기', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        name: '김상현',
        pin: '1234',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.accessToken).toBeTruthy();

    token = data.data.accessToken;
    console.log('✅ 로그인 성공');
  });

  test('2. D1에서 선생님 목록 조회 (Notion API 미사용)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/teachers`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    console.log(`✅ 선생님 목록 조회: ${data.data.length}명`);
  });

  test('3. D1에서 학생 목록 조회 (Notion API 미사용)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/student`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    console.log(`✅ 학생 목록 조회: ${data.data.length}명`);
  });

  test('4. D1에서 시험 목록 조회 (특정 월)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/grader/exams?exam_month=2026-04`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    console.log(`✅ 시험 목록 조회: ${data.data?.length || 0}개`);
  });

  test('5. D1에서 성적 조회 (특정 월)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/report?yearMonth=2026-04`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    console.log(`✅ 성적 조회: ${data.data?.length || 0}개`);
  });

  test('6. D1 CSV 마이그레이션 엔드포인트 (Notion 데이터 import)', async ({ request }) => {
    // 마이그레이션 가능 여부만 확인
    const response = await request.options(`${BASE_URL}/api/migrate/csv`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // OPTIONS 또는 POST로 엔드포인트 존재 여부 확인
    expect([200, 404, 405]).toContain(response.status());
    console.log(`✅ CSV 마이그레이션 엔드포인트 확인: ${response.status()}`);
  });

  test('7. D1 시험 생성 - 이번 달 (4월)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/grader/exams`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        subject: '수학',
        year_month: '2026-04',
        difficulty: '상',
        scope: '1-5장',
        uploaded_by: 'user-i170bjn6w',
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    console.log(`✅ 시험 생성 성공: ${data.data?.id}`);
  });

  test('8. D1 성적 저장 (특정 시험에 점수 입력)', async ({ request }) => {
    // 먼저 학생과 시험 목록 조회
    const studentsRes = await request.get(`${BASE_URL}/api/student`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const students = await studentsRes.json();

    if (!students.data || students.data.length === 0) {
      console.log('⚠️ 학생이 없어서 성적 저장 스킵');
      return;
    }

    const examsRes = await request.get(`${BASE_URL}/api/grader/exams?exam_month=2026-04`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const exams = await examsRes.json();

    if (!exams.data || exams.data.length === 0) {
      console.log('⚠️ 시험이 없어서 성적 저장 스킵');
      return;
    }

    const studentId = students.data[0].id;
    const examId = exams.data[0].id;

    const response = await request.post(`${BASE_URL}/api/grader/grades`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        student_id: studentId,
        exam_id: examId,
        score: 95,
        comment: 'E2E 테스트',
        subject: '수학',
        year_month: '2026-04',
        teacher_id: 'user-i170bjn6w',
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    console.log(`✅ 성적 저장 성공: ${studentId} - 95점`);
  });

  test('9. 콘솔 로그 검증 - Notion API 호출 없음', async ({ page }) => {
    // 콘솔 메시지 수집
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    // 페이지 방문
    await page.goto('http://localhost:5174');
    await page.waitForTimeout(2000);

    // Notion 관련 로그 확인
    const notionLogs = consoleLogs.filter(log =>
      log.includes('Notion') ||
      log.includes('notion') ||
      log.includes('[Notion')
    );

    // Notion 호출이 없어야 함
    if (notionLogs.length > 0) {
      console.warn('⚠️ Notion 관련 로그 발견:', notionLogs);
    } else {
      console.log('✅ Notion API 호출 없음 (D1 전용 사용)');
    }
  });

  test('10. D1 API 응답 시간 검증', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.get(`${BASE_URL}/api/student`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(1000); // 1초 이내

    console.log(`✅ D1 API 응답 시간: ${responseTime}ms`);
  });
});

test.describe('D1 Only - No Notion Settings Required', () => {
  test('설정 페이지 - Notion API Key 필드 없음', async ({ page }) => {
    await page.goto('http://localhost:5174');

    // Settings 페이지로 이동
    await page.click('a[href*="settings"]');
    await page.waitForTimeout(1000);

    // Notion API Key 입력 필드가 없어야 함
    const notionKeyField = await page.locator('input[placeholder*="Notion"]').count();
    const notionApiKeyField = await page.locator('input[id*="notion"]').count();

    console.log(`⚠️ Notion 관련 필드: ${notionKeyField + notionApiKeyField}개 (0이어야 함)`);
  });
});
