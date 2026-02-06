import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProvider, AISettings, AIUsageRecord, AIGenerationRequest, AIGenerationResult, AIModel } from '../types';

// 사용 가능한 모델 목록
export const AI_MODELS: AIModel[] = [
  // Gemini
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', inputPricePerMToken: 0.15, outputPricePerMToken: 0.60 },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', inputPricePerMToken: 0.10, outputPricePerMToken: 0.40 },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', provider: 'gemini', inputPricePerMToken: 0.075, outputPricePerMToken: 0.30 },
  // OpenAI
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', inputPricePerMToken: 0.15, outputPricePerMToken: 0.60 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', inputPricePerMToken: 2.50, outputPricePerMToken: 10.00 },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai', inputPricePerMToken: 0.10, outputPricePerMToken: 0.40 },
  // Claude
  { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku', provider: 'claude', inputPricePerMToken: 0.80, outputPricePerMToken: 4.00 },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet', provider: 'claude', inputPricePerMToken: 3.00, outputPricePerMToken: 15.00 },
];

// thinking 모델 판별 (gemini 2.5 계열)
export const isThinkingModel = (modelId: string) => modelId.startsWith('gemini-2.5');

export const DEFAULT_PROMPT_TEMPLATE = `당신은 학원 선생님입니다. 아래 학생의 월말평가 데이터를 바탕으로 학부모에게 전달할 종합평가를 작성해주세요.

학생: {{학생이름}} ({{학년}})
평가 기간: {{연월}}

[과목별 성적]
{{과목별점수}}

[과목별 선생님 코멘트]
{{과목별코멘트}}

[최근 6개월 성적 추이]
{{6개월추이}}

작성 가이드:
- 학부모가 읽기 편한 따뜻한 톤으로 작성
- 잘한 점을 먼저 언급하고, 개선할 부분을 건설적으로 제시
- 구체적인 학습 조언 포함
- 3~5문장으로 작성
- 한국어로 작성`;

const defaultAISettings: AISettings = {
  defaultProvider: 'gemini',
  defaultModel: 'gemini-2.5-flash',
  promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  generationCount: 3,
  maxTokens: 500,
};

interface AIState {
  // AI 설정
  aiSettings: AISettings;
  setAISettings: (settings: Partial<AISettings>) => void;

  // 사용량 기록
  usageRecords: AIUsageRecord[];
  addUsageRecord: (record: Omit<AIUsageRecord, 'month'>) => void;
  getMonthlyUsage: (month: string) => AIUsageRecord[];
  getTotalMonthlyStats: (month: string) => { callCount: number; inputTokens: number; outputTokens: number; estimatedCost: number };

  // AI 생성 상태
  isGenerating: boolean;
  generatedVersions: string[];
  setIsGenerating: (v: boolean) => void;
  setGeneratedVersions: (versions: string[]) => void;

  // AI 생성 실행
  generateEvaluation: (request: AIGenerationRequest) => Promise<AIGenerationResult>;
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      // AI 설정
      aiSettings: defaultAISettings,
      setAISettings: (settings) => set((state) => ({
        aiSettings: { ...state.aiSettings, ...settings },
      })),

      // 사용량
      usageRecords: [],
      addUsageRecord: (record) => {
        const month = new Date().toISOString().slice(0, 7); // "2026-02"
        set((state) => ({
          usageRecords: [...state.usageRecords, { ...record, month }],
        }));
      },
      getMonthlyUsage: (month) => {
        return get().usageRecords.filter((r) => r.month === month);
      },
      getTotalMonthlyStats: (month) => {
        const records = get().usageRecords.filter((r) => r.month === month);
        return records.reduce(
          (acc, r) => ({
            callCount: acc.callCount + r.callCount,
            inputTokens: acc.inputTokens + r.inputTokens,
            outputTokens: acc.outputTokens + r.outputTokens,
            estimatedCost: acc.estimatedCost + r.estimatedCost,
          }),
          { callCount: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0 }
        );
      },

      // 생성 상태
      isGenerating: false,
      generatedVersions: [],
      setIsGenerating: (v) => set({ isGenerating: v }),
      setGeneratedVersions: (versions) => set({ generatedVersions: versions }),

      // AI 생성 실행 (IPC 호출)
      generateEvaluation: async (request) => {
        set({ isGenerating: true, generatedVersions: [] });
        try {
          if (window.wawaAPI?.aiGenerate) {
            const raw = await window.wawaAPI.aiGenerate(request);
            const result: AIGenerationResult = {
              success: raw.success,
              versions: raw.versions || [],
              usage: raw.usage ? {
                inputTokens: raw.usage.inputTokens,
                outputTokens: raw.usage.outputTokens,
                model: raw.usage.model,
                provider: raw.usage.provider as AIProvider,
              } : undefined,
              error: raw.error,
            };
            if (result.success && result.versions.length > 0) {
              set({ generatedVersions: result.versions });
              // 사용량 기록
              if (result.usage) {
                const model = AI_MODELS.find((m) => m.id === result.usage!.model);
                const inputCost = model ? (result.usage!.inputTokens / 1_000_000) * model.inputPricePerMToken : 0;
                const outputCost = model ? (result.usage!.outputTokens / 1_000_000) * model.outputPricePerMToken : 0;
                get().addUsageRecord({
                  provider: result.usage!.provider,
                  model: result.usage!.model,
                  callCount: 1,
                  inputTokens: result.usage!.inputTokens,
                  outputTokens: result.usage!.outputTokens,
                  estimatedCost: inputCost + outputCost,
                });
              }
            }
            return result;
          }
          // Electron 환경이 아닌 경우 (개발용 fallback)
          return { success: false, versions: [], error: 'AI API는 Electron 환경에서만 사용 가능합니다.' } as AIGenerationResult;
        } catch (error: any) {
          return { success: false, versions: [], error: error.message || 'AI 생성 중 오류가 발생했습니다.' } as AIGenerationResult;
        } finally {
          set({ isGenerating: false });
        }
      },
    }),
    {
      name: 'wawa-ai-settings',
      partialize: (state) => ({
        aiSettings: state.aiSettings,
        usageRecords: state.usageRecords,
      }),
    }
  )
);
