/**
 * Step3 검증 — gacha/jingdari/ssaem 라우트를 실제 SQLite 위에서 호출.
 * 서비스 상태 기록 + 내부 emit(신호 적재)이 한 번에 도는지 실행 확인.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { RequestContext } from '@/types';
import { makeTestD1, makeTestEnv, seed, ShimD1 } from '@/test-support/d1-shim';
import { handleGachaReview } from '@/routes/gacha-review-handler';
import { handleJingdariAttempt } from '@/routes/jingdari-attempt-handler';
import { handleSsaem } from '@/routes/ssaem-handler';

function ctx(db: ShimD1, academyId = 'acad-gangnam'): RequestContext {
  return {
    env: makeTestEnv(db),
    auth: { userId: 'u1', role: 'instructor', academyId },
    tenantId: academyId,
  } as unknown as RequestContext;
}
function post(url: string, body: unknown): Request {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) });
}

describe('flywheel 서비스 라우트 — 실행 검증', () => {
  let db: ShimD1;
  beforeEach(() => {
    db = makeTestD1(['076_flywheel_foundation.sql', '077_service_tables.sql']);
    seed(db);
  });

  it('gacha review(fail) → 서비스행 기록 + review 신호 적재(암호화)', async () => {
    const res = await handleGachaReview('POST', '/api/gacha/review',
      post('http://x/api/gacha/review', {
        erp_student_id: 'student-eunji', card_id: 'c45', result: 'fail',
        box_from: 1, box_to: 1, concept: '지수법칙',
      }), ctx(db));
    expect(res.status).toBe(200);
    const out = await res.json() as any;
    expect(out.data.signal).toBe(true);
    const card = db.raw.prepare("SELECT result FROM gacha_session_cards WHERE id=?").get(out.data.card) as any;
    expect(card.result).toBe('fail');
    const sig = db.raw.prepare("SELECT source, kind, payload_enc FROM signals WHERE source='gacha'").get() as any;
    expect(sig.kind).toBe('review');
    expect(sig.payload_enc).not.toContain('지수법칙'); // 봉인됨
  });

  it('P1 원자성 — 동의 철회로 emit 거부되면 서비스행도 안 써짐', async () => {
    db.raw.exec("UPDATE consents SET withdrawn_at=datetime('now') WHERE erp_student_id='student-eunji'");
    const res = await handleGachaReview('POST', '/api/gacha/review',
      post('http://x/api/gacha/review', {
        erp_student_id: 'student-eunji', card_id: 'c45', result: 'fail', concept: '지수법칙',
      }), ctx(db));
    expect(res.status).toBe(422);
    const cards = db.raw.prepare("SELECT COUNT(*) c FROM gacha_session_cards").get() as any;
    const sess = db.raw.prepare("SELECT COUNT(*) c FROM gacha_sessions").get() as any;
    expect(cards.c).toBe(0); // 서비스행 미기록 = 원자성
    expect(sess.c).toBe(0);
  });

  it('gacha review — 타학원 학생 지정 차단(소유권)', async () => {
    const res = await handleGachaReview('POST', '/api/gacha/review',
      post('http://x/api/gacha/review', {
        erp_student_id: 'student-x', card_id: 'c1', result: 'fail',
      }), ctx(db, 'acad-gangnam'));
    expect(res.status).toBe(422);
  });

  it('jingdari attempt — 정답은 신호 없음, 오답은 wrong_answer 발신', async () => {
    const ok = await handleJingdariAttempt('POST', '/api/jingdari/attempt',
      post('http://x/api/jingdari/attempt', {
        erp_student_id: 'student-eunji', item_kid: 'jd-001', correct: true,
      }), ctx(db));
    expect(((await ok.json()) as any).data.signal).toBe(false);

    const wrong = await handleJingdariAttempt('POST', '/api/jingdari/attempt',
      post('http://x/api/jingdari/attempt', {
        erp_student_id: 'student-eunji', item_kid: 'jd-002', correct: false,
        type: '계산', lv: 'B', unit: '지수', n: 1,
      }), ctx(db));
    expect(((await wrong.json()) as any).data.signal).toBe(true);
    const cnt = db.raw.prepare("SELECT COUNT(*) c FROM signals WHERE source='jingdari'").get() as any;
    expect(cnt.c).toBe(1);
  });

  it('ssaem activity → 활동·태그 기록 + activity 신호', async () => {
    const res = await handleSsaem('POST', '/api/ssaem/activity',
      post('http://x/api/ssaem/activity', {
        erp_student_id: 'student-eunji', kind: '발표', subject: '수학',
        topic: '미적분', grade: 2, tags: ['리더십', '탐구'],
      }), ctx(db));
    const out = await res.json() as any;
    expect(out.data.signal).toBe(true);
    const tags = db.raw.prepare("SELECT COUNT(*) c FROM ssaem_activity_tags WHERE activity_id=?").get(out.data.activity) as any;
    expect(tags.c).toBe(2);
  });

  it('ssaem feed — recommendations 소비(읽기)', async () => {
    db.raw.exec(`INSERT INTO recommendations (academy_id, erp_student_id, items, model_version)
      VALUES ('acad-gangnam','student-eunji','[{"ref":"지수법칙","reason":"최근 3번 틀린 곳"}]','poc-v2')`);
    const res = await handleSsaem('GET', '/api/ssaem/feed',
      new Request('http://x/api/ssaem/feed?erp_student_id=student-eunji'), ctx(db));
    const out = await res.json() as any;
    expect(out.data.items[0].ref).toBe('지수법칙');
  });
});
