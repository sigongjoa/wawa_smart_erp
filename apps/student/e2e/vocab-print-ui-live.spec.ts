/**
 * Phase 3b — 학생 word-gacha UI 유즈케이스
 *
 * UC-S1: 선생님 API 배정 → word-gacha 홈에 알림 카드 노출 → 클릭 → 응시 → 제출 → 결과
 */
import { test, expect, type Page } from '@playwright/test';

const API = process.env.API || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
  academyName: process.env.E2E_ACADEMY_NAME || 'E2E테스트학원',
};

test.setTimeout(180_000);

async function apiJson(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function studentLogin(page: Page, name: string, pin: string) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click(`.academy-item:has-text("${TEACHER.academyName}")`);
  await page.fill('input[placeholder="이름"]', name);
  await page.fill('input[placeholder*="PIN"]', pin);
  await page.click('.login-btn');
  await expect(page.locator('.home-page')).toBeVisible({ timeout: 15_000 });
}

test('UC-S1: 학생 word-gacha 홈 알림 → 응시 → 제출 → 결과 (UI)', async ({ page }) => {
  const uniq = `s${Date.now().toString(36).slice(-5)}`;

  // ── seed: 선생님 JWT로 학생/단어/배정 ──
  const login = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin }),
  });
  const token = login.body.data.accessToken;

  const stuName = `UC-S-${uniq}`;
  const stuPin = '3333';
  const stu = await apiJson('/api/gacha/students', {
    method: 'POST',
    body: JSON.stringify({ name: stuName, grade: '중1', pin: stuPin }),
  }, token);
  const studentId = stu.body.data.id;

  try {
    // 단어 6개 approved
    for (let i = 0; i < 6; i++) {
      await apiJson('/api/vocab/words', {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId,
          english: `sw${i}${uniq}`,
          korean: `뜻${i}`,
          blank_type: 'korean',
        }),
      }, token);
    }

    // 배정
    const assign = await apiJson('/api/vocab/print/assign', {
      method: 'POST',
      body: JSON.stringify({ student_ids: [studentId], max_words: 6 }),
    }, token);
    const jobId = assign.body.data.created[0].job_id;
    expect(jobId).toBeTruthy();

    // ── 학생 React 앱 로그인 → 영단어 → word-gacha ──
    await studentLogin(page, stuName, stuPin);
    // word-gacha 이동 전에 localStorage에 creature 주입 → 온보딩 dialog skip
    await page.evaluate(() => {
      const now = new Date().toISOString();
      localStorage.setItem('wg.v1.creature', JSON.stringify({
        speciesKey: 'sprout', name: '테스트', personality: 'curious',
        stage: 1, bond: 50, hunger: 80,
        lastInteractionAt: now, lastTickedAt: now,
      }));
      // sync banner dismiss
      sessionStorage.setItem('wg.sync-banner-dismissed', '1');
    });
    await page.locator('.home-mode-card').filter({ hasText: '영단어' }).click();
    await page.waitForURL(/\/word-gacha\//, { timeout: 15_000 });

    // 만일 온보딩/재회 다이얼로그 떠도 즉시 닫기
    await page.evaluate(() => {
      const dlgs = ['#dlg-onboard', '#reunion'];
      for (const id of dlgs) {
        const el = document.querySelector(id) as HTMLDialogElement | null;
        if (el?.open) el.close();
        if (el) el.hidden = true;
      }
    });

    // 콘솔 수집 (디버깅)
    page.on('console', m => console.log('[wg]', m.type(), m.text()));
    page.on('pageerror', err => console.log('[wg-err]', err.message));

    // ── 홈 알림 카드 노출 ──
    const alertBox = page.locator('#print-alert');
    await expect(alertBox).toBeVisible({ timeout: 20_000 });
    await expect(alertBox).toContainText('새 단어 시험지');
    console.log('✅ UC-S1 step 1: 홈 알림 카드 노출');

    // dataset.jobId 세팅 대기 후 클릭 (안정성)
    await expect(alertBox).toHaveAttribute('data-job-id', /.+/, { timeout: 5_000 });
    // window.__wg 헬퍼로 직접 전환 (click 이벤트 안정성 회피)
    await page.evaluate(async (jid) => {
      await (window as any).__wg.enterPrintTake(jid);
    }, jobId);

    // ── 응시 화면 ──
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'print', { timeout: 10_000 });
    await expect(page.locator('#print-take-progress')).toContainText('1 / 6');
    // 첫 문항: prompt 는 "sw0{uniq}" 같은 값
    const prompt0 = await page.locator('#print-take-prompt').textContent();
    expect(prompt0?.startsWith('sw')).toBe(true);
    console.log(`✅ UC-S1 step 2: 응시 화면 진입 (prompt=${prompt0?.trim()})`);

    // 6문항 — prompt에서 번호 추출해 "뜻N" 선택지를 찾아 정답 5개, 첫 문항은 일부러 오답
    for (let i = 0; i < 6; i++) {
      const prompt = (await page.locator('#print-take-prompt').textContent())?.trim() || '';
      const m = prompt.match(/^sw(\d+)/);
      const correctKor = m ? `뜻${m[1]}` : null;
      const choiceBtns = page.locator('#print-take-choices .print-take-choice');
      const count = await choiceBtns.count();
      let correctIdx = -1;
      for (let c = 0; c < count; c++) {
        const txt = (await choiceBtns.nth(c).locator('.print-take-choice-text').textContent())?.trim();
        if (txt === correctKor) { correctIdx = c; break; }
      }
      const pick = i === 0 ? (correctIdx === 0 ? 1 : 0) : correctIdx;
      if (pick >= 0) await choiceBtns.nth(pick).click();

      if (i < 5) {
        await page.locator('#print-take-next').click();
      } else {
        // 마지막 문항
        page.once('dialog', d => d.accept());
        await page.locator('#print-take-next').click();
      }
    }

    // ── 결과 화면 ──
    const result = page.locator('#print-take-result');
    await expect(result).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#print-take-result-correct')).toHaveText('5');
    await expect(page.locator('#print-take-result-total')).toHaveText('6');

    // 오답 1개 row
    await expect(page.locator('.print-take-result-wrong-row')).toHaveCount(1);

    console.log('✅ UC-S1 step 3: 제출 → 결과 5/6 + 오답 1개');

    // ── 서버 상태 확인: 제출됨 + auto_correct=5 ──
    const jobAfter = await apiJson(`/api/vocab/print/jobs/${jobId}`, {}, token);
    expect(jobAfter.status).toBe(200);
    // handleGetPrintJob 응답 구조: { job, words, grammar }
    expect(jobAfter.body.data.job.status).toBe('submitted');
    expect(jobAfter.body.data.job.auto_correct).toBe(5);

    console.log('✅ UC-S1 step 4: 서버에 status=submitted, auto_correct=5 기록됨');
  } finally {
    await apiJson(`/api/gacha/students/${studentId}`, { method: 'DELETE' }, token).catch(() => {});
  }
});
