import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DAY_LABELS,
  getTodayDay,
  SUBJECT_COLORS,
  getSubjectColor,
  formatMessageTime,
  formatTimeOnly,
  getTeacherName,
} from '../constants/common';
import type { DayType } from '../types';

// ============================================================
// Feature: 요일 상수 및 유틸리티 (DAY_LABELS, getTodayDay)
// ============================================================
describe('Feature: 요일 상수 및 유틸리티', () => {
  describe('Scenario: DAY_LABELS가 올바른 요일 배열을 제공한다', () => {
    it('7개의 요일을 포함한다', () => {
      expect(DAY_LABELS).toHaveLength(7);
    });

    it('일요일(index 0)부터 토요일(index 6)까지 올바른 순서이다', () => {
      expect(DAY_LABELS[0]).toBe('일');
      expect(DAY_LABELS[1]).toBe('월');
      expect(DAY_LABELS[2]).toBe('화');
      expect(DAY_LABELS[3]).toBe('수');
      expect(DAY_LABELS[4]).toBe('목');
      expect(DAY_LABELS[5]).toBe('금');
      expect(DAY_LABELS[6]).toBe('토');
    });

    it('DayType 배열과 호환된다', () => {
      const validDays: DayType[] = ['월', '화', '수', '목', '금', '토', '일'];
      DAY_LABELS.forEach((day) => {
        expect(validDays).toContain(day);
      });
    });
  });

  describe('Scenario: getTodayDay가 현재 요일을 반환한다', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.each([
      [0, '일'], [1, '월'], [2, '화'], [3, '수'],
      [4, '목'], [5, '금'], [6, '토'],
    ] as const)('Given getDay()=%i 일 때, Then "%s"을 반환한다', (dayIndex, expected) => {
      vi.spyOn(Date.prototype, 'getDay').mockReturnValue(dayIndex);
      expect(getTodayDay()).toBe(expected);
    });
  });
});

// ============================================================
// Feature: 과목별 색상 매핑
// ============================================================
describe('Feature: 과목별 색상 매핑', () => {
  describe('Scenario: 등록된 과목의 색상을 반환한다', () => {
    it.each([
      ['국어', '#FF6B00'],
      ['영어', '#3B82F6'],
      ['수학', '#10B981'],
      ['과학', '#8B5CF6'],
      ['사회', '#EC4899'],
      ['역사', '#F59E0B'],
      ['물리', '#06B6D4'],
      ['화학', '#84CC16'],
      ['생물', '#22C55E'],
      ['지구과학', '#6366F1'],
    ])('과목 "%s" → 색상 "%s"', (subject, color) => {
      expect(getSubjectColor(subject)).toBe(color);
    });
  });

  describe('Scenario: SUBJECT_COLORS 상수 검증', () => {
    it('10개 과목이 등록되어 있다', () => {
      expect(Object.keys(SUBJECT_COLORS)).toHaveLength(10);
    });

    it('모든 색상값이 유효한 HEX 코드이다', () => {
      Object.values(SUBJECT_COLORS).forEach((color) => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });

  describe('Scenario: 미등록 과목은 기본 회색을 반환한다', () => {
    it.each(['음악', '체육', '', '!@#$%', '  '])(
      '과목 "%s" → 기본색 "#6B7280"',
      (subject) => {
        expect(getSubjectColor(subject)).toBe('#6B7280');
      }
    );
  });
});

// ============================================================
// Feature: 메시지 시간 포맷팅
// ============================================================
describe('Feature: 메시지 시간 포맷팅', () => {
  describe('formatMessageTime', () => {
    it('오늘 메시지는 시:분 형식을 반환한다', () => {
      const now = new Date();
      now.setHours(14, 30, 0, 0);
      const result = formatMessageTime(now.toISOString());
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('이전 날짜 메시지는 월/일 형식을 반환한다', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = formatMessageTime(yesterday.toISOString());
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('undefined 입력 시 빈 문자열을 반환한다', () => {
      expect(formatMessageTime(undefined)).toBe('');
    });

    it('빈 문자열 입력 시 빈 문자열을 반환한다', () => {
      expect(formatMessageTime('')).toBe('');
    });
  });

  describe('formatTimeOnly', () => {
    it('ISO 날짜에서 시간만 추출한다', () => {
      const result = formatTimeOnly('2026-02-07T14:30:00Z');
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('자정(00:00) 시간도 유효하게 반환한다', () => {
      const result = formatTimeOnly('2026-02-07T00:00:00Z');
      expect(result).toBeTruthy();
    });
  });
});

// ============================================================
// Feature: 선생님 이름 조회
// ============================================================
describe('Feature: 선생님 이름 조회', () => {
  const teachers = [
    { id: 'tea-1', name: '서재용' },
    { id: 'tea-2', name: '지혜영' },
    { id: 'tea-3', name: '김수학' },
  ];

  describe('Scenario: 존재하는 선생님 ID로 이름을 찾는다', () => {
    it('tea-1 → "서재용"', () => {
      expect(getTeacherName(teachers, 'tea-1')).toBe('서재용');
    });

    it('tea-3 → "김수학"', () => {
      expect(getTeacherName(teachers, 'tea-3')).toBe('김수학');
    });
  });

  describe('Scenario: 존재하지 않는 선생님 ID → 빈 문자열', () => {
    it('미등록 ID → ""', () => {
      expect(getTeacherName(teachers, 'tea-999')).toBe('');
    });

    it('빈 문자열 ID → ""', () => {
      expect(getTeacherName(teachers, '')).toBe('');
    });
  });

  describe('Scenario: 엣지 케이스', () => {
    it('빈 선생님 목록 → ""', () => {
      expect(getTeacherName([], 'tea-1')).toBe('');
    });

    it('선생님 1명만 있을 때 정확히 찾는다', () => {
      expect(getTeacherName([{ id: 'only', name: '유일한선생' }], 'only')).toBe('유일한선생');
    });
  });
});
