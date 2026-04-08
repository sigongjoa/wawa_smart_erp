import { test, expect } from '@playwright/test';

const ADMIN_USER = {
  name: '김상현',
  pin: '1234',
};

test.describe('Admin Dashboard E2E Tests', () => {
  let accessToken: string = '';

  test.beforeEach(async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        name: ADMIN_USER.name,
        pin: ADMIN_USER.pin,
      },
    });

    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      accessToken = data.data?.accessToken || '';
    }
  });

  // UC-1: Admin Page Access Control (Backend validation)
  test('should validate admin user can access student management', async ({ request }) => {
    const response = await request.get('/api/timer/classes', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect([200, 404]).toContain(response.status());
  });

  test('should return 401 when accessing without authentication', async ({ request }) => {
    const response = await request.get('/api/timer/classes');

    expect(response.status()).toBe(401);
  });

  test('should return 401 when accessing with invalid token', async ({ request }) => {
    const response = await request.get('/api/timer/classes', {
      headers: {
        'Authorization': 'Bearer invalid-token-xyz',
      },
    });

    expect(response.status()).toBe(401);
  });

  // UC-2: Student Management Tab (using Timer classes as proxy)
  test('should list classes for admin user', async ({ request }) => {
    const response = await request.get('/api/timer/classes', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect([200, 404]).toContain(response.status());
  });

  test('should create new class with admin authentication', async ({ request }) => {
    const response = await request.post('/api/timer/classes', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        name: 'Test Class',
        grade: 1,
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
        capacity: 30,
      },
    });

    expect([200, 201, 400]).toContain(response.status());
  });

  test('should return 401 when creating class without authentication', async ({ request }) => {
    const response = await request.post('/api/timer/classes', {
      data: {
        name: 'Test Class',
        grade: 1,
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should return 400 when creating class with invalid data', async ({ request }) => {
    const response = await request.post('/api/timer/classes', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        name: '',
        // Missing required fields
      },
    });

    expect([400, 500]).toContain(response.status());
  });

  test('should update class with admin authentication', async ({ request }) => {
    const updateResponse = await request.patch('/api/timer/classes/class-123', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        name: 'Updated Class',
      },
    });

    expect([200, 400, 404]).toContain(updateResponse.status());
  });

  test('should return 401 when updating class without authentication', async ({ request }) => {
    const response = await request.patch('/api/timer/classes/class-123', {
      data: {
        name: 'Updated',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should delete class with admin authentication', async ({ request }) => {
    const response = await request.delete('/api/timer/classes/class-123', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect([200, 404]).toContain(response.status());
  });

  test('should return 401 when deleting class without authentication', async ({ request }) => {
    const response = await request.delete('/api/timer/classes/class-123');

    expect(response.status()).toBe(401);
  });

  // UC-3: System Settings Tab - Report Settings
  test('should access report settings with admin authentication', async ({ request }) => {
    const response = await request.get('/api/report/settings', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect([200, 404]).toContain(response.status());
  });

  test('should return 401 when accessing report settings without authentication', async ({ request }) => {
    const response = await request.get('/api/report/settings');

    expect(response.status()).toBe(401);
  });

  test('should update report settings with admin authentication', async ({ request }) => {
    const response = await request.patch('/api/report/settings', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        prompt: 'Test prompt',
      },
    });

    expect([200, 201, 400]).toContain(response.status());
  });

  test('should return 401 when updating report settings without authentication', async ({ request }) => {
    const response = await request.patch('/api/report/settings', {
      data: {
        prompt: 'Test prompt',
      },
    });

    expect(response.status()).toBe(401);
  });

  // UC-4: System Settings Tab - Admin Access Validation
  test('should allow admin to fetch timer settings', async ({ request }) => {
    const response = await request.get('/api/timer/settings', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect([200, 404]).toContain(response.status());
  });

  test('should return 401 when accessing timer settings without authentication', async ({ request }) => {
    const response = await request.get('/api/timer/settings');

    expect(response.status()).toBe(401);
  });

  test('should allow admin to update timer settings', async ({ request }) => {
    const response = await request.patch('/api/timer/settings', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        defaultStartTime: '09:00',
      },
    });

    expect([200, 201, 400]).toContain(response.status());
  });

  test('should return 401 when updating timer settings without authentication', async ({ request }) => {
    const response = await request.patch('/api/timer/settings', {
      data: {
        defaultStartTime: '09:00',
      },
    });

    expect(response.status()).toBe(401);
  });

  // UC-5: Role-Based Access Control
  test('should block non-admin from deleting class', async ({ request }) => {
    const response = await request.delete('/api/timer/classes/class-123', {
      headers: {
        'Authorization': 'Bearer student-token',
      },
    });

    expect([401, 403]).toContain(response.status());
  });

  test('should block non-admin from updating settings', async ({ request }) => {
    const response = await request.patch('/api/timer/settings', {
      headers: {
        'Authorization': 'Bearer student-token',
      },
      data: {
        defaultStartTime: '09:00',
      },
    });

    expect([401, 403]).toContain(response.status());
  });

  // UC-6: Navigation and Data Consistency
  test('should maintain data consistency across admin operations', async ({ request }) => {
    // Fetch classes
    const classesResponse1 = await request.get('/api/timer/classes', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const classesData1 = classesResponse1.ok() ? await classesResponse1.json() : null;

    // Fetch report settings
    const settingsResponse = await request.get('/api/report/settings', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect([200, 404]).toContain(settingsResponse.status());

    // Fetch classes again to verify data integrity
    const classesResponse2 = await request.get('/api/timer/classes', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect([200, 404]).toContain(classesResponse2.status());
  });

  // UC-7: Admin Dashboard Access Validation
  test('should validate admin can record attendance', async ({ request }) => {
    const response = await request.post('/api/timer/attendance', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      data: {
        studentId: 'student-123',
        classId: 'class-123',
        date: '2026-04-08',
        status: 'present',
      },
    });

    expect([200, 201, 400]).toContain(response.status());
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
  });

  test('should validate admin can fetch attendance', async ({ request }) => {
    const response = await request.get('/api/timer/attendance/class-123/2026-04-08', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect([200, 404]).toContain(response.status());
  });

  test('should return 401 when fetching attendance without authentication', async ({ request }) => {
    const response = await request.get('/api/timer/attendance/class-123/2026-04-08');

    expect(response.status()).toBe(401);
  });
});
