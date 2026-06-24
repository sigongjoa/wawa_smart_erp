/**
 * recommend-infer — 소비측. signals(server-trust, 최근 WINDOW건) → 약한 개념 집계 → 복합점수 랭킹 → recommendation_items.
 *   설계: vine-flywheel/docs/specs/rs-two-layer-design.md §2 (BE-2) · rs-api-contract.md (SSOT).
 *
 * 목표함수(★ 접속최적화 금지 — 약점 충전이 북극성):
 *   score_total = w_gap·약점 + w_habit·습관(가드레일) + w_ret·리텐션(가드레일)
 *   · 약점(score_gap, 최대화): fail 빈도 × 시간감쇠(최근↑) + 낮은 Leitner box 보정 + 교차소스 보강.
 *   · 습관(score_habit, 가드레일): daily_cap 상한 + *오늘 끝낼 만한 것* 우선(streak 보존). 최대화 아님.
 *   · 리텐션(score_ret, 가드레일): 이탈위험(attendance 급감·grade 하락) 시 부드러운 것으로 페널티.
 *
 * 학습 제외: client-trust 신호(저신뢰)는 학습에 안 들어옴. shred된 학생은 복호 불가 → 제외.
 * 076 recommendations(요약/freshness)는 보존 — 호환 위해 top 개념을 계속 갱신한다.
 */
import { Env } from '@/types';
import { executeFirst, executeQuery } from '@/utils/db';
import { generatePrefixedId } from '@/utils/id';
import { getStudentKey, unsealPayload } from '@/utils/signal-crypto';
import { resolveConceptToAction, ResolvedAction } from '@/services/rec-resolver';

const WINDOW = 50; // 최근 N건만 학습 (전수스캔 방지)
const HALF_LIFE_DAYS = 7; // 시간감쇠 반감기 — 최근 fail이 더 무겁게

interface SignalRow { payload_enc: string; kind: string; ts: string }

interface RsConfig {
  w_gap: number; w_habit: number; w_ret: number; daily_cap: number; model_version: string;
}

const DEFAULT_CONFIG: RsConfig = { w_gap: 0.6, w_habit: 0.2, w_ret: 0.2, daily_cap: 5, model_version: 'rs-v1' };

/** 약점 후보 1개의 누적 신호. */
interface ConceptAgg {
  concept: string;
  weighted: number;      // fail 빈도 × 시간감쇠 합
  count: number;         // raw fail 횟수
  sources: Set<string>;  // 교차소스(가챠·jingdari·assessment·ssaem) 보강용
  minBox: number;        // 본 가장 낮은 Leitner box (낮을수록 약함)
}

function loadConfig(env: Env, academyId: string): Promise<RsConfig | null> {
  return executeFirst<RsConfig>(
    env.DB,
    'SELECT w_gap, w_habit, w_ret, daily_cap, model_version FROM rs_config WHERE academy_id = ?',
    [academyId]
  );
}

/** 시간감쇠: 최근일수록 1에 가깝게, 오래될수록 0으로 (반감기 HALF_LIFE_DAYS). */
function timeDecay(tsIso: string, nowMs: number): number {
  const t = Date.parse(tsIso);
  if (!Number.isFinite(t)) return 0.5;
  const ageDays = Math.max(0, (nowMs - t) / 86_400_000);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** 0~1 정규화 squash. */
function squash(x: number): number {
  return x <= 0 ? 0 : 1 - Math.exp(-x);
}

/** 한 학생의 최근 신호에서 약점 개념 집계 + 리텐션 가드레일 신호 추출. */
async function aggregate(
  env: Env, academyId: string, erpStudentId: string, keyWrapped: string, nowMs: number
): Promise<{ aggs: Map<string, ConceptAgg>; churnRisk: number }> {
  const rows = await executeQuery<SignalRow>(
    env.DB,
    `SELECT s.payload_enc, s.kind, s.ts, s.source FROM signals s
     WHERE s.academy_id = ? AND s.erp_student_id = ? AND s.trust = 'server'
       AND s.kind IN ('review','wrong_answer','result','mastery','attendance','grade')
     ORDER BY s.ts DESC LIMIT ?`,
    [academyId, erpStudentId, WINDOW]
  );

  const aggs = new Map<string, ConceptAgg>();
  let churnRisk = 0; // 리텐션 가드레일 — attendance 급감·grade 하락이면 ↑

  const bump = (concept: string, source: string, ts: string, box: number | null) => {
    if (!concept) return;
    let a = aggs.get(concept);
    if (!a) { a = { concept, weighted: 0, count: 0, sources: new Set(), minBox: 6 }; aggs.set(concept, a); }
    a.weighted += timeDecay(ts, nowMs);
    a.count += 1;
    a.sources.add(source);
    if (box != null && box < a.minBox) a.minBox = box;
  };

  for (const r of rows) {
    const src = (r as SignalRow & { source: string }).source;
    const pt = await unsealPayload(env, keyWrapped, r.payload_enc);
    if (pt === null) continue; // 복호 불가 → 제외
    let d: Record<string, unknown>;
    try { d = JSON.parse(pt) as Record<string, unknown>; } catch { continue; }

    switch (r.kind) {
      case 'review': // 가챠 Leitner — fail이 약점, box 낮을수록 약함
        if (d.result === 'fail') bump(String(d.concept ?? ''), src, r.ts, Number(d.box_to ?? d.box_from ?? 1));
        break;
      case 'wrong_answer': // jingdari 오답 단원
        bump(String(d.unit ?? ''), src, r.ts, null);
        break;
      case 'result': // assessment.result — 틀린 단원
        if (d.correct === false) bump(String(d.unit ?? ''), src, r.ts, null);
        break;
      case 'mastery': // ssaem.mastery — 낮은 box = 약점
        if (Number(d.box ?? 6) <= 2) bump(String(d.concept ?? ''), src, r.ts, Number(d.box ?? 1));
        break;
      case 'attendance': // erp.attendance — net_minutes 급감 → 이탈위험 가드레일 연료
        if (Number(d.net_minutes ?? 1) <= 0 || d.status === 'absent') churnRisk += timeDecay(r.ts, nowMs);
        break;
      case 'grade': // erp.grade — 낮은 점수 → 좌절위험 가드레일 연료
        if (Number(d.score ?? 100) < 60) churnRisk += timeDecay(r.ts, nowMs) * 0.5;
        break;
    }
  }
  return { aggs, churnRisk: squash(churnRisk) };
}

export interface ScoredItem {
  concept: string;
  score_gap: number;
  score_habit: number;
  score_ret: number;
  score_total: number;
  reason: string;
  count: number;
  action: ResolvedAction;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

function urgencyOf(total: number, churnRisk: number): ScoredItem['urgency'] {
  if (total >= 0.75 || churnRisk >= 0.7) return 'critical';
  if (total >= 0.5) return 'high';
  if (total >= 0.25) return 'medium';
  return 'low';
}

/**
 * 약점 개념들을 복합점수로 랭킹. 순수 계산(테스트 용이) — resolver만 비동기 I/O.
 * 반환은 rank 순(내림차순) 정렬된 ScoredItem[].
 */
export async function scoreConcepts(
  aggs: Map<string, ConceptAgg>, churnRisk: number, cfg: RsConfig, ctx: { env: Env; academyId: string; erpStudentId: string }
): Promise<ScoredItem[]> {
  const maxWeighted = Math.max(1, ...[...aggs.values()].map((a) => a.weighted));
  const out: ScoredItem[] = [];

  for (const a of aggs.values()) {
    // 약점(북극성): 시간가중 fail 정규화 + 낮은 box 보정 + 교차소스 보강.
    const base = a.weighted / maxWeighted;                    // 0~1
    const boxBoost = a.minBox <= 5 ? (6 - a.minBox) / 5 * 0.3 : 0; // box1→+0.3 … box5→+0.06
    const crossBoost = a.sources.size >= 2 ? 0.2 : 0;          // 여러 서비스에서 약하면↑
    const score_gap = Math.min(1, base + boxBoost + crossBoost);

    // 습관(가드레일): "오늘 끝낼 만한 것" 우선 — fail이 과도하게 많으면 부담↑ → 살짝 페널티(최대화 아님).
    const score_habit = a.count <= 3 ? 1 : Math.max(0.3, 1 - (a.count - 3) * 0.15);

    // 리텐션(가드레일): 이탈/좌절 위험이 높으면 어려운(=약점 깊은) 것에 페널티 — 부드러운 것 우선.
    const score_ret = 1 - churnRisk * score_gap;

    const score_total = cfg.w_gap * score_gap + cfg.w_habit * score_habit + cfg.w_ret * score_ret;

    const action = await resolveConceptToAction(a.concept, ctx);
    out.push({
      concept: a.concept, score_gap, score_habit, score_ret, score_total,
      reason: `최근 ${a.count}번 틀린 곳`, count: a.count, action,
      urgency: urgencyOf(score_total, churnRisk),
    });
  }
  out.sort((x, y) => y.score_total - x.score_total);
  return out;
}

/**
 * 학생 1명의 최근 신호로 복합점수 랭킹을 산출, recommendation_items에 N≤daily_cap 기록(status=auto_served).
 * 076 recommendations(요약)도 top 개념으로 갱신(호환). 약점 없으면 행 삭제.
 */
export async function runRecommend(env: Env, academyId: string, erpStudentId: string): Promise<{ ref: string; n: number } | null> {
  const keyWrapped = await getStudentKey(env, academyId, erpStudentId);
  if (!keyWrapped) {
    // 키 폐기(삭제권) 또는 키 없음 → 학습 불가 → 추천 제거
    await env.DB.batch([
      env.DB.prepare('DELETE FROM recommendations WHERE academy_id = ? AND erp_student_id = ?').bind(academyId, erpStudentId),
      env.DB.prepare('DELETE FROM recommendation_items WHERE academy_id = ? AND erp_student_id = ?').bind(academyId, erpStudentId),
    ]);
    return null;
  }

  const cfg = (await loadConfig(env, academyId)) ?? DEFAULT_CONFIG;
  const nowMs = Date.now();
  const { aggs, churnRisk } = await aggregate(env, academyId, erpStudentId, keyWrapped, nowMs);

  if (aggs.size === 0) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM recommendations WHERE academy_id = ? AND erp_student_id = ?').bind(academyId, erpStudentId),
      env.DB.prepare('DELETE FROM recommendation_items WHERE academy_id = ? AND erp_student_id = ?').bind(academyId, erpStudentId),
    ]);
    return null;
  }

  const scored = await scoreConcepts(aggs, churnRisk, cfg, { env, academyId, erpStudentId });
  const top = scored.slice(0, cfg.daily_cap);
  const generatedAt = new Date(nowMs).toISOString();

  // 재추론 = 자동행을 새 랭킹으로 교체. 강사 override(승인/반려/부스트)·이미 행동한(acted_at) 행은 보존.
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `DELETE FROM recommendation_items
       WHERE academy_id = ? AND erp_student_id = ? AND status = 'auto_served' AND acted_at IS NULL`
    ).bind(academyId, erpStudentId),
  ];
  top.forEach((s, i) => {
    stmts.push(env.DB.prepare(
      `INSERT INTO recommendation_items
         (id, academy_id, erp_student_id, rank, action_type, action_ref, target_path, reason, urgency,
          score_total, score_gap, score_habit, score_ret, status, model_version, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto_served', ?, ?)`
    ).bind(
      generatePrefixedId('ri'), academyId, erpStudentId, i + 1,
      s.action.action_type, s.action.action_ref, s.action.target_path, s.reason, s.urgency,
      s.score_total, s.score_gap, s.score_habit, s.score_ret, cfg.model_version, generatedAt
    ));
  });

  // 076 recommendations 요약(호환) — top 개념 1개.
  const best = top[0];
  const summary = JSON.stringify([{ ref: best.concept, source: 'flywheel', reason: best.reason, score: best.score_total }]);
  stmts.push(env.DB.prepare(
    `INSERT INTO recommendations (academy_id, erp_student_id, items, model_version, generated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(academy_id, erp_student_id) DO UPDATE SET items = excluded.items, generated_at = excluded.generated_at, model_version = excluded.model_version`
  ).bind(academyId, erpStudentId, summary, cfg.model_version, generatedAt));

  await env.DB.batch(stmts);
  return { ref: best.concept, n: best.count };
}

/**
 * 큐에서 recommend-infer job 1건을 원자 claim 후 처리. 처리할 게 없으면 null.
 * 원자성: 고유 claim 토큰을 worker_id에 박고 그 토큰으로 되읽어 경합 차단.
 */
export async function tickRecommendJob(env: Env): Promise<{ job: string; res: { ref: string; n: number } | null } | null> {
  const claimToken = generatePrefixedId('clm');
  await env.DB.prepare(
    `UPDATE jobs SET status='claimed', worker_id=?, claimed_at=datetime('now')
     WHERE id = (SELECT id FROM jobs WHERE status='queued' AND type='recommend-infer'
                 ORDER BY priority, created_at LIMIT 1)
       AND status='queued'`
  ).bind(claimToken).run();

  const job = await executeFirst<{ id: string; academy_id: string; erp_student_id: string }>(
    env.DB,
    "SELECT id, academy_id, erp_student_id FROM jobs WHERE worker_id = ? AND status = 'claimed'",
    [claimToken]
  );
  if (!job) return null;

  let res: { ref: string; n: number } | null = null;
  try {
    res = await runRecommend(env, job.academy_id, job.erp_student_id);
    await env.DB.prepare("UPDATE jobs SET status='published', published_at=datetime('now') WHERE id=?")
      .bind(job.id).run();
  } catch (e) {
    await env.DB.prepare("UPDATE jobs SET status='failed', error=? WHERE id=?")
      .bind(String(e), job.id).run();
    throw e;
  }
  return { job: job.id, res };
}

/** 큐가 빌 때까지 반복 처리 (cron/배치용). 안전 상한. */
export async function drainRecommendJobs(env: Env, max = 100): Promise<number> {
  let processed = 0;
  while (processed < max) {
    const r = await tickRecommendJob(env);
    if (!r) break;
    processed++;
  }
  return processed;
}
