// apps/desktop/src/stores/chatStore.ts

import { create } from 'zustand';
import type { ChatMessage, ChatSession, LLMProvider, SkillResult } from '../skills/types';

// Helper function to generate unique IDs
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

/**
 * @interface ChatState
 * @description AI 채팅 위젯의 상태를 정의합니다.
 */
interface ChatState {
  // 채팅 위젯 열림 상태
  isOpen: boolean;
  // LLM 응답 대기 중 여부
  isProcessing: boolean;
  // 현재 활성화된 채팅 세션
  currentSession: ChatSession | null;
  // 과거 채팅 세션 목록
  sessions: ChatSession[];
  // 현재 선택된 LLM 프로바이더 (기본 'gemini')
  provider: LLMProvider;
  // 현재 선택된 LLM 모델 (기본 'gemini-2.5-flash')
  model: string;
  // 사용자 확인 대기 중인 tool call 메시지
  pendingConfirmation: ChatMessage | null;

  // 액션들
  toggleWidget: () => void;
  openWidget: () => void;
  closeWidget: () => void;
  sendMessage: (content: string) => void;
  addAssistantMessage: (content: string, toolCall?: ChatMessage['toolCall']) => void;
  confirmToolCall: (messageId: string) => void;
  rejectToolCall: (messageId: string) => void;
  updateToolCallResult: (messageId: string, result: SkillResult) => void;
  setProcessing: (v: boolean) => void;
  setProvider: (provider: LLMProvider) => void;
  setModel: (model: string) => void;
  setPendingConfirmation: (msg: ChatMessage | null) => void;
  clearSession: () => void;
  newSession: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  isProcessing: false,
  currentSession: null,
  sessions: [],
  provider: 'gemini', // 기본 프로바이더
  model: 'gemini-2.5-flash', // 기본 모델
  pendingConfirmation: null,

  toggleWidget: () => set((state) => ({ isOpen: !state.isOpen })),
  openWidget: () => set({ isOpen: true }),
  closeWidget: () => set({ isOpen: false }),

  // 사용자 메시지 전송
  sendMessage: (content: string) => {
    const { currentSession, newSession } = get();
    // 현재 세션이 없으면 새 세션 생성
    if (!currentSession) {
      newSession(); // 새 세션 생성 후 currentSession 업데이트
    }

    const newMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    set((state) => {
      const updatedSession = state.currentSession
        ? {
            ...state.currentSession,
            messages: [...state.currentSession.messages, newMessage],
          }
        : null; // newSession에서 이미 currentSession을 설정했으므로, 이 경우는 발생하지 않음

      return {
        currentSession: updatedSession,
        // 필요에 따라 sessions 배열도 업데이트
        sessions: state.sessions.map((s) => (s.id === updatedSession?.id ? updatedSession : s)),
      };
    });
  },

  // 어시스턴트 메시지 추가 (tool call 포함 가능)
  addAssistantMessage: (content: string, toolCall?: ChatMessage['toolCall']) => {
    set((state) => {
      if (!state.currentSession) return state; // 현재 세션이 없으면 추가하지 않음

      const newMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
        toolCall,
      };

      const updatedSession = {
        ...state.currentSession,
        messages: [...state.currentSession.messages, newMessage],
      };

      return {
        currentSession: updatedSession,
        sessions: state.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
      };
    });
  },

  // Tool call을 confirmed 상태로 변경
  confirmToolCall: (messageId: string) => {
    set((state) => {
      if (!state.currentSession) return state;

      const updatedMessages = state.currentSession.messages.map((msg) =>
        msg.id === messageId && msg.toolCall
          ? { ...msg, toolCall: { ...msg.toolCall, status: 'confirmed' } }
          : msg,
      );

      const updatedSession = { ...state.currentSession, messages: updatedMessages };
      return {
        currentSession: updatedSession,
        sessions: state.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
      };
    });
  },

  // Tool call을 rejected 상태로 변경
  rejectToolCall: (messageId: string) => {
    set((state) => {
      if (!state.currentSession) return state;

      const updatedMessages = state.currentSession.messages.map((msg) =>
        msg.id === messageId && msg.toolCall
          ? { ...msg, toolCall: { ...msg.toolCall, status: 'rejected' } }
          : msg,
      );

      const updatedSession = { ...state.currentSession, messages: updatedMessages };
      return {
        currentSession: updatedSession,
        sessions: state.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
      };
    });
  },

  // Tool call 실행 결과를 업데이트하고 상태를 executed로 변경
  updateToolCallResult: (messageId: string, result: SkillResult) => {
    set((state) => {
      if (!state.currentSession) return state;

      const updatedMessages = state.currentSession.messages.map((msg) =>
        msg.id === messageId && msg.toolCall
          ? { ...msg, toolCall: { ...msg.toolCall, result, status: 'executed' } }
          : msg,
      );

      const updatedSession = { ...state.currentSession, messages: updatedMessages };
      return {
        currentSession: updatedSession,
        sessions: state.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
      };
    });
  },

  setProcessing: (v: boolean) => set({ isProcessing: v }),
  setProvider: (provider: LLMProvider) => set({ provider }),
  setModel: (model: string) => set({ model }),
  setPendingConfirmation: (msg: ChatMessage | null) => set({ pendingConfirmation: msg }),

  // 현재 세션 초기화 (메시지 삭제)
  clearSession: () => {
    set((state) => {
      if (!state.currentSession) return state;
      const updatedSession = { ...state.currentSession, messages: [] };
      return {
        currentSession: updatedSession,
        sessions: state.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
      };
    });
  },

  // 새 채팅 세션 시작
  newSession: () => {
    const newSession: ChatSession = {
      id: generateId(),
      messages: [],
      createdAt: new Date().toISOString(),
      title: '새 채팅', // 새 세션의 기본 제목
    };

    set((state) => ({
      currentSession: newSession,
      sessions: [newSession, ...state.sessions], // 새 세션을 목록의 맨 앞에 추가
    }));
  },
}));
