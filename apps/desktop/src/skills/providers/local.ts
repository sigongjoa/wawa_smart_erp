import { ILLMProvider } from './types';
import { LLMChatRequest, LLMChatResponse } from '../types';

/**
 * 로컬 LLM 프로바이더 (transformers.js 기반)
 * CPU 수준에서 동작하는 경량 모델을 사용합니다.
 * TODO: transformers.js 통합 구현 예정
 */
export class LocalProvider implements ILLMProvider {
  readonly name: string = 'local';
  private modelLoaded: boolean = false;

  get isAvailable(): boolean {
    return this.modelLoaded;
  }

  // 모델 로드 (transformers.js pipeline 초기화)
  async loadModel(_modelId?: string): Promise<void> {
    // TODO: transformers.js 모델 로드 구현
    // import { pipeline } from '@xenova/transformers';
    // this.generator = await pipeline('text-generation', modelId || 'Xenova/phi-2');
    console.log('[LocalProvider] 로컬 모델 로드 기능은 추후 구현 예정입니다.');
    this.modelLoaded = false;
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    if (!this.modelLoaded) {
      throw new Error('로컬 모델이 로드되지 않았습니다. 클라우드 API를 사용해주세요.');
    }

    // TODO: transformers.js를 사용한 텍스트 생성 구현
    // 로컬 모델은 function calling을 직접 지원하지 않으므로
    // 프롬프트 기반으로 JSON 응답을 요청하여 파싱하는 방식 사용
    const lastMessage = request.messages[request.messages.length - 1]?.content || '';
    return {
      content: `[로컬 모델 미구현] 요청: ${lastMessage}`,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
