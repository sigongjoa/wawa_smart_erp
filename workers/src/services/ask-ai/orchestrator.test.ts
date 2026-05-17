/**
 * UC-01 — orchestrator 테스트
 *
 * Claude API mock으로 검증:
 *   - system prompt에 학생 메모 + 단원지 grounding 주입
 *   - 응답 JSON이 AskAIResponseSchema 강제됨
 *   - confidence=low → needs_teacher 자동 true
 *   - 학생 컨텍스트 누락되면 정상 동작 (기본값)
 */

import { describe, it, expect, vi } from 'vitest';
import { orchestrate, buildSystemPrompt, transformFigureStep } from './orchestrator';
import type { ClaudeFetcher } from './orchestrator';
import type { AskAIRequest } from '@/schemas/ask-ai';
import type { UnitSection } from './search-unit';

const STUDENT_META = {
  name: '이루다',
  grade: '고2',
  weakness_notes: ['근의 위치·경계값에서 그림 안 그리는 습관'],
  current_unit: '확통 III-1 표본분포',
};

const SECTIONS: UnitSection[] = [
  {
    unit_id: '확통 III-1', section_id: '§2.1', page: 11,
    title: '표본과 모집단',
    body: '확률표본의 정의...',
    keywords: ['표본'],
  },
];

const REQUEST: AskAIRequest = {
  student_id: 'iruda-001',
  unit_id: '확통 III-1 표본분포',
  message: '표본평균 분산이 왜 σ²/n인가요?',
  attached_photos: [],
};

function makeMockFetcher(responseJson: object): ClaudeFetcher {
  return {
    generate: vi.fn().mockResolvedValue({
      content: [{
        type: 'tool_use',
        name: 'respond',
        input: responseJson,
      }],
      usage: { input_tokens: 1200, output_tokens: 800 },
    }),
  };
}

const VALID_RESPONSE = {
  steps: [
    { kind: 'explain', title: '표본평균은 변수다', body_md: '매번 표본을 뽑으면...' },
    { kind: 'checkpoint', question: '여기까지 OK?' },
  ],
  references: [],
  confidence: 'high',
  needs_teacher: false,
};

describe('buildSystemPrompt', () => {
  it('학생 이름·약점·현재 단원 포함', () => {
    const prompt = buildSystemPrompt({ studentMeta: STUDENT_META, references: [] });
    expect(prompt).toContain('이루다');
    expect(prompt).toContain('근의 위치');
    expect(prompt).toContain('확통 III-1');
  });

  it('references 있으면 단원지 인용 포함', () => {
    const prompt = buildSystemPrompt({
      studentMeta: STUDENT_META,
      references: [{ unit: '확통 III-1 §2.1', page: 11, quote: '확률표본의 정의' }],
    });
    expect(prompt).toContain('§2.1');
    expect(prompt).toContain('확률표본');
  });

  it('학생 메모 없어도 동작 (신규 학생)', () => {
    const prompt = buildSystemPrompt({ studentMeta: undefined, references: [] });
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('"한 줄씩 멈춤" 강제 지침 포함', () => {
    const prompt = buildSystemPrompt({ studentMeta: STUDENT_META, references: [] });
    expect(prompt).toMatch(/checkpoint|한 줄씩|멈춤/);
  });
});

describe('orchestrate — UC-01', () => {
  it('정상 흐름 — 응답 parsing + schema 검증 통과', async () => {
    const fetcher = makeMockFetcher(VALID_RESPONSE);
    const result = await orchestrate({
      request: REQUEST,
      studentMeta: STUDENT_META,
      sections: SECTIONS,
      claudeFetch: fetcher,
      now: () => new Date('2026-05-15T14:02:00Z'),
    });

    expect(result.response.steps.length).toBe(2);
    expect(result.response.confidence).toBe('high');
    expect(result.conversation_id).toBeDefined();
    expect(result.used_tokens).toBe(2000);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('Claude를 1회만 호출 (불필요한 retry 없음)', async () => {
    const fetcher = makeMockFetcher(VALID_RESPONSE);
    await orchestrate({
      request: REQUEST,
      studentMeta: STUDENT_META,
      sections: SECTIONS,
      claudeFetch: fetcher,
      now: () => new Date(),
    });
    expect(fetcher.generate).toHaveBeenCalledTimes(1);
  });

  it('UC-05 — Claude가 confidence=low 반환하면 needs_teacher 자동 true', async () => {
    const lowConfResponse = { ...VALID_RESPONSE, confidence: 'low', needs_teacher: false };
    const fetcher = makeMockFetcher(lowConfResponse);
    const result = await orchestrate({
      request: REQUEST,
      studentMeta: STUDENT_META,
      sections: SECTIONS,
      claudeFetch: fetcher,
      now: () => new Date(),
    });
    expect(result.response.needs_teacher).toBe(true);
  });

  it('UC-06 — orchestrator가 search-unit 호출 결과를 system prompt에 주입', async () => {
    const fetcher = makeMockFetcher(VALID_RESPONSE);
    await orchestrate({
      request: REQUEST,
      studentMeta: STUDENT_META,
      sections: SECTIONS,
      claudeFetch: fetcher,
      now: () => new Date(),
    });
    const generateCall = (fetcher.generate as any).mock.calls[0];
    const messages = generateCall[0];
    const system = messages.find((m: any) => m.role === 'system')?.content || '';
    expect(system).toContain('확통 III-1');
  });

  it('Claude 응답이 schema 위반 시 throws (방어선)', async () => {
    const invalid = { steps: [], references: [], confidence: 'high' };
    const fetcher = makeMockFetcher(invalid);
    await expect(orchestrate({
      request: REQUEST,
      studentMeta: STUDENT_META,
      sections: SECTIONS,
      claudeFetch: fetcher,
      now: () => new Date(),
    })).rejects.toThrow(/schema|invalid/i);
  });

  it('학생 메시지가 사용자 메시지로 전달됨', async () => {
    const fetcher = makeMockFetcher(VALID_RESPONSE);
    await orchestrate({
      request: REQUEST,
      studentMeta: STUDENT_META,
      sections: SECTIONS,
      claudeFetch: fetcher,
      now: () => new Date(),
    });
    const generateCall = (fetcher.generate as any).mock.calls[0];
    const messages = generateCall[0];
    const userMsg = messages.find((m: any) => m.role === 'user');
    expect(JSON.stringify(userMsg)).toContain('표본평균 분산이 왜');
  });

  // figure transform — Gemini flat → Zod nested 변환
  it('transformFigureStep — flat figure_xs/figure_ys → spec.points-2d', () => {
    const flat = {
      kind: 'figure',
      figure_xs: [-2, -1, 0, 1, 2],
      figure_ys: [4, 1, 0, 1, 4],
      figure_xlabel: 'x',
      figure_ylabel: 'y',
      figure_caption: 'y = x² 그래프',
    };
    const out = transformFigureStep(flat);
    expect(out.kind).toBe('figure');
    expect(out.spec.type).toBe('points-2d');
    expect(out.spec.xs).toEqual([-2, -1, 0, 1, 2]);
    expect(out.spec.ys).toEqual([4, 1, 0, 1, 4]);
    expect(out.spec.xlabel).toBe('x');
    expect(out.caption).toBe('y = x² 그래프');
  });

  it('transformFigureStep — figure_xs/ys 길이 불일치 → explain 으로 강등', () => {
    const broken = { kind: 'figure', figure_xs: [1, 2, 3], figure_ys: [1, 4], figure_caption: '깨진 그림' };
    const out = transformFigureStep(broken);
    expect(out.kind).toBe('explain');
    expect(out.title).toBe('깨진 그림');
  });

  it('transformFigureStep — figure 외 kind 는 그대로', () => {
    const ex = { kind: 'explain', title: 'A', body_md: 'B' };
    expect(transformFigureStep(ex)).toBe(ex);
  });

  // 회귀 — 2026-05-15 발견된 Gemini schema 버그.
  // items.required 가 비어있으면 Gemini 가 kind/title/body_md 등을 빠뜨려 Zod fail.
  it('respond tool schema 의 steps.items 가 모든 분기 필드 required (Gemini 호환)', async () => {
    const fetcher = makeMockFetcher(VALID_RESPONSE);
    await orchestrate({
      request: REQUEST,
      studentMeta: STUDENT_META,
      sections: SECTIONS,
      claudeFetch: fetcher,
      now: () => new Date(),
    });
    const tools = (fetcher.generate as any).mock.calls[0][1];
    const respond = tools[0];
    const stepsSchema = respond.input_schema.properties.steps;
    expect(stepsSchema.type).toBe('array');
    expect(stepsSchema.items).toBeDefined();
    expect(stepsSchema.items.type).toBe('object');
    // Gemini 호환 — kind/title/body_md/question/src/quote 모두 required (Zod 가 kind 별 strip)
    const required = stepsSchema.items.required as string[];
    for (const f of ['kind', 'title', 'body_md', 'question', 'src', 'quote']) {
      expect(required).toContain(f);
    }
    // references items 도 누락 시 Gemini 가 400 → items 정의 필수
    const refsSchema = respond.input_schema.properties.references;
    expect(refsSchema.items).toBeDefined();
    expect(refsSchema.items.type).toBe('object');
  });
});
