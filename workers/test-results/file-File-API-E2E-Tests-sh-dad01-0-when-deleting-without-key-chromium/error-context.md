# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: file.spec.ts >> File API E2E Tests >> should return 400 when deleting without key
- Location: e2e/file.spec.ts:74:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 401
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('File API E2E Tests', () => {
  4   |   test('should return 401 when uploading file without authentication', async ({ request }) => {
  5   |     const response = await request.post('/api/file/upload', {
  6   |       multipart: {
  7   |         file: {
  8   |           name: 'test.txt',
  9   |           mimeType: 'text/plain',
  10  |           buffer: Buffer.from('test content'),
  11  |         },
  12  |         folder: 'test',
  13  |       },
  14  |     });
  15  | 
  16  |     expect(response.status()).toBe(401);
  17  |     const data = await response.json();
  18  |     expect(data.success).toBe(false);
  19  |   });
  20  | 
  21  |   test('should return 400 when uploading without file', async ({ request }) => {
  22  |     const response = await request.post('/api/file/upload', {
  23  |       headers: {
  24  |         'Authorization': 'Bearer test-token',
  25  |       },
  26  |       multipart: {
  27  |         folder: 'test',
  28  |       },
  29  |     });
  30  | 
  31  |     expect(response.status()).toBe(400);
  32  |     const data = await response.json();
  33  |     expect(data.error).toContain('파일');
  34  |   });
  35  | 
  36  |   test('should return 401 when downloading file without authentication', async ({ request }) => {
  37  |     const response = await request.get('/api/file/download/test-key');
  38  | 
  39  |     expect(response.status()).toBe(401);
  40  |     const data = await response.json();
  41  |     expect(data.success).toBe(false);
  42  |   });
  43  | 
  44  |   test('should return 400 when downloading without key', async ({ request }) => {
  45  |     const response = await request.get('/api/file/download/', {
  46  |       headers: {
  47  |         'Authorization': 'Bearer test-token',
  48  |       },
  49  |     });
  50  | 
  51  |     expect(response.status()).toBe(404);
  52  |   });
  53  | 
  54  |   test('should return 404 when downloading non-existent file', async ({ request }) => {
  55  |     const response = await request.get('/api/file/download/nonexistent-key', {
  56  |       headers: {
  57  |         'Authorization': 'Bearer test-token',
  58  |       },
  59  |     });
  60  | 
  61  |     expect(response.status()).toBe(404);
  62  |     const data = await response.json();
  63  |     expect(data.success).toBe(false);
  64  |   });
  65  | 
  66  |   test('should return 401 when deleting file without authentication', async ({ request }) => {
  67  |     const response = await request.delete('/api/file/test-key');
  68  | 
  69  |     expect(response.status()).toBe(401);
  70  |     const data = await response.json();
  71  |     expect(data.success).toBe(false);
  72  |   });
  73  | 
  74  |   test('should return 400 when deleting without key', async ({ request }) => {
  75  |     const response = await request.delete('/api/file/', {
  76  |       headers: {
  77  |         'Authorization': 'Bearer test-token',
  78  |       },
  79  |     });
  80  | 
> 81  |     expect(response.status()).toBe(404);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  82  |   });
  83  | 
  84  |   test('should return 403 when deleting file without ownership', async ({ request }) => {
  85  |     const response = await request.delete('/api/file/other-user-file-key', {
  86  |       headers: {
  87  |         'Authorization': 'Bearer test-token',
  88  |       },
  89  |     });
  90  | 
  91  |     expect(response.status()).toBe(403);
  92  |     const data = await response.json();
  93  |     expect(data.error).toContain('권한');
  94  |   });
  95  | 
  96  |   test('should return 401 when listing files without authentication', async ({ request }) => {
  97  |     const response = await request.get('/api/file/list/documents');
  98  | 
  99  |     expect(response.status()).toBe(401);
  100 |     const data = await response.json();
  101 |     expect(data.success).toBe(false);
  102 |   });
  103 | 
  104 |   test('should return 400 when listing without folder', async ({ request }) => {
  105 |     const response = await request.get('/api/file/list/', {
  106 |       headers: {
  107 |         'Authorization': 'Bearer test-token',
  108 |       },
  109 |     });
  110 | 
  111 |     expect(response.status()).toBe(404);
  112 |   });
  113 | });
  114 | 
```