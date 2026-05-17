/**
 * Gemini 어댑터 — orchestrator의 ClaudeFetcher 인터페이스 만족.
 *
 * Claude는 tool_use, Gemini는 responseSchema로 강제 JSON 반환.
 * 두 API의 message 형식 차이를 흡수.
 */

import type { ClaudeFetcher, ClaudeMessage, ClaudeTool, ClaudeRawResponse } from './orchestrator';
import { geminiGenerate, wrapUserInput } from '@/utils/gemini';
import type { Env } from '@/types';

export interface GeminiAdapterOpts {
  env: Env;
  userId: string;
  academyId?: string;
  model?: string;     // gemini-2.5-flash 권장 (한국어 수학 설명, lite보다 한 단계 위)
}

export class GeminiFetcher implements ClaudeFetcher {
  constructor(private opts: GeminiAdapterOpts) {}

  async generate(messages: ClaudeMessage[], tools?: ClaudeTool[]): Promise<ClaudeRawResponse> {
    // system + user 메시지를 하나의 prompt로 합침 (Gemini는 system 별도 없음 — system instruction 가능하지만 단순화)
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMsgs = messages.filter((m) => m.role !== 'system');

    const systemText = systemMsg
      ? typeof systemMsg.content === 'string'
        ? systemMsg.content
        : JSON.stringify(systemMsg.content)
      : '';

    const userText = userMsgs
      .map((m) => {
        if (typeof m.content === 'string') return m.content;
        // 멀티모달 — 사진 부분은 일단 텍스트로만 (Gemini vision은 별도 작업)
        return m.content
          .map((b: any) => (b.type === 'text' ? b.text : `[사진 첨부: ${b.source?.data ?? '?'}]`))
          .join('\n');
      })
      .join('\n\n');

    const prompt = [
      systemText,
      '',
      wrapUserInput('학생 질문', userText),
      '',
      '위 질문에 대한 응답을 schema에 맞춰 JSON으로 반환하세요.',
    ].join('\n');

    // 첫 번째 tool의 input_schema를 Gemini responseSchema로 사용
    const schema = tools?.[0]?.input_schema as object | undefined;

    const result = await geminiGenerate({
      env: this.opts.env,
      userId: this.opts.userId,
      academyId: this.opts.academyId,
      kind: 'ask-ai',
      prompt,
      temperature: 0.4,           // 수학은 낮은 temperature 안전
      // figure step (xs/ys 30점 = ~600토큰) + 다단계 explain → 4096 으론 빈번히 truncate.
      // gemini-2.5-flash 는 8192 까지 안정.
      maxOutputTokens: 8192,
      model: this.opts.model ?? 'gemini-2.5-flash',
      responseSchema: schema,
    });

    if (result.blocked) {
      // rate limit 등으로 차단 — orchestrator에 알림 위해 throw
      throw new Error('AI 호출 차단됨 (한도 초과 또는 키 누락)');
    }

    if (!result.text) {
      throw new Error('Gemini empty response');
    }

    // JSON 파싱
    let parsed: object;
    try {
      parsed = JSON.parse(result.text);
    } catch (err) {
      throw new Error(`Gemini JSON parse 실패: ${result.text.slice(0, 200)}`);
    }

    // ClaudeRawResponse 형태로 변환 — orchestrator는 content[0].input을 읽음
    return {
      content: [{
        type: 'tool_use',
        name: tools?.[0]?.name ?? 'respond',
        input: parsed,
      }],
      usage: result.usage ? {
        input_tokens: result.usage.input,
        output_tokens: result.usage.output,
      } : undefined,
    };
  }
}
