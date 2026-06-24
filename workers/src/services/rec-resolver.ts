/**
 * rec-resolver — 개념→행동 브릿지 (2계층 RS의 크럭스).
 *   설계: vine-flywheel/docs/specs/rs-two-layer-design.md §1·§2 (BE-2 resolver).
 *
 * 추천 엔진이 "약한 개념"(문자열)을 뱉으면, 학생이 탭할 *구체 행동*으로 잇는다.
 * 행동 후보를 "서비스 가용성 순"으로 골라 action_type·target_path를 채운다.
 *   1) 그 개념을 다루는 가챠 덱이 있으면  → gacha_deck   (/gacha?concept=…)
 *   2) (확장 지점) jingdari 셋·증명 등…
 *   3) 폴백                              → review       (/drill?concept=…)
 *
 * 확장 설계: ResolverStrategy 배열에 새 서비스를 push 하면 자동 편입. 첫 매치 우선.
 */
import { Env } from '@/types';
import { executeFirst } from '@/utils/db';

export type ActionType = 'gacha_deck' | 'jingdari_set' | 'proof' | 'assignment' | 'review' | 'exam';

export interface ResolvedAction {
  action_type: ActionType;
  action_ref: string | null;   // 개념/타깃 id
  target_path: string;         // FE 내비
  title: string;
  icon?: string;
}

export interface ResolveCtx {
  env: Env;
  academyId: string;
  erpStudentId: string;
}

/** 한 전략 = (이 개념에 이 서비스 행동이 실재하나?) → 있으면 ResolvedAction, 없으면 null. */
interface ResolverStrategy {
  name: string;
  resolve(concept: string, ctx: ResolveCtx): Promise<ResolvedAction | null>;
}

/**
 * 가챠 덱: 그 개념을 다루는 카드가 1장이라도 있으면 가챠 복습 행동으로 잇는다.
 * gacha_cards는 ERP(019: topic/chapter) vs 공유D1(077: concept) 두 스키마가 같은 이름을 공유 —
 * 양쪽 컬럼을 모두 매칭하고, 컬럼 부재 등으로 쿼리가 실패하면 "덱 없음"으로 우아하게 폴백.
 */
const gachaStrategy: ResolverStrategy = {
  name: 'gacha_deck',
  async resolve(concept, ctx) {
    let card: { ok: number } | null = null;
    try {
      card = await executeFirst<{ ok: number }>(
        ctx.env.DB,
        `SELECT 1 AS ok FROM gacha_cards
         WHERE academy_id = ? AND (concept = ? OR topic = ? OR chapter = ?) LIMIT 1`,
        [ctx.academyId, concept, concept, concept]
      );
    } catch {
      // 어느 스키마든 매칭 컬럼이 없으면(혹은 테이블 부재) 가챠 덱 없는 것으로 간주 → 폴백.
      return null;
    }
    if (!card) return null;
    return {
      action_type: 'gacha_deck',
      action_ref: concept,
      target_path: `/gacha?concept=${encodeURIComponent(concept)}`,
      title: `${concept} 다지기`,
      icon: '🃏',
    };
  },
};

/**
 * 폴백: 가용 서비스가 없으면 일반 복습 드릴로. 빈 행동 금지(콜드스타트·신규개념 대비).
 * (전략이 아니라 항상 성공하는 최종 안전망.)
 */
function reviewFallback(concept: string): ResolvedAction {
  return {
    action_type: 'review',
    action_ref: concept,
    target_path: `/drill?concept=${encodeURIComponent(concept)}`,
    title: `${concept} 복습`,
    icon: '📝',
  };
}

// 서비스 가용성 순. ● 서비스(gacha)부터 — jingdari/proof는 백엔드 준비되면 여기 push.
const STRATEGIES: ResolverStrategy[] = [gachaStrategy];

/**
 * 약한 개념을 *실재하는* 학생 행동으로 변환. 첫 매치 전략 우선, 없으면 review 폴백.
 * MVP: 가챠 덱 → 폴백 드릴.
 */
export async function resolveConceptToAction(concept: string, ctx: ResolveCtx): Promise<ResolvedAction> {
  for (const s of STRATEGIES) {
    const hit = await s.resolve(concept, ctx);
    if (hit) return hit;
  }
  return reviewFallback(concept);
}
