import { test, expect } from '@playwright/test';

// 테스트용 자격증명
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test@1234567890',
};

test.describe('Authentication E2E Tests', () => {
  let accessToken: string;

  test('should fail login with invalid email format', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'invalid-email',
        password: 'password123',
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('입력 검증');
  });

  test('should fail login with missing password', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: TEST_USER.email,
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should fail login with non-existent user', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'nonexistent@example.com',
        password: 'password123',
      },
    });

    expect([401, 404]).toContain(response.status());
    const data = await response.json();
    expect(data.success).toBe(false);
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
    const response = await request.post('/api/auth/refresh', {
      data: {
        refreshToken: 'invalid-format',
      },
    });

    expect(response.status()).toBe(400);
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
