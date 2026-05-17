/**
 * 학생 페이지 로드 진단 — 페이지가 안 뜬다는 사용자 보고에 대한 smoke 테스트.
 * 콘솔 에러 / 네트워크 실패 / 빈 화면 / JS 에러를 모두 캡처한다.
 *
 * 실행:
 *   cd apps/student
 *   STUDENT_URL=https://wawa-learn.pages.dev npx playwright test e2e/smoke-page-load.spec.ts
 */
import { test, expect } from '@playwright/test';

test('학생 페이지가 실제로 렌더되는가', async ({ page }) => {
  const consoleAll: string[] = [];
  const pageErrors: string[] = [];
  const allResponses: { url: string; status: number }[] = [];
  const requestFailures: { url: string; failure: string }[] = [];

  page.on('console', (msg) => {
    consoleAll.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(`${err.name}: ${err.message}\n${err.stack ?? ''}`);
  });
  page.on('response', (res) => {
    allResponses.push({ url: res.url(), status: res.status() });
  });
  page.on('requestfailed', (req) => {
    requestFailures.push({ url: req.url(), failure: req.failure()?.errorText ?? 'unknown' });
  });

  const url = process.env.STUDENT_URL || 'https://wawa-learn.pages.dev';
  console.log(`\n→ 접속 URL: ${url}`);

  const response = await page.goto(url, { waitUntil: 'load', timeout: 30_000 }).catch((e) => {
    console.log(`❌ goto 실패: ${e.message}`);
    return null;
  });

  // React가 부트스트랩하고 lazy 청크가 로드될 시간을 충분히 줌
  await page.waitForTimeout(8000);

  console.log(`→ HTTP 상태: ${response?.status()} ${response?.statusText() ?? ''}`);
  console.log(`→ 최종 URL: ${page.url()}`);

  const html = await page.content();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const rootHtml = await page.locator('#root, #app').first().innerHTML().catch(() => '<없음>');

  console.log(`→ HTML 길이: ${html.length}`);
  console.log(`→ body 텍스트 길이: ${bodyText.length}`);
  console.log(`→ #root/#app 첫 200자: ${rootHtml.slice(0, 200)}`);
  console.log(`→ body 텍스트 첫 300자: ${bodyText.slice(0, 300)}`);

  console.log(`\n=== 모든 네트워크 응답 (${allResponses.length}건) ===`);
  allResponses.forEach((r) => console.log(`   [${r.status}] ${r.url}`));

  if (requestFailures.length) {
    console.log(`\n❌ 네트워크 실패 (${requestFailures.length}건):`);
    requestFailures.forEach((r) => console.log(`   - ${r.url} → ${r.failure}`));
  }
  if (pageErrors.length) {
    console.log(`\n❌ JS 에러 (${pageErrors.length}건):`);
    pageErrors.forEach((e) => console.log(`   - ${e}`));
  }
  if (consoleAll.length) {
    console.log(`\n=== 콘솔 메시지 전체 (${consoleAll.length}건) ===`);
    consoleAll.forEach((e) => console.log(`   ${e}`));
  }

  await page.screenshot({ path: 'test-results/student-page-load.png', fullPage: true });
  console.log(`\n📸 스크린샷: test-results/student-page-load.png`);

  // 진단 모드 — assertion 없이 정보만 출력
  expect(response?.status() ?? 599, 'HTTP 200 응답').toBeLessThan(400);
});
