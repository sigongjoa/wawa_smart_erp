import { test, expect } from '@playwright/test';

// 라이브 환경 테스트 - 환경 변수에서 로드
const LIVE_API_URL = process.env.LIVE_API_URL || 'http://localhost:8787';
const LIVE_APP_URL = process.env.LIVE_APP_URL || 'http://localhost:5173';

const TEACHERS = [
  { name: '김상현', pin: '1234' },
  { name: '남현욱', pin: '1312' },
];

test.describe('Live Environment E2E Tests', () => {
  test('should login with first teacher', async ({ request }) => {
    const response = await request.post(`${LIVE_API_URL}/api/auth/login`, {
      data: {
        name: TEACHERS[0].name,
        pin: TEACHERS[0].pin,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.accessToken).toBeTruthy();
    expect(data.data?.user?.name).toBe(TEACHERS[0].name);
  });

  test('should login with second teacher', async ({ request }) => {
    const response = await request.post(`${LIVE_API_URL}/api/auth/login`, {
      data: {
        name: TEACHERS[1].name,
        pin: TEACHERS[1].pin,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.accessToken).toBeTruthy();
    expect(data.data?.user?.name).toBe(TEACHERS[1].name);
  });

  test('should create new teacher with admin token', async ({ request }) => {
    // 관리자 로그인
    const loginResponse = await request.post(`${LIVE_API_URL}/api/auth/login`, {
      data: {
        name: TEACHERS[0].name,
        pin: TEACHERS[0].pin,
      },
    });

    const adminToken = (await loginResponse.json()).data.accessToken;

    // 새 선생님 추가
    const createResponse = await request.post(`${LIVE_API_URL}/api/teachers`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
      data: {
        name: `라이브테스트_${Date.now()}`,
        pin: 'testpin1234',
        subjects: ['국어', '수학'],
        isAdmin: false,
      },
    });

    const data = await createResponse.json();
    console.log('Create teacher response status:', createResponse.status());
    console.log('Create teacher response data:', data);

    expect(createResponse.status()).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data?.id).toBeTruthy();
  });

  test('should check migration status', async ({ request }) => {
    // 관리자 로그인
    const loginResponse = await request.post(`${LIVE_API_URL}/api/auth/login`, {
      data: {
        name: TEACHERS[0].name,
        pin: TEACHERS[0].pin,
      },
    });

    const adminToken = (await loginResponse.json()).data.accessToken;

    // 마이그레이션 확인
    const migrationResponse = await request.post(`${LIVE_API_URL}/api/migrate/notion-to-d1`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    expect(migrationResponse.status()).toBe(200);
    const data = await migrationResponse.json();
    expect(data.success).toBe(true);
    expect(data.data?.migratedCount).toBeGreaterThan(0);
  });

  test('should verify app loads with login page', async ({ page }) => {
    await page.goto(LIVE_APP_URL);

    // 로그인 페이지 요소 확인
    await expect(page.locator('text=WAWA Smart ERP')).toBeVisible();
    await expect(page.locator('text=선생님 로그인')).toBeVisible();

    // 입력 필드 확인
    const nameInput = page.locator('input[placeholder*="예:"]');
    const pinInput = page.locator('input[type="password"]');

    expect(nameInput).toBeTruthy();
    expect(pinInput).toBeTruthy();
  });

  test('should login via UI and access dashboard', async ({ page }) => {
    await page.goto(LIVE_APP_URL);

    // API 상태 확인 및 대기
    await page.waitForTimeout(1000); // API 상태 체크 완료 대기

    // 선생님 이름 입력
    await page.fill('input[placeholder*="예:"]', TEACHERS[0].name);

    // PIN 입력
    await page.fill('input[type="password"]', TEACHERS[0].pin);

    // 로그인 버튼 클릭
    const loginButton = page.locator('button:has-text("로그인")');
    await loginButton.click();

    // 대시보드로 이동할 때까지 대기
    await page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }).catch(() => {});
    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);

    // 타이머 페이지로 이동 확인
    expect(currentUrl).toContain('/timer');
  });

  test('should handle incorrect pin', async ({ request }) => {
    const response = await request.post(`${LIVE_API_URL}/api/auth/login`, {
      data: {
        name: TEACHERS[0].name,
        pin: 'wrongpin',
      },
    });

    expect(response.status()).toBe(401);
  });
});
