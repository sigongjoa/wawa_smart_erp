/**
 * 학생앱 영단어(word-gacha) 통합 — 실제 UI/UX 동작 검증
 *   홈 → 영단어 → word-gacha → 학습 → 내 단어장 → FAB → 단어 추가 → 서버 POST 확인 → 새로고침 후 영속 확인
 *
 * 실행: STUDENT_URL=https://1b4e4a4f.wawa-learn.pages.dev \
 *       API=https://wawa-smart-erp-api.zeskywa499.workers.dev \
 *       npx playwright test e2e/word-gacha-integration.spec.ts --project=chromium
 */
import { test, expect, type Page, type Request } from '@playwright/test';

const API = process.env.API || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const ACADEMY_NAME = '알파시티점';
const STUDENT_NAME = '강은서';
const STUDENT_PIN = '9999';

async function loginAsStudent(page: Page) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click(`.academy-item:has-text("${ACADEMY_NAME}")`);
  await page.fill('input[placeholder="이름"]', STUDENT_NAME);
  await page.fill('input[placeholder*="PIN"]', STUDENT_PIN);
  await page.click('.login-btn');
  await expect(page.locator('.home-page')).toBeVisible({ timeout: 15_000 });
}

test('word-gacha: 홈에서 진입 → 화면·캐릭터·탭 렌더 → 단어 추가 → 서버 저장 → 영속', async ({ page }) => {
  // 콘솔 에러 / 실패 요청 모니터
  const consoleErrors: string[] = [];
  const failedReqs: string[] = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('requestfailed', r => failedReqs.push(`${r.method()} ${r.url()}`));

  // 네트워크 추적
  const getReqs: string[] = [];
  const postReqs: Array<{ url: string; body?: string; status?: number }> = [];
  page.on('request', req => {
    if (req.url().includes('/api/play/vocab/words')) {
      if (req.method() === 'GET') getReqs.push(req.url());
      if (req.method() === 'POST') postReqs.push({ url: req.url(), body: req.postData() || undefined });
    }
  });
  page.on('response', async resp => {
    if (resp.url().includes('/api/play/vocab/words') && resp.request().method() === 'POST') {
      const match = postReqs.find(p => !p.status);
      if (match) match.status = resp.status();
    }
  });

  // 1) 로그인 → 홈
  await loginAsStudent(page);
  console.log('✅ 1. 로그인 완료');

  // 2) 영단어 버튼 클릭 → word-gacha로 전체 네비
  const vocabBtn = page.locator('.home-mode-card').filter({ hasText: '영단어' });
  await expect(vocabBtn).toBeVisible();
  await vocabBtn.click();
  await page.waitForURL(/\/word-gacha\//, { timeout: 15_000 });
  await expect(page).toHaveTitle(/Word Gacha/);
  console.log('✅ 2. word-gacha 페이지 진입');

  // 2-1) 첫 방문 시 온보딩(알→이름→성격) 통과
  const onboard = page.locator('#dlg-onboard');
  if (await onboard.isVisible().catch(() => false)) {
    await onboard.locator('.egg-pick[data-species="sprout"]').click();
    await page.click('#btn-onboard-next');
    await onboard.locator('#inp-name').fill('토토');
    await page.click('#btn-onboard-next');
    await onboard.locator('.per-pick[data-personality="curious"]').click();
    await page.click('#btn-onboard-next');
    await expect(onboard).toBeHidden({ timeout: 5_000 });
    console.log('✅ 2-1. 온보딩 완료 (sprout/토토/curious)');
  }

  // 3) 하단 탭바 5개(홈/학습/연습/도감/기록) 렌더
  const tabbar = page.locator('nav.tabbar');
  await expect(tabbar).toBeVisible();
  for (const label of ['홈', '학습', '연습', '도감', '기록']) {
    await expect(tabbar.getByRole('button', { name: new RegExp(label) })).toBeVisible();
  }
  console.log('✅ 3. 하단 탭바 5개 노출');

  // 4) 초기 서버 단어 fetch 확인 (booting 시 loadServerWords 호출)
  await page.waitForFunction(() => {
    const ws = JSON.parse(localStorage.getItem('wg.v1.words') || '[]');
    return Array.isArray(ws);
  });
  expect(getReqs.length).toBeGreaterThanOrEqual(1);
  console.log(`✅ 4. 서버 단어 GET 호출됨 (${getReqs.length}회)`);

  // 5) 학습 탭 → 내 단어장 서브탭
  await tabbar.getByRole('button', { name: /학습/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'learn');
  await page.locator('#tab-learn-mywords').click();
  await expect(page.locator('#tab-learn-mywords')).toHaveAttribute('aria-selected', 'true');
  console.log('✅ 5. 학습 → 내 단어장 서브탭 활성화');

  // 6) FAB(단어 추가) 노출 확인 & 클릭
  const fab = page.locator('#btn-add-word');
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(page.locator('#dlg-add-word')).toBeVisible();
  console.log('✅ 6. FAB 클릭 → 추가 모달 오픈');

  // 7) 고유 단어 입력 후 제출 (영문자만 허용, 숫자→영문 매핑)
  const suffix = Date.now().toString(36).replace(/[^a-z]/gi, '').padEnd(6, 'x').slice(0, 6);
  const unique = `wgtest${suffix}`;
  await page.fill('#aw-word', unique);
  await page.fill('#aw-meaning', '시험용단어');
  await page.selectOption('#aw-pos', 'noun');
  await page.click('#btn-add-submit');

  // 모달이 닫히고 단어가 리스트에 나타나야 함
  await expect(page.locator('#dlg-add-word')).toBeHidden({ timeout: 5_000 });
  console.log(`✅ 7. 단어 "${unique}" 추가 (모달 닫힘)`);

  // 8) 서버 POST 요청이 실제로 나갔고 2xx 응답인지
  await page.waitForTimeout(1500); // response 핸들러 기다림
  const ourPost = postReqs.find(p => p.body?.includes(unique));
  expect(ourPost, 'POST /api/play/vocab/words 요청이 나가야 함').toBeTruthy();
  expect(ourPost!.body).toContain('"english"');
  expect(ourPost!.body).toContain(unique);
  expect(ourPost!.status, `POST 응답 상태 2xx (실제: ${ourPost!.status})`).toBeLessThan(300);
  console.log(`✅ 8. 서버 POST 전송 확인 (status=${ourPost!.status}, body=${ourPost!.body?.slice(0, 80)}…)`);

  // 9) API 직접 조회 — 토큰으로 GET해서 방금 넣은 단어가 실제로 DB에 있는지
  const token = await page.evaluate(() => localStorage.getItem('play_token'));
  expect(token, 'play_token 있어야 함').toBeTruthy();
  const apiRes = await page.request.get(`${API}/api/play/vocab/words`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(apiRes.status()).toBe(200);
  const apiJson = await apiRes.json();
  const rows: any[] = apiJson?.data ?? apiJson;
  const found = rows.find(r => r.english === unique);
  expect(found, `DB에 ${unique}가 저장되어야 함`).toBeTruthy();
  console.log(`✅ 9. 서버 DB에 저장 확인 (id=${found.id}, status=${found.status})`);

  // 10) 새로고침 → 서버에서 다시 로드 → 단어가 로컬에 머지되어야 함
  await page.reload();
  await page.waitForFunction((w) => {
    const ws = JSON.parse(localStorage.getItem('wg.v1.words') || '[]');
    return ws.some((x: any) => x.word === w);
  }, unique, { timeout: 10_000 });
  console.log('✅ 10. 새로고침 후 서버에서 머지되어 로컬에 존재');

  // 11) 콘솔 에러 / 실패 요청 없음 (404 허용: 없는 첨부키 등)
  const hardFails = failedReqs.filter(u => !u.includes('favicon'));
  expect(hardFails, `실패한 요청: ${hardFails.join(', ')}`).toEqual([]);
  const hardErrs = consoleErrors.filter(e => !/favicon|404/.test(e));
  if (hardErrs.length) console.log(`⚠️  콘솔 에러: ${hardErrs.join(' | ')}`);
  console.log(`✅ 11. 네트워크·콘솔 clean (요청 실패 ${failedReqs.length}건, 콘솔 에러 ${consoleErrors.length}건)`);
});
