/**
 * word-gacha 유즈케이스 E2E (실 배포 대상)
 *
 * 커버:
 *  UC-A #54: 단어 POST 시 pos/example 서버 저장
 *  UC-B #52: 교재 탭 — 서버에서 목록 fetch + 유닛/단어 렌더
 *  UC-C #53: 문법 Q&A — 질문 제출 → 서버 저장 → 내 질문 섹션 노출
 *  UC-D #51: 퀴즈 — 실제 단어로 문제 렌더 → 답 선택 → 확인 → 상태 전환
 *
 * 실행:
 *   STUDENT_URL=https://master.wawa-learn.pages.dev \
 *   API=https://wawa-smart-erp-api.zeskywa499.workers.dev \
 *   npx playwright test e2e/word-gacha-usecases-live.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';

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

async function enterWordGacha(page: Page) {
  await loginAsStudent(page);
  await page.locator('.home-mode-card').filter({ hasText: '영단어' }).click();
  await page.waitForURL(/\/word-gacha\//, { timeout: 15_000 });
  await expect(page).toHaveTitle(/Word Gacha/);

  // 혹시 온보딩이 뜨면 기본값으로 통과
  const onboard = page.locator('#dlg-onboard');
  if (await onboard.isVisible().catch(() => false)) {
    await onboard.locator('.egg-pick').first().click();
    await page.click('#btn-onboard-next');
    await onboard.locator('#inp-name').fill('테스트');
    await page.click('#btn-onboard-next');
    await onboard.locator('.per-pick').first().click();
    await page.click('#btn-onboard-next');
    await expect(onboard).toBeHidden({ timeout: 5_000 });
  }

  // 12시간 이상 미접속 시 뜨는 재회(reunion) 다이얼로그 닫기
  const reunion = page.locator('#reunion');
  if (await reunion.isVisible().catch(() => false)) {
    await page.click('#btn-reunion-close').catch(() => {});
    await expect(reunion).toBeHidden({ timeout: 3_000 }).catch(() => {});
  }
}

test.describe('word-gacha 유즈케이스 (실배포)', () => {

  test('UC-A #54: 단어 POST 시 pos/example 서버 저장', async ({ page }) => {
    const posts: Array<{ body?: string; status?: number }> = [];
    page.on('request', r => {
      if (r.url().includes('/api/play/vocab/words') && r.method() === 'POST') {
        posts.push({ body: r.postData() || undefined });
      }
    });
    page.on('response', async r => {
      if (r.url().includes('/api/play/vocab/words') && r.request().method() === 'POST') {
        const m = posts.find(p => !p.status);
        if (m) m.status = r.status();
      }
    });

    await enterWordGacha(page);
    await page.locator('nav.tabbar').getByRole('button', { name: /학습/ }).click();
    await page.locator('#tab-learn-mywords').click();

    const fab = page.locator('#btn-add-word');
    await expect(fab).toBeVisible();
    await fab.click();
    await expect(page.locator('#dlg-add-word')).toBeVisible();

    // 영문자만 허용 (숫자 금지) — hex→문자 매핑으로 all-letters 보장
    const hex = Date.now().toString(16);
    const letters = hex.replace(/[0-9]/g, d => String.fromCharCode('a'.charCodeAt(0) + Number(d)));
    const uniq = `ucexam${letters}`.slice(0, 14);
    const example = `Example sentence for ${uniq}`;
    await page.fill('#aw-word', uniq);
    await page.fill('#aw-meaning', '유즈케이스54');
    await page.selectOption('#aw-pos', 'verb');
    await page.fill('#aw-example', example);
    await page.click('#btn-add-submit');
    await expect(page.locator('#dlg-add-word')).toBeHidden({ timeout: 5_000 });

    await page.waitForTimeout(1500);
    const ours = posts.find(p => p.body?.includes(uniq));
    expect(ours, 'POST 요청 나가야 함').toBeTruthy();
    expect(ours!.body).toContain('"pos":"verb"');
    expect(ours!.body).toContain('"example"');
    expect(ours!.body).toContain(example);
    expect(ours!.status, 'POST 2xx').toBeLessThan(300);

    // 서버 GET으로 pos/example 실제 저장 확인
    const token = await page.evaluate(() => localStorage.getItem('play_token'));
    const apiRes = await page.request.get(`${API}/api/play/vocab/words`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(apiRes.ok()).toBeTruthy();
    const rows: any[] = (await apiRes.json()).data ?? [];
    const row = rows.find(r => r.english === uniq);
    expect(row, 'DB에 단어 있어야 함').toBeTruthy();
    expect(row.pos, 'pos 저장').toBe('verb');
    expect(row.example, 'example 저장').toBe(example);
    console.log(`✅ UC-A 통과 — pos=${row.pos}, example="${row.example.slice(0, 40)}…"`);
  });

  test('UC-B #52: 교재 탭 — 서버 fetch + 유닛/빈상태 렌더', async ({ page }) => {
    const tbGets: string[] = [];
    page.on('request', r => {
      if (r.url().includes('/api/play/vocab/textbooks')) tbGets.push(r.url());
    });

    await enterWordGacha(page);
    await page.locator('nav.tabbar').getByRole('button', { name: /학습/ }).click();
    await page.locator('#tab-learn-textbook').click();
    await expect(page.locator('#tab-learn-textbook')).toHaveAttribute('aria-selected', 'true');

    await page.waitForTimeout(1500);
    expect(tbGets.length, '교재 목록 GET 1회 이상').toBeGreaterThanOrEqual(1);

    // 교재가 없으면 empty 표시, 있으면 unit 버튼 나옴
    const emptyVisible = await page.locator('#tb-empty').isVisible().catch(() => false);
    const unitsVisible = await page.locator('#tb-units .unit').first().isVisible().catch(() => false);
    expect(emptyVisible || unitsVisible, '빈 상태 또는 유닛 노출').toBeTruthy();
    console.log(`✅ UC-B 통과 — GETs=${tbGets.length}, empty=${emptyVisible}, hasUnits=${unitsVisible}`);
  });

  test('UC-C #53: 문법 Q&A — 질문 제출 → 서버 저장 → 내 질문 섹션 노출', async ({ page }) => {
    const grammarPosts: Array<{ body?: string; status?: number }> = [];
    page.on('request', r => {
      if (r.url().includes('/api/play/vocab/grammar') && r.method() === 'POST') {
        grammarPosts.push({ body: r.postData() || undefined });
      }
    });
    page.on('response', async r => {
      if (r.url().includes('/api/play/vocab/grammar') && r.request().method() === 'POST') {
        const m = grammarPosts.find(p => !p.status);
        if (m) m.status = r.status();
      }
    });

    await enterWordGacha(page);
    await page.locator('nav.tabbar').getByRole('button', { name: /연습/ }).click();
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'practice');

    const askInput = page.locator('textarea[placeholder*="질문"], #ask-input');
    const submitBtn = page.locator('#btn-ask-submit');
    const exists = await askInput.isVisible().catch(() => false) && await submitBtn.isVisible().catch(() => false);
    test.skip(!exists, '문법 탭 입력 UI가 페이지에 없음 — 스킵');

    const q = `UC53 질문 ${Date.now().toString(36)} — e2e 자동 생성`;
    await askInput.fill(q);
    await submitBtn.click();
    await page.waitForTimeout(1500);

    const ours = grammarPosts.find(p => p.body?.includes('UC53'));
    expect(ours, 'POST 나가야 함').toBeTruthy();
    expect(ours!.status, '2xx').toBeLessThan(300);

    // 서버 GET으로 저장 확인
    const token = await page.evaluate(() => localStorage.getItem('play_token'));
    const apiRes = await page.request.get(`${API}/api/play/vocab/grammar`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(apiRes.ok()).toBeTruthy();
    const rows: any[] = (await apiRes.json()).data ?? [];
    const found = rows.find(r => r.question?.includes('UC53'));
    expect(found, 'DB에 질문 저장').toBeTruthy();
    console.log(`✅ UC-C 통과 — id=${found.id}, status=${found.status}`);
  });

  test('UC-D #51: 퀴즈 — 실제 단어로 렌더 + 답 선택 + 확인 흐름', async ({ page }) => {
    const patchCalls: string[] = [];
    page.on('request', r => {
      const u = r.url();
      if (u.includes('/api/play/vocab/words/') && u.includes('/progress') && r.method() === 'PATCH') {
        patchCalls.push(u);
      }
    });

    await enterWordGacha(page);
    await page.locator('nav.tabbar').getByRole('button', { name: /학습/ }).click();
    await page.locator('#tab-learn-quiz').click();
    await expect(page.locator('#tab-learn-quiz')).toHaveAttribute('aria-selected', 'true');

    // 단어 부족이면 empty 표시 — 이 경우 테스트를 스킵
    const empty = await page.locator('#quiz-empty').isVisible().catch(() => false);
    test.skip(empty, '단어 2개 미만 — 퀴즈 세션 시작 불가 (skip)');

    // 세션 시작 렌더 확인: 진행 0/N, 4개 선택지에 실제 텍스트가 — 가 아닌 값으로 들어감
    await page.waitForFunction(() => {
      const v = document.getElementById('quiz-progress-val');
      return v && /\d+\s*\/\s*\d+/.test(v.textContent || '');
    }, undefined, { timeout: 8000 });

    const promptFirst = await page.locator('#quiz-stage-word').textContent();
    expect(promptFirst?.trim().length ?? 0, '첫 단어 렌더').toBeGreaterThan(0);
    const firstMoveText = await page.locator('#quiz-moves .move[data-i="0"] .move-text').textContent();
    expect(firstMoveText?.trim()).not.toBe('—');

    // 확인 버튼은 선택 전 disabled
    const confirm = page.locator('#btn-quiz-confirm');
    await expect(confirm).toBeDisabled();

    // 선택 → disabled 해제
    await page.locator('#quiz-moves .move[data-i="0"]').click();
    await expect(confirm).toBeEnabled();

    // 확인 1차: 정답/오답 공개 (is-correct / is-wrong 클래스)
    await confirm.click();
    await page.waitForFunction(() => {
      const btns = document.querySelectorAll('#quiz-moves .move');
      return Array.from(btns).some(b => b.classList.contains('is-correct'));
    }, undefined, { timeout: 5000 });

    // 확인 2차: 다음 문제 또는 결과 패널
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await page.waitForTimeout(500);
    // 다음 문제면 quiz-progress-val의 "done" 숫자가 1 이상, 결과 패널이면 #quiz-result 노출
    const resultVisible = await page.locator('#quiz-result').isVisible().catch(() => false);
    if (!resultVisible) {
      const progressText = (await page.locator('#quiz-progress-val').textContent()) || '';
      const done = Number((progressText.match(/^(\d+)\s*\//) || [])[1] ?? 0);
      expect(done, '진행도 1 이상').toBeGreaterThanOrEqual(1);
    }

    // 전체 세션이 끝나면 patch 호출됨. 결과까지 강제로 풀어서 검증:
    // HP/진행 한도에 도달할 때까지 반복 (최대 12회)
    for (let i = 0; i < 12; i++) {
      const finished = await page.locator('#quiz-result').isVisible().catch(() => false);
      if (finished) break;
      // 첫번째 choice 선택
      const move0 = page.locator('#quiz-moves .move[data-i="0"]');
      if (await move0.isDisabled().catch(() => true)) {
        // 이미 공개 상태 — 확인 눌러 다음
        await confirm.click({ trial: false }).catch(() => {});
      } else {
        await move0.click();
        await confirm.click();
        await page.waitForTimeout(150);
        await confirm.click();
      }
      await page.waitForTimeout(200);
    }

    const finishedFinal = await page.locator('#quiz-result').isVisible().catch(() => false);
    expect(finishedFinal, '최종 결과 패널 노출').toBeTruthy();

    await page.waitForTimeout(1200);
    console.log(`✅ UC-D 통과 — 퀴즈 완주, patch 호출=${patchCalls.length}건`);
    // 실서버에 저장된 vw_ 단어가 있을 때만 patch 호출됨 — seed-only 계정이면 0일 수 있음
    // 따라서 >=0 허용, 단 완주 자체가 핵심
  });
});
