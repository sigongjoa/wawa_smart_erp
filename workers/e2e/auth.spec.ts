import { test, expect } from '@playwright/test';

// Notion 마이그레이션된 선생님 자격증명 (남현욱)
const NOTION_TEACHER = {
  name: '남현욱',
  pin: '1312',
};

test.describe('Authentication E2E Tests', () => {
  let accessToken: string;

  test('should fail login with missing name', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        name: '',
        pin: 'password123',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should fail login with missing pin', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        name: '테스트',
        pin: '',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should fail login with non-existent user', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        name: '존재하지않는선생님',
        pin: 'password123',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should return 401 for missing authentication header', async ({ request }) => {
    const response = await request.get('/api/timer/classes');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 for invalid token', async ({ request }) => {
    const response = await request.get('/api/timer/classes', {
      headers: {
        'Authorization': 'Bearer invalid-token-xyz',
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should successfully login with valid teacher credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        name: NOTION_TEACHER.name,
        pin: NOTION_TEACHER.pin,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.accessToken).toBeTruthy();
    expect(data.data.refreshToken).toBeTruthy();
    expect(data.data.user.name).toBe(NOTION_TEACHER.name);
  });
});

test.describe('Rate Limiting E2E Tests', () => {
  test('should not exceed rate limit on health check', async ({ request }) => {
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(request.get('/health'));
    }

    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status());

    // 대부분의 요청이 200이어야 함
    const successCount = statusCodes.filter(s => s === 200).length;
    expect(successCount).toBeGreaterThan(5);
  });
});

test.describe('Refresh Token E2E Tests', () => {
  test('should fail refresh with invalid token format', async ({ request }) => {
    // 먼저 유효한 토큰을 얻기
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'teacher1@academy.local',
        password: '1234',
      },
    });

    const loginData = await loginResponse.json();

    // 그 후 잘못된 형식의 refresh token으로 테스트
    const response = await request.post('/api/auth/refresh', {
      data: {
        refreshToken: 'invalid-format-token',
      },
    });

    expect([400, 401]).toContain(response.status());
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should fail refresh with missing refreshToken', async ({ request }) => {
    const response = await request.post('/api/auth/refresh', {
      data: {},
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});
