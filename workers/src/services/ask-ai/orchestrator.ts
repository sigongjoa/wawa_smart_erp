/**
 * UC-01 — orchestrator: Claude API 호출 + 학원 컨텍스트 주입
 *
 * 주요 책임:
 *   1. search-unit 호출해 학원 단원지에서 grounding fetch
 *   2. system prompt에 학생 메모 + grounding + 한 줄씩 멈춤 지침 주입
 *   3. Claude tool_use 강제로 응답 스키마 잠금
 *   4. AskAIResponseSchema 검증 후 반환 (방어선)
 *   5. UC-05 — confidence=low면 needs_teacher 자동 true
 *
 * Claude SDK fetch는 inject — 테스트 시 mock, 운영 시 실제 API 클라이언트.
 */

import { AskAIResponseSchema, type AskAIResponse, type AskAIRequest, type Reference } from '@/schemas/ask-ai';
import { searchUnit, type UnitSection } from './search-unit';

export interface StudentMeta {
  name?: string;
  grade?: string;
  weakness_notes?: string[];
  current_unit?: string;
}

export interface ClaudeMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; source?: any }>;
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: object;
}

export interface ClaudeRawResponse {
  content: Array<{
    type: 'text' | 'tool_use';
    name?: string;
    input?: object;
    text?: string;
  }>;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface ClaudeFetcher {
  generate(messages: ClaudeMessage[], tools?: ClaudeTool[]): Promise<ClaudeRawResponse>;
}

export interface OrchestrateOpts {
  request: AskAIRequest;
  studentMeta?: StudentMeta;
  sections: UnitSection[];          // search-unit 데이터셋
  claudeFetch: ClaudeFetcher;
  now: () => Date;
}

export interface OrchestrateResult {
  response: AskAIResponse;
  conversation_id: string;
  used_tokens: number;
  duration_ms: number;
}

/* ─────────── public ─────────── */

export async function orchestrate(opts: OrchestrateOpts): Promise<OrchestrateResult> {
  const start = opts.now().getTime();

  // 1. search-unit으로 grounding 확보
  const references = searchUnit({
    query: opts.request.message,
    sections: opts.sections,
    unit_filter: opts.request.unit_id,
    limit: 3,
  });

  // 2. system prompt 구성
  const systemPrompt = buildSystemPrompt({
    studentMeta: opts.studentMeta,
    references,
  });

  // 3. user message 구성 (사진 첨부 포함)
  const userMessage = buildUserMessage(opts.request);

  // 4. Claude tool_use 강제
  const tools = [respondTool];

  const raw = await opts.claudeFetch.generate(
    [
      { role: 'system', content: systemPrompt },
      userMessage,
    ],
    tools
  );

  // 5. tool_use 응답 추출
  const toolUse = raw.content.find((c) => c.type === 'tool_use' && c.name === 'respond');
  if (!toolUse || !toolUse.input) {
    throw new Error('Claude did not return respond tool_use');
  }

  // 6. UC-05 — confidence=low면 needs_teacher 자동 보정 (Claude가 까먹어도)
  const inputWithFix = autoFlagNeedsTeacher(toolUse.input as any);

  // 6.5. figure step — Gemini가 flat 필드(figure_xs/figure_ys/...)로 보낸 것을
  //      Zod 가 기대하는 nested spec 으로 변환. 점 ≥ 2개 + 길이 일치 시만 figure.
  if (Array.isArray((inputWithFix as any).steps)) {
    (inputWithFix as any).steps = (inputWithFix as any).steps.map(transformFigureStep);
  }

  // 7. schema 검증 (방어선)
  const parsed = AskAIResponseSchema.safeParse({
    ...inputWithFix,
    references: (inputWithFix as any).references?.length ? (inputWithFix as any).references : references,
  });
  if (!parsed.success) {
    throw new Error(`Claude response failed schema validation: ${parsed.error.message}`);
  }

  const used_tokens = (raw.usage?.input_tokens ?? 0) + (raw.usage?.output_tokens ?? 0);
  const duration_ms = opts.now().getTime() - start;

  return {
    response: parsed.data,
    conversation_id: generateConversationId(opts.now()),
    used_tokens,
    duration_ms,
  };
}

/* ─────────── pure helpers (testable) ─────────── */

export function buildSystemPrompt(opts: {
  studentMeta?: StudentMeta;
  references: Reference[];
}): string {
  const parts: string[] = [];

  parts.push(
    '너는 와와 학원의 수학 설명 전용 AI다. 학생이 막히는 곳을 함께 풀어 나간다.',
    '',
    '[중요한 응답 규칙]',
    '- steps[] 안에 한 줄씩 멈춤(checkpoint) 단계를 1개 이상 포함.',
    '- 학생이 다음 단계로 가기 전에 항상 "이해했나?" 묻는 checkpoint.',
    '- 자신 없으면 confidence를 "low"로, needs_teacher를 true로 설정.',
    '',
    '[step 형식 — kind 별 필수 필드 엄수]',
    '- kind="explain": title (간단), body_md (마크다운, $..$로 KaTeX 가능). 필수 둘 다.',
    '- kind="checkpoint": question (학생이 답할 한 줄 질문). 필수.',
    '- kind="inline_cite": src, quote (인용 출처 + 인용문).',
    '- kind="figure": figure_xs, figure_ys (좌표 배열, 같은 길이 ~30개), figure_caption.',
    '- 모든 step은 kind 필드 필수. 잘못된 kind 사용 금지.',
    '',
    '[그림(figure) 사용 — 글보다 그림이 본질적으로 더 나은 경우만]',
    '- 함수의 모양/위치 (이차함수, 사인/지수 곡선)',
    '- 부등식 영역, 근의 분포, 점·교점 좌표',
    '- 데이터 분포 (정규분포 종 모양, 막대 등)',
    '- 그림이 굳이 필요 없는 대수 계산이면 figure 쓰지 말 것 (장식 X)',
    '- figure_xs / figure_ys 는 그래프를 부드럽게 그릴 만큼 (보통 25~40개 점) sampling.',
    '  예: y=x²-2x+1, x∈[-2,4] 면 x = -2, -1.7, -1.4, ..., 4 같은 등간격 점을 직접 계산해서 ys 채우기.',
    '- figure step 다음에는 explain step 으로 그림 해석 (학생이 그림 보고 알아채야 할 포인트 짚기).',
    '',
  );

  if (opts.studentMeta) {
    parts.push('[학생 컨텍스트]');
    if (opts.studentMeta.name) parts.push(`이름: ${opts.studentMeta.name}`);
    if (opts.studentMeta.grade) parts.push(`학년: ${opts.studentMeta.grade}`);
    if (opts.studentMeta.current_unit) parts.push(`현재 단원: ${opts.studentMeta.current_unit}`);
    if (opts.studentMeta.weakness_notes?.length) {
      parts.push('약점 메모:');
      opts.studentMeta.weakness_notes.forEach((n) => parts.push(`  - ${n}`));
    }
    parts.push('');
  }

  if (opts.references.length > 0) {
    parts.push('[학원 단원지 grounding — 정의·기호·풀이 스타일은 이 자료에 맞출 것]');
    opts.references.forEach((r) => {
      parts.push(`◦ ${r.unit} (p.${r.page}): "${r.quote}"`);
    });
    parts.push('');
  }

  return parts.join('\n');
}

function buildUserMessage(request: AskAIRequest): ClaudeMessage {
  if (request.attached_photos.length === 0) {
    return { role: 'user', content: request.message };
  }
  // 멀티모달 — 사진 + 텍스트
  const blocks: Array<{ type: string; text?: string; source?: any }> = [];
  for (const photo of request.attached_photos) {
    blocks.push({ type: 'image', source: { type: 'r2_key', media_type: 'image/jpeg', data: photo } });
  }
  blocks.push({ type: 'text', text: request.message });
  return { role: 'user', content: blocks };
}

/**
 * figure step transform — Gemini는 flat schema (figure_xs, figure_ys, figure_caption ...)
 * Zod 는 nested (spec: { type: 'points-2d', xs, ys, ... }, caption).
 * 길이 검증 실패 시 explain 으로 fallback (도메인 추측 실패 케이스 방지).
 */
export function transformFigureStep(step: any): any {
  if (step?.kind !== 'figure') return step;
  const xs = Array.isArray(step.figure_xs) ? step.figure_xs : [];
  const ys = Array.isArray(step.figure_ys) ? step.figure_ys : [];
  if (xs.length < 2 || xs.length !== ys.length) {
    // figure 의도였으나 데이터 불완전 — explain 으로 강등
    return {
      kind: 'explain',
      title: step.figure_caption || '그림',
      body_md: step.body_md || step.figure_caption || '(그림 데이터 누락)',
    };
  }
  return {
    kind: 'figure',
    spec: {
      type: 'points-2d',
      xs, ys,
      ...(step.figure_xlabel ? { xlabel: step.figure_xlabel } : {}),
      ...(step.figure_ylabel ? { ylabel: step.figure_ylabel } : {}),
    },
    ...(step.figure_caption ? { caption: step.figure_caption } : {}),
  };
}

function autoFlagNeedsTeacher(input: any): any {
  if (input.confidence === 'low' && input.needs_teacher !== true) {
    return { ...input, needs_teacher: true };
  }
  return input;
}

function generateConversationId(now: Date): string {
  // UUID v4 simple — Workers 환경에선 crypto.randomUUID() 가능
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback (테스트 환경 일부)
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const r = (n: number) => Array.from({ length: n }, () => hex(Math.floor(Math.random() * 256))).join('');
  return `${r(4)}-${r(2)}-${r(2)}-${r(2)}-${r(6)}`;
}

/* ─────────── Claude tool 정의 ─────────── */

const respondTool: ClaudeTool = {
  name: 'respond',
  description: '학생에게 줄 응답을 구조화 JSON으로 반환',
  input_schema: {
    type: 'object',
    required: ['steps', 'confidence'],
    properties: {
      // Gemini responseSchema는 array에 items 필수. Zod 가 후처리 정밀 검증하므로
      // 여기선 Gemini가 kind 필드를 빠뜨리지 않게 enum hint만 제공.
      steps: {
        type: 'array', minItems: 1,
        items: {
          type: 'object',
          // Gemini가 union을 못 다루므로 모든 필드를 required로 — Zod가 kind별 strip.
          // explain: title/body_md, checkpoint: question, inline_cite: src/quote, figure: figure_*.
          // 사용 안 하는 필드도 빈 문자열/빈 배열 (Zod가 무시).
          required: ['kind', 'title', 'body_md', 'question', 'src', 'quote', 'figure_xs', 'figure_ys', 'figure_caption'],
          properties: {
            kind: { type: 'string', enum: ['explain', 'checkpoint', 'inline_cite', 'figure'] },
            title: { type: 'string', description: 'kind=explain 단계 제목.' },
            body_md: { type: 'string', description: 'kind=explain 마크다운 본문 ($..$ KaTeX).' },
            question: { type: 'string', description: 'kind=checkpoint 학생에게 묻는 질문.' },
            src: { type: 'string', description: 'kind=inline_cite 출처.' },
            quote: { type: 'string', description: 'kind=inline_cite 인용문.' },
            // figure: AI가 함수/곡선/데이터를 30개 안팎의 (xs, ys) 점으로 sampling.
            figure_xs: { type: 'array', items: { type: 'number' }, description: 'kind=figure x좌표 배열. 다른 kind는 빈 배열.' },
            figure_ys: { type: 'array', items: { type: 'number' }, description: 'kind=figure y좌표 배열 (xs와 동일 길이).' },
            figure_xlabel: { type: 'string', description: 'kind=figure x축 라벨 (선택).' },
            figure_ylabel: { type: 'string', description: 'kind=figure y축 라벨 (선택).' },
            figure_caption: { type: 'string', description: 'kind=figure 그림 설명 캡션.' },
          },
        },
      },
      references: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            src: { type: 'string' },
            page: { type: 'number' },
            quote: { type: 'string' },
          },
        },
      },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      needs_teacher: { type: 'boolean' },
    },
  },
};
