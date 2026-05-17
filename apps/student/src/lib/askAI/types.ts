/**
 * AskAI 공유 타입 — workers/src/schemas/ask-ai.ts와 동일 형태.
 *
 * 미래에는 monorepo packages로 추출. 지금은 frontend가 알아야 할 최소 타입만 복제.
 */

export type Confidence = 'high' | 'medium' | 'low';

export type Step =
  | { kind: 'explain'; title: string; body_md: string; id?: string }
  | { kind: 'figure'; spec: FigureSpec; caption?: string; id?: string }
  | { kind: 'checkpoint'; question: string; required?: boolean; id?: string }
  | { kind: 'ocr_confirm'; source_image_id: string; parsed_latex: string; source_kind: 'textbook' | 'student_work'; ocr_confidence: Confidence; id?: string }
  | { kind: 'annotated_photo'; source_image_id: string; annotations: Annotation[]; id?: string }
  | { kind: 'inline_cite'; variant: 'unit' | 'student-meta'; src: string; page?: number; quote: string; id?: string };

export interface FigureSpec {
  type: 'function-plot' | 'jsxgraph' | 'cetz';
  fn?: string;
  domain?: [number, number];
  range?: [number, number];
  definition?: string;
  code?: string;
}

export interface Annotation {
  type: 'box' | 'strike' | 'check' | 'note';
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  color?: 'pen-red' | 'success' | 'ink';
}

export interface Reference {
  unit: string;
  page?: number;
  quote: string;
  doc_id?: string;
}

export interface AskAIResponse {
  steps: Step[];
  references: Reference[];
  confidence: Confidence;
  needs_teacher: boolean;
  used_tokens?: number;
  duration_ms?: number;
}

export interface AskAIResult {
  conversation_id: string;
  response: AskAIResponse;
  quota_remaining: { questions: number; photos: number };
}

export type Rating = 'easy' | 'ok' | 'hard' | 'dunno';

export interface QuotaSummary {
  questions: { used: number; limit: number };
  photos: { used: number; limit: number };
  date: string;
}
