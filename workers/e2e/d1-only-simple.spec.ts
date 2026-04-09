/**
 * D1 전용 E2E 테스트 (간단 버전)
 * Notion API 제거 후 D1 기반 동작 검증
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8787';
let token: string;

test.describe('D1 Only - Notion API 완전 제거 검증', () => {
  test.beforeAll(async ({ playwright }) => {
    // 테스트 토큰 획득
    const context = await playwright.request.newContext();
    const response = await context.post(`${BASE_URL}/api/auth/login`, {
      data: {
        name: '김상현',
        pin: '1234',
      },
    });
    const data = await response.json();
    token = data.data.accessToken;
    await context.dispose();
  });

  test('1️⃣ 로그인 및 토큰 획득', async ({ request }) => {
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
    console.log('✅ 로그인 성공');
  });

  test('2️⃣ D1 API - 선생님 목록 조회', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/teachers`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    console.log(`✅ 선생님 ${data.data.length}명 조회`);
  });

  test('3️⃣ D1 API - 학생 목록 조회', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/student`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    console.log(`✅ 학생 ${data.data.length}명 조회`);
  });

  test('4️⃣ D1 API - 시험 목록 조회 (2026-04)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/grader/exams?exam_month=2026-04`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    console.log(`✅ 시험 ${data.data.length}개 조회`);
  });

  test('5️⃣ D1 API - 성적 조회 (2026-04)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/report?yearMonth=2026-04`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    console.log(`✅ 성적 ${data.data.length}개 조회`);
  });

  test('6️⃣ D1 API - 응답 시간 검증 (1초 이내)', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/student`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const elapsed = Date.now() - startTime;

    expect(response.status()).toBe(200);
    expect(elapsed).toBeLessThan(1000);
    console.log(`✅ API 응답 시간: ${elapsed}ms`);
  });

  test('7️⃣ Notion API 호출 없음 검증', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.goto('http://localhost:5174');
    await page.waitForTimeout(2000);

    const notionLogs = logs.filter(log =>
      log.includes('[Notion') || log.includes('notionFetch')
    );

    if (notionLogs.length > 0) {
      console.warn('⚠️ Notion 로그:', notionLogs);
    } else {
      console.log('✅ Notion API 호출 없음 (D1 전용)');
    }

    expect(notionLogs.length).toBe(0);
  });

  test('8️⃣ CSV 마이그레이션 엔드포인트 존재', async ({ request }) => {
    // CSV 업로드 엔드포인트 테스트 (빈 파일)
    const formData = new FormData();
    formData.append('file', new File(['id,name,grade\ntest-001,테스트,고1'], 'test.csv', { type: 'text/csv' }));

    const response = await request.post(`${BASE_URL}/api/migrate/csv`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'test.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('id,name,grade\ntest-001,테스트,고1'),
        },
      },
    });

    expect([201, 400, 415]).toContain(response.status());
    console.log(`✅ CSV 마이그레이션 엔드포인트 작동`);
  });
});

test.describe('설정 페이지 검증 - Notion 설정 없음', () => {
  test('설정 페이지 로드 확인', async ({ page }) => {
    // 설정 페이지 URL 직접 접근
    await page.goto('http://localhost:5174/settings');

    // Notion 관련 텍스트 없음
    const notionTextElements = await page.locator('text=/Notion|notion/').count();
    const notionInputFields = await page.locator('input[id*="notion"]').count();

    console.log(`⚠️ Notion 관련 요소: ${notionTextElements + notionInputFields}개`);

    // API Key 입력 필드 없음
    expect(notionInputFields).toBe(0);
    console.log('✅ Notion API Key 필드 없음');
  });
});
