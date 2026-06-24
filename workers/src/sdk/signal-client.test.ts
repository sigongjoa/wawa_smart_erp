/**
 * Step5 검증 — signal-client SDK.
 * (1) SDK → /api/signal(handleSignal) → D1 실제 적재 루프
 * (2) 워커키 틀리면 미적재  (3) 5xx 재시도  (4) 4xx 즉시 실패.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { RequestContext } from '@/types';
import { SignalClient } from '@/sdk/signal-client';
import { handleSignal } from '@/routes/signal-handler';
import { makeTestD1, makeTestEnv, seed, ShimD1 } from '@/test-support/d1-shim';

describe('signal-client SDK', () => {
  let db: ShimD1;
  let env: ReturnType<typeof makeTestEnv>;
  beforeEach(() => {
    db = makeTestD1();
    seed(db);
    env = makeTestEnv(db);
  });

  // SDK의 fetch를 실제 handleSignal로 라우팅 (외부워커→Core Worker 시뮬레이션)
  const routingFetch = (): typeof fetch =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      const req = new Request(typeof url === 'string' ? url : url.toString(), init);
      const ctx = { env } as unknown as RequestContext; // 워커키 경로 = auth 불필요
      return handleSignal('POST', '/api/signal', req, ctx);
    }) as unknown as typeof fetch;

  it('워커키 정상 → /api/signal 경유 D1 적재', async () => {
    const client = new SignalClient({
      endpoint: 'http://core/api/signal', workerKey: 'test-worker-key-secret', fetchImpl: routingFetch(),
    });
    const r = await client.send({
      academyId: 'acad-gangnam', source: 'edu-arch', kind: 'result',
      payload: { kid: 'k1', unit: '지수', difficulty: 'B', role: 'drill', correct: false },
      erpStudentId: 'student-eunji', ingestId: 'sdk-1', // 생성기는 erp_student_id를 안다
    });
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(true);
    const cnt = db.raw.prepare("SELECT COUNT(*) c FROM signals WHERE source='edu-arch'").get() as any;
    expect(cnt.c).toBe(1);
  });

  it('워커키 틀림 → 미적재(server-trust 거부)', async () => {
    const client = new SignalClient({
      endpoint: 'http://core/api/signal', workerKey: 'WRONG', fetchImpl: routingFetch(), backoffMs: 1,
    });
    const r = await client.send({
      academyId: 'acad-gangnam', source: 'edu-arch', kind: 'result',
      payload: { kid: 'k1', unit: '지수', difficulty: 'B', role: 'drill', correct: false },
      externalId: 'uuid-abc', ingestId: 'sdk-2',
    });
    expect(r.ok).toBe(false);
    const cnt = db.raw.prepare("SELECT COUNT(*) c FROM signals").get() as any;
    expect(cnt.c).toBe(0);
  });

  it('5xx 재시도 후 성공 — 세 번째 호출에서 200', async () => {
    let calls = 0;
    const flaky = (async () => {
      calls++;
      if (calls < 3) return new Response('err', { status: 503 });
      return new Response(JSON.stringify({ data: { inserted: true } }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new SignalClient({ endpoint: 'http://x', workerKey: 'k', fetchImpl: flaky, backoffMs: 1 });
    const r = await client.send({ academyId: 'a', source: 'edu-arch', kind: 'result', payload: {}, ingestId: 'i1' });
    expect(r.ok).toBe(true);
    expect(calls).toBe(3);
  });

  it('4xx 즉시 실패 — 재시도 안 함', async () => {
    let calls = 0;
    const reject = (async () => {
      calls++;
      return new Response(JSON.stringify({ error: 'payload 거부' }), { status: 422 });
    }) as unknown as typeof fetch;
    const client = new SignalClient({ endpoint: 'http://x', workerKey: 'k', fetchImpl: reject, backoffMs: 1 });
    const r = await client.send({ academyId: 'a', source: 'edu-arch', kind: 'result', payload: {}, ingestId: 'i2' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(422);
    expect(calls).toBe(1);
  });
});
