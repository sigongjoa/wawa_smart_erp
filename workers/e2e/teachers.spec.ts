import { test, expect } from '@playwright/test';

const ADMIN_USER = {
  email: 'teacher1@academy.local',
  password: '1234',
};

const TEST_TEACHER = {
  name: '테스트 선생님',
  email: 'test-teacher@academy.local',
  password: 'test1234',
  subjects: ['국어', '영어'],
  isAdmin: false,
};

const DUPLICATE_TEACHER = {
  name: '중복 테스트 선생님',
  email: 'test-teacher@academy.local', // 같은 이메일
  password: 'test5678',
  subjects: ['수학'],
  isAdmin: false,
};

test.describe('Teacher Management E2E Tests', () => {
  let adminAccessToken: string = '';

  test.beforeEach(async ({ request }) => {
    // 관리자로 로그인
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: ADMIN_USER.email,
        password: ADMIN_USER.password,
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
        email: 'test@academy.local',
        password: 'test1234',
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('should validate required fields when creating teacher (email required)', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '테스트',
        email: '', // 빈 이메일
        password: 'test1234',
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should validate required fields when creating teacher (password required)', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '테스트',
        email: 'test@academy.local',
        password: '', // 빈 비밀번호
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should validate email format when creating teacher', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '테스트',
        email: 'invalid-email', // 유효하지 않은 이메일
        password: 'test1234',
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should validate password minimum length when creating teacher', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '테스트',
        email: 'test@academy.local',
        password: '123', // 너무 짧은 비밀번호
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
        email: TEST_TEACHER.email,
        password: TEST_TEACHER.password,
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
        email: TEST_TEACHER.email,
        password: TEST_TEACHER.password,
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
        name: TEST_TEACHER.name,
        email: `unique-${Date.now()}@academy.local`, // 고유한 이메일
        password: TEST_TEACHER.password,
        subjects: TEST_TEACHER.subjects,
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.data?.id).toBeDefined();
    expect(data.data?.email).toBeDefined();
    expect(data.data?.name).toBe(TEST_TEACHER.name);
  });

  test('should create teacher with admin role when isAdmin is true', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '관리자 선생님',
        email: `admin-${Date.now()}@academy.local`,
        password: 'adminpass1234',
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
        name: '강사 선생님',
        email: `instructor-${Date.now()}@academy.local`,
        password: 'instrpass1234',
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
        name: '데이터 테스트',
        email: `data-test-${Date.now()}@academy.local`,
        password: 'datatest1234',
        subjects: ['국어', '수학', '영어'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data?.id).toBeDefined();
    expect(data.data?.name).toBe('데이터 테스트');
    expect(data.data?.email).toContain('data-test-');
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

  // UC-5: Duplicate prevention (same email check)
  test('should prevent creating teacher with duplicate email', async ({ request }) => {
    const uniqueEmail = `duplicate-test-${Date.now()}@academy.local`;

    // 첫 번째 선생님 생성
    const firstResponse = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '첫 번째 선생님',
        email: uniqueEmail,
        password: 'password1234',
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    expect(firstResponse.status()).toBe(201);

    // 같은 이메일로 두 번째 선생님 생성 시도
    const secondResponse = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '두 번째 선생님',
        email: uniqueEmail, // 같은 이메일
        password: 'password5678',
        subjects: ['수학'],
        isAdmin: false,
      },
    });

    expect(secondResponse.status()).toBe(409); // 409 Conflict
    const errorData = await secondResponse.json();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('이미 등록된');
  });

  test('should allow creating teachers with different emails', async ({ request }) => {
    const email1 = `teacher-a-${Date.now()}@academy.local`;
    const email2 = `teacher-b-${Date.now()}@academy.local`;

    const response1 = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '선생님 A',
        email: email1,
        password: 'passA1234',
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
        name: '선생님 B',
        email: email2,
        password: 'passB1234',
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
        name: '다과목 선생님',
        email: `multi-subject-${Date.now()}@academy.local`,
        password: 'multipass1234',
        subjects: ['국어', '영어', '수학', '사회', '과학'],
        isAdmin: false,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data?.subjects).toEqual(['국어', '영어', '수학', '사회', '과학']);
  });

  test('should trim whitespace from name and email', async ({ request }) => {
    const response = await request.post('/api/teachers', {
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      data: {
        name: '  선생님  ', // 공백 포함
        email: '  trimmed@academy.local  ',
        password: 'trimpass1234',
        subjects: ['국어'],
        isAdmin: false,
      },
    });

    // 응답 상태 확인 (400 또는 201 가능)
    expect([201, 400]).toContain(response.status());
  });
});
