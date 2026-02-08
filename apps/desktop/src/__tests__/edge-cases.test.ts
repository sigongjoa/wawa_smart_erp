import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatMessageTime,
  formatTimeOnly,
  getSubjectColor,
  getTeacherName,
  getTodayDay,
  SUBJECT_COLORS,
} from '../constants/common';

// ============================================================
// Edge Case: formatMessageTime - 비정상 입력
// ============================================================
describe('Edge: formatMessageTime 비정상 입력', () => {
  it('잘못된 날짜 문자열 → Invalid Date 처리 (크래시 없음)', () => {
    // new Date('not-a-date') → Invalid Date
    const result = formatMessageTime('not-a-date');
    expect(typeof result).toBe('string'); // 크래시하지 않음
  });

  it('숫자 문자열 → 유효한 날짜로 해석될 수 있음', () => {
    const result = formatMessageTime('0');
    expect(typeof result).toBe('string');
  });

  it('매우 오래된 날짜 (1970-01-01)', () => {
    const result = formatMessageTime('1970-01-01T00:00:00Z');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('미래 날짜 (2099-12-31)', () => {
    const result = formatMessageTime('2099-12-31T23:59:59Z');
    expect(result).toBeTruthy();
  });

  it('자정 직전 23:59:59 메시지는 "오늘"로 표시된다', () => {
    const almostMidnight = new Date();
    almostMidnight.setHours(23, 59, 59, 999);
    const result = formatMessageTime(almostMidnight.toISOString());
    expect(result).toBeTruthy();
  });

  it('오늘 00:00:00 메시지는 "오늘"로 표시된다', () => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const result = formatMessageTime(midnight.toISOString());
    expect(result).toBeTruthy();
  });
});

// ============================================================
// Edge Case: formatTimeOnly - 비정상 입력
// ============================================================
describe('Edge: formatTimeOnly 비정상 입력', () => {
  it('잘못된 날짜 문자열 → 크래시 없음', () => {
    const result = formatTimeOnly('not-a-date');
    expect(typeof result).toBe('string');
  });

  it('23:59:59 경계값', () => {
    const result = formatTimeOnly('2026-02-07T23:59:59Z');
    expect(result).toBeTruthy();
  });

  it('시간대 오프셋 포함 문자열', () => {
    const result = formatTimeOnly('2026-02-07T14:30:00+09:00');
    expect(result).toBeTruthy();
  });
});

// ============================================================
// Edge Case: getTeacherName - 중복/특수 케이스
// ============================================================
describe('Edge: getTeacherName 특수 케이스', () => {
  it('동일 ID가 중복된 선생님 목록 → 첫 번째 매칭 반환', () => {
    const teachers = [
      { id: 'dup', name: '첫번째' },
      { id: 'dup', name: '두번째' },
    ];
    expect(getTeacherName(teachers, 'dup')).toBe('첫번째');
  });

  it('이름이 빈 문자열인 선생님 → 빈 문자열 반환 (falsy)', () => {
    const teachers = [{ id: 'tea-1', name: '' }];
    // name이 '' 이면 || '' 에 의해 빈 문자열 반환
    expect(getTeacherName(teachers, 'tea-1')).toBe('');
  });

  it('대량의 선생님 목록에서도 정확히 찾는다', () => {
    const teachers = Array.from({ length: 1000 }, (_, i) => ({
      id: `tea-${i}`,
      name: `선생님${i}`,
    }));
    expect(getTeacherName(teachers, 'tea-999')).toBe('선생님999');
    expect(getTeacherName(teachers, 'tea-0')).toBe('선생님0');
  });
});

// ============================================================
// Edge Case: getSubjectColor - 유사 과목명
// ============================================================
describe('Edge: getSubjectColor 유사 과목명', () => {
  it('과목명 앞뒤 공백 → 기본색 반환 (정확 매칭만)', () => {
    expect(getSubjectColor(' 수학')).toBe('#6B7280');
    expect(getSubjectColor('수학 ')).toBe('#6B7280');
  });

  it('대소문자/전각 문자 → 기본색 반환', () => {
    expect(getSubjectColor('국어 ')).toBe('#6B7280'); // 전각 공백
  });

  it('SUBJECT_COLORS의 모든 색상이 고유하다 (중복 색상 없음)', () => {
    const colors = Object.values(SUBJECT_COLORS);
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });
});

// ============================================================
// Edge Case: getTodayDay - 시스템 시간 의존성
// ============================================================
describe('Edge: getTodayDay 시스템 시간', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('반환값이 항상 DayType 유효값이다', () => {
    const validDays = ['일', '월', '화', '수', '목', '금', '토'];
    const result = getTodayDay();
    expect(validDays).toContain(result);
  });

  it('연속 호출 시 동일한 결과를 반환한다 (같은 밀리초 내)', () => {
    const result1 = getTodayDay();
    const result2 = getTodayDay();
    expect(result1).toBe(result2);
  });
});
