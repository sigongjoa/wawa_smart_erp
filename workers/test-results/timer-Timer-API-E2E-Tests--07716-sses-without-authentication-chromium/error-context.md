# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: timer.spec.ts >> Timer API E2E Tests >> should return 401 when fetching classes without authentication
- Location: e2e/timer.spec.ts:4:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 429
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Timer API E2E Tests', () => {
  4   |   test('should return 401 when fetching classes without authentication', async ({ request }) => {
  5   |     const response = await request.get('/api/timer/classes');
  6   | 
> 7   |     expect(response.status()).toBe(401);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  8   |     const data = await response.json();
  9   |     expect(data.success).toBe(false);
  10  |   });
  11  | 
  12  |   test('should return 401 when fetching class details without authentication', async ({ request }) => {
  13  |     const response = await request.get('/api/timer/classes/class-123');
  14  | 
  15  |     expect(response.status()).toBe(401);
  16  |     const data = await response.json();
  17  |     expect(data.success).toBe(false);
  18  |   });
  19  | 
  20  |   test('should return 401 when creating class without authentication', async ({ request }) => {
  21  |     const response = await request.post('/api/timer/classes', {
  22  |       data: {
  23  |         name: 'Math 101',
  24  |         grade: 1,
  25  |         dayOfWeek: 'Monday',
  26  |         startTime: '09:00',
  27  |         endTime: '10:00',
  28  |         capacity: 30,
  29  |       },
  30  |     });
  31  | 
  32  |     expect(response.status()).toBe(401);
  33  |     const data = await response.json();
  34  |     expect(data.success).toBe(false);
  35  |   });
  36  | 
  37  |   test('should return 400 when creating class with invalid data', async ({ request }) => {
  38  |     const response = await request.post('/api/timer/classes', {
  39  |       headers: {
  40  |         'Authorization': 'Bearer test-token',
  41  |       },
  42  |       data: {
  43  |         name: 'Math 101',
  44  |         // missing required fields
  45  |       },
  46  |     });
  47  | 
  48  |     expect(response.status()).toBe(400);
  49  |     const data = await response.json();
  50  |     expect(data.success).toBe(false);
  51  |   });
  52  | 
  53  |   test('should return 401 when updating class without authentication', async ({ request }) => {
  54  |     const response = await request.patch('/api/timer/classes/class-123', {
  55  |       data: {
  56  |         name: 'Updated Math 101',
  57  |       },
  58  |     });
  59  | 
  60  |     expect(response.status()).toBe(401);
  61  |     const data = await response.json();
  62  |     expect(data.success).toBe(false);
  63  |   });
  64  | 
  65  |   test('should return 401 when recording attendance without authentication', async ({ request }) => {
  66  |     const response = await request.post('/api/timer/attendance', {
  67  |       data: {
  68  |         studentId: 'student-123',
  69  |         classId: 'class-123',
  70  |         date: '2026-04-08',
  71  |         status: 'present',
  72  |       },
  73  |     });
  74  | 
  75  |     expect(response.status()).toBe(401);
  76  |     const data = await response.json();
  77  |     expect(data.success).toBe(false);
  78  |   });
  79  | 
  80  |   test('should return 400 when recording attendance with invalid data', async ({ request }) => {
  81  |     const response = await request.post('/api/timer/attendance', {
  82  |       headers: {
  83  |         'Authorization': 'Bearer test-token',
  84  |       },
  85  |       data: {
  86  |         studentId: 'student-123',
  87  |         // missing required fields
  88  |       },
  89  |     });
  90  | 
  91  |     expect(response.status()).toBe(400);
  92  |     const data = await response.json();
  93  |     expect(data.success).toBe(false);
  94  |   });
  95  | 
  96  |   test('should return 401 when fetching attendance without authentication', async ({ request }) => {
  97  |     const response = await request.get('/api/timer/attendance/class-123/2026-04-08');
  98  | 
  99  |     expect(response.status()).toBe(401);
  100 |     const data = await response.json();
  101 |     expect(data.success).toBe(false);
  102 |   });
  103 | 
  104 |   test('should validate class creation requires instructor or admin role', async ({ request }) => {
  105 |     const response = await request.post('/api/timer/classes', {
  106 |       headers: {
  107 |         'Authorization': 'Bearer student-token',
```