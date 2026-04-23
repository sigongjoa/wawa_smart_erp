/**
 * Phase 3b — 단어 시험지 학생 응시 루프 end-to-end (API 검증)
 *
 * 1. 선생님 JWT — 학생 + approved 단어 8개 생성
 * 2. /api/vocab/print/assign 으로 학생에게 배정 → job_id 획득
 * 3. 학생 PIN 로그인 → /api/play/vocab/print/pending 에 노출
 * 4. /start → questions 배열 수령 (4지선다, choices snapshot)
 * 5. 모든 문항에 correct_index 고정으로 답 저장 (정답률 100%)
 * 6. /submit → correct==total, auto_correct/auto_total 업데이트 확인
 * 7. 선생님 /api/vocab/print/jobs?status=submitted 에 노출 + /answers 에 breakdown
 * 8. vocab_words.box 업데이트 확인 (정답 → box 증가)
 * 9. cleanup
 *
 * UI 렌더링은 별도 세부 테스트에서 다룸 (이 파일은 API end-to-end)
 */
import { test, expect } from '@playwright/test';

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

test.setTimeout(120_000);

test('UC-P: 선생님 배정 → 학생 응시 → 자동 채점 → 선생님 상세', async () => {
  const uniq = `pt${Date.now().toString(36).slice(-5)}`;

  // ── 선생님 로그인 ──
  const login = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin }),
  });
  expect(login.status).toBe(200);
  const token = login.body.data.accessToken;

  // ── 학생 생성 ──
  const stu = await apiJson('/api/gacha/students', {
    method: 'POST',
    body: JSON.stringify({ name: `UC-P-${uniq}`, grade: '중1', pin: '4680' }),
  }, token);
  expect(stu.status).toBeLessThan(300);
  const studentId: string = stu.body.data.id;

  const createdWordIds: string[] = [];
  try {
    // ── 단어 8개 추가 (teacher 가 POST → approved) ──
    for (let i = 0; i < 8; i++) {
      const w = await apiJson('/api/vocab/words', {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId,
          english: `word${i}${uniq}`,
          korean: `뜻${i}`,
          blank_type: 'korean',
        }),
      }, token);
      expect(w.status).toBeLessThan(300);
      createdWordIds.push(w.body.data.id);
    }

    // ── 학생에게 배정 ──
    const assign = await apiJson('/api/vocab/print/assign', {
      method: 'POST',
      body: JSON.stringify({ student_ids: [studentId], max_words: 8 }),
    }, token);
    expect(assign.status).toBeLessThan(300);
    expect(assign.body.data.created.length).toBe(1);
    const jobId: string = assign.body.data.created[0].job_id;

    // ── 학생 PIN 로그인 ──
    const playLogin = await apiJson('/api/play/login', {
      method: 'POST',
      body: JSON.stringify({ academy_slug: TEACHER.slug, name: `UC-P-${uniq}`, pin: '4680' }),
    });
    expect(playLogin.status).toBe(200);
    const playToken = playLogin.body.data.token;

    // ── pending 목록에 노출 ──
    const pending = await apiJson('/api/play/vocab/print/pending', {}, playToken);
    expect(pending.status).toBe(200);
    expect(pending.body.data.some((j: any) => j.job_id === jobId)).toBe(true);

    // ── start → questions 수령 ──
    const start = await apiJson(`/api/play/vocab/print/${jobId}/start`, {
      method: 'POST', body: JSON.stringify({}),
    }, playToken);
    expect(start.status).toBe(200);
    const questions = start.body.data.questions as Array<{
      wordId: string; prompt: string; choices: string[]; selectedIndex: number | null;
    }>;
    expect(questions.length).toBe(8);
    for (const q of questions) {
      expect(q.choices.length).toBe(4);
      expect(q.selectedIndex).toBeNull();
    }

    // ── 모든 문항 정답 찍기 ──
    // correct_index 는 서버가 정한 값 → /start 응답엔 없지만 제출 후 breakdown에 나옴.
    // 여기선 어떤 선택이 정답인지 알 수 없으니 한 문항 당 4번 시도해야 함 — 대신
    // prompt === target.english 이고 choices 중 target.korean 이 정답이므로
    // "뜻N" 패턴으로 매칭 가능.
    for (const q of questions) {
      // prompt 에서 번호 추출 (ex: 'word3ptabc' → 3)
      const m = q.prompt.match(/^word(\d+)/);
      const correctKor = m ? `뜻${m[1]}` : null;
      const correctIdx = correctKor ? q.choices.findIndex(c => c === correctKor) : -1;
      const pick = correctIdx >= 0 ? correctIdx : 0;
      const save = await apiJson(`/api/play/vocab/print/${jobId}/answers/${q.wordId}`, {
        method: 'PUT', body: JSON.stringify({ selected_index: pick }),
      }, playToken);
      expect(save.status).toBe(200);
    }

    // ── 제출 ──
    const submit = await apiJson(`/api/play/vocab/print/${jobId}/submit`, {
      method: 'POST', body: JSON.stringify({}),
    }, playToken);
    expect(submit.status).toBe(200);
    expect(submit.body.data.correct).toBe(8);
    expect(submit.body.data.total).toBe(8);

    // ── 선생님 뷰 ──
    const jobs = await apiJson('/api/vocab/print/jobs?status=submitted&days=7', {}, token);
    expect(jobs.status).toBe(200);
    const mine = jobs.body.data.find((j: any) => j.job_id === jobId);
    expect(mine).toBeTruthy();
    expect(mine.auto_correct).toBe(8);
    expect(mine.auto_total).toBe(8);

    // 상세 — breakdown 8개
    const detail = await apiJson(`/api/vocab/print/jobs/${jobId}/answers`, {}, token);
    expect(detail.status).toBe(200);
    expect(detail.body.data.answers.length).toBe(8);
    const allCorrect = detail.body.data.answers.every((a: any) => a.correct);
    expect(allCorrect).toBe(true);

    // vocab_words.box 업데이트 검증 — 1개 단어라도 확인 (전원 정답이라 box≥2)
    const words = await apiJson(`/api/vocab/words?student_id=${studentId}`, {}, token);
    expect(words.status).toBe(200);
    const first = words.body.data.find((w: any) => w.id === createdWordIds[0]);
    expect(first).toBeTruthy();
    expect(first.box).toBeGreaterThanOrEqual(2);  // 정답 → box 증가
    expect(first.review_count).toBeGreaterThanOrEqual(1);

    console.log(`✅ UC-P end-to-end 통과 — 8/8 정답, box 업데이트 확인`);
  } finally {
    // cleanup: 학생 삭제가 cascade로 단어/시험지 모두 정리
    await apiJson(`/api/gacha/students/${studentId}`, { method: 'DELETE' }, token).catch(() => {});
  }
});
