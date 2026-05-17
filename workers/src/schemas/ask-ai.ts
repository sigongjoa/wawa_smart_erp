/**
 * 와와 학원 · 설명 AI 시스템 — Zod 스키마 (데이터 계약)
 *
 * 이 파일은 frontend ↔ orchestrator(Claude) ↔ DB 사이의 모든 데이터 형태를 정의함.
 * UC-01 (텍스트 질문 → AI 응답) · UC-04 (한 줄씩 멈춤 응답) · UC-05 (needs_teacher 플래그)
 * UC-06 (단원지 인용) · UC-07 (OCR 확인) · UC-08 (annotated photo) 의 contract.
 *
 * Claude tool_use 강제 스키마 + frontend Zod 검증 + DB 직렬화 모두 같은 정의 사용.
 */

import { z } from 'zod';

/* ─────────── 공통 enum ─────────── */

export const TypeColorSchema = z.enum([
  'electric', 'water', 'grass', 'psychic', 'ground', 'dragon',
]);

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);

/* ─────────── Step (응답의 기본 단위) — UC-04 ─────────── */

const StepBaseSchema = z.object({
  id: z.string().uuid().optional(),
});

const ExplainStepSchema = StepBaseSchema.extend({
  kind: z.literal('explain'),
  title: z.string().min(1).max(120),       // 단계 제목 (h2)
  body_md: z.string().min(1).max(4000),    // KaTeX inline ($..$) 가능한 마크다운
});

const FigureStepSchema = StepBaseSchema.extend({
  kind: z.literal('figure'),
  spec: z.discriminatedUnion('type', [
    // points-2d: AI 가 xy 샘플 (~30개) 만 보내고 프런트는 SVG polyline.
    // 안전 (eval 없음) + 가벼움. y=f(x) 그래프, 데이터 분포, 함수 영역 표시 등.
    z.object({
      type: z.literal('points-2d'),
      xs: z.array(z.number()).min(2).max(200),
      ys: z.array(z.number()).min(2).max(200),
      xlabel: z.string().max(40).optional(),
      ylabel: z.string().max(40).optional(),
      // 부가 표시 (선택) — 점/선 강조용
      markers: z.array(z.object({
        x: z.number(), y: z.number(),
        label: z.string().max(40).optional(),
      })).max(10).optional(),
    }),
    z.object({
      type: z.literal('function-plot'),
      fn: z.string(),                      // 'x^2 + 2x + 1' — 향후 확장
      domain: z.tuple([z.number(), z.number()]),
      range: z.tuple([z.number(), z.number()]).optional(),
    }),
    z.object({
      type: z.literal('jsxgraph'),
      definition: z.string(),
    }),
    z.object({
      type: z.literal('cetz'),
      code: z.string(),
    }),
  ]),
  caption: z.string().max(300).optional(),
});

const CheckpointStepSchema = StepBaseSchema.extend({
  kind: z.literal('checkpoint'),
  question: z.string().min(1).max(200),    // "여기까지 OK?"
  required: z.boolean().default(true),     // false면 학생이 통과 안 해도 다음 step 보임
});

// UC-07 — 사진 인식 결과 확인 게이트
const OcrConfirmStepSchema = StepBaseSchema.extend({
  kind: z.literal('ocr_confirm'),
  source_image_id: z.string(),             // 원본 사진 R2 key
  parsed_latex: z.string().min(1),         // AI가 읽은 결과
  source_kind: z.enum(['textbook', 'student_work']),
  ocr_confidence: ConfidenceSchema,
});

// UC-08 — 빨간펜 채점 오버레이
const AnnotationSchema = z.object({
  type: z.enum(['box', 'strike', 'check', 'note']),
  x: z.number(),                            // SVG viewBox 좌표
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
  text: z.string().max(200).optional(),
  color: z.enum(['pen-red', 'success', 'ink']).default('pen-red'),
});

const AnnotatedPhotoStepSchema = StepBaseSchema.extend({
  kind: z.literal('annotated_photo'),
  source_image_id: z.string(),
  annotations: z.array(AnnotationSchema).min(1).max(20),
});

const InlineCiteStepSchema = StepBaseSchema.extend({
  kind: z.literal('inline_cite'),
  variant: z.enum(['unit', 'student-meta']),
  src: z.string(),                          // 단원지 §2.1 또는 _meta.json 라인
  page: z.number().int().positive().optional(),
  quote: z.string().min(1).max(500),
});

export const StepSchema = z.discriminatedUnion('kind', [
  ExplainStepSchema,
  FigureStepSchema,
  CheckpointStepSchema,
  OcrConfirmStepSchema,
  AnnotatedPhotoStepSchema,
  InlineCiteStepSchema,
]);
export type Step = z.infer<typeof StepSchema>;

/* ─────────── References (학원 자료 인용) — UC-06 ─────────── */

export const ReferenceSchema = z.object({
  unit: z.string(),                         // "확통 III-1 §2.1"
  page: z.number().int().positive().optional(),
  quote: z.string().max(500),
  doc_id: z.string().optional(),            // by-curriculum/.../section.json 식별자
});
export type Reference = z.infer<typeof ReferenceSchema>;

/* ─────────── 전체 AI 응답 — UC-04, UC-05 ─────────── */

export const AskAIResponseSchema = z.object({
  steps: z.array(StepSchema).min(1).max(20),
  references: z.array(ReferenceSchema).max(10).default([]),
  confidence: ConfidenceSchema,
  needs_teacher: z.boolean().default(false),
  used_tokens: z.number().int().nonnegative().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
}).refine(
  // UC-04 — 마지막 step은 반드시 checkpoint (final step 제외 — 마무리)
  (data) => {
    const interactiveSteps = data.steps.filter(s => s.kind !== 'inline_cite' && s.kind !== 'figure');
    if (interactiveSteps.length === 0) return false;
    return true;
  },
  { message: 'response must have at least one explain/checkpoint step' }
).refine(
  // UC-05 — confidence가 low면 needs_teacher 자동 true
  (data) => data.confidence !== 'low' || data.needs_teacher === true,
  { message: 'confidence=low requires needs_teacher=true' }
);
export type AskAIResponse = z.infer<typeof AskAIResponseSchema>;

/* ─────────── 학생 질문 요청 — UC-01, UC-03 ─────────── */

export const AskAIRequestSchema = z.object({
  student_id: z.string().min(1),
  unit_id: z.string().optional(),           // "확통 III-1 표본분포"
  message: z.string().min(1).max(2000),
  attached_photos: z.array(z.string()).max(5).default([]),  // R2 keys
  resume_session_id: z.string().uuid().optional(),
});
export type AskAIRequest = z.infer<typeof AskAIRequestSchema>;

/* ─────────── Drill — UC-12, UC-13 ─────────── */

export const DrillSourceSchema = z.enum([
  'askai_failed_checkpoint',  // UC-12 신호 1
  'exam_wrong',               // UC-12 신호 2 (가장 강함)
  'homework_deduction',       // UC-12 신호 3
  'unit_xmark',               // UC-12 신호 4
]);
export type DrillSource = z.infer<typeof DrillSourceSchema>;

export const DrillCardSchema = z.object({
  id: z.string().uuid(),
  student_id: z.string(),
  source: DrillSourceSchema,
  source_ref: z.string(),                   // 원본 conversation_id / homework_id 등
  unit: z.string(),
  problem_md: z.string().min(1),            // 문제 본문 (KaTeX 가능)
  answer_md: z.string().min(1),
  context_note: z.string().max(300).optional(),  // "너 그때 멈춘 자리..."
  ai_cite: z.string().max(300).optional(),
  created_at: z.string().datetime(),
});
export type DrillCard = z.infer<typeof DrillCardSchema>;

export const SM2StateSchema = z.object({
  card_id: z.string().uuid(),
  ease: z.number().min(1.3).max(2.5),       // 난이도 계수
  interval_days: z.number().int().nonnegative(),
  due_date: z.string().date(),              // YYYY-MM-DD
  reps: z.number().int().nonnegative(),     // 누적 복습 횟수
  lapses: z.number().int().nonnegative(),   // "모름/어려움" 누적
});
export type SM2State = z.infer<typeof SM2StateSchema>;

export const RatingSchema = z.enum(['easy', 'ok', 'hard', 'dunno']);
export type Rating = z.infer<typeof RatingSchema>;

/* ─────────── Drill Signals — UC-12 입력 4종 ─────────── */

export const SignalSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('askai_failed_checkpoint'),
    conversation_id: z.string().uuid(),
    step_id: z.string(),
    fail_count: z.number().int().nonnegative(),  // 누적 "다시" 횟수
    problem_md: z.string().min(1).max(2000),
    answer_md: z.string().min(1).max(2000),
    unit: z.string(),
    ai_cite: z.string().max(300).optional(),
  }),
  z.object({
    kind: z.literal('exam_wrong'),
    exam_id: z.string(),
    problem_md: z.string().min(1).max(2000),
    answer_md: z.string().min(1).max(2000),
    unit: z.string(),
    school: z.string().optional(),
  }),
  z.object({
    kind: z.literal('homework_deduction'),
    homework_id: z.string(),
    problem_md: z.string().min(1).max(2000),
    answer_md: z.string().min(1).max(2000),
    unit: z.string(),
    deduction_points: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('unit_xmark'),
    unit_problem_id: z.string(),
    problem_md: z.string().min(1).max(2000),
    answer_md: z.string().min(1).max(2000),
    unit: z.string(),
  }),
]);
export type Signal = z.infer<typeof SignalSchema>;

/* ─────────── Quota — UC-02 ─────────── */

export const QuotaStateSchema = z.object({
  student_id: z.string(),
  date: z.string().date(),                  // YYYY-MM-DD (학생 timezone Asia/Seoul)
  questions_used: z.number().int().nonnegative(),
  questions_limit: z.number().int().positive().default(30),
  photos_used: z.number().int().nonnegative(),
  photos_limit: z.number().int().positive().default(10),
});
export type QuotaState = z.infer<typeof QuotaStateSchema>;

/* ─────────── Teacher Decision — UC-10 ─────────── */

export const TeacherDecisionSchema = z.enum(['ok', 'comment', 'ai_wrong']);
export type TeacherDecision = z.infer<typeof TeacherDecisionSchema>;

export const TeacherActionRequestSchema = z.object({
  conversation_id: z.string().uuid(),
  teacher_id: z.string(),
  decision: TeacherDecisionSchema,
  comment: z.string().max(1000).optional(),
}).refine(
  // UC-10 — comment 결정엔 comment 필수
  (data) => data.decision !== 'comment' || (data.comment !== undefined && data.comment.length > 0),
  { message: 'comment decision requires non-empty comment text' }
);
export type TeacherActionRequest = z.infer<typeof TeacherActionRequestSchema>;
