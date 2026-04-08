# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: health.spec.ts >> Health Check E2E Tests >> should return 200 with ok status
- Location: e2e/health.spec.ts:4:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Health Check E2E Tests', () => {
  4  |   test('should return 200 with ok status', async ({ request }) => {
  5  |     const response = await request.get('/health');
> 6  |     expect(response.status()).toBe(200);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  7  | 
  8  |     const data = await response.json();
  9  |     expect(data).toHaveProperty('status', 'ok');
  10 |     expect(data).toHaveProperty('timestamp');
  11 |   });
  12 | 
  13 |   test('should have valid ISO timestamp', async ({ request }) => {
  14 |     const response = await request.get('/health');
  15 |     const data = await response.json();
  16 | 
  17 |     const timestamp = new Date(data.timestamp);
  18 |     expect(timestamp).toBeInstanceOf(Date);
  19 |     expect(!isNaN(timestamp.getTime())).toBeTruthy();
  20 |   });
  21 | });
  22 | 
  23 | test.describe('CORS Handling E2E Tests', () => {
  24 |   test('should handle OPTIONS request for CORS', async ({ request }) => {
  25 |     const response = await request.options('/api/auth/login', {
  26 |       headers: {
  27 |         'Origin': 'http://localhost:3000',
  28 |       },
  29 |     });
  30 | 
  31 |     expect(response.status()).toBe(200);
  32 |     expect(response.headers()['access-control-allow-origin']).toBeTruthy();
  33 |   });
  34 | 
  35 |   test('should include CORS headers in response', async ({ request }) => {
  36 |     const response = await request.get('/health', {
  37 |       headers: {
  38 |         'Origin': 'http://localhost:3000',
  39 |       },
  40 |     });
  41 | 
  42 |     expect(response.headers()['access-control-allow-origin']).toBeTruthy();
  43 |   });
  44 | });
  45 | 
```