import { test, expect } from '@playwright/test';

const TEACHER = {
  name: '김상현',
  pin: '1234',
};

test.describe('Message API E2E Tests', () => {
  let accessToken: string = '';

  test.beforeEach(async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        name: TEACHER.name,
        pin: TEACHER.pin,
      },
    });

    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      accessToken = data.data?.accessToken || '';
    }
  });
  test('should return 401 when sending message without authentication', async ({ request }) => {
    const response = await request.post('/api/message/', {
      data: {
        recipientId: 'user-123',
        content: 'Hello',
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 400 when sending message without content', async ({ request }) => {
    const response = await request.post('/api/message/', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        recipientId: 'user-123',
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when fetching inbox without authentication', async ({ request }) => {
    const response = await request.get('/api/message/inbox');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when fetching sent messages without authentication', async ({ request }) => {
    const response = await request.get('/api/message/sent');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when fetching conversation without authentication', async ({ request }) => {
    const response = await request.get('/api/message/conversation/user-123');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when marking message as read without authentication', async ({ request }) => {
    const response = await request.patch('/api/message/msg-123/read', {
      data: {},
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when deleting message without authentication', async ({ request }) => {
    const response = await request.delete('/api/message/msg-123');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});
