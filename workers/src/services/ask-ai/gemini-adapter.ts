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
  /** UC-03 — 학생이 첨부한 사진 R2 keys (Gemini Vision parts.inlineData 로 변환됨) */
  attachedPhotoKeys?: string[];
}

const VISION_ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);

async function loadPhotosAsParts(env: Env, keys: string[]): Promise<Array<{ mimeType: string; data: string }>> {
  if (keys.length === 0) return [];
  const parts: Array<{ mimeType: string; data: string }> = [];
  for (const key of keys.slice(0, 5)) {  // 최대 5장
    const obj = await env.BUCKET.get(key);
    if (!obj) continue;
    const mimeType = obj.httpMetadata?.contentType?.toLowerCase() || 'image/jpeg';
    if (!VISION_ALLOWED_MIMES.has(mimeType)) continue;
    const buf = await obj.arrayBuffer();
    // base64 encode (worker runtime은 btoa 가능하나 Uint8Array → string 필요)
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const data = btoa(binary);
    parts.push({ mimeType, data });
  }
  return parts;
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
        // 사진은 inlineData parts로 별도 전달 — text 블록만 합침
        return m.content
          .map((b: any) => (b.type === 'text' ? b.text : ''))
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    // R2 → base64 inlineData parts 로드
    const imageParts = await loadPhotosAsParts(this.opts.env, this.opts.attachedPhotoKeys ?? []);

    const photoNote = imageParts.length > 0
      ? `\n(학생이 사진 ${imageParts.length}장을 첨부했습니다. 사진의 수식·도형·문제를 인식해 응답에 반영하세요.)\n`
      : '';

    const prompt = [
      systemText,
      '',
      wrapUserInput('학생 질문', userText),
      photoNote,
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
      imageParts,
      // ask-ai는 orchestrate-v2 가 sub-call N회 호출 (Plan+Fill).
      // KV daily limit·usage 추적은 handleAsk 진입점에서 1회만 → KV 쓰기 80% 감소.
      // 응답 메트릭은 Analytics Engine (AE_ASKAI) 가 대체.
      skipKVTracking: true,
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
