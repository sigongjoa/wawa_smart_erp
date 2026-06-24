/**
 * Step4 검증 — 소비측 end-to-end: 신호 적재 → recommend-infer 큐 → 추천 산출 → 피드.
 * flow_v2의 핵심 결론(server-trust만 학습 · 최근 N · shred 제외)을 TS에서 재증명.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Env } from '@/types';
import { emitSignal } from '@/services/signal-service';
import { runRecommend, tickRecommendJob, drainRecommendJobs } from '@/services/recommend-service';
import { makeTestD1, makeTestEnv, seed, ShimD1 } from '@/test-support/d1-shim';

async function gachaFail(env: Env, concept: string, ingestId: string, trust: 'server' | 'client' = 'server') {
  return emitSignal(env, {
    academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
    payload: { card_id: ingestId, result: 'fail', box_from: 1, box_to: 1, concept },
    ts: '2026-06-23T10:00:00Z', ingestId, externalId: 'uuid-abc', trust,
  });
}

describe('recommend-infer — 소비측 실행 검증', () => {
  let db: ShimD1;
  let env: Env;
  beforeEach(() => {
    // 078 RS 업그레이드: runRecommend가 recommendation_items에도 기록 + resolver가 gacha_cards 조회 → 077·078 필요.
    db = makeTestD1(['076_flywheel_foundation.sql', '077_service_tables.sql', '078_rs_items.sql']);
    seed(db);
    env = makeTestEnv(db) as unknown as Env;
  });

  it('신호3건 → 큐 드레인 → 약점 지수법칙(최근 3번)', async () => {
    await gachaFail(env, '지수법칙', 's1');
    await gachaFail(env, '지수법칙', 's2');
    await gachaFail(env, '지수법칙', 's3');
    // 클라 신호(저신뢰)는 학습 제외돼야 함 — job도 안 생기고 집계도 제외
    await gachaFail(env, '클라위조', 'cli1', 'client');

    const queued = db.raw.prepare("SELECT COUNT(*) c FROM jobs WHERE status='queued' AND type='recommend-infer'").get() as any;
    expect(queued.c).toBe(3); // server 3건만 enqueue (client 제외)

    const processed = await drainRecommendJobs(env);
    expect(processed).toBe(3);

    const rec = db.raw.prepare("SELECT items FROM recommendations WHERE erp_student_id='student-eunji'").get() as any;
    const items = JSON.parse(rec.items);
    expect(items[0].ref).toBe('지수법칙');
    expect(items[0].reason).toBe('최근 3번 틀린 곳');
  });

  it('원자 claim — 처리된 job은 재claim 안 됨(이중처리 방지)', async () => {
    await gachaFail(env, '지수법칙', 'one');
    const first = await tickRecommendJob(env);
    expect(first?.res?.ref).toBe('지수법칙');
    const second = await tickRecommendJob(env); // 큐 비었음
    expect(second).toBeNull();
    const published = db.raw.prepare("SELECT COUNT(*) c FROM jobs WHERE status='published'").get() as any;
    expect(published.c).toBe(1);
  });

  it('wrong_answer 단원 집계 — jingdari 오답도 약점으로', async () => {
    await emitSignal(env, {
      academyId: 'acad-gangnam', source: 'jingdari', kind: 'wrong_answer',
      payload: { kid: 'jd1', type: '계산', lv: 'B', unit: '삼각함수', n: 1 },
      ts: '2026-06-23T11:00:00Z', ingestId: 'w1', erpStudentId: 'student-eunji', trust: 'server',
    });
    await drainRecommendJobs(env);
    const res = await runRecommend(env, 'acad-gangnam', 'student-eunji');
    expect(res?.ref).toBe('삼각함수');
  });

  it('crypto-shred — 키 폐기 후 추천 산출 null + 추천행 삭제(삭제권)', async () => {
    await gachaFail(env, '지수법칙', 'sh1');
    await drainRecommendJobs(env);
    expect(db.raw.prepare("SELECT COUNT(*) c FROM recommendations").get() as any).toEqual({ c: 1 });

    db.raw.exec("UPDATE student_keys SET shredded_at=datetime('now') WHERE erp_student_id='student-eunji'");
    const res = await runRecommend(env, 'acad-gangnam', 'student-eunji');
    expect(res).toBeNull();
    expect(db.raw.prepare("SELECT COUNT(*) c FROM recommendations").get() as any).toEqual({ c: 0 });
  });
});
