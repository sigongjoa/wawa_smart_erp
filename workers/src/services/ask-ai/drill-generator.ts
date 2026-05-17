/**
 * UC-12 — drill 카드 자동 생성기
 *
 * 4가지 신호 → DrillCard | null 변환 (순수 함수, side effect 없음).
 *
 * 비즈니스 룰:
 *   - askai_failed_checkpoint: fail_count >= 3 일 때만 (그보다 적으면 노이즈)
 *   - exam_wrong: 1번 오답이라도 즉시 (가장 강한 신호)
 *   - homework_deduction: deduction_points >= 2 일 때만
 *   - unit_xmark: 무조건
 *   - 같은 source + source_ref가 existing에 있으면 null (dedup)
 */

import type { Signal, DrillCard, DrillSource } from '@/schemas/ask-ai';

const ASKAI_FAIL_THRESHOLD = 3;
const HOMEWORK_DEDUCTION_THRESHOLD = 2;

export interface ExistingCardRef {
  id: string;
  source: DrillSource;
  source_ref: string;
}

export interface GenerateDrillCardOpts {
  student_id: string;
  signal: Signal;
  existing: ExistingCardRef[];
  today: string;       // 'YYYY-MM-DD'
  uuidFn: () => string;
}

export function generateDrillCard(opts: GenerateDrillCardOpts): DrillCard | null {
  const { student_id, signal, existing, today, uuidFn } = opts;

  // 임계치 체크 — 신호별 다른 정책
  if (!passesThreshold(signal)) return null;

  // 중복 방지 — 같은 source + source_ref 가 있으면 skip
  const source: DrillSource = signal.kind;
  const source_ref = signalToSourceRef(signal);
  const isDuplicate = existing.some(
    (e) => e.source === source && e.source_ref === source_ref
  );
  if (isDuplicate) return null;

  return {
    id: uuidFn(),
    student_id,
    source,
    source_ref,
    unit: signal.unit,
    problem_md: signal.problem_md,
    answer_md: signal.answer_md,
    context_note: contextNoteFor(signal),
    ai_cite: signal.kind === 'askai_failed_checkpoint' ? signal.ai_cite : undefined,
    created_at: `${today}T00:00:00Z`,
  };
}

export function signalToSourceRef(signal: Signal): string {
  switch (signal.kind) {
    case 'askai_failed_checkpoint': return signal.conversation_id;
    case 'exam_wrong':              return signal.exam_id;
    case 'homework_deduction':      return signal.homework_id;
    case 'unit_xmark':              return signal.unit_problem_id;
  }
}

function passesThreshold(signal: Signal): boolean {
  switch (signal.kind) {
    case 'askai_failed_checkpoint':
      return signal.fail_count >= ASKAI_FAIL_THRESHOLD;
    case 'homework_deduction':
      return signal.deduction_points >= HOMEWORK_DEDUCTION_THRESHOLD;
    case 'exam_wrong':
    case 'unit_xmark':
      return true;
  }
}

function contextNoteFor(signal: Signal): string {
  switch (signal.kind) {
    case 'askai_failed_checkpoint':
      return '너 그때 멈춘 자리 — 막혔던 단계 다시 한 번.';
    case 'exam_wrong':
      return signal.school
        ? `${signal.school} 시험에서 틀린 문제. 같은 함정 또 안 빠지자.`
        : '시험에서 틀린 문제. 다시 풀어보자.';
    case 'homework_deduction':
      return `숙제에서 ${signal.deduction_points}점 감점된 자리. 한 번 더.`;
    case 'unit_xmark':
      return '단원지에서 X 표시한 문제. 이번엔 OK 가자.';
  }
}
