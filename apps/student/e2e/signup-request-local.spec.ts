/**
 * 학생 자가 가입 요청 — 로컬 e2e
 *
 * 사전 조건:
 *   - workers dev:  cd workers && npx wrangler dev --env development --port 8787
 *   - student dev:  cd apps/student && pnpm dev   (포트 5175, /api → 8787 프록시)
 *   - 로컬 D1에 migration 061 적용 + academies에 'wawa' slug 학원 1개 존재
 *
 * 실행:
 *   STUDENT_URL=http://localhost:5175 npx playwright test e2e/signup-request-local.spec.ts
 *
 * 검증 시나리오:
 *   A. UI 폼 동작 — 학원 선택 sheet → 폼 입력 → 제출 → submitted 화면
 *   B. API: 가입 요청 정상 접수
 *   C. API: PIN 불일치는 클라이언트 차단 (UI 검증)
 *   D. API: 동명 재신청은 409
 *   E. 가입 요청 후 로그인 시도 → "승인 대기 중" 메시지
 */
import { test, expect, request as pwRequest } from '@playwright/test';

const STUDENT_URL = process.env.STUDENT_URL || 'http://localhost:5175';
const API_BASE = process.env.API_BASE || 'http://localhost:8787';
const ACADEMY_SLUG = 'wawa';
const ACADEMY_NAME = 'Test Academy';

// 매 테스트 실행마다 유니크한 이름 (DB 잔존 row 충돌 회피)
const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

test.describe('A. UI 가입 요청 폼', () => {
  test('가입 요청 페이지 진입 → 폼 입력 → submitted 화면', async ({ page }) => {
    const studentName = unique('이순신');

    await page.goto(`${STUDENT_URL}/#/signup-request`);
    await expect(page.getByRole('heading', { name: /JOIN/i })).toBeVisible();

    // 학원 선택 sheet
    await page.getByRole('button', { name: /학원을 선택하세요/ }).click();
    await expect(page.getByRole('dialog', { name: '학원 선택' })).toBeVisible();
    await page.getByText(ACADEMY_NAME, { exact: true }).click();

    // 이름 / 학년
    await page.getByPlaceholder('예: 강은서').fill(studentName);
    await page.getByPlaceholder('예: 중2 / 고1').fill('중3');

    // PIN 4자리 × 2
    await page.getByLabel('PIN 4자리').fill('4321');
    await page.getByLabel('PIN 재확인').fill('4321');
    await page.getByPlaceholder('예: 김OO 선생님 추천').fill('테스트 메모');

    // 제출
    await page.getByRole('button', { name: /가입 요청 보내기/ }).click();

    // submitted 화면 확인
    await expect(page.getByRole('heading', { name: /SUBMITTED/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('가입 요청이 접수되었습니다.')).toBeVisible();
  });

  test('PIN 불일치 시 에러 표시 + submitted로 진입 X', async ({ page }) => {
    const studentName = unique('홍길동');

    await page.goto(`${STUDENT_URL}/#/signup-request`);
    await page.getByRole('button', { name: /학원을 선택하세요/ }).click();
    await page.getByText(ACADEMY_NAME, { exact: true }).click();
    await page.getByPlaceholder('예: 강은서').fill(studentName);
    await page.getByLabel('PIN 4자리').fill('1111');
    await page.getByLabel('PIN 재확인').fill('2222');
    await page.getByRole('button', { name: /가입 요청 보내기/ }).click();

    // submitted 화면 안 뜨고 에러 표시
    await expect(page.getByText(/PIN이 일치하지 않습니다/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /SUBMITTED/i })).not.toBeVisible();
  });
});

test.describe('B-D. API 가입 요청', () => {
  test('가입 요청 정상 접수 (201)', async () => {
    const ctx = await pwRequest.newContext({ baseURL: API_BASE });
    const studentName = unique('김유신');
    const res = await ctx.post('/api/onboard/student-signup-request', {
      data: {
        academy_slug: ACADEMY_SLUG,
        name: studentName,
        grade: '중2',
        pin: '1234',
        memo: 'e2e test',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data?.id || body.id).toBeTruthy();
  });

  test('학원 없음 → 404', async () => {
    const ctx = await pwRequest.newContext({ baseURL: API_BASE });
    const res = await ctx.post('/api/onboard/student-signup-request', {
      data: {
        academy_slug: 'no-such-academy-xyz',
        name: unique('이몽룡'),
        pin: '5678',
      },
    });
    expect(res.status()).toBe(404);
  });

  test('같은 학원에 같은 이름 재신청 → 409', async () => {
    const ctx = await pwRequest.newContext({ baseURL: API_BASE });
    const studentName = unique('강감찬');
    const first = await ctx.post('/api/onboard/student-signup-request', {
      data: { academy_slug: ACADEMY_SLUG, name: studentName, pin: '1111' },
    });
    expect(first.status()).toBe(201);

    const dup = await ctx.post('/api/onboard/student-signup-request', {
      data: { academy_slug: ACADEMY_SLUG, name: studentName, pin: '2222' },
    });
    expect(dup.status()).toBe(409);
    const body = await dup.json();
    expect(body.error || '').toMatch(/이미 가입 요청|이미 등록/);
  });

  test('PIN 4자리 아님 → 400', async () => {
    const ctx = await pwRequest.newContext({ baseURL: API_BASE });
    const res = await ctx.post('/api/onboard/student-signup-request', {
      data: { academy_slug: ACADEMY_SLUG, name: unique('정약용'), pin: '12' },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('E. 로그인 흐름 안내 메시지', () => {
  // 앞 describe들에서 IP rate limit(분 5회)에 근접하므로 별 IP 헤더로 격리
  const fakeIp = () => `10.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;

  test('가입 요청만 한 학생의 로그인 시도 → "승인 대기 중" 메시지', async () => {
    const ip = fakeIp();
    const ctx = await pwRequest.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { 'CF-Connecting-IP': ip },
    });
    const studentName = unique('을지문덕');

    const signup = await ctx.post('/api/onboard/student-signup-request', {
      data: { academy_slug: ACADEMY_SLUG, name: studentName, pin: '9999' },
    });
    expect(signup.status()).toBe(201);

    const login = await ctx.post('/api/play/login', {
      data: { academy_slug: ACADEMY_SLUG, name: studentName, pin: '9999' },
    });
    expect(login.status()).toBe(403);
    const body = await login.json();
    expect(body.error || '').toMatch(/승인 대기 중/);
  });
});

test.describe('F. Rate limit 동작', () => {
  test('같은 IP에서 6번째 가입 요청 → 429', async () => {
    const ctx = await pwRequest.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { 'CF-Connecting-IP': '10.99.99.99' },
    });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await ctx.post('/api/onboard/student-signup-request', {
        data: { academy_slug: ACADEMY_SLUG, name: unique(`이성계${i}`), pin: '7777' },
      });
      statuses.push(res.status());
    }
    // 처음 5회 중 일부는 409/201 일 수 있고 6번째는 무조건 429
    expect(statuses[5]).toBe(429);
  });
});
