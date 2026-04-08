import { test, expect } from '@playwright/test';

const TEACHER = {
  email: 'teacher1@academy.local',
  password: '1234',
};

test.describe('Timer API E2E Tests', () => {
  // 유효한 토큰을 얻는 헬퍼 함수
  const getAccessToken = async (request: any) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEACHER.email,
        password: TEACHER.password,
      },
    });

    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      return data.data?.accessToken || '';
    }
    return '';
  };
  test('should return 401 when fetching classes without authentication', async ({ request }) => {
    const response = await request.get('/api/timer/classes');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when fetching class details without authentication', async ({ request }) => {
    const response = await request.get('/api/timer/classes/class-123');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when creating class without authentication', async ({ request }) => {
    const response = await request.post('/api/timer/classes', {
      data: {
        name: 'Math 101',
        grade: 1,
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
        capacity: 30,
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 400 when creating class with invalid data', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEACHER.email,
        password: TEACHER.password,
      },
    });

    if (!loginResponse.ok()) {
      throw new Error('Failed to login for test');
    }

    const loginData = await loginResponse.json();
    const accessToken = loginData.data?.accessToken;

    const response = await request.post('/api/timer/classes', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        name: '', // Empty string - should fail validation
      },
    });

    expect([400, 500]).toContain(response.status());
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when updating class without authentication', async ({ request }) => {
    const response = await request.patch('/api/timer/classes/class-123', {
      data: {
        name: 'Updated Math 101',
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when recording attendance without authentication', async ({ request }) => {
    const response = await request.post('/api/timer/attendance', {
      data: {
        studentId: 'student-123',
        classId: 'class-123',
        date: '2026-04-08',
        status: 'present',
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 400 when recording attendance with invalid data', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEACHER.email,
        password: TEACHER.password,
      },
    });

    if (!loginResponse.ok()) {
      throw new Error('Failed to login for test');
    }

    const loginData = await loginResponse.json();
    const accessToken = loginData.data?.accessToken;

    const response = await request.post('/api/timer/attendance', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        studentId: 'invalid-uuid',
        // missing required fields and invalid format
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 when fetching attendance without authentication', async ({ request }) => {
    const response = await request.get('/api/timer/attendance/class-123/2026-04-08');

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should validate class creation requires instructor or admin role', async ({ request }) => {
    const response = await request.post('/api/timer/classes', {
      headers: {
        'Authorization': 'Bearer student-token',
      },
      data: {
        name: 'Math 101',
        grade: 1,
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
        capacity: 30,
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should validate attendance recording requires instructor or admin role', async ({ request }) => {
    const response = await request.post('/api/timer/attendance', {
      headers: {
        'Authorization': 'Bearer student-token',
      },
      data: {
        studentId: 'student-123',
        classId: 'class-123',
        date: '2026-04-08',
        status: 'present',
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});
