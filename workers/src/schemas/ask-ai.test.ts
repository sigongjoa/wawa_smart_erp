/**
 * UC-04 (응답 스키마 강제) · UC-05 (needs_teacher) · UC-10 (강사 코멘트) 검증
 */

import { describe, it, expect } from 'vitest';
import {
  AskAIResponseSchema,
  AskAIRequestSchema,
  StepSchema,
  TeacherActionRequestSchema,
  SM2StateSchema,
  DrillCardSchema,
} from './ask-ai';

describe('StepSchema (discriminated union by kind)', () => {
  it('explain step 통과', () => {
    expect(() => StepSchema.parse({
      kind: 'explain',
      title: '표본평균은 확률변수다',
      body_md: '매번 표본을 뽑을 때마다 평균값이 바뀜.',
    })).not.toThrow();
  });

  it('checkpoint step 통과', () => {
    expect(() => StepSchema.parse({
      kind: 'checkpoint',
      question: '여기까지 OK?',
    })).not.toThrow();
  });

  it('figure step — function-plot 통과', () => {
    expect(() => StepSchema.parse({
      kind: 'figure',
      spec: { type: 'function-plot', fn: 'x^2', domain: [-3, 3] },
    })).not.toThrow();
  });

  it('annotated_photo step — UC-08 통과', () => {
    expect(() => StepSchema.parse({
      kind: 'annotated_photo',
      source_image_id: 'r2-key-abc',
      annotations: [
        { type: 'box', x: 36, y: 74, w: 240, h: 22, color: 'pen-red' },
        { type: 'note', x: 280, y: 90, text: '↑ 여기!' },
      ],
    })).not.toThrow();
  });

  it('알 수 없는 kind 거부', () => {
    expect(() => StepSchema.parse({
      kind: 'magic',
      anything: 1,
    })).toThrow();
  });

  it('explain 본문 4000자 초과 거부', () => {
    expect(() => StepSchema.parse({
      kind: 'explain',
      title: 'x',
      body_md: 'a'.repeat(4001),
    })).toThrow();
  });
});

describe('AskAIResponseSchema — UC-04 / UC-05', () => {
  const validBaseResponse = {
    steps: [
      { kind: 'explain', title: '정의', body_md: '표본평균 정의' },
      { kind: 'checkpoint', question: '정의 OK?' },
    ],
    references: [],
    confidence: 'high',
    needs_teacher: false,
  };

  it('정상 응답 통과 — checkpoint 1개 이상', () => {
    expect(() => AskAIResponseSchema.parse(validBaseResponse)).not.toThrow();
  });

  it('UC-04 — steps가 비어있으면 거부', () => {
    expect(() => AskAIResponseSchema.parse({
      ...validBaseResponse,
      steps: [],
    })).toThrow();
  });

  it('UC-04 — interactive step 없이 inline_cite/figure만 있으면 거부', () => {
    expect(() => AskAIResponseSchema.parse({
      ...validBaseResponse,
      steps: [
        { kind: 'inline_cite', variant: 'unit', src: '§2.1', quote: 'def' },
        { kind: 'figure', spec: { type: 'function-plot', fn: 'x', domain: [0, 1] } },
      ],
    })).toThrow();
  });

  it('UC-05 — confidence=low인데 needs_teacher=false면 거부', () => {
    expect(() => AskAIResponseSchema.parse({
      ...validBaseResponse,
      confidence: 'low',
      needs_teacher: false,
    })).toThrow(/needs_teacher=true/);
  });

  it('UC-05 — confidence=low + needs_teacher=true 통과', () => {
    expect(() => AskAIResponseSchema.parse({
      ...validBaseResponse,
      confidence: 'low',
      needs_teacher: true,
    })).not.toThrow();
  });

  it('confidence=high + needs_teacher=true 통과 (학생 직접 요청 케이스)', () => {
    expect(() => AskAIResponseSchema.parse({
      ...validBaseResponse,
      confidence: 'high',
      needs_teacher: true,
    })).not.toThrow();
  });

  it('steps 20개 초과 거부 (응답 폭주 방지)', () => {
    const longSteps = Array(21).fill({
      kind: 'explain', title: 'x', body_md: 'y',
    });
    expect(() => AskAIResponseSchema.parse({
      ...validBaseResponse,
      steps: longSteps,
    })).toThrow();
  });
});

describe('AskAIRequestSchema — UC-01, UC-03', () => {
  it('정상 텍스트 질문 통과', () => {
    expect(() => AskAIRequestSchema.parse({
      student_id: 'iruda-001',
      message: '표본평균 분산이 왜 σ²/n인가요?',
      attached_photos: [],
    })).not.toThrow();
  });

  it('사진 첨부 질문 — 5장까지 OK', () => {
    expect(() => AskAIRequestSchema.parse({
      student_id: 'iruda-001',
      message: '이거 봐주세요',
      attached_photos: ['r2-key-1', 'r2-key-2'],
    })).not.toThrow();
  });

  it('사진 6장 이상 거부', () => {
    expect(() => AskAIRequestSchema.parse({
      student_id: 'iruda-001',
      message: '많이도 찍었네',
      attached_photos: Array(6).fill('r2-key'),
    })).toThrow();
  });

  it('빈 메시지 거부', () => {
    expect(() => AskAIRequestSchema.parse({
      student_id: 'iruda-001',
      message: '',
      attached_photos: [],
    })).toThrow();
  });

  it('메시지 2000자 초과 거부 (token 폭주 방지)', () => {
    expect(() => AskAIRequestSchema.parse({
      student_id: 'iruda-001',
      message: 'a'.repeat(2001),
      attached_photos: [],
    })).toThrow();
  });
});

describe('TeacherActionRequestSchema — UC-10', () => {
  const baseAction = {
    conversation_id: '00000000-0000-0000-0000-000000000001',
    teacher_id: 'seo-jaeyong',
  };

  it('OK 결정 — comment 없어도 통과', () => {
    expect(() => TeacherActionRequestSchema.parse({
      ...baseAction,
      decision: 'ok',
    })).not.toThrow();
  });

  it('AI 틀림 결정 — comment 없어도 통과', () => {
    expect(() => TeacherActionRequestSchema.parse({
      ...baseAction,
      decision: 'ai_wrong',
    })).not.toThrow();
  });

  it('UC-10 — comment 결정엔 comment 필수', () => {
    expect(() => TeacherActionRequestSchema.parse({
      ...baseAction,
      decision: 'comment',
      // comment 없음
    })).toThrow(/comment text/);
  });

  it('UC-10 — comment 빈 문자열 거부', () => {
    expect(() => TeacherActionRequestSchema.parse({
      ...baseAction,
      decision: 'comment',
      comment: '',
    })).toThrow();
  });

  it('comment 결정 + 텍스트 통과', () => {
    expect(() => TeacherActionRequestSchema.parse({
      ...baseAction,
      decision: 'comment',
      comment: '4단계 빈칸 답해서 다시 보내봐.',
    })).not.toThrow();
  });

  it('comment 1000자 초과 거부', () => {
    expect(() => TeacherActionRequestSchema.parse({
      ...baseAction,
      decision: 'comment',
      comment: 'a'.repeat(1001),
    })).toThrow();
  });
});

describe('SM2StateSchema — UC-13 데이터 무결성', () => {
  it('정상 state 통과', () => {
    expect(() => SM2StateSchema.parse({
      card_id: '00000000-0000-0000-0000-000000000001',
      ease: 2.5,
      interval_days: 7,
      due_date: '2026-05-22',
      reps: 3,
      lapses: 1,
    })).not.toThrow();
  });

  it('ease 1.3 미만 거부', () => {
    expect(() => SM2StateSchema.parse({
      card_id: '00000000-0000-0000-0000-000000000001',
      ease: 1.0,
      interval_days: 7,
      due_date: '2026-05-22',
      reps: 0,
      lapses: 0,
    })).toThrow();
  });

  it('ease 2.5 초과 거부', () => {
    expect(() => SM2StateSchema.parse({
      card_id: '00000000-0000-0000-0000-000000000001',
      ease: 3.0,
      interval_days: 7,
      due_date: '2026-05-22',
      reps: 0,
      lapses: 0,
    })).toThrow();
  });
});

describe('DrillCardSchema — UC-12', () => {
  it('AskAI 출처 카드 통과', () => {
    expect(() => DrillCardSchema.parse({
      id: '00000000-0000-0000-0000-000000000001',
      student_id: 'iruda-001',
      source: 'askai_failed_checkpoint',
      source_ref: 'conv-uuid-abc',
      unit: '확통 III-1',
      problem_md: '표본평균 분산은?',
      answer_md: 'σ²/n',
      created_at: '2026-05-15T10:00:00Z',
    })).not.toThrow();
  });

  it('알 수 없는 source 거부', () => {
    expect(() => DrillCardSchema.parse({
      id: '00000000-0000-0000-0000-000000000001',
      student_id: 'iruda-001',
      source: 'random_source',
      source_ref: 'x',
      unit: 'x',
      problem_md: 'x',
      answer_md: 'y',
      created_at: '2026-05-15T10:00:00Z',
    })).toThrow();
  });
});
