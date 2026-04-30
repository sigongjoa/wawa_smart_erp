/**
 * 학생 HomePage 런타임 회귀 가드 — fake login + API mocking 으로 인증 후 / 진입.
 *
 * 검증 핵심:
 *   1. HomePage 가 마운트되고 실제 API 호출 흐름을 탄다
 *   2. 서버가 paginated 객체({items, total}) 를 반환해도 .filter() 같은 호출이 깨지지 않음
 *      → 이전 버그 (TypeError: d.filter is not a function) 회귀 가드
 *   3. ProtectedRoute 통과 후 useEffect 가 API 응답으로 setAssignments 까지 도달
 *
 * 실행:
 *   STUDENT_URL=https://master.wawa-learn.pages.dev \
 *     npx playwright test e2e/home-render-live.spec.ts --reporter=list
 */
import { test, expect, Route } from '@playwright/test';

const STUDENT_URL = process.env.STUDENT_URL || 'https://master.wawa-learn.pages.dev';

/** paginated 응답 형태 mock — 서버가 paginatedList 로 변경됐을 때를 재현 */
async function mockPaginated(route: Route, items: unknown[] = []) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: { items, total: items.length, hasMore: false }
    }),
  });
}
async function mockArray(route: Route, items: unknown[] = []) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: items }),
  });
}

test.describe('HomePage 런타임 회귀 가드', () => {
  test.beforeEach(async ({ page }) => {
    // ProtectedRoute 통과를 위한 fake auth 주입 — 실제 토큰은 아니지만 isLoggedIn 검사는 통과
    // API 호출은 실제 401 → catch(() => []) 로 빈 응답 처리. 이때 .filter() 가
    // 빈 배열에 대해 호출 가능해야 한다 (회귀 검증 핵심).
    await page.addInitScript(() => {
      localStorage.setItem('play_token', 'fake-test-token-not-real');
      localStorage.setItem('play_token_created_at', String(Date.now()));
      localStorage.setItem('play_student', JSON.stringify({
        id: 'stu-test', name: 'TestStudent', academyId: 'wawa', teacherId: 'tc',
      }));
      localStorage.setItem('play_slug', 'wawa');
    });
  });

  test('HomePage 진입 시 paginated 응답이 와도 .filter 깨지지 않음 (회귀)', async ({ page }) => {
    // 핵심 회귀 시나리오: 서버가 paginated 객체로 응답할 때 클라이언트가
    // .filter() 호출 전에 정규화하는지 검증.
    await page.route('**/api/play/assignments', (r) => mockPaginated(r, []));
    await page.route('**/api/play/proofs', (r) => mockArray(r, []));
    await page.route('**/api/play/exams', (r) => mockArray(r, []));
    await page.route('**/api/play/sessions/today', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) })
    );
    await page.route('**/api/play/exam-attempts/active', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) })
    );
    await page.route('**/api/play/live-sessions/active', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) })
    );

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));

    await page.goto(`${STUDENT_URL}/#/`);
    await page.waitForTimeout(2500);

    const typeErrors = errors.filter((e) =>
      e.includes('TypeError') ||
      e.includes('is not a function') ||
      e.includes('Cannot read')
    );
    expect(typeErrors, `런타임 에러:\n${typeErrors.join('\n')}`).toEqual([]);
  });

  test('HomePage 진입 시 paginated 응답에 실제 데이터 들어 있어도 안전', async ({ page }) => {
    // items 가 비어있지 않은 paginated 응답 — 정규화가 진짜 동작해야 통과
    await page.route('**/api/play/assignments', (r) => mockPaginated(r, [
      { id: 't1', target_id: 't1', title: 'Test', kind: 'assignment', status: 'pending' },
    ]));
    await page.route('**/api/play/proofs', (r) => mockArray(r));
    await page.route('**/api/play/exams', (r) => mockArray(r));
    await page.route('**/api/play/sessions/today', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) })
    );
    await page.route('**/api/play/exam-attempts/active', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) })
    );
    await page.route('**/api/play/live-sessions/active', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) })
    );

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));

    await page.goto(`${STUDENT_URL}/#/`);
    await page.waitForTimeout(2500);

    expect(errors.filter((e) => e.includes('TypeError'))).toEqual([]);
  });

  test('MedTermPage 진입 시 런타임 에러 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));

    await page.goto(`${STUDENT_URL}/#/medterm`);
    await page.waitForTimeout(2500);

    const typeErrors = errors.filter((e) =>
      e.includes('TypeError') ||
      e.includes('is not a function') ||
      e.includes('Cannot read')
    );
    expect(typeErrors, `런타임 에러:\n${typeErrors.join('\n')}`).toEqual([]);
  });

  test('Assignments 페이지 진입 시 런타임 에러 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));

    await page.goto(`${STUDENT_URL}/#/assignments`);
    await page.waitForTimeout(2500);

    const typeErrors = errors.filter((e) =>
      e.includes('TypeError') || e.includes('is not a function')
    );
    expect(typeErrors).toEqual([]);
  });
});
