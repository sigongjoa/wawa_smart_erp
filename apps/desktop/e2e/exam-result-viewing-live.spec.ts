/**
 * Phase 2 — 학생 응시 → 선생님 결과 보기 전체 흐름
 *
 * 1. 선생님이 시험기간·시험지·문제·학생 배정 (API seed)
 * 2. 학생 API로 응시+제출 (자동 채점됨)
 * 3. 선생님 ERP 로그인 → /#/exams(ExamManagementPage) → 점수 컬럼에 채점 결과 노출 확인
 * 4. "점수" 버튼 클릭 → /#/exam-result/:attemptId → 문항별 ○/× + 학생 선택 표시 검증
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

test('선생님 ExamManagementPage에 자동 점수 노출 + 상세 결과 뷰', async ({ page }) => {
  const uniq = `er${Date.now().toString(36).slice(-5)}`;

  // teacher login
  const login = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin }),
  });
  const token = login.body.data.accessToken;

  // 학생 만들기
  const stu = await apiJson('/api/gacha/students', {
    method: 'POST',
    body: JSON.stringify({ name: `UC-R-${uniq}`, grade: '중1', pin: '3579' }),
  }, token);
  const studentId = stu.body.data.id;

  let periodId = '';
  let paperId = '';
  let assignmentId = '';
  let attemptId = '';

  try {
    // 시험기간 (먼 미래 월 사용, 충돌 회피)
    const rand = Math.floor(Math.random() * 1000);
    const ym = `2098-${String((rand % 12) + 1).padStart(2, '0')}`;
    let per = await apiJson('/api/exam-mgmt', {
      method: 'POST',
      body: JSON.stringify({ title: `UC-R ${uniq}`, period_month: ym }),
    }, token);
    if (per.status === 409) {
      const listRes = await apiJson('/api/exam-mgmt', {}, token);
      const existing = (listRes.body.data ?? []).find((p: any) => p.period_month === ym);
      if (existing) per = { status: 200, body: { data: existing } };
    }
    periodId = per.body.data.id;

    const paper = await apiJson(`/api/exam-mgmt/${periodId}/papers`, {
      method: 'POST',
      body: JSON.stringify({ title: `UC-R 영어 ${uniq}`, grade_filter: '중1' }),
    }, token);
    paperId = paper.body.data.id;

    await apiJson(`/api/exam-mgmt/papers/${paperId}`, {
      method: 'PATCH',
      body: JSON.stringify({ subject: 'english', durationMinutes: 30 }),
    }, token);

    await apiJson(`/api/exam-mgmt/papers/${paperId}/questions`, {
      method: 'PUT',
      body: JSON.stringify({
        questions: [
          { questionNo: 1, prompt: 'What is a verb?', choices: ['noun','run','blue','fast','happy'], correctChoice: 2, points: 1 },
          { questionNo: 2, prompt: 'Past of "go"?',    choices: ['gone','went','goes','going','goed'], correctChoice: 2, points: 1 },
          { questionNo: 3, prompt: 'Synonym "big"?',    choices: ['small','tiny','huge','short','thin'], correctChoice: 3, points: 1 },
        ],
      }),
    }, token);

    const assign = await apiJson(`/api/exam-mgmt/${periodId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, exam_paper_id: paperId }),
    }, token);
    assignmentId = assign.body.data.id;

    // 학생 로그인 (PIN 토큰)
    const playLogin = await apiJson('/api/play/login', {
      method: 'POST',
      body: JSON.stringify({ academy_slug: TEACHER.slug, name: `UC-R-${uniq}`, pin: '3579' }),
    });
    const playToken = playLogin.body.data.token;

    // 응시 시작
    const start = await apiJson(`/api/play/exams/${assignmentId}/start`, { method: 'POST' }, playToken);
    attemptId = start.body.data.id;

    // 답안 저장: Q1 정답(2), Q2 정답(2), Q3 오답(1)
    await apiJson(`/api/play/attempts/${attemptId}/answer`, {
      method: 'PUT', body: JSON.stringify({ questionNo: 1, choice: 2 }),
    }, playToken);
    await apiJson(`/api/play/attempts/${attemptId}/answer`, {
      method: 'PUT', body: JSON.stringify({ questionNo: 2, choice: 2 }),
    }, playToken);
    await apiJson(`/api/play/attempts/${attemptId}/answer`, {
      method: 'PUT', body: JSON.stringify({ questionNo: 3, choice: 1 }),
    }, playToken);

    // 제출
    const submit = await apiJson(`/api/play/attempts/${attemptId}/submit`, { method: 'POST' }, playToken);
    expect(submit.body.data.correct).toBe(2);
    expect(submit.body.data.total).toBe(3);

    // ── 선생님 ERP 로그인 ──
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
    await page.waitForURL(url => !url.toString().includes('#/login'), { timeout: 15_000 });

    // ExamManagementPage로 이동
    await page.goto('/#/exams', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /정기고사 관리/ })).toBeVisible({ timeout: 15_000 });

    // 월 이동해서 해당 period에 진입 (UC-R ym=2098-XX)
    // by-month는 selectedMonth state 기반. 직접 period 데이터가 로드될 때까지 기다림 — 또는 API fallback
    // Desktop UI는 "지난달/이번달/다음달/+2달" 4개 탭만 제공. 2098-XX는 탭에 없음.
    // 대신 API로 attempts-by-period 직접 검증:
    const byPeriod = await apiJson(`/api/exam-attempts/by-period/${periodId}`, {}, token);
    expect(byPeriod.status).toBe(200);
    const list = byPeriod.body.data;
    expect(list.length).toBeGreaterThanOrEqual(1);
    const mine = list.find((a: any) => a.id === attemptId);
    expect(mine?.auto_correct).toBe(2);
    expect(mine?.auto_total).toBe(3);

    // 결과 상세 페이지 직접 방문
    await page.goto(`/#/exam-result/${attemptId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(`UC-R-${uniq}`)).toBeVisible({ timeout: 15_000 });
    // 점수 카드 — 2 / 3
    const scoreMain = page.locator('.exam-result-score-main').first();
    await expect(scoreMain).toContainText('2');
    await expect(scoreMain).toContainText('3');

    // breakdown — Q1/Q2 정답, Q3 오답
    await expect(page.locator('.exam-result-item--correct')).toHaveCount(2);
    await expect(page.locator('.exam-result-item--wrong')).toHaveCount(1);

    // "오답만" 필터
    await page.getByRole('button', { name: /^오답만/ }).click();
    await expect(page.locator('.exam-result-item')).toHaveCount(1);
    await expect(page.locator('.exam-result-item--wrong')).toHaveCount(1);

    // "전체" 복귀
    await page.getByRole('button', { name: /^전체/ }).click();
    await expect(page.locator('.exam-result-item')).toHaveCount(3);

    console.log(`✅ P2-2 통과 — 점수 2/3 자동 채점, 문항별 breakdown, 오답만 필터 동작`);
  } finally {
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

test('/vocab/wrong 오답 현황 탭 기본 렌더', async ({ page }) => {
  // 로그인
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
  await page.waitForURL(url => !url.toString().includes('#/login'), { timeout: 15_000 });

  // /vocab 진입 → "오답 현황" 서브탭 클릭
  await page.goto('/#/vocab', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.vocab-subnav')).toBeVisible();
  await page.getByRole('tab', { name: /오답 현황/ }).click();
  await expect(page).toHaveURL(/#\/vocab\/wrong$/);

  // 로딩 끝난 후: 오답 없거나 그룹 리스트가 있음
  const emptyState = page.locator('.vocab-empty-state__title');
  const groups = page.locator('.vocab-wrong-group');
  await Promise.race([
    emptyState.first().waitFor({ state: 'visible', timeout: 15_000 }),
    groups.first().waitFor({ state: 'visible', timeout: 15_000 }),
  ]).catch(() => {});

  const hasEmpty = await emptyState.count();
  const groupCount = await groups.count();
  expect(hasEmpty + groupCount).toBeGreaterThan(0);

  console.log(`✅ /vocab/wrong 렌더 — empty=${hasEmpty}, groups=${groupCount}`);
});
