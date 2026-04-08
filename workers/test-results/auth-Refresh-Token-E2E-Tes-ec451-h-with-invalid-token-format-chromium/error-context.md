# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Refresh Token E2E Tests >> should fail refresh with invalid token format
- Location: e2e/auth.spec.ts:89:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 400
Received: 401
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // 테스트용 자격증명
  4   | const TEST_USER = {
  5   |   email: 'test@example.com',
  6   |   password: 'Test@1234567890',
  7   | };
  8   | 
  9   | test.describe('Authentication E2E Tests', () => {
  10  |   let accessToken: string;
  11  | 
  12  |   test('should fail login with invalid email format', async ({ request }) => {
  13  |     const response = await request.post('/api/auth/login', {
  14  |       data: {
  15  |         email: 'invalid-email',
  16  |         password: 'password123',
  17  |       },
  18  |     });
  19  | 
  20  |     expect(response.status()).toBe(400);
  21  |     const data = await response.json();
  22  |     expect(data.success).toBe(false);
  23  |     expect(data.error).toContain('입력 검증');
  24  |   });
  25  | 
  26  |   test('should fail login with missing password', async ({ request }) => {
  27  |     const response = await request.post('/api/auth/login', {
  28  |       data: {
  29  |         email: TEST_USER.email,
  30  |       },
  31  |     });
  32  | 
  33  |     expect(response.status()).toBe(400);
  34  |     const data = await response.json();
  35  |     expect(data.success).toBe(false);
  36  |   });
  37  | 
  38  |   test('should fail login with non-existent user', async ({ request }) => {
  39  |     const response = await request.post('/api/auth/login', {
  40  |       data: {
  41  |         email: 'nonexistent@example.com',
  42  |         password: 'password123',
  43  |       },
  44  |     });
  45  | 
  46  |     expect([401, 404]).toContain(response.status());
  47  |     const data = await response.json();
  48  |     expect(data.success).toBe(false);
  49  |   });
  50  | 
  51  |   test('should return 401 for missing authentication header', async ({ request }) => {
  52  |     const response = await request.get('/api/timer/classes');
  53  | 
  54  |     expect(response.status()).toBe(401);
  55  |     const data = await response.json();
  56  |     expect(data.success).toBe(false);
  57  |   });
  58  | 
  59  |   test('should return 401 for invalid token', async ({ request }) => {
  60  |     const response = await request.get('/api/timer/classes', {
  61  |       headers: {
  62  |         'Authorization': 'Bearer invalid-token-xyz',
  63  |       },
  64  |     });
  65  | 
  66  |     expect(response.status()).toBe(401);
  67  |     const data = await response.json();
  68  |     expect(data.success).toBe(false);
  69  |   });
  70  | });
  71  | 
  72  | test.describe('Rate Limiting E2E Tests', () => {
  73  |   test('should not exceed rate limit on health check', async ({ request }) => {
  74  |     const requests = [];
  75  |     for (let i = 0; i < 10; i++) {
  76  |       requests.push(request.get('/health'));
  77  |     }
  78  | 
  79  |     const responses = await Promise.all(requests);
  80  |     const statusCodes = responses.map(r => r.status());
  81  | 
  82  |     // 대부분의 요청이 200이어야 함
  83  |     const successCount = statusCodes.filter(s => s === 200).length;
  84  |     expect(successCount).toBeGreaterThan(5);
  85  |   });
  86  | });
  87  | 
  88  | test.describe('Refresh Token E2E Tests', () => {
  89  |   test('should fail refresh with invalid token format', async ({ request }) => {
  90  |     const response = await request.post('/api/auth/refresh', {
  91  |       data: {
  92  |         refreshToken: 'invalid-format',
  93  |       },
  94  |     });
  95  | 
> 96  |     expect(response.status()).toBe(400);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  97  |     const data = await response.json();
  98  |     expect(data.success).toBe(false);
  99  |   });
  100 | 
  101 |   test('should fail refresh with missing refreshToken', async ({ request }) => {
  102 |     const response = await request.post('/api/auth/refresh', {
  103 |       data: {},
  104 |     });
  105 | 
  106 |     expect(response.status()).toBe(400);
  107 |     const data = await response.json();
  108 |     expect(data.success).toBe(false);
  109 |   });
  110 | });
  111 | 
```