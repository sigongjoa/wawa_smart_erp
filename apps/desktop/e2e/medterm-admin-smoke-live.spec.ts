/**
 * MedTerm 강사 콘솔 — 실제 배포 서버 smoke 테스트.
 *
 * 검증:
 *   - /#/medterm 접근 시 로그인 우회 없이 페이지 로드 (또는 인증 가드)
 *   - chunk 로드 실패 0건
 *   - 핵심 testid 셀렉터 존재 확인 (강사 인증 후 — 본 spec 은 미인증 화면만)
 *
 * 실행:
 *   cd apps/desktop
 *   DESKTOP_URL=https://wawa-smart-erp.pages.dev npx playwright test e2e/medterm-admin-smoke-live.spec.ts
 */
import { test, expect } from '@playwright/test';

const DESKTOP_URL = process.env.DESKTOP_URL || 'https://wawa-smart-erp.pages.dev';
const API_URL = process.env.API_URL || 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';

test.describe('MedTerm 강사 콘솔 — smoke', () => {
  test('/#/medterm 접근 시 페이지 로드 (콘솔 에러 0)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));

    await page.goto(`${DESKTOP_URL}/#/medterm`);
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});

    expect(errors, `pageerrors: ${errors.join('\n')}`).toEqual([]);
  });

  test('chunk 로드 실패 0건', async ({ page }) => {
    const responses: { url: string; status: number }[] = [];
    page.on('response', (r) => responses.push({ url: r.url(), status: r.status() }));

    await page.goto(`${DESKTOP_URL}/#/medterm`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const failed = responses.filter(r =>
      (r.url.includes('.js') || r.url.includes('.css')) && r.status >= 400
    );
    expect(failed, `failed assets: ${JSON.stringify(failed)}`).toEqual([]);
  });
});

test.describe('MedTerm API — 강사 미인증', () => {
  test('GET /api/medterm/books → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/medterm/books`);
    expect(r.status()).toBe(401);
  });

  test('GET /api/medterm/chapters → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/medterm/chapters`);
    expect(r.status()).toBe(401);
  });

  test('GET /api/medterm/progress?student_id=X → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/medterm/progress?student_id=stu-x`);
    expect(r.status()).toBe(401);
  });
});
