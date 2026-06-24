/**
 * vine-flywheel E2E — 유즈케이스별 실 HTTP(wrangler dev) + 실 D1(076/077) 검증.
 *
 * 선행(README 참고):
 *   1) D1에 076·077 마이그레이션 적용
 *   2) _seed_test_fixtures.sql (acad-1 + 교사 김상현/PIN 1234)
 *   3) _seed_flywheel_e2e.sql (학생·동의·링크·acad-2)
 *   4) .dev.vars에 SIGNAL_MASTER_KEY·SIGNAL_WORKER_KEY
 *   5) wrangler dev (:8787)
 * 실행: npm run test:e2e -- flywheel-usecases
 *
 * 결정론: stu-eunji는 마지막 UC7(삭제권)에서 키가 폐기되므로 serial 순서 유지. 재실행 전 시드 재적용.
 */
import { test, expect, APIRequestContext } from '@playwright/test';

const WORKER_KEY = process.env.SIGNAL_WORKER_KEY ?? 'dev-worker-key-flywheel-e2e';
const ADMIN = { slug: 'alpha', name: '김상현', pin: '1234' };

async function login(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/auth/login', { data: ADMIN });
  expect(res.ok(), `로그인 실패 (${res.status()}) — 시드 적용됐는지 확인`).toBeTruthy();
  const token = (await res.json()).data?.accessToken;
  expect(token, 'accessToken 없음').toBeTruthy();
  return token;
}

test.describe.serial('flywheel 유즈케이스 E2E', () => {
  let auth: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    auth = { Authorization: `Bearer ${await login(request)}` };
  });

  test('UC1 가챠 오답 3건 → 추천 드레인 → 학생 피드에 약점 노출', async ({ request }) => {
    for (const card of ['c45', 'c46', 'c47']) {
      const r = await request.post('/api/gacha/review', {
        headers: auth,
        data: { erp_student_id: 'stu-eunji', card_id: card, result: 'fail', box_from: 1, box_to: 1, concept: '지수법칙' },
      });
      expect(r.ok(), `gacha review ${card} 실패: ${await r.text()}`).toBeTruthy();
      expect((await r.json()).data.signal).toBe(true);
    }
    const drain = await request.post('/api/flywheel/drain', { headers: auth });
    expect(drain.ok()).toBeTruthy();
    expect((await drain.json()).data.processed).toBeGreaterThanOrEqual(1);

    const feed = await request.get('/api/ssaem/feed?erp_student_id=stu-eunji', { headers: auth });
    const items = (await feed.json()).data.items;
    expect(items[0].ref).toBe('지수법칙');
    expect(items[0].reason).toContain('3');
  });

  test('UC2 징검다리 — 정답은 무신호, 오답은 wrong_answer 발신', async ({ request }) => {
    const ok = await request.post('/api/jingdari/attempt', {
      headers: auth, data: { erp_student_id: 'stu-eunji', item_kid: 'jd-ok', correct: true },
    });
    expect((await ok.json()).data.signal).toBe(false);

    const wrong = await request.post('/api/jingdari/attempt', {
      headers: auth,
      data: { erp_student_id: 'stu-eunji', item_kid: 'jd-1', correct: false, type: '계산', lv: 'B', unit: '삼각함수', n: 1 },
    });
    expect((await wrong.json()).data.signal).toBe(true);
  });

  test('UC3 쌤키퍼 — 활동 기록 + activity 신호', async ({ request }) => {
    const r = await request.post('/api/ssaem/activity', {
      headers: auth,
      data: { erp_student_id: 'stu-eunji', kind: '발표', subject: '수학', topic: '미적분', grade: 2, tags: ['리더십', '탐구'] },
    });
    expect(r.ok()).toBeTruthy();
    const out = (await r.json()).data;
    expect(out.signal).toBe(true);
    expect(out.activity).toBeTruthy();
  });

  test('UC4 외부 SDK 발신 — 워커키 server-trust 경로(/api/signal)', async ({ request }) => {
    const good = await request.post('/api/signal', {
      headers: { 'X-Signal-Worker-Key': WORKER_KEY },
      data: {
        academy_id: 'acad-1', source: 'edu-arch', kind: 'result',
        payload: { kid: 'k1', unit: '지수', difficulty: 'B', role: 'drill', correct: false },
        erp_student_id: 'stu-eunji', ingest_id: 'e2e-sdk-1',
      },
    });
    expect(good.ok(), `SDK 발신 실패: ${await good.text()}`).toBeTruthy();
    expect((await good.json()).data.inserted).toBe(true);

    const bad = await request.post('/api/signal', {
      headers: { 'X-Signal-Worker-Key': 'WRONG' },
      data: { academy_id: 'acad-1', source: 'edu-arch', kind: 'result', payload: {}, ingest_id: 'e2e-sdk-2' },
    });
    expect(bad.ok()).toBeFalsy(); // 워커키 틀림 → JWT 경로로 빠져 인증 실패
  });

  test('UC5 동의 게이트 — 동의 없는 학생은 신호 거부', async ({ request }) => {
    const r = await request.post('/api/gacha/review', {
      headers: auth,
      data: { erp_student_id: 'stu-noconsent', card_id: 'c1', result: 'fail', concept: '지수' },
    });
    expect(r.status()).toBe(422);
    expect(await r.text()).toContain('동의');
  });

  test('UC6 academy 격리 — acad-1 토큰으로 acad-2 학생 신호 차단', async ({ request }) => {
    const r = await request.post('/api/gacha/review', {
      headers: auth,
      data: { erp_student_id: 'stu-iso', card_id: 'c1', result: 'fail', concept: '침투' },
    });
    expect(r.status()).toBe(422); // 소유권 가드: stu-iso는 acad-2 소속
  });

  test('UC7 삭제권(crypto-shred) — 키 폐기 후 추천 소멸 + 재적재 거부', async ({ request }) => {
    const erase = await request.post('/api/flywheel/erase', {
      headers: auth, data: { erp_student_id: 'stu-eunji' },
    });
    expect(erase.ok()).toBeTruthy();
    expect((await erase.json()).data.erased).toBe(true);

    const feed = await request.get('/api/ssaem/feed?erp_student_id=stu-eunji', { headers: auth });
    expect((await feed.json()).data.items.length).toBe(0); // 추천 제거됨

    const after = await request.post('/api/gacha/review', {
      headers: auth,
      data: { erp_student_id: 'stu-eunji', card_id: 'c99', result: 'fail', concept: '지수법칙' },
    });
    expect(after.status()).toBe(422); // DEK 폐기 → 복호 불가 → 적재 거부
  });
});
