import { describe, it, expect } from 'vitest';
import { getMonthDays, WEEKDAYS, STATUS_COLORS } from '../modules/makeup/Calendar';

// ============================================================
// Edge Case Tests: getMonthDays - 경계값 및 엣지케이스
// ============================================================
describe('Edge Cases: getMonthDays', () => {
  // --- Boundary: 윤년/비윤년 ---
  describe('윤년 경계', () => {
    it('2024년 2월 (윤년) → 29일', () => {
      const days = getMonthDays(2024, 1);
      const currentDays = days.filter(d => d.month === 'current');
      expect(currentDays).toHaveLength(29);
    });

    it('2025년 2월 (비윤년) → 28일', () => {
      const days = getMonthDays(2025, 1);
      const currentDays = days.filter(d => d.month === 'current');
      expect(currentDays).toHaveLength(28);
    });

    it('2000년 2월 (400으로 나눠지는 윤년) → 29일', () => {
      const days = getMonthDays(2000, 1);
      const currentDays = days.filter(d => d.month === 'current');
      expect(currentDays).toHaveLength(29);
    });

    it('1900년 2월 (100으로 나눠지는 비윤년) → 28일', () => {
      const days = getMonthDays(1900, 1);
      const currentDays = days.filter(d => d.month === 'current');
      expect(currentDays).toHaveLength(28);
    });
  });

  // --- Boundary: 월 경계 (1월 ↔ 12월) ---
  describe('연도 경계 (1월/12월)', () => {
    it('1월의 prev 날짜는 전년도 12월이다', () => {
      const days = getMonthDays(2026, 0);
      const prevDays = days.filter(d => d.month === 'prev');
      for (const d of prevDays) {
        expect(d.fullDate).toMatch(/^2025-12-/);
      }
    });

    it('12월의 next 날짜는 다음 해 1월이다', () => {
      const days = getMonthDays(2025, 11);
      const nextDays = days.filter(d => d.month === 'next');
      for (const d of nextDays) {
        expect(d.fullDate).toMatch(/^2026-01-/);
      }
    });

    it('12월 현재 달은 31일이다', () => {
      const days = getMonthDays(2026, 11);
      const currentDays = days.filter(d => d.month === 'current');
      expect(currentDays).toHaveLength(31);
    });
  });

  // --- Boundary: 월초가 일요일인 경우 (prev 날짜 0개) ---
  describe('1일이 일요일인 달', () => {
    it('prev 날짜가 없다', () => {
      // 2026년 2월 1일은 일요일
      const days = getMonthDays(2026, 1);
      const prevDays = days.filter(d => d.month === 'prev');
      expect(prevDays).toHaveLength(0);
    });
  });

  // --- Boundary: 월초가 토요일인 경우 (prev 날짜 6개) ---
  describe('1일이 토요일인 달', () => {
    it('prev 날짜가 6개이다', () => {
      // 2026년 8월 1일은 토요일
      const days = getMonthDays(2026, 7);
      const prevDays = days.filter(d => d.month === 'prev');
      expect(prevDays).toHaveLength(6);
    });
  });

  // --- Consistency: 전체 연도 검증 ---
  describe('2026년 전체 달 일관성 검증', () => {
    it('모든 12개월이 42셀을 반환한다', () => {
      for (let m = 0; m < 12; m++) {
        const days = getMonthDays(2026, m);
        expect(days).toHaveLength(42);
      }
    });

    it('current 날짜들은 연속적이며 1부터 시작한다', () => {
      for (let m = 0; m < 12; m++) {
        const days = getMonthDays(2026, m);
        const currentDays = days.filter(d => d.month === 'current');
        for (let i = 0; i < currentDays.length; i++) {
          expect(currentDays[i].date).toBe(i + 1);
        }
      }
    });

    it('날짜 순서가 올바르다: prev → current → next', () => {
      for (let m = 0; m < 12; m++) {
        const days = getMonthDays(2026, m);
        let phase: 'prev' | 'current' | 'next' = 'prev';
        for (const d of days) {
          if (phase === 'prev' && d.month === 'current') phase = 'current';
          else if (phase === 'current' && d.month === 'next') phase = 'next';
          // prev가 없는 달은 바로 current로 시작 가능
          if (phase === 'prev' && d.month !== 'prev') phase = d.month;
          expect(d.month).toBe(phase);
        }
      }
    });
  });

  // --- fullDate 형식 검증 ---
  describe('fullDate 형식 일관성', () => {
    it('모든 셀의 fullDate가 YYYY-MM-DD 형식이다', () => {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      for (let m = 0; m < 12; m++) {
        const days = getMonthDays(2026, m);
        for (const d of days) {
          expect(d.fullDate).toMatch(dateRegex);
        }
      }
    });

    it('fullDate의 월은 01~12 범위이다', () => {
      for (let m = 0; m < 12; m++) {
        const days = getMonthDays(2026, m);
        for (const d of days) {
          const monthPart = parseInt(d.fullDate.split('-')[1]);
          expect(monthPart).toBeGreaterThanOrEqual(1);
          expect(monthPart).toBeLessThanOrEqual(12);
        }
      }
    });

    it('fullDate의 일은 01~31 범위이다', () => {
      for (let m = 0; m < 12; m++) {
        const days = getMonthDays(2026, m);
        for (const d of days) {
          const dayPart = parseInt(d.fullDate.split('-')[2]);
          expect(dayPart).toBeGreaterThanOrEqual(1);
          expect(dayPart).toBeLessThanOrEqual(31);
        }
      }
    });
  });

  // --- 30일/31일 달 구분 ---
  describe('월별 일수 정확성', () => {
    const expected2026: Record<number, number> = {
      0: 31, 1: 28, 2: 31, 3: 30, 4: 31, 5: 30,
      6: 31, 7: 31, 8: 30, 9: 31, 10: 30, 11: 31,
    };

    for (const [m, expectedDays] of Object.entries(expected2026)) {
      it(`2026년 ${parseInt(m) + 1}월은 ${expectedDays}일이다`, () => {
        const days = getMonthDays(2026, parseInt(m));
        const currentDays = days.filter(d => d.month === 'current');
        expect(currentDays).toHaveLength(expectedDays);
      });
    }
  });
});

// ============================================================
// Edge Cases: STATUS_COLORS 접근
// ============================================================
describe('Edge Cases: STATUS_COLORS 접근', () => {
  it('존재하지 않는 상태에 접근하면 undefined이다', () => {
    expect(STATUS_COLORS['알 수 없음']).toBeUndefined();
  });

  it('빈 문자열로 접근하면 undefined이다', () => {
    expect(STATUS_COLORS['']).toBeUndefined();
  });
});

// ============================================================
// Edge Cases: WEEKDAYS 불변성
// ============================================================
describe('Edge Cases: WEEKDAYS', () => {
  it('요일 배열이 정확히 7개이다', () => {
    expect(WEEKDAYS).toHaveLength(7);
  });

  it('첫 번째 요일은 일요일, 마지막은 토요일이다', () => {
    expect(WEEKDAYS[0]).toBe('일');
    expect(WEEKDAYS[6]).toBe('토');
  });
});
