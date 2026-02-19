import { ILLMProvider } from './types';
import { LLMChatRequest, LLMChatResponse, ToolDefinition } from '../types';

/**
 * Gemini API와의 통신을 처리하는 클래스입니다.
 * ILLMProvider 인터페이스를 구현합니다.
 */
export class GeminiProvider implements ILLMProvider {
  // 프로바이더의 이름 (고정값)
  readonly name: string = 'gemini';
  // Gemini API 키
  private readonly apiKey: string;
  // 사용할 기본 모델
  private readonly defaultModel: string;

  /**
   * GeminiProvider의 생성자입니다.
   * @param apiKey Gemini API 키
   * @param model 사용할 기본 모델 (기본값: 'gemini-2.5-flash')
   */
  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.defaultModel = model;
  }

  /**
   * API 키가 유효한지 여부를 반환합니다.
   * @returns API 키가 있으면 true, 없으면 false
   */
  get isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Gemini 모델과 채팅 세션을 시작하거나 메시지를 전송합니다.
   * @param request LLM 채팅 요청 객체
   * @returns LLM 채팅 응답 객체
   */
  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const model = request.model || this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    // 시스템 메시지와 일반 메시지 분리 및 변환
    let systemInstruction: string | undefined;
    const contents = request.messages.map((msg) => {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
        return null; // 시스템 메시지는 contents에서 제외
      }
      return {
        role: msg.role === 'assistant' ? 'model' : 'user', // Gemini API는 'user'와 'model' 역할만 지원
        parts: [{ text: msg.content }],
      };
    }).filter(Boolean); // null 값 제거

    // ToolDefinition을 Gemini의 functionDeclarations 형태로 변환
    const functionDeclarations = request.tools?.map((tool: ToolDefinition) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    // thinking 모델(2.5 계열)은 thinkingBudget을 0으로 설정하여 토큰 낭비 방지
    const generationConfig: any = {
      maxOutputTokens: request.maxTokens,
      temperature: 0.8, // 기본 온도 설정
    };

    if (model.startsWith('gemini-2.5')) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const body: any = {
      contents,
      generationConfig,
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (functionDeclarations && functionDeclarations.length > 0) {
      body.tools = [{ function_declarations: functionDeclarations }];
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Gemini API 에러 메시지를 한국어로 변환
        let errorMessage = '알 수 없는 Gemini API 오류가 발생했습니다.';
        if (data.error?.message) {
          errorMessage = `Gemini API 오류: ${data.error.message}`;
        } else if (response.status === 400) {
          errorMessage = '잘못된 요청입니다. 입력값을 확인해주세요.';
        } else if (response.status === 401 || response.status === 403) {
          errorMessage = '인증 오류입니다. API 키를 확인해주세요.';
        } else if (response.status === 429) {
          errorMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        } else if (response.status === 500 || response.status === 503) {
          errorMessage = 'Gemini 서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
        throw new Error(errorMessage);
      }

      const candidate = data.candidates?.[0];
      const output: LLMChatResponse = {
        content: '',
      };

      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            output.content += part.text;
          }
          // function calling 결과 변환
          if (part.functionCall) {
            if (!output.toolCalls) {
              output.toolCalls = [];
            }
            output.toolCalls.push({
              name: part.functionCall.name,
              arguments: part.functionCall.args || {},
            });
          }
        }
      }

      // 사용량 정보 추출
      const usage = data.usageMetadata;
      if (usage) {
        output.usage = {
          inputTokens: usage.promptTokenCount || 0,
          outputTokens: usage.candidatesTokenCount || 0,
        };
      }

      return output;
    } catch (error: any) {
      // 네트워크 에러 메시지를 한국어로 변환
      let message = '네트워크 오류가 발생했습니다.';
      if (error.cause?.code === 'ENOTFOUND') {
        message = 'Gemini 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.';
      } else if (error.cause?.code === 'ETIMEDOUT') {
        message = 'Gemini 서버 응답 시간이 초과되었습니다.';
      } else if (error.message) {
        message = error.message;
      }
      throw new Error(message);
    }
  }
}
