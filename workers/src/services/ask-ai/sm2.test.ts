/**
 * UC-13 — SM-2 알고리즘 테스트
 *
 * Given-When-Then 시나리오 (use case 명세에서 직접 옮김):
 *   "쉬움: ease ↑ 0.15, interval ×1.3 → 7일 후 (첫 review 시)"
 *   "적당: ease 유지, interval × ease → 3일 후 (2회차)"
 *   "어려움: ease ↓ 0.15, interval ×1.0 → 1일 후"
 *   "모름: interval = 0, ease ↓ 0.20, → 즉시 mobile-chat 진입 (re_enter_chat)"
 */

import { describe, it, expect } from 'vitest';
import { nextSM2, initialSM2State } from './sm2';
import type { SM2State } from '@/schemas/ask-ai';

const TODAY = '2026-05-15';
const FRESH_CARD: SM2State = {
  card_id: '00000000-0000-0000-0000-000000000001',
  ease: 2.5,
  interval_days: 1,
  due_date: TODAY,
  reps: 0,
  lapses: 0,
};

describe('initialSM2State', () => {
  it('새 카드는 ease=2.5, interval=1, 내일 due, reps/lapses=0', () => {
    const s = initialSM2State('00000000-0000-0000-0000-000000000001', TODAY);
    expect(s.ease).toBe(2.5);
    expect(s.interval_days).toBe(1);
    expect(s.due_date).toBe('2026-05-16');
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(0);
  });
});

describe('nextSM2 — UC-13 자가평가', () => {
  describe('"쉬움"', () => {
    it('첫 review에서 쉬움 → 7일 후 due, ease ↑', () => {
      const r = nextSM2(FRESH_CARD, 'easy', TODAY);
      expect(r.next_state.interval_days).toBe(7);
      expect(r.next_state.due_date).toBe('2026-05-22');
      expect(r.next_state.ease).toBe(2.5);  // 이미 max니까 안 올라감
      expect(r.re_enter_chat).toBe(false);
    });

    it('2회차 이상에서 쉬움 → interval ×1.3', () => {
      const card: SM2State = { ...FRESH_CARD, reps: 2, interval_days: 10, ease: 2.0 };
      const r = nextSM2(card, 'easy', TODAY);
      expect(r.next_state.interval_days).toBe(13);  // 10 * 1.3
      expect(r.next_state.ease).toBe(2.15);  // 2.0 + 0.15
    });

    it('ease는 max 2.5를 넘지 않음', () => {
      const card: SM2State = { ...FRESH_CARD, reps: 2, ease: 2.5 };
      const r = nextSM2(card, 'easy', TODAY);
      expect(r.next_state.ease).toBe(2.5);
    });
  });

  describe('"적당"', () => {
    it('첫 review에서 적당 → 1일 후', () => {
      const r = nextSM2(FRESH_CARD, 'ok', TODAY);
      expect(r.next_state.interval_days).toBe(1);
      expect(r.next_state.due_date).toBe('2026-05-16');
    });

    it('2회차에서 적당 → 3일 후 (고정 backbone)', () => {
      const card: SM2State = { ...FRESH_CARD, reps: 1, interval_days: 1 };
      const r = nextSM2(card, 'ok', TODAY);
      expect(r.next_state.interval_days).toBe(3);
    });

    it('3회차 이상 → interval × ease', () => {
      const card: SM2State = { ...FRESH_CARD, reps: 2, interval_days: 3, ease: 2.5 };
      const r = nextSM2(card, 'ok', TODAY);
      expect(r.next_state.interval_days).toBe(8);  // 3 * 2.5 = 7.5 → 8
      expect(r.next_state.ease).toBe(2.5);  // 유지
    });
  });

  describe('"어려움"', () => {
    it('어려움 → ease ↓ 0.15, interval ×1.0 (간격 안 늘어남)', () => {
      const card: SM2State = { ...FRESH_CARD, reps: 2, interval_days: 5, ease: 2.5 };
      const r = nextSM2(card, 'hard', TODAY);
      expect(r.next_state.interval_days).toBe(5);  // 변화 없음
      expect(r.next_state.ease).toBe(2.35);
      expect(r.re_enter_chat).toBe(false);
    });

    it('첫 review에서 어려움 → 최소 1일', () => {
      const r = nextSM2(FRESH_CARD, 'hard', TODAY);
      expect(r.next_state.interval_days).toBeGreaterThanOrEqual(1);
    });

    it('ease는 min 1.3 미만으로 안 떨어짐', () => {
      const card: SM2State = { ...FRESH_CARD, reps: 5, ease: 1.3 };
      const r = nextSM2(card, 'hard', TODAY);
      expect(r.next_state.ease).toBe(1.3);
    });
  });

  describe('"모름" — UC-14 핵심', () => {
    it('모름 → interval=0, lapses ↑, re_enter_chat=true', () => {
      const card: SM2State = { ...FRESH_CARD, reps: 3, interval_days: 7, lapses: 0 };
      const r = nextSM2(card, 'dunno', TODAY);
      expect(r.next_state.interval_days).toBe(0);
      expect(r.next_state.due_date).toBe(TODAY);  // 즉시
      expect(r.next_state.lapses).toBe(1);
      expect(r.re_enter_chat).toBe(true);
    });

    it('모름 → ease ↓ 0.20', () => {
      const card: SM2State = { ...FRESH_CARD, ease: 2.0 };
      const r = nextSM2(card, 'dunno', TODAY);
      expect(r.next_state.ease).toBe(1.8);
    });

    it('연속 모름은 lapses 누적', () => {
      let s: SM2State = { ...FRESH_CARD, lapses: 2 };
      const r1 = nextSM2(s, 'dunno', TODAY);
      expect(r1.next_state.lapses).toBe(3);
      const r2 = nextSM2(r1.next_state, 'dunno', TODAY);
      expect(r2.next_state.lapses).toBe(4);
    });
  });

  describe('reps 누적', () => {
    it('모든 평가에서 reps +1', () => {
      const ratings: Array<'easy' | 'ok' | 'hard' | 'dunno'> = ['easy', 'ok', 'hard', 'dunno'];
      for (const r of ratings) {
        const result = nextSM2(FRESH_CARD, r, TODAY);
        expect(result.next_state.reps).toBe(1);
      }
    });
  });

  describe('due_date 계산', () => {
    it('월말 넘어갈 때 정확히 계산', () => {
      const card: SM2State = { ...FRESH_CARD, reps: 2, interval_days: 5 };
      const r = nextSM2(card, 'easy', '2026-05-30');
      // 5 * 1.3 = 6.5 → 7일 후 = 2026-06-06
      expect(r.next_state.due_date).toBe('2026-06-06');
    });

    it('연말 넘어갈 때 정확히 계산', () => {
      const card: SM2State = { ...FRESH_CARD, reps: 2, interval_days: 30 };
      const r = nextSM2(card, 'ok', '2026-12-15');  // 30 * 2.5 = 75일
      expect(r.next_state.due_date).toBe('2027-02-28');
    });
  });
});
