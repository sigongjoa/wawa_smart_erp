/**
 * word-gacha prod 연결 검증 E2E — 실제 배포된 wawa-learn.pages.dev 에서
 * 학생 로그인 → /word-gacha/ 진입 시 401 없이 서버 상태 로딩되는지 확인.
 *
 * 재현 조건:
 * - 학생 로그인은 prod 워커(-production)에서 토큰 발급
 * - word-gacha 는 wawa-bridge.js 의 API_BASE 로 호출
 * - 두 URL 이 다르면 401 (다른 DB 의 토큰이라 인증 실패)
 */
import { test, expect } from '@playwright/test';

const FRONT = 'https://wawa-learn.pages.dev';
const PROD_API = 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';
const SLUG = 'alpha';
const STUDENT_NAME = '강은서';
const STUDENT_PIN = '3141';

test.setTimeout(120000);

test('word-gacha 에서 prod 워커로 호출 → 401 없음', async ({ page }) => {
  // 401 요청 수집
  const unauthorized: string[] = [];
  const apiCalls: { url: string; status: number }[] = [];

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/') && !url.includes('/onboard/academies')) {
      apiCalls.push({ url, status: res.status() });
      if (res.status() === 401) {
        unauthorized.push(url);
      }
    }
  });

  // 1. 학생 로그인 페이지 진입
  await page.goto(`${FRONT}/#/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 2. 학원 선택
  await page.click('button:has-text("학원을 선택하세요"), button.lg-academy');
  await page.waitForTimeout(500);
  await page.click(`text=${/알파시티점|Alpha/}`);
  await page.waitForTimeout(300);

  // 3. 이름 + PIN 입력
  await page.fill('input.lg-name', STUDENT_NAME);
  await page.fill('input.lg-pin-input', STUDENT_PIN);
  await page.waitForTimeout(300);

  // 4. START 버튼
  await Promise.all([
    page.waitForURL((u) => !u.hash.includes('login'), { timeout: 15000 }),
    page.click('button.lg-submit'),
  ]);

  // 5. 홈에서 "영단어" 타일 클릭 → /word-gacha/ 이동
  await page.waitForTimeout(2000);
  const hashBeforeGacha = page.url();
  console.log('[로그인 후 URL]', hashBeforeGacha);

  // localStorage 에 토큰이 있는지
  const token = await page.evaluate(() => localStorage.getItem('play_token'));
  expect(token, '로그인 후 play_token 있어야 함').toBeTruthy();
  console.log('[play_token prefix]', token?.slice(0, 12));

  // 6. word-gacha 진입
  await page.goto(`${FRONT}/word-gacha/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000); // wawa-bridge.js 초기 동기화 대기

  // 7. 수집된 API 호출 분석
  const vocabCalls = apiCalls.filter((c) => c.url.includes('/api/play/vocab/'));
  console.log('[vocab API calls]', vocabCalls);
  console.log('[401 URLs]', unauthorized);

  // 8. word-gacha 가 호출한 API 가 prod 워커 여야 함
  const allToProd = vocabCalls.every((c) => c.url.startsWith(PROD_API));
  expect(allToProd, `word-gacha 호출이 prod 워커로 가야 함. 실제: ${JSON.stringify(vocabCalls)}`).toBe(true);

  // 9. 401 발생하지 않아야 함
  expect(unauthorized, `401 발생하면 안됨. 발생한 URL: ${unauthorized.join(', ')}`).toHaveLength(0);

  // 10. 최소 1개 이상 vocab 호출 성공 (서버 상태 동기화 확인)
  const success = vocabCalls.filter((c) => c.status === 200);
  expect(success.length, 'vocab API 호출 1건 이상 200 성공 필요').toBeGreaterThan(0);
});
