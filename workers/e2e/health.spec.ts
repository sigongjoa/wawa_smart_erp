import { test, expect } from '@playwright/test';

test.describe('Health Check E2E Tests', () => {
  test('should return 200 with ok status', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
  });

  test('should have valid ISO timestamp', async ({ request }) => {
    const response = await request.get('/health');
    const data = await response.json();

    const timestamp = new Date(data.timestamp);
    expect(timestamp).toBeInstanceOf(Date);
    expect(!isNaN(timestamp.getTime())).toBeTruthy();
  });
});

test.describe('CORS Handling E2E Tests', () => {
  test('should handle OPTIONS request for CORS', async ({ request }) => {
    const response = await request.options('/api/auth/login', {
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['access-control-allow-origin']).toBeTruthy();
  });

  test('should include CORS headers in response', async ({ request }) => {
    const response = await request.get('/health', {
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });

    expect(response.headers()['access-control-allow-origin']).toBeTruthy();
  });
});
