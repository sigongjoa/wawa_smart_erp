/**
 * Phase 3b — 선생님 UI 유즈케이스 (브라우저)
 *
 * UC-P1: VocabGradeTab에서 배정 → 테이블에 row 추가 + "대기중" 메트릭 증가
 * UC-P4: 학생이 제출한 시험지의 "상세" 버튼 → 문항별 breakdown 모달
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://wawa-smart-erp.pages.dev';
const API = process.env.API || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};

test.setTimeout(180_000);
test.use({ baseURL: BASE });

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

async function teacherLogin(page: any) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const opts = document.querySelectorAll('#login-academy option');
    return opts.length > 1;
  }, { timeout: 15_000 });
  await page.locator('#login-academy').selectOption(TEACHER.slug);
  await page.waitForTimeout(600);
  await page.fill('#login-name', TEACHER.name);
  await page.fill('#login-pin', TEACHER.pin);
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.toString().includes('#/login'), { timeout: 15_000 });
}

test('UC-P1 + UC-P4: 선생님이 배정 → 학생 제출 시뮬 → 상세 모달 확인', async ({ page }) => {
  const uniq = `u${Date.now().toString(36).slice(-5)}`;

  // API seed
  const login = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin }),
  });
  const token = login.body.data.accessToken;

  const stu = await apiJson('/api/gacha/students', {
    method: 'POST',
    body: JSON.stringify({ name: `UC-U-${uniq}`, grade: '중1', pin: '2020' }),
  }, token);
  const studentId = stu.body.data.id;

  const wordIds: string[] = [];
  try {
    // 단어 5개 approved
    for (let i = 0; i < 5; i++) {
      const w = await apiJson('/api/vocab/words', {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId,
          english: `uw${i}${uniq}`,
          korean: `뜻${i}`,
          blank_type: 'korean',
        }),
      }, token);
      wordIds.push(w.body.data.id);
    }

    // ── UC-P1: UI에서 배정 ──
    await teacherLogin(page);
    await page.goto('/#/vocab/grading', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '학습 (영단어)' })).toBeVisible({ timeout: 10_000 });

    // "+ 시험지 배정" 버튼
    const assignBtn = page.locator('.vocab-header-action').getByRole('button', { name: /시험지 배정/ });
    await expect(assignBtn).toBeVisible();
    await assignBtn.click();

    // 모달 → 학생 선택
    await expect(page.locator('.modal-overlay')).toBeVisible();
    const studentCheckbox = page.locator('.vocab-grade-picker-item', { hasText: `UC-U-${uniq}` }).locator('input[type="checkbox"]');
    await expect(studentCheckbox).toBeVisible({ timeout: 10_000 });
    await studentCheckbox.check();

    // 단어 수 20개 기본값 → 5개밖에 없으니 5개로 pick될 것
    await page.getByRole('button', { name: /1명에게 배정/ }).click();

    // 모달 닫히고 테이블에 row 생김
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 10_000 });
    const row = page.locator('.vocab-table tbody tr', { hasText: `UC-U-${uniq}` });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('.pill--warning', { hasText: /대기|pending/i })).toBeVisible();

    console.log('✅ UC-P1: UI 배정 → 테이블에 "대기" row 확인');

    // ── 학생 API로 응시·제출 시뮬 (UI는 UC-S1에서 별도) ──
    const jobs = await apiJson(`/api/vocab/print/jobs?days=7`, {}, token);
    const job = jobs.body.data.find((j: any) => j.student_id === studentId);
    expect(job).toBeTruthy();
    const jobId = job.job_id;

    const playLogin = await apiJson('/api/play/login', {
      method: 'POST',
      body: JSON.stringify({ academy_slug: TEACHER.slug, name: `UC-U-${uniq}`, pin: '2020' }),
    });
    const playToken = playLogin.body.data.token;
    const start = await apiJson(`/api/play/vocab/print/${jobId}/start`, {
      method: 'POST', body: JSON.stringify({}),
    }, playToken);
    const questions = start.body.data.questions;

    // Q3만 오답, 나머지는 정답
    for (const [i, q] of questions.entries()) {
      const m = q.prompt.match(/^uw(\d+)/);
      const correctKor = m ? `뜻${m[1]}` : null;
      const correctIdx = correctKor ? q.choices.findIndex((c: string) => c === correctKor) : -1;
      const wrongIdx = correctIdx === 0 ? 1 : 0;
      const pick = i === 2 ? wrongIdx : correctIdx;
      await apiJson(`/api/play/vocab/print/${jobId}/answers/${q.wordId}`, {
        method: 'PUT', body: JSON.stringify({ selected_index: pick }),
      }, playToken);
    }
    const submit = await apiJson(`/api/play/vocab/print/${jobId}/submit`, {
      method: 'POST', body: JSON.stringify({}),
    }, playToken);
    expect(submit.body.data.correct).toBe(4);

    // ── UC-P4: UI 새로고침 → 제출됨 상태 → 상세 모달 ──
    await page.reload();
    await page.waitForURL(/#\/vocab\/grading$/);

    const submittedRow = page.locator('.vocab-table tbody tr', { hasText: `UC-U-${uniq}` });
    await expect(submittedRow.locator('.pill--success', { hasText: /제출|submitted/i })).toBeVisible({ timeout: 10_000 });
    // 점수 인라인 4/5 확인
    const scoreInline = submittedRow.locator('.vocab-score-inline');
    await expect(scoreInline).toContainText('4');
    await expect(scoreInline).toContainText('5');

    // 상세 버튼 클릭
    await submittedRow.getByRole('button', { name: /상세/ }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    // 5문항 breakdown
    await expect(page.locator('.vocab-detail-item')).toHaveCount(5);
    // 오답 1개 (is-ng)
    await expect(page.locator('.vocab-detail-item.is-ng')).toHaveCount(1);
    await expect(page.locator('.vocab-detail-item.is-ok')).toHaveCount(4);

    console.log('✅ UC-P4: 상세 모달 문항별 breakdown (4정답/1오답) 확인');

    await page.keyboard.press('Escape');
  } finally {
    await apiJson(`/api/gacha/students/${studentId}`, { method: 'DELETE' }, token).catch(() => {});
  }
});
