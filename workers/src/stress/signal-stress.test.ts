/**
 * 로컬 스트레스(서비스계층) — emitSignal/recommend를 실 SQLite(node:sqlite shim) 위에서 대량 구동.
 *
 * 방법론(.claude/skills/performance-testing): 테스트유형 = **Volume**(대량 데이터/정상연산) 중심.
 * 한계(정직): node:sqlite는 동기·단일 JS 스레드 → 진짜 동시성/네트워크 경합은 재현 안 됨.
 *   여기서 재는 것 = (a) 로직 처리량(상대치), (b) 대규모에서 불변식 유지(멱등·격리·추천·키),
 *   (c) 부하 하 버그·메모리. 절대 처리량·D1 과부하는 k6 + --remote 로(리서치 결론).
 *
 * 실행: npx vitest run src/stress/signal-stress.test.ts
 */
import { describe, it, expect } from 'vitest';
import { appendFileSync } from 'node:fs';
import type { Env } from '@/types';
import { emitSignal } from '@/services/signal-service';
import { drainRecommendJobs } from '@/services/recommend-service';
import { makeTestD1, makeTestEnv, ShimD1 } from '@/test-support/d1-shim';

const OUT = process.env.STRESS_OUT || '/tmp/stress-metrics.txt';
function emit(line: string) { try { appendFileSync(OUT, line + '\n'); } catch { /* noop */ } }

// ── 메트릭 ──
function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
function report(name: string, latencies: number[], wallMs: number) {
  const s = [...latencies].sort((a, b) => a - b);
  const n = s.length;
  const rps = (n / wallMs) * 1000;
  const line = `[${name}] n=${n} wall=${wallMs.toFixed(0)}ms thrpt=${rps.toFixed(0)}/s ` +
    `p50=${pct(s, 50).toFixed(2)} p95=${pct(s, 95).toFixed(2)} p99=${pct(s, 99).toFixed(2)} max=${s[n - 1].toFixed(2)}ms`;
  emit(line);
  return { n, rps, p50: pct(s, 50), p95: pct(s, 95), p99: pct(s, 99) };
}

// 부모/동의/링크 시드 (academy·student 다수)
function seedTenants(db: ShimD1, academies: number, studentsPer: number) {
  const r = db.raw;
  for (let a = 0; a < academies; a++) {
    r.exec(`INSERT INTO academies VALUES ('ac-${a}')`);
    for (let s = 0; s < studentsPer; s++) {
      const sid = `st-${a}-${s}`;
      r.exec(`INSERT INTO students VALUES ('${sid}','ac-${a}')`);
      r.exec(`INSERT INTO consents (academy_id, erp_student_id, age_band, guardian_consent, consented_at)
              VALUES ('ac-${a}','${sid}','14plus',1,datetime('now'))`);
    }
  }
}
const review = (concept: string) => ({ card_id: 'c', result: 'fail', box_from: 1, box_to: 1, concept });

describe('로컬 스트레스 — signal 파이프라인 (Volume)', () => {
  it('S1 처리량 — 핫 학생 2000 신호 적재', { timeout: 120000 }, async () => {
    const db = makeTestD1(); seedTenants(db, 1, 1);
    const env = makeTestEnv(db) as unknown as Env;
    const N = 2000, lat: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      const s = performance.now();
      const r = await emitSignal(env, { academyId: 'ac-0', source: 'gacha', kind: 'review',
        payload: review('지수법칙'), ts: '2026-06-24T00:00:00Z', ingestId: `s1-${i}`, erpStudentId: 'st-0-0', trust: 'server' });
      lat.push(performance.now() - s);
      if (!r.ok) throw new Error('적재 실패: ' + r.reason);
    }
    const m = report('S1 throughput', lat, performance.now() - t0);
    const cnt = (db.raw.prepare('SELECT COUNT(*) c FROM signals').get() as any).c;
    expect(cnt).toBe(N);                 // 전건 적재
    expect(m.rps).toBeGreaterThan(50);   // SLO 게이트(로컬 하한, 실측은 로그)
  });

  it('S2 멱등 폭주 — 3000 호출/100 고유 ingest → 중복 0', { timeout: 120000 }, async () => {
    const db = makeTestD1(); seedTenants(db, 1, 1);
    const env = makeTestEnv(db) as unknown as Env;
    const N = 3000, UNIQ = 100, lat: number[] = []; let okCount = 0;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      const s = performance.now();
      const r = await emitSignal(env, { academyId: 'ac-0', source: 'gacha', kind: 'review',
        payload: review('멱등'), ts: 't', ingestId: `dup-${i % UNIQ}`, erpStudentId: 'st-0-0', trust: 'server' });
      lat.push(performance.now() - s);
      if (r.ok) okCount++;
    }
    report('S2 idempotent-flood', lat, performance.now() - t0);
    const cnt = (db.raw.prepare('SELECT COUNT(*) c FROM signals').get() as any).c;
    expect(cnt).toBe(UNIQ);   // 고유 키만큼만 적재 (중복 storm 흡수)
    expect(okCount).toBe(N);  // 중복도 ok:true(inserted:false) — 5xx 없음
  });

  it('S3 멀티테넌트 격리 — 5학원×2000 인터리브, 누수 0', { timeout: 120000 }, async () => {
    const db = makeTestD1(); const A = 5; seedTenants(db, A, 1);
    const env = makeTestEnv(db) as unknown as Env;
    const perA = 2000, lat: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < perA; i++) {
      for (let a = 0; a < A; a++) {
        const s = performance.now();
        await emitSignal(env, { academyId: `ac-${a}`, source: 'gacha', kind: 'review',
          payload: review(`개념-${a}`), ts: 't', ingestId: `m-${a}-${i}`, erpStudentId: `st-${a}-0`, trust: 'server' });
        lat.push(performance.now() - s);
      }
    }
    report('S3 multitenant', lat, performance.now() - t0);
    for (let a = 0; a < A; a++) {
      const c = (db.raw.prepare("SELECT COUNT(*) c FROM signals WHERE academy_id=?").get(`ac-${a}`) as any).c;
      expect(c).toBe(perA); // 각 학원 정확히 perA — 교차 누수 없음
    }
  });

  it('S4 추천 드레인 백로그 — 500 신호 → 큐 드레인, 이중처리 0', { timeout: 120000 }, async () => {
    const db = makeTestD1(); seedTenants(db, 1, 1);
    const env = makeTestEnv(db) as unknown as Env;
    const N = 500;
    for (let i = 0; i < N; i++) {
      await emitSignal(env, { academyId: 'ac-0', source: 'gacha', kind: 'review',
        payload: review(i % 3 === 0 ? '약점A' : '약점B'), ts: `2026-06-24T00:00:${(i % 60).toString().padStart(2, '0')}Z`,
        ingestId: `d-${i}`, erpStudentId: 'st-0-0', trust: 'server' });
    }
    const queued = (db.raw.prepare("SELECT COUNT(*) c FROM jobs WHERE status='queued'").get() as any).c;
    expect(queued).toBe(N);
    const t0 = performance.now();
    const processed = await drainRecommendJobs(env, N + 10);
    const wall = performance.now() - t0;
    emit(`[S4 drain] jobs=${N} processed=${processed} wall=${wall.toFixed(0)}ms (${(processed / wall * 1000).toFixed(0)} jobs/s)`);
    expect(processed).toBe(N);
    const published = (db.raw.prepare("SELECT COUNT(*) c FROM jobs WHERE status='published'").get() as any).c;
    expect(published).toBe(N);                 // 전건 처리, 이중처리/유실 0
    const rec = (db.raw.prepare("SELECT COUNT(*) c FROM recommendations").get() as any).c;
    expect(rec).toBe(1);                        // 학생 1명 추천 1행 (멱등 갱신)
  });
});
