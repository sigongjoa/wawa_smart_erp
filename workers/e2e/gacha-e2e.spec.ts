/**
 * Concept Gacha 통합 E2E 테스트
 *
 * 유즈케이스:
 *   UC1: 관리자 학생 CRUD + PIN 관리
 *   UC2: 관리자 카드 CRUD
 *   UC3: 증명 생성 → 단계 등록 → 학생 배정
 *   UC4: 학생 PIN 로그인 → 가차 카드 학습 → Leitner
 *   UC5: 증명 순서배치 풀기 → 채점 → Leitner
 *   UC6: 증명 빈칸채우기 풀기 → 채점
 *   UC7: 증명 공유 마켓 → 복사
 *   UC8: 전체 통합 시나리오 (선생님→학생 end-to-end)
 *
 * 전체가 하나의 serial describe 안에서 순차 실행됩니다.
 * 관리자 로그인 1회만 수행하여 rate limit을 방지합니다.
 *
 * 사전 조건:
 *   - 019_concept_gacha.sql 마이그레이션이 적용된 상태
 *   - 선생님 계정 (남현욱/1312) 존재
 *
 * 실행: cd workers && npx playwright test e2e/gacha-e2e.spec.ts
 */

import { test, expect } from '@playwright/test';

// ── 테스트 자격증명 (환경변수 또는 기본값) ──
const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};
const UNIQUE = Date.now().toString(36);

// ── 공유 상태 ──
let adminToken = '';
let studentId = '';
let studentName = '';
let cardId = '';
let proofId = '';
let proofStepIds: string[] = [];
let playToken = '';
let academySlug = '';

function auth() {
  return { Authorization: `Bearer ${adminToken}` };
}

function playAuth() {
  return { Authorization: `Bearer ${playToken}` };
}

// ══════════════════════════════════════════════════
// 전체 순차 실행
// ══════════════════════════════════════════════════
test.describe.serial('Concept Gacha E2E', () => {

  // ── 사전: 관리자 로그인 (1회) ──
  test('사전: 관리자 로그인 + 학원 slug 확인', async ({ request }) => {
    // slug 필수 — multi-tenant 로그인
    const res = await request.post('/api/auth/login', {
      data: { slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin },
    });
    if (!res.ok()) {
      const errBody = await res.text();
      throw new Error(`관리자 로그인 실패 (${res.status()}): ${errBody}. 019_concept_gacha 마이그레이션이 적용되었는지 확인하세요.`);
    }
    const body = await res.json();
    adminToken = body.data.accessToken;
    expect(adminToken).toBeTruthy();

    // 로그인 응답에서 slug 추출
    academySlug = body.data.user?.academySlug || TEACHER.slug;
    expect(academySlug).toBeTruthy();
    console.log(`✅ 관리자 토큰 획득, slug: ${academySlug}`);
  });

  // ══════════════════════════════════════
  // UC1: 관리자 학생 CRUD + PIN 관리
  // ══════════════════════════════════════

  test('UC1-1: 학생 목록 조회', async ({ request }) => {
    const res = await request.get('/api/gacha/students', { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    console.log(`✅ 기존 학생 ${body.data.length}명`);
  });

  test('UC1-2: 학생 생성', async ({ request }) => {
    studentName = `E2E-${UNIQUE}`;
    const res = await request.post('/api/gacha/students', {
      headers: auth(),
      data: { name: studentName, pin: '1234', grade: '중1' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    studentId = body.data.id;
    expect(studentId).toBeTruthy();
    console.log(`✅ 학생 생성: ${studentId}`);
  });

  test('UC1-3: 학생 중복 이름 거부', async ({ request }) => {
    const res = await request.post('/api/gacha/students', {
      headers: auth(),
      data: { name: studentName, pin: '5678', grade: '중1' },
    });
    expect(res.ok()).toBeFalsy();
    console.log('✅ 중복 이름 거부됨');
  });

  test('UC1-4: 학생 수정', async ({ request }) => {
    const res = await request.patch(`/api/gacha/students/${studentId}`, {
      headers: auth(),
      data: { grade: '중2' },
    });
    expect(res.ok()).toBeTruthy();
    console.log('✅ 학년 변경 → 중2');
  });

  test('UC1-5: PIN 리셋', async ({ request }) => {
    const res = await request.post(`/api/gacha/students/${studentId}/reset-pin`, {
      headers: auth(),
      data: { pin: '9999' },
    });
    expect(res.ok()).toBeTruthy();
    console.log('✅ PIN → 9999 리셋');
  });

  test('UC1-6: 인증 없이 접근 차단', async ({ request }) => {
    const res = await request.get('/api/gacha/students');
    expect(res.status()).toBe(401);
  });

  // ══════════════════════════════════════
  // UC2: 관리자 카드 CRUD
  // ══════════════════════════════════════

  test('UC2-1: 카드 생성 (text)', async ({ request }) => {
    const res = await request.post('/api/gacha/cards', {
      headers: auth(),
      data: {
        student_id: studentId,
        type: 'text',
        question: `E2E: $x^2 + 2x + 1$의 인수분해는?`,
        answer: '$(x+1)^2$',
        topic: 'E2E-인수분해',
        grade: '중3',
      },
    });
    expect(res.status()).toBe(201);
    cardId = (await res.json()).data.id;
    expect(cardId).toBeTruthy();
    console.log(`✅ 카드 생성: ${cardId}`);
  });

  test('UC2-2: 카드 목록에서 확인', async ({ request }) => {
    const res = await request.get('/api/gacha/cards', { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const found = body.data.find((c: any) => c.id === cardId);
    expect(found).toBeTruthy();
    expect(found.box).toBe(1);
    console.log(`✅ 카드 발견 (Box ${found.box})`);
  });

  test('UC2-3: 카드 수정', async ({ request }) => {
    const res = await request.patch(`/api/gacha/cards/${cardId}`, {
      headers: auth(),
      data: { topic: 'E2E-완전제곱식' },
    });
    expect(res.ok()).toBeTruthy();
    console.log('✅ 토픽 수정');
  });

  test('UC2-4: 카드 벌크 생성', async ({ request }) => {
    const res = await request.post('/api/gacha/cards/bulk', {
      headers: auth(),
      data: {
        student_id: studentId,
        cards: [
          { type: 'text', question: 'E2E벌크1: 소수란?', answer: '1보다 큰 자연수 중 약수가 1과 자기자신뿐인 수' },
          { type: 'text', question: 'E2E벌크2: 합성수란?', answer: '1보다 큰 자연수 중 약수가 3개 이상인 수' },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    const created = body.data.created ?? body.data.ids ?? body.data;
    expect(Array.isArray(created) ? created.length : created).toBe(2);
    console.log('✅ 벌크 2장 생성');
  });

  // ══════════════════════════════════════
  // UC3: 증명 관리 + 학생 배정
  // ══════════════════════════════════════

  test('UC3-1: 증명 생성 (5단계, 빈칸 포함)', async ({ request }) => {
    const res = await request.post('/api/proof', {
      headers: auth(),
      data: {
        title: `E2E-삼각형내각-${UNIQUE}`,
        grade: '중2',
        chapter: '도형의 성질',
        difficulty: 2,
        description: '삼각형의 세 내각의 합이 180°임을 증명하시오.',
        steps: [
          { content: '삼각형 ABC에서 꼭짓점 A를 지나고 BC에 평행한 직선 l을 긋는다.', blanks_json: JSON.stringify([{ position: 20, length: 4, answer: 'BC에' }]) },
          { content: '엇각의 성질에 의해 ∠DAB = ∠ABC이다.', blanks_json: JSON.stringify([{ position: 13, length: 7, answer: '∠DAB' }]) },
          { content: '엇각의 성질에 의해 ∠EAC = ∠ACB이다.', blanks_json: JSON.stringify([{ position: 13, length: 7, answer: '∠EAC' }]) },
          { content: '∠DAB + ∠BAC + ∠EAC = 180° (직선 위의 각)' },
          { content: '따라서 ∠ABC + ∠BAC + ∠ACB = 180°' },
        ],
      },
    });
    expect(res.status()).toBe(201);
    proofId = (await res.json()).data.id;
    expect(proofId).toBeTruthy();
    console.log(`✅ 증명 생성: ${proofId}`);
  });

  test('UC3-2: 증명 상세 조회', async ({ request }) => {
    const res = await request.get(`/api/proof/${proofId}`, { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const proof = (await res.json()).data;
    expect(proof.steps.length).toBe(5);
    proofStepIds = proof.steps
      .sort((a: any, b: any) => a.step_order - b.step_order)
      .map((s: any) => s.id);
    console.log(`✅ 5단계 확인, stepIds 저장`);
  });

  test('UC3-3: 학생에게 증명 배정', async ({ request }) => {
    const res = await request.post(`/api/proof/${proofId}/assign`, {
      headers: auth(),
      data: { student_ids: [studentId] },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.assigned_students).toContain(studentId);
    console.log('✅ 증명 배정');
  });

  test('UC3-4: 중복 배정 무시', async ({ request }) => {
    const res = await request.post(`/api/proof/${proofId}/assign`, {
      headers: auth(),
      data: { student_ids: [studentId] },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.assigned_students.length).toBe(0);
    console.log('✅ 중복 배정 무시 확인');
  });

  test('UC3-5: 단계 수정 (PUT)', async ({ request }) => {
    const res = await request.put(`/api/proof/${proofId}/steps`, {
      headers: auth(),
      data: {
        steps: [
          { content: '삼각형 ABC에서 꼭짓점 A를 지나고 BC에 평행한 직선 l을 긋는다.', blanks_json: JSON.stringify([{ position: 20, length: 4, answer: 'BC에' }]) },
          { content: '엇각의 성질에 의해 ∠DAB = ∠ABC이다.', blanks_json: JSON.stringify([{ position: 13, length: 7, answer: '∠DAB' }]) },
          { content: '엇각의 성질에 의해 ∠EAC = ∠ACB이다.', blanks_json: JSON.stringify([{ position: 13, length: 7, answer: '∠EAC' }]) },
          { content: '∠DAB + ∠BAC + ∠EAC = 180° (직선 위의 각)' },
          { content: '따라서 ∠ABC + ∠BAC + ∠ACB = 180°', hint: '대입 정리' },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.step_count).toBe(5);

    // 새 step IDs 갱신
    const detailRes = await request.get(`/api/proof/${proofId}`, { headers: auth() });
    proofStepIds = (await detailRes.json()).data.steps
      .sort((a: any, b: any) => a.step_order - b.step_order)
      .map((s: any) => s.id);
    console.log('✅ 단계 수정 + stepIds 갱신');
  });

  // ══════════════════════════════════════
  // UC4: 학생 PIN 로그인 → 가차 학습 → Leitner
  // ══════════════════════════════════════

  test('UC4-1: 잘못된 PIN 거부', async ({ request }) => {
    const res = await request.post('/api/play/login', {
      data: { academy_slug: academySlug, name: studentName, pin: '0000' },
    });
    expect(res.status()).toBe(401);
    console.log('✅ 잘못된 PIN 거부');
  });

  test('UC4-2: 학생 PIN 로그인', async ({ request }) => {
    const res = await request.post('/api/play/login', {
      data: { academy_slug: academySlug, name: studentName, pin: '9999' },
    });
    expect(res.ok(), `학생 로그인 실패: ${res.status()}`).toBeTruthy();
    const body = await res.json();
    playToken = body.data.token;
    expect(playToken).toBeTruthy();
    expect(body.data.student.name).toBe(studentName);
    console.log(`✅ 학생 로그인, token=${playToken.slice(0, 8)}...`);
  });

  test('UC4-3: 세션 조회/생성', async ({ request }) => {
    const res = await request.get('/api/play/session', { headers: playAuth() });
    expect(res.ok()).toBeTruthy();
    const sess = (await res.json()).data;
    expect(sess.cards_drawn).toBeDefined();
    expect(sess.proofs_done).toBeDefined();
    console.log(`✅ 세션: 카드 ${sess.cards_drawn}/${sess.cards_target}, 증명 ${sess.proofs_done}/${sess.proofs_target}`);
  });

  test('UC4-4: 랜덤 카드 뽑기', async ({ request }) => {
    const res = await request.get('/api/play/random-card', { headers: playAuth() });
    expect(res.ok()).toBeTruthy();
    const card = (await res.json()).data;
    expect(card.id).toBeTruthy();
    expect(card.answer).toBeTruthy();
    cardId = card.id;
    console.log(`✅ 카드 뽑기: ${card.id.slice(0, 10)} (Box ${card.box})`);
  });

  test('UC4-5: 정답 → Box +1', async ({ request }) => {
    const res = await request.post(`/api/play/card/${cardId}/feedback`, {
      headers: playAuth(),
      data: { result: 'success' },
    });
    expect(res.ok()).toBeTruthy();
    const fb = (await res.json()).data;
    expect(fb.result).toBe('success');
    expect(fb.box_after).toBe(fb.box_before + 1);
    console.log(`✅ 정답: Box ${fb.box_before}→${fb.box_after}`);
  });

  test('UC4-6: 오답 → Box 리셋 1', async ({ request }) => {
    // 다시 뽑기
    const cardRes = await request.get('/api/play/random-card', { headers: playAuth() });
    const card = (await cardRes.json()).data;

    const res = await request.post(`/api/play/card/${card.id}/feedback`, {
      headers: playAuth(),
      data: { result: 'fail' },
    });
    expect(res.ok()).toBeTruthy();
    const fb = (await res.json()).data;
    expect(fb.result).toBe('fail');
    expect(fb.box_after).toBe(1);
    console.log(`✅ 오답: Box ${fb.box_before}→1`);
  });

  test('UC4-7: 인증 없이 play API 차단', async ({ request }) => {
    expect((await request.get('/api/play/session')).status()).toBe(401);
  });

  // ══════════════════════════════════════
  // UC5: 증명 순서배치
  // ══════════════════════════════════════

  test('UC5-1: 배정 증명 목록', async ({ request }) => {
    const res = await request.get('/api/play/proofs', { headers: playAuth() });
    expect(res.ok()).toBeTruthy();
    const proofs = (await res.json()).data;
    expect(proofs.length).toBeGreaterThan(0);
    const mine = proofs.find((p: any) => p.id === proofId);
    expect(mine).toBeTruthy();
    console.log(`✅ 배정 증명 ${proofs.length}개, "${mine.title}" 발견`);
  });

  test('UC5-2: 순서배치 문제 (셔플 + step_order 제거)', async ({ request }) => {
    const res = await request.get(`/api/play/proof/${proofId}/ordering`, { headers: playAuth() });
    expect(res.ok()).toBeTruthy();
    const prob = (await res.json()).data;
    expect(prob.steps.length).toBe(5);
    expect(prob.total_steps).toBe(5);
    for (const s of prob.steps) {
      expect(s.step_order).toBeUndefined(); // 정답 노출 금지
      expect(s.id).toBeTruthy();
    }
    console.log('✅ 5단계 셔플, step_order 미노출');
  });

  test('UC5-3: 정답 제출 → 100점 + Box 2', async ({ request }) => {
    const res = await request.post(`/api/play/proof/${proofId}/submit`, {
      headers: playAuth(),
      data: {
        mode: 'ordering',
        answers: proofStepIds,
        start_time: new Date(Date.now() - 30000).toISOString(),
      },
    });
    expect(res.ok()).toBeTruthy();
    const r = (await res.json()).data;
    expect(r.score).toBe(100);
    expect(r.box_after).toBe(2); // 70+ → box+1
    expect(r.detail.correct).toBe(5);
    expect(r.time_spent).toBeGreaterThan(0);
    console.log(`✅ 100점, Box ${r.box_before}→${r.box_after}, ${r.time_spent}초`);
  });

  test('UC5-4: 오답(역순) → 낮은 점수 + Box 리셋', async ({ request }) => {
    const res = await request.post(`/api/play/proof/${proofId}/submit`, {
      headers: playAuth(),
      data: {
        mode: 'ordering',
        answers: [...proofStepIds].reverse(),
        start_time: new Date(Date.now() - 20000).toISOString(),
      },
    });
    expect(res.ok()).toBeTruthy();
    const r = (await res.json()).data;
    expect(r.score).toBeLessThan(70);
    expect(r.box_after).toBe(1);
    console.log(`✅ ${r.score}점 (${r.detail.correct}/${r.detail.total}), Box→1`);
  });

  test('UC5-5: 미배정 증명 차단', async ({ request }) => {
    const res = await request.get('/api/play/proof/non-existent-id/ordering', { headers: playAuth() });
    expect([403, 404]).toContain(res.status());
    console.log('✅ 미배정 증명 차단');
  });

  // ══════════════════════════════════════
  // UC6: 증명 빈칸채우기
  // ══════════════════════════════════════

  test('UC6-1: 빈칸 문제 (정답 미노출)', async ({ request }) => {
    const res = await request.get(`/api/play/proof/${proofId}/fillblank`, { headers: playAuth() });
    expect(res.ok()).toBeTruthy();
    const prob = (await res.json()).data;
    expect(prob.steps.length).toBe(5);
    const blanked = prob.steps.filter((s: any) => s.has_blank);
    expect(blanked.length).toBeGreaterThan(0);
    for (const s of blanked) {
      for (const b of s.blanks) {
        expect(b.position).toBeDefined();
        expect(b.length).toBeDefined();
        expect(b.answer).toBeUndefined(); // 정답 미노출
      }
    }
    console.log(`✅ 빈칸 ${prob.total_blanks}개, Box ${prob.current_box}, 활성 ${blanked.length}단계`);
  });

  test('UC6-2: 정답 제출', async ({ request }) => {
    // 문제 다시 받기
    const probRes = await request.get(`/api/play/proof/${proofId}/fillblank`, { headers: playAuth() });
    const prob = (await probRes.json()).data;
    const blanked = prob.steps.filter((s: any) => s.has_blank);

    const knownAnswers: Record<number, string[]> = {
      1: ['BC에'], 2: ['∠DAB'], 3: ['∠EAC'],
    };
    const answers: Record<string, Record<number, string>> = {};
    for (const step of blanked) {
      const ans = knownAnswers[step.step_order];
      if (ans) {
        answers[step.id] = {};
        for (let i = 0; i < step.blanks.length; i++) {
          answers[step.id][i] = ans[i] || '';
        }
      }
    }

    const res = await request.post(`/api/play/proof/${proofId}/submit`, {
      headers: playAuth(),
      data: { mode: 'fill_blank', answers, start_time: new Date(Date.now() - 45000).toISOString() },
    });
    expect(res.ok()).toBeTruthy();
    const r = (await res.json()).data;
    expect(r.detail.total).toBeGreaterThan(0);
    console.log(`✅ 빈칸 ${r.score}점 (${r.detail.correct}/${r.detail.total}), Box ${r.box_before}→${r.box_after}`);
  });

  test('UC6-3: 빈 답안 → 0점', async ({ request }) => {
    const res = await request.post(`/api/play/proof/${proofId}/submit`, {
      headers: playAuth(),
      data: { mode: 'fill_blank', answers: {}, start_time: new Date().toISOString() },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.score).toBe(0);
    console.log('✅ 빈 답안 0점');
  });

  test('UC6-4: 잘못된 mode 거부', async ({ request }) => {
    const res = await request.post(`/api/play/proof/${proofId}/submit`, {
      headers: playAuth(),
      data: { mode: 'invalid', answers: {} },
    });
    expect(res.status()).toBe(400);
    console.log('✅ 잘못된 mode 거부');
  });

  // ══════════════════════════════════════
  // UC7: 증명 공유 마켓
  // ══════════════════════════════════════

  test('UC7-1: 증명 공유', async ({ request }) => {
    const res = await request.post(`/api/proof/${proofId}/share`, { headers: auth() });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.shared).toBe(true);
    console.log('✅ 공유됨');
  });

  test('UC7-2: 마켓에서 조회', async ({ request }) => {
    const res = await request.get('/api/proof/shared', { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const found = (await res.json()).data.find((p: any) => p.id === proofId);
    expect(found).toBeTruthy();
    console.log(`✅ 마켓에서 발견: "${found.title}"`);
  });

  test('UC7-3: 학년 필터', async ({ request }) => {
    const res = await request.get('/api/proof/shared?grade=중2', { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const found = (await res.json()).data.find((p: any) => p.id === proofId);
    expect(found).toBeTruthy();
    console.log('✅ 학년 필터 동작');
  });

  test('UC7-4: 증명 복사 (딥카피)', async ({ request }) => {
    const res = await request.post(`/api/proof/${proofId}/copy`, { headers: auth() });
    expect(res.status()).toBe(201);
    const copy = (await res.json()).data;
    expect(copy.copiedFrom).toBe(proofId);
    expect(copy.id).not.toBe(proofId);

    // 복사본 단계 확인
    const detailRes = await request.get(`/api/proof/${copy.id}`, { headers: auth() });
    expect((await detailRes.json()).data.steps.length).toBe(5);

    // 복사본 정리
    await request.delete(`/api/proof/${copy.id}`, { headers: auth() });
    console.log(`✅ 복사 + 5단계 확인 + 정리`);
  });

  test('UC7-5: 공유 해제', async ({ request }) => {
    const res = await request.delete(`/api/proof/${proofId}/share`, { headers: auth() });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.shared).toBe(false);
    console.log('✅ 공유 해제');
  });

  test('UC7-6: 비공유 증명 복사 차단', async ({ request }) => {
    const res = await request.post(`/api/proof/${proofId}/copy`, { headers: auth() });
    expect(res.ok()).toBeFalsy();
    console.log('✅ 비공유 복사 차단');
  });

  // ══════════════════════════════════════
  // UC8: 전체 통합 시나리오
  // ══════════════════════════════════════

  test('UC8: 선생님→학생 전체 플로우', async ({ request }) => {
    const intName = `통합-${UNIQUE}`;
    let intStudentId = '';
    let intProofId = '';
    let intToken = '';

    // 1. 선생님: 학생 생성
    const stuRes = await request.post('/api/gacha/students', {
      headers: auth(),
      data: { name: intName, pin: '7777' },
    });
    expect(stuRes.status()).toBe(201);
    intStudentId = (await stuRes.json()).data.id;
    console.log(`  1️⃣ 학생 생성: ${intStudentId.slice(0, 10)}`);

    // 2. 선생님: 카드 3장
    const cardRes = await request.post('/api/gacha/cards/bulk', {
      headers: auth(),
      data: {
        student_id: intStudentId,
        cards: [
          { type: 'text', question: '통합: 2+3=?', answer: '5' },
          { type: 'text', question: '통합: 1/2+1/3=?', answer: '5/6' },
          { type: 'text', question: '통합: 12 소인수분해', answer: '2²×3' },
        ],
      },
    });
    expect(cardRes.status()).toBe(201);
    console.log('  2️⃣ 카드 3장 생성');

    // 3. 선생님: 증명 + 배정
    const proofRes = await request.post('/api/proof', {
      headers: auth(),
      data: {
        title: `통합-피타고라스-${UNIQUE}`,
        grade: '중2',
        difficulty: 3,
        steps: [
          { content: '직각삼각형 ABC, ∠C=90°' },
          { content: 'C에서 AB에 수선의 발 H' },
          { content: '△ACH∼△ABC → AC²=AH·AB' },
          { content: '△BCH∼△BAC → BC²=BH·BA' },
          { content: 'AC²+BC²=(AH+BH)·AB=AB²' },
        ],
      },
    });
    expect(proofRes.status()).toBe(201);
    intProofId = (await proofRes.json()).data.id;

    await request.post(`/api/proof/${intProofId}/assign`, {
      headers: auth(),
      data: { student_ids: [intStudentId] },
    });
    console.log(`  3️⃣ 증명 생성+배정: ${intProofId.slice(0, 10)}`);

    // 4. 학생: 로그인
    const loginRes = await request.post('/api/play/login', {
      data: { academy_slug: academySlug, name: intName, pin: '7777' },
    });
    expect(loginRes.ok()).toBeTruthy();
    intToken = (await loginRes.json()).data.token;
    const intAuth = { Authorization: `Bearer ${intToken}` };
    console.log('  4️⃣ 학생 로그인');

    // 5. 학생: 세션 → 카드 3장 학습
    const sessRes = await request.get('/api/play/session', { headers: intAuth });
    expect((await sessRes.json()).data.cards_drawn).toBe(0);

    for (let i = 0; i < 3; i++) {
      const c = (await (await request.get('/api/play/random-card', { headers: intAuth })).json()).data;
      await request.post(`/api/play/card/${c.id}/feedback`, {
        headers: intAuth,
        data: { result: i < 2 ? 'success' : 'fail' },
      });
    }

    const sess2 = (await (await request.get('/api/play/session', { headers: intAuth })).json()).data;
    expect(sess2.cards_drawn).toBe(3);
    console.log(`  5️⃣ 카드 3장 학습 (세션: ${sess2.cards_drawn}장)`);

    // 6. 학생: 순서배치 정답
    const detailRes = await request.get(`/api/proof/${intProofId}`, { headers: auth() });
    const correctOrder = (await detailRes.json()).data.steps
      .sort((a: any, b: any) => a.step_order - b.step_order)
      .map((s: any) => s.id);

    const submitRes = await request.post(`/api/play/proof/${intProofId}/submit`, {
      headers: intAuth,
      data: { mode: 'ordering', answers: correctOrder, start_time: new Date(Date.now() - 60000).toISOString() },
    });
    const result = (await submitRes.json()).data;
    expect(result.score).toBe(100);
    console.log(`  6️⃣ 순서배치 100점, Box ${result.box_before}→${result.box_after}`);

    // 7. 학생: 프로필 확인
    const profRes = await request.get('/api/play/profile', { headers: intAuth });
    const profile = (await profRes.json()).data;
    expect(profile.student.name).toBe(intName);
    expect(profile.sessions.length).toBeGreaterThan(0);
    expect(profile.recentProofScores.length).toBeGreaterThan(0);
    console.log(`  7️⃣ 프로필: 세션${profile.sessions.length}, 증명기록${profile.recentProofScores.length}`);

    // 8. 선생님: 대시보드
    const statsRes = await request.get('/api/proof/stats', { headers: auth() });
    const stats = (await statsRes.json()).data;
    expect(stats.summary.students).toBeGreaterThan(0);
    console.log(`  8️⃣ 대시보드: 학생${stats.summary.students}, 카드${stats.summary.cards}, 증명${stats.summary.proofs}`);

    // 정리
    await request.delete(`/api/proof/${intProofId}`, { headers: auth() });
    await request.delete(`/api/gacha/students/${intStudentId}`, { headers: auth() });
    console.log('  🧹 통합 데이터 정리 완료');
  });

  // ── 정리: UC1~UC3 데이터 삭제 ──
  test('정리: 테스트 데이터 삭제', async ({ request }) => {
    if (proofId) await request.delete(`/api/proof/${proofId}`, { headers: auth() });
    if (cardId) await request.delete(`/api/gacha/cards/${cardId}`, { headers: auth() });
    if (studentId) await request.delete(`/api/gacha/students/${studentId}`, { headers: auth() });
    console.log('✅ 전체 테스트 데이터 정리');
  });
});
