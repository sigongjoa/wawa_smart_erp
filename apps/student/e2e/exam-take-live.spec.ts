/**
 * 영어 시험 응시 E2E (실배포)
 *
 * UC-F: 선생님이 문제 입력 → 학생이 풀고 제출 → 자동 채점 결과 확인
 *
 * 데이터 준비는 API로 (시험기간 → 시험지 → subject=english + duration + 문제 3개 → 배정)
 *
 * 실행:
 *   STUDENT_URL=https://master.wawa-learn.pages.dev \
 *   API=https://wawa-smart-erp-api.zeskywa499.workers.dev \
 *   npx playwright test e2e/exam-take-live.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';

const API = process.env.API || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
  academyName: process.env.E2E_ACADEMY_NAME || 'E2E테스트학원',
};
const UNIQUE = `ex${Date.now().toString(36)}`;
const STUDENT_NAME = `exam학생-${UNIQUE}`;
const STUDENT_PIN = '2468';

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

async function loginStudent(page: Page) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click(`.academy-item:has-text("${TEACHER.academyName}")`);
  await page.fill('input[placeholder="이름"]', STUDENT_NAME);
  await page.fill('input[placeholder*="PIN"]', STUDENT_PIN);
  await page.click('.login-btn');
  await expect(page.locator('.home-page')).toBeVisible({ timeout: 15_000 });
}

test('UC-F: 영어 시험 응시 end-to-end (문제입력 → 응시 → 제출 → 채점)', async ({ page }) => {
  // ── 1. teacher login (JWT) ──
  const login = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin }),
  });
  expect(login.status).toBe(200);
  const token: string = login.body.data.accessToken;
  expect(token).toBeTruthy();

  // ── 2. 학생 생성 ──
  const stu = await apiJson('/api/gacha/students', {
    method: 'POST',
    body: JSON.stringify({ name: STUDENT_NAME, grade: '중1', pin: STUDENT_PIN }),
  }, token);
  expect(stu.status, JSON.stringify(stu.body)).toBeLessThan(300);
  const studentId: string = stu.body.data.id;

  // 변수 선언 (finally에서 정리용)
  let periodId = '';
  let paperId = '';
  let assignmentId = '';
  let attemptId = '';

  try {
    // ── 3. 시험 기간 (고유 month 사용 — 이전 실패 run의 데이터와 충돌 피하기) ──
    const rand6 = Math.floor(Math.random() * 1000);
    const ym = `2099-${String((rand6 % 12) + 1).padStart(2, '0')}`;
    let per = await apiJson('/api/exam-mgmt', {
      method: 'POST',
      body: JSON.stringify({ title: `UC-F ${UNIQUE}`, period_month: ym }),
    }, token);
    // 충돌 시 기존 period 재사용
    if (per.status === 409) {
      const listRes = await apiJson('/api/exam-mgmt', { method: 'GET' }, token);
      const existing = (listRes.body.data ?? []).find((p: any) => p.period_month === ym);
      if (existing) per = { status: 200, body: { data: existing } };
    }
    expect(per.status, JSON.stringify(per.body)).toBeLessThan(300);
    periodId = per.body.data.id;

    // ── 4. 시험지 생성 ──
    const paper = await apiJson(`/api/exam-mgmt/${periodId}/papers`, {
      method: 'POST',
      body: JSON.stringify({ title: `UC-F 영어 ${UNIQUE}`, grade_filter: '중1', is_custom: false }),
    }, token);
    expect(paper.status, JSON.stringify(paper.body)).toBeLessThan(300);
    paperId = paper.body.data.id;

    // ── 5. subject=english + duration ──
    const meta = await apiJson(`/api/exam-mgmt/papers/${paperId}`, {
      method: 'PATCH',
      body: JSON.stringify({ subject: 'english', durationMinutes: 30 }),
    }, token);
    expect(meta.status).toBeLessThan(300);

    // ── 6. 문제 3개 bulk set ──
    const quests = await apiJson(`/api/exam-mgmt/papers/${paperId}/questions`, {
      method: 'PUT',
      body: JSON.stringify({
        questions: [
          { questionNo: 1, prompt: 'Which is a verb?', choices: ['cat','run','blue','soft','quickly'], correctChoice: 2, points: 1 },
          { questionNo: 2, prompt: 'Synonym of "happy"?', choices: ['sad','tired','glad','angry','slow'], correctChoice: 3, points: 1 },
          { questionNo: 3, prompt: 'Past tense of "go"?', choices: ['goes','gone','goed','went','going'], correctChoice: 4, points: 1 },
        ],
      }),
    }, token);
    expect(quests.status, JSON.stringify(quests.body)).toBeLessThan(300);
    expect(quests.body.data.saved).toBe(3);

    // ── 7. 학생 배정 ──
    const assign = await apiJson(`/api/exam-mgmt/${periodId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, exam_paper_id: paperId }),
    }, token);
    expect(assign.status, JSON.stringify(assign.body)).toBeLessThan(300);
    assignmentId = assign.body.data.id;

    // ── 8. 학생 로그인 → 홈 카드 노출 ──
    await loginStudent(page);
    const examCard = page.locator(`.exam-cards button:has-text("${UNIQUE}")`);
    await expect(examCard, '홈에 영어 시험 카드 노출').toBeVisible({ timeout: 15_000 });
    await examCard.click();
    await page.waitForURL(/\/exam\//, { timeout: 10_000 });

    // ── 9. Ready 화면 → 시작 ──
    await expect(page.getByRole('button', { name: /시험 시작/ })).toBeVisible();
    await page.getByRole('button', { name: /시험 시작/ }).click();

    // ── 10. Take 화면 — Q1 풀이 ──
    await page.waitForFunction(() => /\d+\s*\/\s*\d+/.test(document.body.innerText || ''));
    // Q1 = correct choice 2 (run)
    await page.getByRole('button', { name: /^2\s*run$/ }).click();
    await page.getByRole('button', { name: /다음/ }).click();

    // Q2 = correct choice 3 (glad)
    await page.getByRole('button', { name: /^3\s*glad$/ }).click();
    await page.getByRole('button', { name: /다음/ }).click();

    // Q3 = correct choice 4 (went) — 일부러 틀리게 'goes'(1번)로
    await page.getByRole('button', { name: /^1\s*goes$/ }).click();

    // ── 11. 제출 ──
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: /제출/ }).click();

    // ── 12. Result 화면 — "2 / 3" 점수 표기 확인 ──
    await expect(page.locator('text=/\\b2\\s*\\/\\s*3\\b/')).toBeVisible({ timeout: 10_000 });

    // body 전체 텍스트에서 ✅/❌ 카운트
    const bodyText = await page.locator('body').innerText();
    const correctCount = (bodyText.match(/✅/g) || []).length;
    const wrongCount = (bodyText.match(/❌/g) || []).length;
    expect(correctCount, `정답 2개 (text: ${bodyText.slice(0, 200)})`).toBe(2);
    expect(wrongCount, '오답 1개').toBe(1);

    console.log(`✅ UC-F 통과 — 자동 채점 ${correctCount}/${correctCount + wrongCount}`);
  } finally {
    // ── 정리 ──
    if (assignmentId && periodId) {
      await apiJson(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, { method: 'DELETE' }, token).catch(() => {});
    }
    if (paperId && periodId) {
      await apiJson(`/api/exam-mgmt/${periodId}/papers/${paperId}`, { method: 'DELETE' }, token).catch(() => {});
    }
    if (periodId) {
      await apiJson(`/api/exam-mgmt/${periodId}`, { method: 'DELETE' }, token).catch(() => {});
    }
    if (studentId) {
      await apiJson(`/api/gacha/students/${studentId}`, { method: 'DELETE' }, token).catch(() => {});
    }
  }
});
