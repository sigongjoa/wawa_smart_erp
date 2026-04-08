import { test, expect } from '@playwright/test';

test.describe('File API E2E Tests', () => {
  test('should return 401 when uploading file without authentication', async ({ request }) => {
    const response = await request.post('/api/file/upload', {
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('test content'),
        },
        folder: 'test',
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 400 when uploading without file', async ({ request }) => {
    const response = await request.post('/api/file/upload', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
      multipart: {
        folder: 'test',
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('파일');
  });

  test('should return 401 when downloading file without authentication', async ({ request }) => {
    const response = await request.get('/api/file/download/test-key');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 400 when downloading without key', async ({ request }) => {
    const response = await request.get('/api/file/download/', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should return 404 when downloading non-existent file', async ({ request }) => {
    const response = await request.get('/api/file/download/nonexistent-key', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });

    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when deleting file without authentication', async ({ request }) => {
    const response = await request.delete('/api/file/test-key');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 400 when deleting without key', async ({ request }) => {
    const response = await request.delete('/api/file/', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should return 403 when deleting file without ownership', async ({ request }) => {
    const response = await request.delete('/api/file/other-user-file-key', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });

    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('권한');
  });

  test('should return 401 when listing files without authentication', async ({ request }) => {
    const response = await request.get('/api/file/list/documents');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 400 when listing without folder', async ({ request }) => {
    const response = await request.get('/api/file/list/', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });

    expect(response.status()).toBe(404);
  });
});
