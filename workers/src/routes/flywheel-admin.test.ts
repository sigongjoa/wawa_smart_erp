/**
 * flywheel-admin 라우트 검증 — drain(추천 동기 처리) · erase(삭제권) · 권한.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { RequestContext } from '@/types';
import { makeTestD1, makeTestEnv, seed, ShimD1 } from '@/test-support/d1-shim';
import { emitSignal } from '@/services/signal-service';
import { handleFlywheelAdmin } from '@/routes/flywheel-admin-handler';

function ctx(db: ShimD1, role = 'admin'): RequestContext {
  return { env: makeTestEnv(db), auth: { userId: 'u1', role, academyId: 'acad-gangnam' }, tenantId: 'acad-gangnam' } as unknown as RequestContext;
}
const REVIEW = { card_id: 'c1', result: 'fail', box_from: 1, box_to: 1, concept: '지수법칙' };

describe('flywheel-admin', () => {
  let db: ShimD1;
  beforeEach(() => { db = makeTestD1(); seed(db); });

  it('drain — 큐의 recommend-infer를 처리해 추천 생성', async () => {
    await emitSignal(makeTestEnv(db) as any, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'd1', externalId: 'uuid-abc', trust: 'server' });
    const res = await handleFlywheelAdmin('POST', '/api/flywheel/drain',
      new Request('http://x/api/flywheel/drain', { method: 'POST' }), ctx(db));
    expect((await res.json() as any).data.processed).toBeGreaterThanOrEqual(1);
    const rec = db.raw.prepare("SELECT COUNT(*) c FROM recommendations WHERE erp_student_id='student-eunji'").get() as any;
    expect(rec.c).toBe(1);
  });

  it('erase — 키 폐기 + 추천 제거, 이후 적재 거부', async () => {
    const env = makeTestEnv(db) as any;
    await emitSignal(env, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'e1', externalId: 'uuid-abc', trust: 'server' });
    await handleFlywheelAdmin('POST', '/api/flywheel/drain', new Request('http://x/api/flywheel/drain', { method: 'POST' }), ctx(db));

    const er = await handleFlywheelAdmin('POST', '/api/flywheel/erase',
      new Request('http://x/api/flywheel/erase', { method: 'POST', body: JSON.stringify({ erp_student_id: 'student-eunji' }) }), ctx(db));
    expect((await er.json() as any).data.erased).toBe(true);
    expect((db.raw.prepare("SELECT COUNT(*) c FROM recommendations").get() as any).c).toBe(0);
    expect((db.raw.prepare("SELECT shredded_at FROM student_keys WHERE erp_student_id='student-eunji'").get() as any).shredded_at).toBeTruthy();

    const after = await emitSignal(env, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'e2', externalId: 'uuid-abc', trust: 'server' });
    expect(after.ok).toBe(false); // 키 폐기 → 거부
  });

  it('권한 — 학생 역할은 403', async () => {
    const res = await handleFlywheelAdmin('POST', '/api/flywheel/drain',
      new Request('http://x/api/flywheel/drain', { method: 'POST' }), ctx(db, 'student'));
    expect(res.status).toBe(403);
  });
});
