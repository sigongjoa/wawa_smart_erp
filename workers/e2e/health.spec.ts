import { test, expect } from '@playwright/test';

test.describe('Health Check E2E Tests', () => {
  test('should return 200 with ok status', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.data).toHaveProperty('status', 'ok');
    expect(data.data).toHaveProperty('timestamp');
  });

  test('should have valid ISO timestamp', async ({ request }) => {
    const response = await request.get('/health');
    const data = await response.json();

    const timestamp = new Date(data.data.timestamp);
    expect(timestamp).toBeInstanceOf(Date);
    expect(!isNaN(timestamp.getTime())).toBeTruthy();
  });
});

test.describe('CORS Handling E2E Tests', () => {
  test('should handle OPTIONS request for CORS', async ({ request }) => {
    const response = await request.fetch('/api/auth/login', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });

    expect([200, 204]).toContain(response.status());
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).toBeTruthy();
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
