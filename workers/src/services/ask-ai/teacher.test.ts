/**
 * UC-09 — 강사 큐 fetch
 * UC-10 — 강사 결정 (OK/comment/ai_wrong) 처리
 *
 * D1 의존성은 추상화. 비즈니스 로직만 순수 함수로 테스트.
 */

import { describe, it, expect } from 'vitest';
import { filterQueue, applyDecision, sortQueue } from './teacher';
import type { ConversationSummary } from './teacher';

const SAMPLE_QUEUE: ConversationSummary[] = [
  {
    conversation_id: 'c1', student_id: 'iruda', student_name: '이루다',
    unit: '확통 III-1', confidence: 'high', needs_teacher: false,
    decision: null, comment_count: 0,
    started_at: '2026-05-15T14:02:00Z',
  },
  {
    conversation_id: 'c2', student_id: 'park', student_name: '박동진',
    unit: '수II', confidence: 'medium', needs_teacher: true,
    decision: null, comment_count: 0,
    started_at: '2026-05-15T13:45:00Z',
  },
  {
    conversation_id: 'c3', student_id: 'oharam', student_name: '오하람',
    unit: '논술', confidence: 'high', needs_teacher: false,
    decision: 'ok', comment_count: 0,
    started_at: '2026-05-15T11:20:00Z',
  },
  {
    conversation_id: 'c4', student_id: 'siu', student_name: '김시우',
    unit: '중2 기하', confidence: 'low', needs_teacher: true,
    decision: null, comment_count: 0,
    started_at: '2026-05-15T10:15:00Z',
  },
];

describe('filterQueue — UC-09', () => {
  it('기본은 전부 반환', () => {
    expect(filterQueue(SAMPLE_QUEUE, {})).toHaveLength(4);
  });

  it('needs_teacher 필터', () => {
    const r = filterQueue(SAMPLE_QUEUE, { needsTeacherOnly: true });
    expect(r).toHaveLength(2);
    expect(r.every((c) => c.needs_teacher)).toBe(true);
  });

  it('학생 ID 필터', () => {
    const r = filterQueue(SAMPLE_QUEUE, { student_id: 'iruda' });
    expect(r).toHaveLength(1);
    expect(r[0].student_id).toBe('iruda');
  });

  it('미코멘트만 필터 (decision is null)', () => {
    const r = filterQueue(SAMPLE_QUEUE, { uncommentedOnly: true });
    expect(r.every((c) => c.decision === null)).toBe(true);
    expect(r).toHaveLength(3);  // c3 OK 처리된 거 제외
  });

  it('confidence low 필터', () => {
    const r = filterQueue(SAMPLE_QUEUE, { minConfidence: 'low' });
    // low 이상 모두 (low/medium/high)
    expect(r).toHaveLength(4);
  });

  it('confidence medium 이상만', () => {
    const r = filterQueue(SAMPLE_QUEUE, { minConfidence: 'medium' });
    expect(r).toHaveLength(3);  // c4 (low) 제외
  });

  it('복합 필터 — needs_teacher + 미코멘트', () => {
    const r = filterQueue(SAMPLE_QUEUE, { needsTeacherOnly: true, uncommentedOnly: true });
    expect(r).toHaveLength(2);  // c2, c4
  });
});

describe('sortQueue', () => {
  it('미코멘트 먼저 (default)', () => {
    const r = sortQueue(SAMPLE_QUEUE, 'uncommented_first');
    expect(r[r.length - 1].conversation_id).toBe('c3');  // OK 처리된 게 맨 뒤
  });

  it('시간순 (최신부터)', () => {
    const r = sortQueue(SAMPLE_QUEUE, 'recent');
    expect(r[0].conversation_id).toBe('c1');
    expect(r[r.length - 1].conversation_id).toBe('c4');
  });

  it('needs_teacher 우선 + 시간순', () => {
    const r = sortQueue(SAMPLE_QUEUE, 'needs_teacher_first');
    // c2, c4 (needs_teacher) 먼저, 그 안에서 시간순
    expect(r[0].needs_teacher).toBe(true);
    expect(r[1].needs_teacher).toBe(true);
  });
});

describe('applyDecision — UC-10', () => {
  it('OK 결정 → decision=ok, comment 없음', () => {
    const r = applyDecision({
      conversation_id: 'c1',
      teacher_id: 'seo-jaeyong',
      decision: 'ok',
    });
    expect(r.decision).toBe('ok');
    expect(r.comment).toBeUndefined();
    expect(r.notify_student).toBe(false);
  });

  it('comment 결정 → comment 저장 + 학생 알림', () => {
    const r = applyDecision({
      conversation_id: 'c1',
      teacher_id: 'seo-jaeyong',
      decision: 'comment',
      comment: '4단계 빈칸 답해서 다시 보내봐.',
    });
    expect(r.decision).toBe('comment');
    expect(r.comment).toBe('4단계 빈칸 답해서 다시 보내봐.');
    expect(r.notify_student).toBe(true);
  });

  it('ai_wrong 결정 → 학생에게 경고 + 학습 데이터 적재', () => {
    const r = applyDecision({
      conversation_id: 'c1',
      teacher_id: 'seo-jaeyong',
      decision: 'ai_wrong',
    });
    expect(r.decision).toBe('ai_wrong');
    expect(r.notify_student).toBe(true);
    expect(r.flag_for_training).toBe(true);
  });

  it('comment 결정인데 comment 없으면 throws', () => {
    expect(() => applyDecision({
      conversation_id: 'c1',
      teacher_id: 'seo-jaeyong',
      decision: 'comment',
    })).toThrow(/comment/i);
  });

  it('comment 결정 빈 문자열 throws', () => {
    expect(() => applyDecision({
      conversation_id: 'c1',
      teacher_id: 'seo-jaeyong',
      decision: 'comment',
      comment: '   ',
    })).toThrow(/comment/i);
  });
});
