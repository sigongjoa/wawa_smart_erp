// src/types/index.ts에서 CurrentUser 인터페이스를 임포트합니다.
import { CurrentUser } from '../types';

/**
 * @interface SkillParameter
 * @description 스킬이 요구하는 개별 파라미터의 정의
 */
export interface SkillParameter {
  name: string; // 파라미터의 이름
  type: 'string' | 'number' | 'boolean' | 'date'; // 파라미터의 타입
  description: string; // 파라미터에 대한 설명 (한국어)
  required: boolean; // 이 파라미터가 필수인지 여부
  enum?: string[]; // (선택 사항) 파라미터가 가질 수 있는 값들의 목록 (열거형)
}

/**
 * @interface SkillDefinition
 * @description LLM Skill System에서 사용될 개별 스킬의 정의
 */
export interface SkillDefinition {
  name: string; // 스킬의 고유한 이름 (영어)
  description: string; // 스킬에 대한 설명 (한국어)
  module: string; // 스킬이 속한 모듈 (예: 'timer', 'report')
  type: 'read' | 'write' | 'navigate'; // 스킬의 동작 타입: 읽기, 쓰기, 화면 이동
  parameters: SkillParameter[]; // 스킬 실행에 필요한 파라미터 목록
  requiresConfirmation: boolean; // 스킬 실행 전에 사용자 확인이 필요한지 여부
}

/**
 * @interface SkillResult
 * @description 스킬 실행 결과
 */
export interface SkillResult {
  success: boolean; // 스킬 실행 성공 여부
  data?: any; // 스킬 실행 결과로 반환될 데이터 (성공 시)
  message?: string; // 사용자에게 표시할 메시지
  error?: string; // 에러 발생 시 에러 메시지
  uiAction?: {
    type: 'navigate' | 'prefill' | 'confirm'; // UI 액션 타입
    payload: any; // UI 액션에 필요한 페이로드
  };
}

/**
 * @interface SkillExecuteContext
 * @description 스킬 실행 시 제공되는 컨텍스트 정보
 */
export interface SkillExecuteContext {
  currentUser: CurrentUser; // 현재 로그인한 사용자 정보
  currentModule: string; // 현재 활성화된 모듈 (예: 'timer', 'report')
  currentYearMonth: string; // 현재 보고 있는 연월 (YYYY-MM)
}

/**
 * @interface ChatMessage
 * @description 채팅 세션 내 개별 메시지
 */
export interface ChatMessage {
  id: string; // 메시지 고유 ID
  role: 'user' | 'assistant' | 'system' | 'tool'; // 메시지 발신자 역할
  content: string; // 메시지 내용
  timestamp: string; // 메시지 생성 시간 (ISO 8601 형식)
  toolCall?: { // 툴 호출 정보 (role이 'tool'일 경우)
    skillName: string; // 호출된 스킬의 이름
    parameters: Record<string, any>; // 스킬에 전달된 파라미터
    result?: SkillResult; // (선택 사항) 스킬 실행 결과
    status: 'pending' | 'confirmed' | 'executed' | 'rejected'; // 툴 호출 상태
  };
}

/**
 * @interface ChatSession
 * @description 단일 채팅 세션의 정보
 */
export interface ChatSession {
  id: string; // 채팅 세션 고유 ID
  messages: ChatMessage[]; // 세션 내 메시지 목록
  createdAt: string; // 세션 생성 시간 (ISO 8601 형식)
  title?: string; // (선택 사항) 채팅 세션의 제목
}

/**
 * @type LLMProvider
 * @description LLM(대규모 언어 모델) 제공자 타입
 */
export type LLMProvider = 'local' | 'gemini' | 'openai' | 'claude';

/**
 * @interface LLMChatRequest
 * @description LLM에게 전송할 채팅 요청 데이터 구조
 */
export interface LLMChatRequest {
  messages: Array<{ role: string; content: string }>; // LLM에 전달할 메시지 배열
  tools?: ToolDefinition[]; // (선택 사항) LLM이 사용할 수 있는 툴 정의 목록
  provider: LLMProvider; // 사용할 LLM 제공자
  model?: string; // (선택 사항) 사용할 LLM 모델 이름
  maxTokens?: number; // (선택 사항) 생성할 최대 토큰 수
}

/**
 * @interface LLMChatResponse
 * @description LLM으로부터 받은 채팅 응답 데이터 구조
 */
export interface LLMChatResponse {
  content: string; // LLM이 생성한 텍스트 응답
  toolCalls?: Array<{ name: string; arguments: Record<string, any> }>; // (선택 사항) LLM이 호출을 요청한 툴 목록
  usage?: { // (선택 사항) 토큰 사용량 정보
    inputTokens: number; // 입력 토큰 수
    outputTokens: number; // 출력 토큰 수
  };
}

/**
 * @interface ToolDefinition
 * @description LLM에게 제공될 툴의 정의
 */
export interface ToolDefinition {
  name: string; // 툴의 이름
  description: string; // 툴의 설명
  parameters: {
    type: 'object';
    properties: Record<string, any>; // 툴 파라미터의 속성 정의
    required: string[]; // 필수 파라미터 목록
  };
}
