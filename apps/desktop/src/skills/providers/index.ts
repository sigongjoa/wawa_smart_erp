// LLM 프로바이더 통합 관리
import { GeminiProvider } from './gemini';
import { LocalProvider } from './local';
import type { ILLMProvider } from './types';
import type { LLMProvider } from '../types';

// 프로바이더 인스턴스 캐시
const providers: Map<string, ILLMProvider> = new Map();

// 프로바이더 생성/조회
export function getProvider(type: LLMProvider, apiKey?: string, model?: string): ILLMProvider {
  const cacheKey = `${type}:${model || 'default'}`;

  if (providers.has(cacheKey)) {
    return providers.get(cacheKey)!;
  }

  let provider: ILLMProvider;
  switch (type) {
    case 'gemini':
      provider = new GeminiProvider(apiKey || '', model);
      break;
    case 'local':
      provider = new LocalProvider();
      break;
    default:
      throw new Error(`지원하지 않는 프로바이더: ${type}`);
  }

  providers.set(cacheKey, provider);
  return provider;
}

// 프로바이더 캐시 초기화
export function clearProviders(): void {
  providers.clear();
}

export type { ILLMProvider } from './types';
