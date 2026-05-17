/**
 * UC-09 — 강사 큐 (대화 리스트 fetch + 필터·정렬)
 * UC-10 — 강사 결정 처리 (OK / comment / ai_wrong)
 *
 * D1 의존성은 호출자 책임. 여기엔 순수 비즈니스 로직.
 */

import type { TeacherDecision, ConfidenceSchema } from '@/schemas/ask-ai';
import { z } from 'zod';

type Confidence = z.infer<typeof ConfidenceSchema>;

export interface ConversationSummary {
  conversation_id: string;
  student_id: string;
  student_name: string;
  unit: string;
  confidence: Confidence;
  needs_teacher: boolean;
  decision: TeacherDecision | null;
  comment_count: number;
  started_at: string;        // ISO datetime
}

export interface FilterOpts {
  needsTeacherOnly?: boolean;
  uncommentedOnly?: boolean;   // decision === null
  student_id?: string;
  minConfidence?: Confidence;  // 'low' = all, 'medium' = medium+high, 'high' = high only
}

export type SortMode = 'recent' | 'uncommented_first' | 'needs_teacher_first';

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function filterQueue(queue: ConversationSummary[], opts: FilterOpts): ConversationSummary[] {
  return queue.filter((c) => {
    if (opts.needsTeacherOnly && !c.needs_teacher) return false;
    if (opts.uncommentedOnly && c.decision !== null) return false;
    if (opts.student_id && c.student_id !== opts.student_id) return false;
    if (opts.minConfidence) {
      const min = CONFIDENCE_RANK[opts.minConfidence];
      if (CONFIDENCE_RANK[c.confidence] < min) return false;
    }
    return true;
  });
}

export function sortQueue(queue: ConversationSummary[], mode: SortMode): ConversationSummary[] {
  const arr = [...queue];
  switch (mode) {
    case 'recent':
      arr.sort((a, b) => b.started_at.localeCompare(a.started_at));
      break;
    case 'uncommented_first':
      arr.sort((a, b) => {
        if ((a.decision === null) !== (b.decision === null)) {
          return a.decision === null ? -1 : 1;
        }
        return b.started_at.localeCompare(a.started_at);
      });
      break;
    case 'needs_teacher_first':
      arr.sort((a, b) => {
        if (a.needs_teacher !== b.needs_teacher) {
          return a.needs_teacher ? -1 : 1;
        }
        return b.started_at.localeCompare(a.started_at);
      });
      break;
  }
  return arr;
}

export interface DecisionRequest {
  conversation_id: string;
  teacher_id: string;
  decision: TeacherDecision;
  comment?: string;
}

export interface DecisionResult {
  conversation_id: string;
  teacher_id: string;
  decision: TeacherDecision;
  comment?: string;
  notify_student: boolean;       // 학생 알림 트리거 여부
  flag_for_training: boolean;    // ai_wrong → 학습 데이터 적재
  applied_at: string;
}

export function applyDecision(req: DecisionRequest): DecisionResult {
  // UC-10 — comment 결정엔 비어있지 않은 comment 필수
  if (req.decision === 'comment') {
    if (!req.comment || req.comment.trim().length === 0) {
      throw new Error('comment decision requires non-empty comment text');
    }
  }

  return {
    conversation_id: req.conversation_id,
    teacher_id: req.teacher_id,
    decision: req.decision,
    comment: req.decision === 'comment' ? req.comment : undefined,
    notify_student: req.decision !== 'ok',  // OK 외에는 알림
    flag_for_training: req.decision === 'ai_wrong',
    applied_at: new Date().toISOString(),
  };
}
