/**
 * MVP2 (그림) + MVP3 (단원평가) — 라이브 배포 서버 smoke.
 *
 * 검증:
 *   - figure / exam attempt 페이지 라우트 존재
 *   - 미인증 시 적절히 가드됨
 *   - API endpoint 401 (모든 신규)
 */
import { test, expect } from '@playwright/test';

const STUDENT_URL = process.env.STUDENT_URL || 'https://master.wawa-learn.pages.dev';
const API_URL = process.env.API_URL || 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';

test.describe('MVP2 그림 + MVP3 평가 — 학생 페이지 smoke', () => {
  test('단원평가 목록 페이지 (/#/medterm/exams) 로드', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));
    await page.goto(`${STUDENT_URL}/#/medterm/exams`);
    await page.waitForTimeout(1500);
    // 미인증 → /login 리다이렉트 또는 페이지 자체가 깨끗하게 렌더
    expect(errors.filter((e) => e.includes('TypeError'))).toEqual([]);
  });

  test('단원평가 응시 페이지 (/#/medterm/exams/X) 로드', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));
    await page.goto(`${STUDENT_URL}/#/medterm/exams/mea-nonexistent`);
    await page.waitForTimeout(1500);
    expect(errors.filter((e) => e.includes('TypeError'))).toEqual([]);
  });
});

test.describe('MVP2/3 API — 미인증 401', () => {
  test('GET /api/medterm/figures (강사) → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/medterm/figures?chapter_id=med-basic-ch01`);
    expect(r.status()).toBe(401);
  });

  test('POST /api/medterm/figures (그림 업로드) → 401', async ({ request }) => {
    const r = await request.post(`${API_URL}/api/medterm/figures`, { data: {} });
    expect(r.status()).toBe(401);
  });

  test('GET /api/medterm/figures/X/labels → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/medterm/figures/fig-test/labels`);
    expect(r.status()).toBe(401);
  });

  test('POST /api/medterm/figures/X/labels → 401', async ({ request }) => {
    const r = await request.post(`${API_URL}/api/medterm/figures/fig-test/labels`, {
      data: { x_ratio: 0.5, y_ratio: 0.5, text: 'test' },
    });
    expect(r.status()).toBe(401);
  });

  test('POST /api/medterm/chapters/X/exam → 401', async ({ request }) => {
    const r = await request.post(`${API_URL}/api/medterm/chapters/med-basic-ch01/exam`, {
      data: { student_ids: ['x'] },
    });
    expect(r.status()).toBe(401);
  });

  test('GET /api/medterm/exam-attempts/X → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/medterm/exam-attempts/mea-test`);
    expect(r.status()).toBe(401);
  });

  test('GET /api/play/medterm/exam-attempts (학생) → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/play/medterm/exam-attempts`);
    expect(r.status()).toBe(401);
  });

  test('POST /api/play/medterm/exam-attempts/X/responses → 401', async ({ request }) => {
    const r = await request.post(`${API_URL}/api/play/medterm/exam-attempts/mea-test/responses`, {
      data: { item_id: 'ei-x', response: 'foo' },
    });
    expect(r.status()).toBe(401);
  });

  test('POST /api/play/medterm/exam-attempts/X/submit → 401', async ({ request }) => {
    const r = await request.post(`${API_URL}/api/play/medterm/exam-attempts/mea-test/submit`);
    expect(r.status()).toBe(401);
  });

  test('GET /api/play/medterm/figures (학생) → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/play/medterm/figures?chapter_id=med-basic-ch01`);
    expect(r.status()).toBe(401);
  });

  test('GET /api/play/medterm/figures/X/image → 401', async ({ request }) => {
    const r = await request.get(`${API_URL}/api/play/medterm/figures/fig-test/image`);
    expect(r.status()).toBe(401);
  });
});

test.describe('MVP2/3 — 빌드 검증', () => {
  test('학생 앱 신규 페이지 chunk 로드 0실패', async ({ page }) => {
    const fails: { url: string; status: number }[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400 && (r.url().includes('.js') || r.url().includes('.css'))) {
        fails.push({ url: r.url(), status: r.status() });
      }
    });
    await page.goto(`${STUDENT_URL}/#/medterm/exams`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    expect(fails).toEqual([]);
  });
});
