/**
 * Plan + Fill orchestration (v2).
 *
 * 흐름:
 *   1. Plan call — 작은 응답 (kind 배열 + 각 step 의 hint 1줄). 토큰 짧음 → truncate 거의 없음.
 *   2. Fill calls — 각 step 별로 평행 호출. step kind 별 전용 schema → 작고 안전.
 *   3. 조합 → 기존 AskAIResponse 형태로 반환.
 *
 * 장점: 응답 단편화로 4096 token truncate 회피, figure xs/ys 같은 큰 배열을 explain 본문과 분리.
 * 비용: API 호출 수 = 1 + step 수 (보통 4~7). gemini-flash 가격 기준 단건 ~$0.0002 → 7회 ~$0.0014/질문.
 */
import { AskAIResponseSchema, type AskAIResponse, type AskAIRequest, type Reference, type Step } from '@/schemas/ask-ai';
import type { ClaudeFetcher, ClaudeMessage, ClaudeTool, OrchestrateOpts, OrchestrateResult, StudentMeta } from './orchestrator';
import { searchUnit } from './search-unit';

/* ─────────── Plan 스키마 ─────────── */

const PLAN_TOOL: ClaudeTool = {
  name: 'plan',
  description: '학생 질문에 답할 step 의 뼈대(kind + 한 줄 hint) 만 반환. 본문 X.',
  input_schema: {
    type: 'object',
    required: ['steps', 'confidence', 'needs_teacher'],
    properties: {
      steps: {
        type: 'array', minItems: 1,
        items: {
          type: 'object',
          required: ['kind', 'hint'],
          properties: {
            kind: { type: 'string', enum: ['explain', 'figure', 'checkpoint'] },
            hint: { type: 'string', description: '이 step 에서 다룰 핵심 (한 줄, 30자 안팎). figure 면 무엇을 그릴지.' },
          },
        },
      },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      needs_teacher: { type: 'boolean' },
    },
  },
};

interface PlanStep { kind: 'explain' | 'figure' | 'checkpoint'; hint: string }
interface PlanResult {
  steps: PlanStep[];
  confidence: 'high' | 'medium' | 'low';
  needs_teacher: boolean;
}

/* ─────────── Fill 스키마 — kind 별 ─────────── */

const FILL_EXPLAIN_TOOL: ClaudeTool = {
  name: 'fill_explain',
  description: 'explain step 본문 생성. KaTeX inline ($..$) 허용.',
  input_schema: {
    type: 'object',
    required: ['title', 'body_md'],
    properties: {
      title: { type: 'string', description: '단계 제목 (간단, 30자 안팎)' },
      body_md: { type: 'string', description: '학생에게 한 줄씩 설명. $..$ 로 KaTeX 수식.' },
    },
  },
};

const FILL_CHECKPOINT_TOOL: ClaudeTool = {
  name: 'fill_checkpoint',
  description: 'checkpoint step — 학생이 답할 한 줄 질문.',
  input_schema: {
    type: 'object', required: ['question'],
    properties: { question: { type: 'string', description: '학생에게 묻는 한 줄 (50자 안팎).' } },
  },
};

const FILL_FIGURE_TOOL: ClaudeTool = {
  name: 'fill_figure',
  description: '그래프 step — xs, ys 25~40개 sampling. 함수면 직접 계산해서 ys 채우기.',
  input_schema: {
    type: 'object',
    required: ['xs', 'ys', 'caption'],
    properties: {
      xs: { type: 'array', items: { type: 'number' }, description: 'x좌표 25~40개 등간격.' },
      ys: { type: 'array', items: { type: 'number' }, description: 'y좌표 (xs와 동일 길이). 함수값 직접 계산.' },
      xlabel: { type: 'string' },
      ylabel: { type: 'string' },
      caption: { type: 'string', description: '그림 한 줄 설명.' },
    },
  },
};

/* ─────────── 헬퍼 ─────────── */

function planSystemPrompt(opts: { studentMeta?: StudentMeta; references: Reference[] }): string {
  const parts: string[] = [
    '너는 와와 학원 수학 설명 AI 의 plan 단계다.',
    '학생 질문을 풀어서 가르칠 step 의 뼈대만 반환한다 (본문 X).',
    '',
    '[규칙]',
    '- step 4~7개 추천. 마지막은 보통 checkpoint.',
    '- explain → checkpoint 교차 권장 (이해 단계마다 멈춤).',
    '- figure 는 그림이 본질적으로 더 나을 때만 (함수 그래프, 분포, 영역). 장식 X.',
    '- figure 다음엔 explain 으로 그림 해석 권장.',
    '- 자신 없으면 confidence=low, needs_teacher=true.',
    '',
  ];
  if (opts.studentMeta?.name) parts.push(`[학생] ${opts.studentMeta.name}${opts.studentMeta.grade ? ' / '+opts.studentMeta.grade : ''}`);
  if (opts.references.length > 0) {
    parts.push('[학원 단원지 grounding]');
    opts.references.forEach((r) => parts.push(`◦ ${r.unit} p.${r.page}: "${r.quote.slice(0, 100)}"`));
  }
  return parts.join('\n');
}

function fillContext(plan: PlanResult, idx: number, userMsg: string): string {
  const before = plan.steps.slice(0, idx).map((s, i) => `${i+1}. ${s.kind}: ${s.hint}`).join('\n');
  const cur = plan.steps[idx];
  return [
    `[학생 질문] ${userMsg}`,
    '',
    '[전체 plan]',
    plan.steps.map((s, i) => `${i+1}. ${s.kind}: ${s.hint}${i === idx ? '  ← 지금 채울 step' : ''}`).join('\n'),
    '',
    `[지금 ${cur.kind} step 채우기 — hint: "${cur.hint}"]`,
  ].join('\n');
}

async function callTool<T>(
  fetcher: ClaudeFetcher,
  systemText: string,
  userText: string,
  tool: ClaudeTool,
): Promise<T> {
  const messages: ClaudeMessage[] = [
    { role: 'system', content: systemText },
    { role: 'user', content: userText },
  ];
  const raw = await fetcher.generate(messages, [tool]);
  const toolUse = raw.content.find((c) => c.type === 'tool_use' && c.name === tool.name);
  if (!toolUse?.input) throw new Error(`Gemini did not return ${tool.name} tool_use`);
  return toolUse.input as T;
}

function generateConversationId(now: Date): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return Array.from({ length: 16 }, () => hex(Math.floor(Math.random() * 256))).join('');
}

/* ─────────── 메인 ─────────── */

export async function orchestrateV2(opts: OrchestrateOpts): Promise<OrchestrateResult> {
  const start = opts.now().getTime();

  const references = searchUnit({
    query: opts.request.message,
    sections: opts.sections,
    unit_filter: opts.request.unit_id,
  });

  // 1) Plan call
  const planSys = planSystemPrompt({ studentMeta: opts.studentMeta, references });
  const plan = await callTool<PlanResult>(opts.claudeFetch, planSys, opts.request.message, PLAN_TOOL);

  // 2) Fill calls — parallel per step
  const fillSys = '너는 와와 학원 수학 설명 AI. plan 의 한 step 을 채운다. 한국어, KaTeX inline ($..$) 가능.';
  const fillPromises = plan.steps.map(async (planStep, i): Promise<Step> => {
    const ctx = fillContext(plan, i, opts.request.message);
    if (planStep.kind === 'explain') {
      const r = await callTool<{ title: string; body_md: string }>(opts.claudeFetch, fillSys, ctx, FILL_EXPLAIN_TOOL);
      return { kind: 'explain', title: r.title, body_md: r.body_md } as Step;
    }
    if (planStep.kind === 'checkpoint') {
      const r = await callTool<{ question: string }>(opts.claudeFetch, fillSys, ctx, FILL_CHECKPOINT_TOOL);
      return { kind: 'checkpoint', question: r.question, required: true } as Step;
    }
    // figure
    const r = await callTool<{ xs: number[]; ys: number[]; xlabel?: string; ylabel?: string; caption: string }>(
      opts.claudeFetch, fillSys, ctx, FILL_FIGURE_TOOL,
    );
    if (!Array.isArray(r.xs) || r.xs.length < 2 || r.xs.length !== r.ys?.length) {
      // figure fill 실패 → explain 으로 안전 강등
      return { kind: 'explain', title: planStep.hint || '그림', body_md: r.caption || '(그림 데이터 누락)' } as Step;
    }
    return {
      kind: 'figure',
      spec: { type: 'points-2d', xs: r.xs, ys: r.ys, ...(r.xlabel ? { xlabel: r.xlabel } : {}), ...(r.ylabel ? { ylabel: r.ylabel } : {}) },
      ...(r.caption ? { caption: r.caption } : {}),
    } as Step;
  });

  const filledSteps = await Promise.all(fillPromises);

  // 3) 조합 + Zod 방어 검증
  const responseDraft = {
    steps: filledSteps,
    references,
    confidence: plan.confidence,
    needs_teacher: plan.needs_teacher || plan.confidence === 'low',
  };
  const parsed = AskAIResponseSchema.safeParse(responseDraft);
  if (!parsed.success) {
    throw new Error(`v2 schema validation failed: ${parsed.error.message}`);
  }

  const duration_ms = opts.now().getTime() - start;
  return {
    response: parsed.data,
    conversation_id: generateConversationId(opts.now()),
    used_tokens: 0,  // v2 는 step 별 분산 — 정확 산출 후속 (logger 에서 sum 가능)
    duration_ms,
  };
}
