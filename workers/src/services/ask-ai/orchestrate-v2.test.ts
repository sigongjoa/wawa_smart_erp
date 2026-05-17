/**
 * orchestrateV2 — Plan + Fill 흐름 테스트.
 * Mock fetcher 가 tool 이름을 보고 적절한 응답 반환.
 */
import { describe, it, expect, vi } from 'vitest';
import { orchestrateV2 } from './orchestrate-v2';
import type { ClaudeFetcher } from './orchestrator';
import type { AskAIRequest } from '@/schemas/ask-ai';
import type { UnitSection } from './search-unit';

const REQUEST: AskAIRequest = {
  student_id: 's-1',
  unit_id: '확통 III-1',
  message: 'y=x^2 그래프 그려주고 정의도 알려줘',
  attached_photos: [],
};
const SECTIONS: UnitSection[] = [];
const STUDENT = { name: '이루다', grade: '고2' };

function makeFetcher(responses: Record<string, object>): ClaudeFetcher {
  return {
    generate: vi.fn(async (_msgs, tools) => {
      const toolName = tools?.[0]?.name ?? 'plan';
      const input = responses[toolName];
      if (!input) throw new Error(`no mock for ${toolName}`);
      return {
        content: [{ type: 'tool_use', name: toolName, input }],
        usage: { input_tokens: 50, output_tokens: 100 },
      };
    }),
  };
}

describe('orchestrateV2 — Plan + Fill', () => {
  it('plan 3 step (explain + figure + checkpoint) → 모두 fill 성공', async () => {
    const fetcher = makeFetcher({
      plan: {
        steps: [
          { kind: 'explain', hint: 'y=x^2 정의' },
          { kind: 'figure', hint: 'y=x^2 곡선' },
          { kind: 'checkpoint', hint: '정의 확인' },
        ],
        confidence: 'high',
        needs_teacher: false,
      },
      fill_explain: { title: '이차함수 정의', body_md: '$y = x^2$ 는 이차함수입니다.' },
      fill_figure: {
        xs: [-2, -1, 0, 1, 2],
        ys: [4, 1, 0, 1, 4],
        xlabel: 'x', ylabel: 'y',
        caption: 'y = x² 곡선',
      },
      fill_checkpoint: { question: '이차함수의 정의를 한 줄로 말해볼까요?' },
    });

    const r = await orchestrateV2({
      request: REQUEST, studentMeta: STUDENT, sections: SECTIONS,
      claudeFetch: fetcher, now: () => new Date(),
    });

    expect(r.response.steps).toHaveLength(3);
    expect(r.response.steps[0].kind).toBe('explain');
    expect(r.response.steps[1].kind).toBe('figure');
    expect((r.response.steps[1] as any).spec.type).toBe('points-2d');
    expect((r.response.steps[1] as any).spec.xs).toHaveLength(5);
    expect(r.response.steps[2].kind).toBe('checkpoint');
    expect(r.response.confidence).toBe('high');
    expect(r.response.needs_teacher).toBe(false);
  });

  it('confidence=low → needs_teacher 자동 true', async () => {
    const fetcher = makeFetcher({
      plan: {
        steps: [{ kind: 'explain', hint: '?' }],
        confidence: 'low', needs_teacher: false,
      },
      fill_explain: { title: '?', body_md: '?' },
    });
    const r = await orchestrateV2({
      request: REQUEST, studentMeta: STUDENT, sections: SECTIONS,
      claudeFetch: fetcher, now: () => new Date(),
    });
    expect(r.response.needs_teacher).toBe(true);
  });

  it('figure fill 가 깨진 데이터 (xs/ys 길이 불일치) → explain 으로 강등', async () => {
    const fetcher = makeFetcher({
      plan: {
        steps: [
          { kind: 'figure', hint: '깨진 그래프' },
          { kind: 'checkpoint', hint: '확인' },
        ],
        confidence: 'medium', needs_teacher: false,
      },
      fill_figure: { xs: [1, 2, 3], ys: [1, 4], caption: '데이터 깨짐' },
      fill_checkpoint: { question: '확인?' },
    });
    const r = await orchestrateV2({
      request: REQUEST, studentMeta: STUDENT, sections: SECTIONS,
      claudeFetch: fetcher, now: () => new Date(),
    });
    expect(r.response.steps[0].kind).toBe('explain');  // figure → explain 강등
    expect((r.response.steps[0] as any).body_md).toBe('데이터 깨짐');
  });

  it('plan 의 step 수만큼 fill 호출 (parallel)', async () => {
    const fetcher = makeFetcher({
      plan: {
        steps: [
          { kind: 'explain', hint: 'a' }, { kind: 'explain', hint: 'b' },
          { kind: 'checkpoint', hint: 'c' }, { kind: 'explain', hint: 'd' },
        ],
        confidence: 'high', needs_teacher: false,
      },
      fill_explain: { title: 't', body_md: 'b' },
      fill_checkpoint: { question: 'q' },
    });
    await orchestrateV2({
      request: REQUEST, studentMeta: STUDENT, sections: SECTIONS,
      claudeFetch: fetcher, now: () => new Date(),
    });
    // plan 1회 + fill 4회 = 5회
    expect((fetcher.generate as any).mock.calls.length).toBe(5);
  });
});
