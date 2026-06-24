/**
 * Step1 런타임 검증 — emitSignal을 실제 SQLite(D1 shim)에 적재하며 flow_v2 불변식을 재증명.
 * 타입체크가 아니라 **실행**: 신원해석·소유권·PII·암호화·멱등·격리·shred.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Env } from '@/types';
import { emitSignal } from '@/services/signal-service';
import { makeTestD1, makeTestEnv, seed, ShimD1 } from '@/test-support/d1-shim';

const REVIEW = { card_id: 'c45', result: 'fail', box_from: 1, box_to: 1, concept: '지수법칙' };

describe('emitSignal — 실행 검증 (D1 shim)', () => {
  let db: ShimD1;
  let env: Env;
  beforeEach(() => {
    db = makeTestD1();
    seed(db);
    env = makeTestEnv(db) as unknown as Env;
  });

  it('server-trust 신호 적재 (externalId 해석)', async () => {
    const r = await emitSignal(env, {
      academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: '2026-06-23T10:00:00Z', ingestId: 's1', externalId: 'uuid-abc', trust: 'server',
    });
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(true);
    const row = db.raw.prepare("SELECT erp_student_id, trust, payload_enc FROM signals WHERE ingest_id='s1'").get() as any;
    expect(row.erp_student_id).toBe('student-eunji');
    expect(row.trust).toBe('server');
    expect(row.payload_enc).not.toContain('지수법칙'); // AES-GCM 봉인 — 평문 아님
  });

  it('멱등 — 같은 ingest_id 재전송은 inserted=false', async () => {
    const args = { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'dup1', externalId: 'uuid-abc' } as const;
    const a = await emitSignal(env, { ...args });
    const b = await emitSignal(env, { ...args });
    expect(a.inserted).toBe(true);
    expect(b.ok).toBe(true);
    expect(b.inserted).toBe(false);
    const cnt = db.raw.prepare("SELECT COUNT(*) c FROM signals WHERE ingest_id='dup1'").get() as any;
    expect(cnt.c).toBe(1);
  });

  it('PII 화이트리스트 — 허용 외 필드(note) 거부', async () => {
    const r = await emitSignal(env, {
      academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: { result: 'fail', concept: '지수', note: '김은지 잘함' } as any,
      ts: 't', ingestId: 'pii1', externalId: 'uuid-abc',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('note');
  });

  it('P1 소유권 — 타학원 학생 erp_student_id 직접 지정 차단', async () => {
    const r = await emitSignal(env, {
      academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'own1', erpStudentId: 'student-x', // student-x = acad-other 소속
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('소속');
  });

  it('격리 — 타학원 토큰은 uuid-abc 해석 실패(unresolved)', async () => {
    const r = await emitSignal(env, {
      academyId: 'acad-other', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'leak1', externalId: 'uuid-abc',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('unresolved');
  });

  it('payload 길이 캡 — 200자 초과 문자열 거부', async () => {
    const r = await emitSignal(env, {
      academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: { ...REVIEW, concept: 'x'.repeat(201) }, ts: 't', ingestId: 'len1', externalId: 'uuid-abc',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('길이');
  });

  it('crypto-shred — 키 폐기 후 적재 거부(삭제권)', async () => {
    await emitSignal(env, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'pre', externalId: 'uuid-abc' }); // 키 생성
    db.raw.exec("UPDATE student_keys SET shredded_at=datetime('now') WHERE erp_student_id='student-eunji'");
    const r = await emitSignal(env, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'post', externalId: 'uuid-abc' });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('폐기');
  });

  it('P1 동의 게이트 — 동의 레코드 없으면 거부', async () => {
    db.raw.exec("DELETE FROM consents WHERE erp_student_id='student-eunji'");
    const r = await emitSignal(env, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'noc1', externalId: 'uuid-abc' });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('동의');
  });

  it('P1 동의 게이트 — under14 보호자 미동의 거부, 동의 시 통과', async () => {
    db.raw.exec("UPDATE consents SET age_band='under14', guardian_consent=0 WHERE erp_student_id='student-eunji'");
    const blocked = await emitSignal(env, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'u14a', externalId: 'uuid-abc' });
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toContain('보호자');

    db.raw.exec("UPDATE consents SET guardian_consent=1 WHERE erp_student_id='student-eunji'");
    const ok = await emitSignal(env, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'u14b', externalId: 'uuid-abc' });
    expect(ok.ok).toBe(true);
  });

  it('P1 동의 철회(withdrawn_at) — 거부', async () => {
    db.raw.exec("UPDATE consents SET withdrawn_at=datetime('now') WHERE erp_student_id='student-eunji'");
    const r = await emitSignal(env, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'wd1', externalId: 'uuid-abc' });
    expect(r.ok).toBe(false);
  });

  it('P2 ts 정규화 — 비ISO 입력도 ISO로 저장(정렬 안정)', async () => {
    await emitSignal(env, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: '2026-06-23', ingestId: 'tsn1', externalId: 'uuid-abc' });
    const row = db.raw.prepare("SELECT ts FROM signals WHERE ingest_id='tsn1'").get() as any;
    expect(row.ts).toBe(new Date('2026-06-23').toISOString());
  });

  it('access_log 원자 기록 — 적재 1건당 감사로그 1건', async () => {
    await emitSignal(env, { academyId: 'acad-gangnam', source: 'gacha', kind: 'review',
      payload: REVIEW, ts: 't', ingestId: 'acl1', externalId: 'uuid-abc' });
    const log = db.raw.prepare("SELECT action, detail FROM access_log WHERE action='signal_ingest'").get() as any;
    expect(log.action).toBe('signal_ingest');
    expect(log.detail).toContain('review');
  });
});
