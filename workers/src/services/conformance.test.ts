/**
 * Step6 conformance 게이트 — 6개 소스가 각자 규격 신호 1개를 적재 통과해야 "연동됨".
 * 통과 = 그 서비스가 공유 신호 계약에 실제로 부합한다는 실행 증거.
 * 설계: cloudflare-integration.md §5 (각 단계 conformance 게이트 통과 = 연동).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Env } from '@/types';
import { emitSignal } from '@/services/signal-service';
import { makeTestD1, makeTestEnv, seed, ShimD1 } from '@/test-support/d1-shim';

// 소스별 대표 규격 신호 (kind별 화이트리스트 payload)
const CASES: Array<{ source: string; kind: string; payload: Record<string, unknown> }> = [
  { source: 'erp',         kind: 'attendance',   payload: { net_minutes: 50, status: 'present' } },
  { source: 'gacha',       kind: 'review',       payload: { card_id: 'c1', result: 'fail', box_from: 1, box_to: 1, concept: '지수' } },
  { source: 'jingdari',    kind: 'wrong_answer',  payload: { kid: 'k1', type: '계산', lv: 'B', unit: '삼각', n: 1 } },
  { source: 'ssaemkeeper', kind: 'activity',     payload: { kind: '발표', subject: '수학', topic: '미적', grade: 2 } },
  { source: 'edu-arch',    kind: 'result',       payload: { kid: 'k2', unit: '지수', difficulty: 'B', role: 'drill', correct: false } },
  { source: 'assessment',  kind: 'submission',   payload: { ir_slug: 'ir-1', subject: '생명', stage: 'final' } },
];

describe('conformance — 6개 소스 규격 신호 적재', () => {
  let db: ShimD1;
  let env: Env;
  beforeEach(() => {
    db = makeTestD1();
    seed(db);
    env = makeTestEnv(db) as unknown as Env;
  });

  for (const c of CASES) {
    it(`${c.source} → ${c.kind} 적재 통과`, async () => {
      const r = await emitSignal(env, {
        academyId: 'acad-gangnam', source: c.source, kind: c.kind, payload: c.payload,
        ts: '2026-06-24T00:00:00Z', ingestId: `conf-${c.source}`, erpStudentId: 'student-eunji', trust: 'server',
      });
      expect(r.ok, `${c.source} 거부 사유: ${r.reason}`).toBe(true);
      expect(r.inserted).toBe(true);
    });
  }

  it('전 소스 적재 후 signals 6건 (연동 매트릭스 = 실행 검증됨)', async () => {
    for (const c of CASES) {
      await emitSignal(env, {
        academyId: 'acad-gangnam', source: c.source, kind: c.kind, payload: c.payload,
        ts: '2026-06-24T00:00:00Z', ingestId: `all-${c.source}`, erpStudentId: 'student-eunji', trust: 'server',
      });
    }
    const cnt = db.raw.prepare('SELECT COUNT(*) c FROM signals').get() as any;
    expect(cnt.c).toBe(6);
  });
});
