/**
 * UC-02 — 학생 일일 한도 (30회 질문 / 10장 사진) 테스트
 *
 * Given-When-Then:
 *   "학생의 오늘 questions 카운트 = 30
 *    When 학생이 새 질문 보내기 탭하면
 *    Then send 버튼이 disabled 상태가 되고
 *    And  '오늘 한도 도달' 토스트 표시
 *    And  서버 호출 안 일어남"
 *
 * 시간대: Asia/Seoul (학원 기준). UTC가 아님 — 자정 기준이 한국 자정.
 *
 * KV/DB 의존성 없이 순수 함수로 테스트 가능하게 설계:
 *   checkQuota(state, kind) → { allowed, reason? }
 *   incrementQuota(state, kind) → state'  (불변)
 */

import { describe, it, expect } from 'vitest';
import { checkQuota, incrementQuota, freshQuotaState, isStaleForToday } from './quota';
import type { QuotaState } from '@/schemas/ask-ai';

const TODAY = '2026-05-15';
const STUDENT_ID = 'iruda-001';

describe('freshQuotaState', () => {
  it('새 학생/새 날짜는 limit 30/10, used 0/0', () => {
    const s = freshQuotaState(STUDENT_ID, TODAY);
    expect(s.questions_used).toBe(0);
    expect(s.questions_limit).toBe(30);
    expect(s.photos_used).toBe(0);
    expect(s.photos_limit).toBe(10);
    expect(s.date).toBe(TODAY);
  });
});

describe('checkQuota — UC-02', () => {
  it('한도 미만이면 allowed=true', () => {
    const state: QuotaState = {
      student_id: STUDENT_ID, date: TODAY,
      questions_used: 22, questions_limit: 30,
      photos_used: 3, photos_limit: 10,
    };
    expect(checkQuota(state, 'question')).toMatchObject({ allowed: true, remaining: 8 });
    expect(checkQuota(state, 'photo')).toMatchObject({ allowed: true, remaining: 7 });
  });

  it('질문 30/30 정확히 도달 시 allowed=false', () => {
    const state: QuotaState = {
      student_id: STUDENT_ID, date: TODAY,
      questions_used: 30, questions_limit: 30,
      photos_used: 0, photos_limit: 10,
    };
    const r = checkQuota(state, 'question');
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/오늘 한도/);
  });

  it('사진 10/10 도달 시 allowed=false (질문은 별개)', () => {
    const state: QuotaState = {
      student_id: STUDENT_ID, date: TODAY,
      questions_used: 5, questions_limit: 30,
      photos_used: 10, photos_limit: 10,
    };
    expect(checkQuota(state, 'photo').allowed).toBe(false);
    expect(checkQuota(state, 'question').allowed).toBe(true);
  });
});

describe('incrementQuota', () => {
  it('질문 1회 → questions_used +1, 다른 필드 불변', () => {
    const before: QuotaState = {
      student_id: STUDENT_ID, date: TODAY,
      questions_used: 5, questions_limit: 30,
      photos_used: 2, photos_limit: 10,
    };
    const after = incrementQuota(before, 'question');
    expect(after.questions_used).toBe(6);
    expect(after.photos_used).toBe(2);  // 불변
    expect(after).not.toBe(before);  // 새 객체 (immutable)
  });

  it('사진 1장 → photos_used +1', () => {
    const before: QuotaState = {
      student_id: STUDENT_ID, date: TODAY,
      questions_used: 5, questions_limit: 30,
      photos_used: 2, photos_limit: 10,
    };
    const after = incrementQuota(before, 'photo');
    expect(after.photos_used).toBe(3);
    expect(after.questions_used).toBe(5);
  });

  it('한도 초과 시 throws (이중 안전장치)', () => {
    const atLimit: QuotaState = {
      student_id: STUDENT_ID, date: TODAY,
      questions_used: 30, questions_limit: 30,
      photos_used: 0, photos_limit: 10,
    };
    expect(() => incrementQuota(atLimit, 'question')).toThrow(/quota exceeded/i);
  });
});

describe('isStaleForToday — 자정 기준 reset', () => {
  it('어제 state는 stale', () => {
    const yesterday: QuotaState = {
      student_id: STUDENT_ID, date: '2026-05-14',
      questions_used: 28, questions_limit: 30,
      photos_used: 9, photos_limit: 10,
    };
    expect(isStaleForToday(yesterday, TODAY)).toBe(true);
  });

  it('오늘 state는 fresh', () => {
    const today: QuotaState = {
      student_id: STUDENT_ID, date: TODAY,
      questions_used: 5, questions_limit: 30,
      photos_used: 0, photos_limit: 10,
    };
    expect(isStaleForToday(today, TODAY)).toBe(false);
  });

  it('미래 날짜도 stale 처리 (시계 오류 안전장치)', () => {
    const future: QuotaState = {
      student_id: STUDENT_ID, date: '2026-05-20',
      questions_used: 5, questions_limit: 30,
      photos_used: 0, photos_limit: 10,
    };
    expect(isStaleForToday(future, TODAY)).toBe(true);
  });
});
