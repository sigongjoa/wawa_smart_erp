import type { LLMChatRequest, LLMChatResponse, ToolDefinition } from '../types';

// LLM 프로바이더 인터페이스
export interface ILLMProvider {
  readonly name: string;
  readonly isAvailable: boolean;

  // 채팅 메시지 전송 (function calling 포함)
  chat(request: LLMChatRequest): Promise<LLMChatResponse>;
}

// 프로바이더 설정
export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}
