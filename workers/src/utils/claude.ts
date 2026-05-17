/**
 * Claude API client — Anthropic Messages API + tool_use
 *
 * orchestrator.ts의 ClaudeFetcher 인터페이스 구현체.
 * 테스트에선 mock 주입, 운영에선 이 클래스.
 */

import type { ClaudeFetcher, ClaudeMessage, ClaudeTool, ClaudeRawResponse } from '@/services/ask-ai/orchestrator';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;

export interface ClaudeClientOpts {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class ClaudeClient implements ClaudeFetcher {
  private apiKey: string;
  private model: string;
  private maxTokens: number;

  constructor(opts: ClaudeClientOpts) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_MODEL;
    this.maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async generate(messages: ClaudeMessage[], tools?: ClaudeTool[]): Promise<ClaudeRawResponse> {
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: conversationMessages,
    };

    if (systemMessage) {
      body.system = typeof systemMessage.content === 'string'
        ? systemMessage.content
        : JSON.stringify(systemMessage.content);
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = { type: 'tool', name: tools[0].name };  // 첫 도구 강제
    }

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API ${res.status}: ${errText}`);
    }

    return (await res.json()) as ClaudeRawResponse;
  }
}
