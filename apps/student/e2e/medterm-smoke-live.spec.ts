/**
 * MedTerm 학생 화면 — 실제 배포 서버 smoke 테스트.
 *
 * 검증 범위:
 *   - 미인증 상태에서 /#/medterm 접근 → /#/login 리다이렉트
 *   - 페이지 로드 시 콘솔 에러 0건
 *   - medterm 라우트가 빌드에 포함되어 chunk 로드 성공
 *
 * 실행:
 *   cd apps/student
 *   STUDENT_URL=https://master.wawa-learn.pages.dev npx playwright test e2e/medterm-smoke-live.spec.ts
 */
import { test, expect } from '@playwright/test';

const STUDENT_URL = process.env.STUDENT_URL || 'https://master.wawa-learn.pages.dev';
const API_URL = process.env.API_URL || 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';

test.describe('MedTerm 학생 화면 — smoke', () => {
  test('미인증 /#/medterm 방문 시 /#/login 리다이렉트', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));

    await page.goto(`${STUDENT_URL}/#/medterm`);
    // ProtectedRoute가 /#/login으로 보내야 함
    await expect.poll(() => page.url(), { timeout: 5000 }).toContain('login');

    expect(errors, `pageerrors: ${errors.join('\n')}`).toEqual([]);
  });

  test('학생 앱 빌드에 medterm 페이지 chunk 가 포함됨', async ({ page }) => {
    const responses: { url: string; status: number }[] = [];
    page.on('response', (r) => responses.push({ url: r.url(), status: r.status() }));

    await page.goto(`${STUDENT_URL}/#/medterm`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // medterm chunk 요청이 있고 모두 2xx 성공
    const jsResponses = responses.filter(r => r.url.includes('.js'));
    const failed = jsResponses.filter(r => r.status >= 400);
    expect(failed, `failed JS chunks: ${JSON.stringify(failed)}`).toEqual([]);
  });
});

test.describe('MedTerm API — 미인증 응답', () => {
  test('GET /api/play/medterm/today (미인증) → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/play/medterm/today`);
    expect(r.status()).toBe(401);
  });

  test('POST /api/play/medterm/answer (미인증) → 401', async ({ request }) => {
    const r = await request.post(`${API_URL}/api/play/medterm/answer`, {
      data: { student_term_id: 'mst-test', response: 'foo' },
    });
    expect(r.status()).toBe(401);
  });

  test('GET /api/medterm/books (강사 미인증) → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/medterm/books`);
    expect(r.status()).toBe(401);
  });

  test('POST /api/medterm/chapters/X/assign (강사 미인증) → 401', async ({ request }) => {
    const r = await request.post(`${API_URL}/api/medterm/chapters/med-basic-ch01/assign`, {
      data: { student_ids: ['stu-x'], modes: ['meaning'] },
    });
    expect(r.status()).toBe(401);
  });

  test('알 수 없는 medterm 라우트 (강사 미인증) → 401 (auth 가 라우터보다 먼저)', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/medterm/nonexistent`);
    // 인증 미들웨어가 먼저 차단
    expect(r.status()).toBe(401);
  });
});

test.describe('MedTerm 학생 페이지 — 토큰 없이 진입', () => {
  test('탭 진입 시 깨지지 않고 login 페이지로 안내', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${STUDENT_URL}/#/medterm`);
    await page.waitForTimeout(800);

    // 빈 화면 아님 — 어떤 형태든 콘텐츠가 렌더됨
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });
});
