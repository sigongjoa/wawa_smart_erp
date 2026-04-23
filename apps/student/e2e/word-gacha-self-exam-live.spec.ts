/**
 * 학생이 내 단어장에서 직접 시험을 시작하는 플로우 (self-start)
 */
import { test, expect, type Page } from '@playwright/test';

const API = process.env.API || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};

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

async function teacherLogin(): Promise<string> {
  // 여러 번 시도 (rate limit 간헐적)
  for (let i = 0; i < 3; i++) {
    const res = await apiJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin }),
    });
    if (res.body?.data?.accessToken) return res.body.data.accessToken;
    await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
  throw new Error('teacher login failed after retries');
}

async function enter(page: Page) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click('.academy-item:has-text("E2E테스트학원")');
  await page.fill('input[placeholder="이름"]', '테스트학생');
  await page.fill('input[placeholder*="PIN"]', '1234');
  await page.click('.login-btn');
  await page.waitForSelector('.home-page', { timeout: 15_000 });
  await page.evaluate(() => {
    const now = new Date().toISOString();
    localStorage.setItem('wg.v1.creature', JSON.stringify({
      speciesKey:'sprout',name:'테스트',personality:'curious',
      stage:1,bond:50,hunger:80,lastInteractionAt:now,lastTickedAt:now,
    }));
  });
  await page.locator('.home-mode-card').filter({ hasText: '영단어' }).click();
  await page.waitForURL(/\/word-gacha\//, { timeout: 15_000 });
  await page.evaluate(() => ['#dlg-onboard','#reunion'].forEach(id => {
    const el = document.querySelector(id) as HTMLDialogElement | null;
    if (el?.open) el.close(); if (el) (el as any).hidden = true;
  }));
}

test('내 단어장에서 [시험 치기] → 응시 화면 → 문항 풀이 → 제출 → 결과', async ({ page }) => {
  await enter(page);
  // 학습 탭 → 내 단어장
  await page.locator('nav.tabbar').getByRole('button', { name: /학습/ }).click();
  await page.locator('#tab-learn-mywords').click();

  // [시험 치기] 버튼 보임
  const examBtn = page.locator('#btn-self-exam');
  await expect(examBtn).toBeVisible({ timeout: 5_000 });
  await expect(examBtn).toContainText('시험 치기');
  await expect(examBtn).toContainText('최대 10문제');

  // 클릭 → 응시 화면 전환
  await examBtn.click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'print', { timeout: 15_000 });
  await expect(page.locator('#print-take-progress')).toContainText(/\d+\s*\/\s*\d+/);

  const total = await page.evaluate(() => {
    const v = document.getElementById('print-take-progress')?.textContent || '';
    const m = v.match(/\/\s*(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  expect(total).toBeGreaterThanOrEqual(4);

  // 모든 문제 첫 번째 선택지로 찍기
  for (let i = 0; i < total; i++) {
    await page.locator('#print-take-choices .print-take-choice').first().click();
    const isLast = i === total - 1;
    if (isLast) page.once('dialog', d => d.accept());
    await page.locator('#print-take-next').click();
  }

  // 결과 화면
  await expect(page.locator('#print-take-result')).toBeVisible({ timeout: 15_000 });
  const correct = await page.locator('#print-take-result-correct').textContent();
  const allTotal = await page.locator('#print-take-result-total').textContent();
  console.log(`result: ${correct}/${allTotal}`);
  expect(Number(allTotal)).toBe(total);

  console.log('✅ self-start 시험 end-to-end UI 통과');
});

test('UC-SE-c: 제출 후 vocab_words.box / wrong_count 실제 업데이트', async () => {
  // 선생님 토큰으로 학생+단어 격리 seed
  const token = await teacherLogin();
  const uniq = `sc${Date.now().toString(36).slice(-5)}`;
  const stu = await apiJson('/api/gacha/students', {
    method: 'POST',
    body: JSON.stringify({ name: `SE-c-${uniq}`, grade: '중1', pin: '5050' }),
  }, token);
  const studentId = stu.body.data.id;
  try {
    for (let i = 0; i < 5; i++) {
      await apiJson('/api/vocab/words', {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId,
          english: `sec${i}${uniq}`,
          korean: `뜻${i}`,
        }),
      }, token);
    }
    // 학생 PIN 로그인
    const play = await apiJson('/api/play/login', {
      method: 'POST',
      body: JSON.stringify({ academy_slug: TEACHER.slug, name: `SE-c-${uniq}`, pin: '5050' }),
    });
    const playToken = play.body.data.token;

    // self-start
    const selfRes = await apiJson('/api/play/vocab/print/self-start', {
      method: 'POST', body: JSON.stringify({ max_words: 5 }),
    }, playToken);
    expect(selfRes.status).toBe(200);
    const jobId = selfRes.body.data.id;
    const questions = selfRes.body.data.questions;
    expect(questions.length).toBe(5);

    // 모두 정답 선택 — prompt(english)에서 번호 뽑아 "뜻N" 선택
    for (const q of questions) {
      const m = (q.prompt as string).match(/^sec(\d+)/);
      const correctKor = m ? `뜻${m[1]}` : null;
      const idx = correctKor ? (q.choices as string[]).findIndex(c => c === correctKor) : -1;
      await apiJson(`/api/play/vocab/print/${jobId}/answers/${q.wordId}`, {
        method: 'PUT', body: JSON.stringify({ selected_index: idx >= 0 ? idx : 0 }),
      }, playToken);
    }
    const submit = await apiJson(`/api/play/vocab/print/${jobId}/submit`, {
      method: 'POST', body: JSON.stringify({}),
    }, playToken);
    expect(submit.body.data.correct).toBe(5);

    // box 업데이트 검증 — seed 단어들은 초기 box=1, 정답 제출 후 box=2 이상
    const words = await apiJson(`/api/vocab/words?student_id=${studentId}`, {}, token);
    const boxes = words.body.data.map((w: any) => w.box).sort();
    console.log('boxes after submit:', JSON.stringify(boxes));
    // 제출한 5개는 box >= 2, review_count>=1 이어야
    const reviewCounts = words.body.data.map((w: any) => w.review_count);
    expect(reviewCounts.every((r: number) => r >= 1)).toBe(true);
    expect(words.body.data.every((w: any) => w.box >= 2)).toBe(true);
    console.log('✅ UC-SE-c: box/review_count 업데이트 확인');
  } finally {
    await apiJson(`/api/gacha/students/${studentId}`, { method: 'DELETE' }, token).catch(() => {});
  }
});

test('UC-SE-d: 학생 self-start 제출 → 선생님 /vocab/grading 잡 리스트에 반영', async () => {
  const token = await teacherLogin();
  const uniq = `sd${Date.now().toString(36).slice(-5)}`;
  const stu = await apiJson('/api/gacha/students', {
    method: 'POST',
    body: JSON.stringify({ name: `SE-d-${uniq}`, grade: '중1', pin: '6060' }),
  }, token);
  const studentId = stu.body.data.id;
  try {
    for (let i = 0; i < 3; i++) {
      await apiJson('/api/vocab/words', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, english: `sd${i}${uniq}`, korean: `뜻${i}` }),
      }, token);
    }
    const play = await apiJson('/api/play/login', {
      method: 'POST',
      body: JSON.stringify({ academy_slug: TEACHER.slug, name: `SE-d-${uniq}`, pin: '6060' }),
    });
    const playToken = play.body.data.token;

    // self-start (단어 3개 < 예전 4개 제약 — 완화됐는지 검증)
    const selfRes = await apiJson('/api/play/vocab/print/self-start', {
      method: 'POST', body: JSON.stringify({}),
    }, playToken);
    expect(selfRes.status, JSON.stringify(selfRes.body)).toBe(200);
    const jobId = selfRes.body.data.id;

    const questions = selfRes.body.data.questions;
    for (const q of questions) {
      await apiJson(`/api/play/vocab/print/${jobId}/answers/${q.wordId}`, {
        method: 'PUT', body: JSON.stringify({ selected_index: 0 }),
      }, playToken);
    }
    await apiJson(`/api/play/vocab/print/${jobId}/submit`, { method: 'POST', body: JSON.stringify({}) }, playToken);

    // 선생님 뷰 — /api/vocab/print/jobs에서 submitted 상태로 노출
    const jobs = await apiJson('/api/vocab/print/jobs?status=submitted&days=1', {}, token);
    const mine = jobs.body.data.find((j: any) => j.job_id === jobId);
    expect(mine, '제출된 self-start job이 선생님 목록에 보여야 함').toBeTruthy();
    expect(mine.status).toBe('submitted');
    expect(mine.auto_total).toBe(3);

    // 상세
    const detail = await apiJson(`/api/vocab/print/jobs/${jobId}/answers`, {}, token);
    expect(detail.body.data.answers.length).toBe(3);
    console.log(`✅ UC-SE-d: 선생님 grading 잡에 self-start 제출 row 노출 (status=${mine.status}, total=${mine.auto_total})`);
  } finally {
    await apiJson(`/api/gacha/students/${studentId}`, { method: 'DELETE' }, token).catch(() => {});
  }
});

test('UC-SE-e: 단어 1개만 있어도 self-start 진행 (제약 완화)', async () => {
  const token = await teacherLogin();
  const uniq = `se${Date.now().toString(36).slice(-5)}`;
  const stu = await apiJson('/api/gacha/students', {
    method: 'POST',
    body: JSON.stringify({ name: `SE-e-${uniq}`, grade: '중1', pin: '7070' }),
  }, token);
  const studentId = stu.body.data.id;
  try {
    // 단어 딱 1개
    await apiJson('/api/vocab/words', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, english: `only${uniq}`, korean: `외로움` }),
    }, token);

    const play = await apiJson('/api/play/login', {
      method: 'POST',
      body: JSON.stringify({ academy_slug: TEACHER.slug, name: `SE-e-${uniq}`, pin: '7070' }),
    });
    const playToken = play.body.data.token;

    const selfRes = await apiJson('/api/play/vocab/print/self-start', {
      method: 'POST', body: JSON.stringify({}),
    }, playToken);
    expect(selfRes.status, '단어 1개라도 200 진행').toBe(200);
    expect(selfRes.body.data.questions.length).toBe(1);
    console.log('✅ UC-SE-e: 단어 1개로도 시험 진행됨');
  } finally {
    await apiJson(`/api/gacha/students/${studentId}`, { method: 'DELETE' }, token).catch(() => {});
  }
});
