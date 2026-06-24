/**
 * 2계층 RS 검증 — 복합점수 랭킹 · resolver 개념→행동 · today 필터 · act acted_at 갱신.
 *   SSOT: vine-flywheel/docs/specs/rs-api-contract.md. D1 shim으로 실제 SQLite 적재 검증.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Env } from '@/types';
import { emitSignal } from '@/services/signal-service';
import { runRecommend, drainRecommendJobs } from '@/services/recommend-service';
import { resolveConceptToAction } from '@/services/rec-resolver';
import { handlePlayRs } from '@/routes/play-rs-handler';
import { handleRecommendQueue, handleRecommendPatch } from '@/routes/ssaem-rs-handler';
import { makeTestD1, makeTestEnv, seed, ShimD1 } from '@/test-support/d1-shim';

const ACADEMY = 'acad-gangnam';
const STUDENT = 'student-eunji';

/** 최소 KV 셰임 — play 토큰 인증(get json / put)만 지원. */
function makeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string, type?: string) {
      const v = store.get(key);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  };
}

/** 078 RS 테이블까지 갖춘 테스트 D1. (name/grade는 seed 후 ALTER — 위치기반 seed INSERT 보존) */
function makeRsDb(): ShimD1 {
  return makeTestD1(['076_flywheel_foundation.sql', '077_service_tables.sql', '078_rs_items.sql']);
}

async function gachaFail(env: Env, concept: string, ingestId: string, ts: string) {
  return emitSignal(env, {
    academyId: ACADEMY, source: 'gacha', kind: 'review',
    payload: { card_id: ingestId, result: 'fail', box_from: 1, box_to: 1, concept },
    ts, ingestId, externalId: 'uuid-abc', trust: 'server',
  });
}

function playReq(method: string, path: string, token: string, body?: unknown): Request {
  return new Request(`https://x${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('RS 2계층', () => {
  let db: ShimD1;
  let env: Env;
  beforeEach(() => {
    db = makeRsDb();
    seed(db); // 위치기반 INSERT(2값) — ALTER 전에 실행
    // d1-shim 최소 students(id, academy_id)에 RS 큐가 읽는 name/grade 추가 후 채움
    db.raw.exec(`ALTER TABLE students ADD COLUMN name TEXT;`);
    db.raw.exec(`ALTER TABLE students ADD COLUMN grade TEXT;`);
    db.raw.exec(`UPDATE students SET name='은지', grade='중2' WHERE id='${STUDENT}';`);
    // gacha_cards를 프로덕션 실현(019: topic/chapter) + 공유D1(077: concept) 둘 다 가진 superset로 교체 —
    // resolver/coldStart가 참조하는 모든 컬럼을 갖춰 실제 매칭 경로를 검증.
    db.raw.exec(`DROP TABLE IF EXISTS gacha_cards;`);
    db.raw.exec(`CREATE TABLE gacha_cards (
      id TEXT PRIMARY KEY, academy_id TEXT NOT NULL, concept TEXT, topic TEXT, chapter TEXT,
      student_id TEXT, box INTEGER DEFAULT 1);`);
    const base = makeTestEnv(db);
    const kv = makeKv();
    kv.put('play:tok', JSON.stringify({ studentId: STUDENT, academyId: ACADEMY, teacherId: 't', name: '은지' }));
    env = { ...base, KV: kv } as unknown as Env;
  });

  it('resolver: 개념→가챠덱(카드 있을 때) / 폴백 드릴(없을 때)', async () => {
    // 카드 없음 → review 폴백
    const fb = await resolveConceptToAction('확률', { env, academyId: ACADEMY, erpStudentId: STUDENT });
    expect(fb.action_type).toBe('review');
    expect(fb.target_path).toBe('/drill?concept=%ED%99%95%EB%A5%A0');

    // 그 개념 카드 추가 → gacha_deck
    db.raw.exec(`INSERT INTO gacha_cards (id, academy_id, concept) VALUES ('gc-1','${ACADEMY}','확률');`);
    const hit = await resolveConceptToAction('확률', { env, academyId: ACADEMY, erpStudentId: STUDENT });
    expect(hit.action_type).toBe('gacha_deck');
    expect(hit.target_path).toBe('/gacha?concept=%ED%99%95%EB%A5%A0');
    expect(hit.action_ref).toBe('확률');
  });

  it('복합점수: 더 자주·최근 틀린 개념이 rank 1', async () => {
    const recent = '2026-06-24T09:00:00Z';
    const old = '2026-05-01T09:00:00Z';
    // 지수법칙: 최근 3회. 미분: 오래된 1회 → 지수법칙이 상위.
    await gachaFail(env, '지수법칙', 'a1', recent);
    await gachaFail(env, '지수법칙', 'a2', recent);
    await gachaFail(env, '지수법칙', 'a3', recent);
    await gachaFail(env, '미분', 'b1', old);
    await drainRecommendJobs(env);

    const items = db.raw.prepare(
      `SELECT rank, action_ref, score_total FROM recommendation_items
       WHERE erp_student_id=? ORDER BY rank ASC`
    ).all(STUDENT) as any[];
    expect(items.length).toBe(2);
    expect(items[0].action_ref).toBe('지수법칙');
    expect(items[0].score_total).toBeGreaterThan(items[1].score_total);
    // 자동서빙 상태로 기록
    const auto = db.raw.prepare(`SELECT status FROM recommendation_items WHERE rank=1 AND erp_student_id=?`).get(STUDENT) as any;
    expect(auto.status).toBe('auto_served');
  });

  it('daily_cap: rs_config 상한만큼만 기록', async () => {
    // 078 seed는 마이그레이션 시점 academies 기준 — 테스트는 seed 후이므로 명시 삽입.
    db.raw.exec(`INSERT INTO rs_config (academy_id, daily_cap) VALUES ('${ACADEMY}', 2)
                 ON CONFLICT(academy_id) DO UPDATE SET daily_cap=2;`);
    for (let i = 0; i < 4; i++) await gachaFail(env, `개념${i}`, `c${i}`, '2026-06-24T09:00:00Z');
    await drainRecommendJobs(env);
    const cnt = db.raw.prepare(`SELECT COUNT(*) c FROM recommendation_items WHERE erp_student_id=?`).get(STUDENT) as any;
    expect(cnt.c).toBe(2);
  });

  const todayReq = () => {
    const req = playReq('GET', '/api/play/today', 'tok');
    return handlePlayRs('GET', '/api/play/today', req, { request: req, env } as any);
  };

  it('today: status 필터(rejected/완료 제외) + cold_start 폴백', async () => {
    // 신호 없음 → cold_start true, 빈 피드 금지
    const j1 = (await (await todayReq()).json()) as any;
    expect(j1.data.cold_start).toBe(true);
    expect(j1.data.actions.length).toBeGreaterThan(0);

    // 신호 적재 → 실아이템
    await gachaFail(env, '지수법칙', 'd1', '2026-06-24T09:00:00Z');
    await drainRecommendJobs(env);
    const j2 = (await (await todayReq()).json()) as any;
    expect(j2.data.cold_start).toBe(false);
    expect(j2.data.actions[0].type).toBeTruthy();

    // 모든 행을 rejected로 → today서 제외 → 다시 폴백
    db.raw.exec(`UPDATE recommendation_items SET status='teacher_rejected' WHERE erp_student_id='${STUDENT}'`);
    const j3 = (await (await todayReq()).json()) as any;
    expect(j3.data.cold_start).toBe(true);
  });

  it('act: completed → acted_at 갱신 + recommendation_action 신호', async () => {
    await gachaFail(env, '지수법칙', 'e1', '2026-06-24T09:00:00Z');
    await drainRecommendJobs(env);
    const item = db.raw.prepare(`SELECT id FROM recommendation_items WHERE erp_student_id=? AND rank=1`).get(STUDENT) as any;

    const path = `/api/play/recommendations/${item.id}/act`;
    const r = await handlePlayRs('POST', path, playReq('POST', path, 'tok', { action: 'completed' }), { request: playReq('POST', path, 'tok', { action: 'completed' }), env } as any);
    const j = (await r.json()) as any;
    expect(j.data.ok).toBe(true);

    const after = db.raw.prepare(`SELECT acted_at FROM recommendation_items WHERE id=?`).get(item.id) as any;
    expect(after.acted_at).toBeTruthy();
    const sig = db.raw.prepare(`SELECT COUNT(*) c FROM signals WHERE kind='recommendation_action'`).get() as any;
    expect(sig.c).toBe(1);
  });

  it('강사 큐: 학생별 그룹 + risk · boost/reject 전이 + intervention 신호', async () => {
    await gachaFail(env, '지수법칙', 'q1', '2026-06-24T09:00:00Z');
    await gachaFail(env, '미분', 'q2', '2026-06-24T09:00:00Z');
    await drainRecommendJobs(env);

    const ctx: any = { request: new Request('https://x/api/ssaem/recommendations'), env, auth: { userId: 'u-teacher', academyId: ACADEMY, role: 'instructor' } };
    const qr = await handleRecommendQueue(ctx.request, ctx, ACADEMY);
    const qj = (await qr.json()) as any;
    expect(qj.data.students.length).toBe(1);
    const stu = qj.data.students[0];
    expect(stu.erp_student_id).toBe(STUDENT);
    expect(stu.name).toBe('은지');
    expect(stu.items.length).toBe(2);
    expect(stu.risk).toHaveProperty('churn');
    expect(stu.risk).toHaveProperty('stale_days');

    // rank2 아이템을 boost → rank1 + teacher_boosted, 다른 행 rank+1
    const rank2 = db.raw.prepare(`SELECT id FROM recommendation_items WHERE erp_student_id=? AND rank=2`).get(STUDENT) as any;
    const pctx: any = { request: new Request('https://x'), env, auth: { userId: 'u-teacher', academyId: ACADEMY } };
    const pr = await handleRecommendPatch(
      new Request('https://x', { method: 'PATCH', body: JSON.stringify({ action: 'boost' }) }), pctx, ACADEMY, rank2.id);
    const pj = (await pr.json()) as any;
    expect(pj.data.ok).toBe(true);
    expect(pj.data.item.status).toBe('teacher_boosted');
    expect(pj.data.item.rank).toBe(1);

    // intervention 신호 적재(boost → lever=boost)
    const intv = db.raw.prepare(`SELECT COUNT(*) c FROM signals WHERE kind='intervention'`).get() as any;
    expect(intv.c).toBe(1);

    // reject → teacher_rejected, 큐서 제외
    const rejected = await handleRecommendPatch(
      new Request('https://x', { method: 'PATCH', body: JSON.stringify({ action: 'reject' }) }), pctx, ACADEMY, rank2.id);
    await rejected.json();
    const qr2 = await handleRecommendQueue(new Request('https://x/api/ssaem/recommendations'), ctx, ACADEMY);
    const qj2 = (await qr2.json()) as any;
    expect(qj2.data.students[0].items.length).toBe(1); // rejected 제외
  });
});
