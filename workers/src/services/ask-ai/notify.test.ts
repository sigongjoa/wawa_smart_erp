/**
 * UC-11 — 강사 코멘트 → 학생 알림 (push + in-app)
 *
 * 실제 push send는 외부 서비스. 여기서는 알림 message 빌더만 검증.
 */

import { describe, it, expect } from 'vitest';
import { buildCommentNotification, buildAiWrongWarning, shouldRateLimit } from './notify';

describe('buildCommentNotification — UC-11', () => {
  it('강사 이름 + 단원 + 미리보기 포함', () => {
    const n = buildCommentNotification({
      teacher_name: '서재용',
      student_name: '이루다',
      unit: '확통 III-1',
      comment: '4단계 빈칸 답해서 다시 보내봐.',
    });
    expect(n.title).toContain('서재용');
    expect(n.body).toContain('확통');
    expect(n.body.length).toBeLessThanOrEqual(120);  // 푸시 제한
  });

  it('긴 코멘트는 80자 + … 로 잘림', () => {
    const long = 'a'.repeat(200);
    const n = buildCommentNotification({
      teacher_name: '서재용',
      student_name: '이루다',
      unit: '수II',
      comment: long,
    });
    expect(n.body).toContain('…');
    expect(n.body.length).toBeLessThan(150);
  });

  it('deeplink는 해당 대화로', () => {
    const n = buildCommentNotification({
      teacher_name: '서재용',
      student_name: '이루다',
      unit: '수II',
      comment: 'OK',
      conversation_id: 'c-uuid-123',
    });
    expect(n.deeplink).toContain('c-uuid-123');
  });
});

describe('buildAiWrongWarning', () => {
  it('"AI 답이 틀렸다고 선생님이 표시" 메시지', () => {
    const n = buildAiWrongWarning({
      student_name: '이루다',
      teacher_name: '서재용',
      unit: '확통',
    });
    expect(n.title).toMatch(/AI|선생님/);
    expect(n.body).toMatch(/틀|확인/);
  });
});

describe('shouldRateLimit — 푸시 폭주 방지', () => {
  it('10분 이내 같은 학생에게 3개 이상 → rate limit', () => {
    const recent = [
      { sent_at: '2026-05-15T14:00:00Z' },
      { sent_at: '2026-05-15T14:03:00Z' },
      { sent_at: '2026-05-15T14:05:00Z' },
    ];
    expect(shouldRateLimit(recent, '2026-05-15T14:08:00Z')).toBe(true);
  });

  it('10분 이상 지났으면 OK', () => {
    const recent = [
      { sent_at: '2026-05-15T13:30:00Z' },
    ];
    expect(shouldRateLimit(recent, '2026-05-15T14:00:00Z')).toBe(false);
  });

  it('빈 배열은 OK', () => {
    expect(shouldRateLimit([], '2026-05-15T14:00:00Z')).toBe(false);
  });
});
