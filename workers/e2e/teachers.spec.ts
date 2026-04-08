import { test, expect } from '@playwright/test';

const ADMIN_USER = {
  name: '김상현',
  pin: '1234',
};

const TEST_TEACHER = {
  name: '테스트 선생님',
  pin: 'test1234',
  subjects: ['국어', '영어'],
  isAdmin: false,
};

test.describe('Teacher Management E2E Tests', () => {
  let adminAccessToken: string = '';

  test.beforeEach(async ({ request }) => {
    // 관리자로 로그인
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        name: ADMIN_USER.name,
        pin: ADMIN_USER.pin,
      },
    });

    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      adminAccessToken = data.data?.accessToken || '';
    }
  });

  // UC-1: Teacher add form rendering and input validation
  test('should validate required fields when creating teacher (name required)', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '', // 빈 이름
        pin: 'test1234',
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('should validate required fields when creating teacher (pin required)', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '테스트',
        pin: '', // 빈 PIN
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should validate PIN minimum length when creating teacher', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '테스트',
        pin: '123', // 너무 짧은 PIN
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should validate at least one subject is required', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '테스트',
        email: 'test@academy.local',
        password: 'test1234',
        subjects: [], // 빈 과목
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should require admin authentication to create teacher', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      data: {
        name: TEST_TEACHER.name,
        pin: TEST_TEACHER.pin,
        subjects: TEST_TEACHER.subjects,
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should require admin role to create teacher', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
      data: {
        name: TEST_TEACHER.name,
        pin: TEST_TEACHER.pin,
        subjects: TEST_TEACHER.subjects,
        isAdmin: false,
      },
    });

    expect([401, 403]).toContain(response.status());
  });

  // UC-2: Teacher creation and list operations
  test('should successfully create teacher with valid data', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: `테스트_${Date.now()}`,
        pin: 'test1234',
        subjects: TEST_TEACHER.subjects,
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.data?.id).toBeDefined();
    expect(data.data?.pin).toBeDefined();
    expect(data.data?.name).toBeDefined();
  });

  test('should create teacher with admin role when isAdmin is true', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: `관리자_${Date.now()}`,
        pin: 'adminpass1234',
        subjects: ['국어', '영어'],
        isAdmin: true,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data?.isAdmin).toBe(true);
  });

  test('should create teacher with instructor role when isAdmin is false', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: `강사_${Date.now()}`,
        pin: 'instrpass1234',
        subjects: ['수학'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data?.isAdmin).toBe(false);
  });

  test('should return teacher data with all required fields', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: `데이터_${Date.now()}`,
        pin: 'datatest1234',
        subjects: ['국어', '수학', '영어'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data?.id).toBeDefined();
    expect(data.data?.pin).toBeDefined();
    expect(data.data?.subjects).toEqual(['국어', '수학', '영어']);
    expect(data.data?.isAdmin).toBe(false);
  });

  // UC-3: Notion migration endpoint
  test('should return 401 when accessing migration without authentication', async ({ request }) => {
    const response = await request.post('/api/migrate/notion-to-d1', {});

    expect(response.status()).toBe(401);
  });

  test('should require admin role to migrate Notion data', async ({ request }) => {
    const response = await request.post('/api/migrate/notion-to-d1', {
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });

    expect([401, 403]).toContain(response.status());
  });

  // UC-4: Migration progress tracking
  test('should return migration status with user count', async ({ request }) => {
    const response = await request.post('/api/migrate/notion-to-d1', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.data?.migratedCount).toBeDefined();
    expect(typeof data.data?.migratedCount).toBe('number');
  });

  test('should return success message from migration', async ({ request }) => {
    const response = await request.post('/api/migrate/notion-to-d1', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data?.message).toBeDefined();
  });

  // UC-5: Duplicate prevention (same name check)
  test('should prevent creating teacher with duplicate name', async ({ request }) => {
    const uniqueName = `중복테스트_${Date.now()}`;

    // 첫 번째 선생님 생성
    const firstResponse = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: uniqueName,
        pin: 'password1234',
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(firstResponse.status()).toBe(201);

    // 같은 이름으로 두 번째 선생님 생성 시도
    const secondResponse = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: uniqueName, // 같은 이름
        pin: 'password5678',
        subjects: ['수학'],
        isAdmin: false,
      },
    });

    expect(secondResponse.status()).toBe(409); // 409 Conflict
    const errorData = await secondResponse.json();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('이미 등록된');
  });

  test('should allow creating teachers with different names', async ({ request }) => {
    const name1 = `선생님A_${Date.now()}`;
    const name2 = `선생님B_${Date.now()}`;

    const response1 = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: name1,
        pin: 'passA1234',
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(response1.status()).toBe(201);

    const response2 = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: name2,
        pin: 'passB1234',
        subjects: ['수학'],
        isAdmin: false,
      },
    });

    expect(response2.status()).toBe(201);
  });

  // Additional sanity tests
  test('should handle multiple subjects correctly', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: `다과목_${Date.now()}`,
        pin: 'multipass1234',
        subjects: ['국어', '영어', '수학', '사회', '과학'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data?.subjects).toEqual(['국어', '영어', '수학', '사회', '과학']);
  });

  test('should handle PIN correctly', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: `PIN테스트_${Date.now()}`,
        pin: 'trimpass1234',
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data?.pin).toBeDefined();
  });
});
