# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: message.spec.ts >> Message API E2E Tests >> should return 401 when fetching sent messages without authentication
- Location: e2e/message.spec.ts:40:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 429
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Message API E2E Tests', () => {
  4  |   test('should return 401 when sending message without authentication', async ({ request }) => {
  5  |     const response = await request.post('/api/message/', {
  6  |       data: {
  7  |         recipientId: 'user-123',
  8  |         content: 'Hello',
  9  |       },
  10 |     });
  11 | 
  12 |     expect(response.status()).toBe(401);
  13 |     const data = await response.json();
  14 |     expect(data.success).toBe(false);
  15 |   });
  16 | 
  17 |   test('should return 400 when sending message without content', async ({ request }) => {
  18 |     const response = await request.post('/api/message/', {
  19 |       headers: {
  20 |         'Authorization': 'Bearer test-token',
  21 |       },
  22 |       data: {
  23 |         recipientId: 'user-123',
  24 |       },
  25 |     });
  26 | 
  27 |     expect(response.status()).toBe(400);
  28 |     const data = await response.json();
  29 |     expect(data.success).toBe(false);
  30 |   });
  31 | 
  32 |   test('should return 401 when fetching inbox without authentication', async ({ request }) => {
  33 |     const response = await request.get('/api/message/inbox');
  34 | 
  35 |     expect(response.status()).toBe(401);
  36 |     const data = await response.json();
  37 |     expect(data.success).toBe(false);
  38 |   });
  39 | 
  40 |   test('should return 401 when fetching sent messages without authentication', async ({ request }) => {
  41 |     const response = await request.get('/api/message/sent');
  42 | 
> 43 |     expect(response.status()).toBe(401);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  44 |     const data = await response.json();
  45 |     expect(data.success).toBe(false);
  46 |   });
  47 | 
  48 |   test('should return 401 when fetching conversation without authentication', async ({ request }) => {
  49 |     const response = await request.get('/api/message/conversation/user-123');
  50 | 
  51 |     expect(response.status()).toBe(401);
  52 |     const data = await response.json();
  53 |     expect(data.success).toBe(false);
  54 |   });
  55 | 
  56 |   test('should return 401 when marking message as read without authentication', async ({ request }) => {
  57 |     const response = await request.patch('/api/message/msg-123/read', {
  58 |       data: {},
  59 |     });
  60 | 
  61 |     expect(response.status()).toBe(401);
  62 |     const data = await response.json();
  63 |     expect(data.success).toBe(false);
  64 |   });
  65 | 
  66 |   test('should return 401 when deleting message without authentication', async ({ request }) => {
  67 |     const response = await request.delete('/api/message/msg-123');
  68 | 
  69 |     expect(response.status()).toBe(401);
  70 |     const data = await response.json();
  71 |     expect(data.success).toBe(false);
  72 |   });
  73 | });
  74 | 
```