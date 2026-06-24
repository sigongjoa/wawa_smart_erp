/**
 * flywheel-api — vine-flywheel 신호 파이프라인 단일 워커 (정규).
 * 동일 코드가 wrangler [env.test]/[env.prod] 양쪽에 배포됨 → 배포 아티팩트 패리티.
 * 인증: 워커키(X-Signal-Worker-Key). 서비스 백엔드·외부 생성워커가 호출.
 *
 *   GET  /health                         — 헬스
 *   POST /api/signal                     — 신호 적재 (handleSignal 재사용)
 *   POST /api/flywheel/drain             — recommend 큐 동기 드레인
 *   GET  /api/feed?academy_id&erp_student_id — 추천 피드
 *   POST /api/flywheel/erase             — 삭제권(crypto-shred)
 *   cron(every 1m)                       — recommend 큐 자동 드레인
 */
import { handleSignal } from '@/routes/signal-handler';
import { drainRecommendJobs } from '@/services/recommend-service';
import { emitSignal } from '@/services/signal-service';
import type { Env, RequestContext } from '@/types';

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const keyed = (req: Request, env: Env) => req.headers.get('X-Signal-Worker-Key') === env.SIGNAL_WORKER_KEY;

// 브라우저 데모용 CORS (공개 데모 라우트 한정)
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const cjson = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;

    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (p === '/health') return json({ status: 'ok', env: env.ENVIRONMENT ?? 'unknown', ts: new Date().toISOString() });

    // ── 데모 (브라우저 직접 호출 · ac-1 테스트 학원 한정 · 공개) ──
    // 실서비스는 worker-key 경유(아래). 데모는 워커키 노출 없이 ac-1 더미만 만진다.
    if (p.startsWith('/demo/')) {
      const ACAD = 'ac-1';
      if (p === '/demo/students' && req.method === 'GET') {
        const r = await env.DB.prepare(
          'SELECT s.id FROM students s JOIN consents c ON c.erp_student_id=s.id AND c.academy_id=s.academy_id ' +
          "WHERE s.academy_id=? AND c.withdrawn_at IS NULL ORDER BY s.id LIMIT 30").bind(ACAD).all<{ id: string }>();
        return cjson({ students: (r.results ?? []).map((x) => x.id) });
      }
      if (p === '/demo/feed' && req.method === 'GET') {
        const sid = url.searchParams.get('erp_student_id') ?? '';
        const row = await env.DB.prepare('SELECT items FROM recommendations WHERE academy_id=? AND erp_student_id=?')
          .bind(ACAD, sid).first<{ items: string }>();
        return cjson({ erp_student_id: sid, items: row ? JSON.parse(row.items) : [] });
      }
      if (p === '/demo/gacha' && req.method === 'POST') {
        const b = (await req.json()) as { erp_student_id?: string; concept?: string; result?: string };
        const sig = await emitSignal(env, {
          academyId: ACAD, source: 'gacha', kind: 'review',
          payload: { card_id: 'demo', result: b.result === 'pass' ? 'pass' : 'fail', box_from: 1, box_to: 1, concept: String(b.concept ?? '') },
          ts: new Date().toISOString(), ingestId: `demo-${crypto.randomUUID()}`, erpStudentId: String(b.erp_student_id ?? ''), trust: 'server',
        });
        if (sig.ok) await drainRecommendJobs(env); // 즉시 추천 갱신(데모)
        return cjson({ ok: sig.ok, inserted: sig.inserted, reason: sig.reason });
      }
      return cjson({ error: 'unknown demo route' }, 404);
    }

    if (p === '/api/signal') {
      return handleSignal(req.method, p, req, { env } as unknown as RequestContext);
    }

    // 운영 엔드포인트 — 워커키 필요
    if (!keyed(req, env)) return json({ error: '워커키 필요 (X-Signal-Worker-Key)' }, 401);

    if (p === '/api/flywheel/drain' && req.method === 'POST') {
      return json({ processed: await drainRecommendJobs(env) });
    }

    if (p === '/api/feed' && req.method === 'GET') {
      const aid = url.searchParams.get('academy_id') ?? '';
      const sid = url.searchParams.get('erp_student_id') ?? '';
      const r = await env.DB.prepare(
        'SELECT items FROM recommendations WHERE academy_id = ? AND erp_student_id = ?'
      ).bind(aid, sid).first<{ items: string }>();
      return json({ academy_id: aid, erp_student_id: sid, items: r ? JSON.parse(r.items) : [] });
    }

    if (p === '/api/flywheel/erase' && req.method === 'POST') {
      const b = (await req.json()) as { academy_id?: string; erp_student_id?: string };
      await env.DB.batch([
        env.DB.prepare("UPDATE student_keys SET shredded_at = datetime('now') WHERE erp_student_id = ? AND academy_id = ?")
          .bind(b.erp_student_id ?? '', b.academy_id ?? ''),
        env.DB.prepare('DELETE FROM recommendations WHERE erp_student_id = ? AND academy_id = ?')
          .bind(b.erp_student_id ?? '', b.academy_id ?? ''),
      ]);
      return json({ erased: true });
    }

    return json({ name: 'flywheel-api', env: env.ENVIRONMENT ?? 'unknown',
      endpoints: ['/health', '/api/signal', '/api/flywheel/drain', '/api/feed', '/api/flywheel/erase'] });
  },

  // recommend 큐 자동 드레인 (매 1분)
  async scheduled(_event: unknown, env: Env): Promise<void> {
    try { await drainRecommendJobs(env); } catch { /* 다음 tick에서 재시도 */ }
  },
};
