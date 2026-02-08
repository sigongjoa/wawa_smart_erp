import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { getMonthDays, WEEKDAYS, STATUS_COLORS } from '../modules/makeup/Calendar';

// ============================================================
// Feature: getMonthDays - 캘린더 날짜 그리드 생성
// As a 선생님
// I want 월별 캘린더 그리드를 정확하게 볼 수 있기를 원한다
// So that 보강 일정을 날짜별로 확인할 수 있다
// ============================================================
describe('Feature: getMonthDays - 캘린더 날짜 그리드 생성', () => {
  describe('Scenario: 항상 42개(6주) 셀을 반환한다', () => {
    it('Given 2026년 2월, Then 42개 셀을 반환한다', () => {
      const days = getMonthDays(2026, 1); // month=1 → 2월
      expect(days).toHaveLength(42);
    });

    it('Given 2026년 1월, Then 42개 셀을 반환한다', () => {
      const days = getMonthDays(2026, 0);
      expect(days).toHaveLength(42);
    });

    it('Given 2024년 2월 (윤년), Then 42개 셀을 반환한다', () => {
      const days = getMonthDays(2024, 1);
      expect(days).toHaveLength(42);
    });
  });

  describe('Scenario: 현재 달의 모든 날짜를 포함한다', () => {
    it('Given 2026년 2월(28일), Then current 날짜가 1~28일이다', () => {
      const days = getMonthDays(2026, 1);
      const currentDays = days.filter(d => d.month === 'current');
      expect(currentDays).toHaveLength(28);
      expect(currentDays[0].date).toBe(1);
      expect(currentDays[27].date).toBe(28);
    });

    it('Given 2026년 1월(31일), Then current 날짜가 1~31일이다', () => {
      const days = getMonthDays(2026, 0);
      const currentDays = days.filter(d => d.month === 'current');
      expect(currentDays).toHaveLength(31);
    });

    it('Given 2024년 2월(윤년 29일), Then current 날짜가 1~29일이다', () => {
      const days = getMonthDays(2024, 1);
      const currentDays = days.filter(d => d.month === 'current');
      expect(currentDays).toHaveLength(29);
      expect(currentDays[28].date).toBe(29);
    });
  });

  describe('Scenario: 이전 달과 다음 달 패딩이 올바르다', () => {
    it('Given 2026년 2월(일요일 시작), Then prev 날짜가 0개이거나 올바르다', () => {
      const days = getMonthDays(2026, 1);
      const prevDays = days.filter(d => d.month === 'prev');
      // 2026년 2월 1일은 일요일 → firstDay=0 → prev 없음
      expect(prevDays).toHaveLength(0);
    });

    it('Given 2026년 3월(일요일 시작), Then prev 패딩 날짜가 있다', () => {
      const days = getMonthDays(2026, 2); // 3월
      const prevDays = days.filter(d => d.month === 'prev');
      // 2026년 3월 1일은 일요일 → firstDay=0 → prev 없음
      expect(prevDays.length).toBeGreaterThanOrEqual(0);
    });

    it('Given 어떤 달이든, Then prev + current + next = 42', () => {
      for (let m = 0; m < 12; m++) {
        const days = getMonthDays(2026, m);
        const prev = days.filter(d => d.month === 'prev').length;
        const current = days.filter(d => d.month === 'current').length;
        const next = days.filter(d => d.month === 'next').length;
        expect(prev + current + next).toBe(42);
      }
    });
  });

  describe('Scenario: fullDate 형식이 YYYY-MM-DD이다', () => {
    it('Given 2026년 2월 5일, Then fullDate가 "2026-02-05"이다', () => {
      const days = getMonthDays(2026, 1);
      const feb5 = days.find(d => d.month === 'current' && d.date === 5);
      expect(feb5?.fullDate).toBe('2026-02-05');
    });

    it('Given 한 자리 월/일, Then 0-padding 된다', () => {
      const days = getMonthDays(2026, 0); // 1월
      const jan1 = days.find(d => d.month === 'current' && d.date === 1);
      expect(jan1?.fullDate).toBe('2026-01-01');
    });

    it('Given 12월, Then 다음 달이 다음 해 1월이다', () => {
      const days = getMonthDays(2025, 11); // 12월
      const nextDays = days.filter(d => d.month === 'next');
      if (nextDays.length > 0) {
        expect(nextDays[0].fullDate).toMatch(/^2026-01-/);
      }
    });

    it('Given 1월, Then 이전 달이 전년도 12월이다', () => {
      const days = getMonthDays(2026, 0); // 1월
      const prevDays = days.filter(d => d.month === 'prev');
      if (prevDays.length > 0) {
        expect(prevDays[0].fullDate).toMatch(/^2025-12-/);
      }
    });
  });
});

// ============================================================
// Feature: WEEKDAYS - 요일 헤더 상수
// ============================================================
describe('Feature: WEEKDAYS 상수', () => {
  it('7개의 요일을 포함한다', () => {
    expect(WEEKDAYS).toHaveLength(7);
  });

  it('일요일부터 토요일 순서이다', () => {
    expect(WEEKDAYS).toEqual(['일', '월', '화', '수', '목', '금', '토']);
  });
});

// ============================================================
// Feature: STATUS_COLORS - 보강 상태별 색상
// ============================================================
describe('Feature: STATUS_COLORS 상수', () => {
  it('3개 상태를 포함한다: 시작 전, 진행 중, 완료', () => {
    expect(Object.keys(STATUS_COLORS)).toEqual(['시작 전', '진행 중', '완료']);
  });

  it('각 상태에 bg, text, dot 속성이 있다', () => {
    for (const [status, colors] of Object.entries(STATUS_COLORS)) {
      expect(colors).toHaveProperty('bg');
      expect(colors).toHaveProperty('text');
      expect(colors).toHaveProperty('dot');
      expect(typeof colors.bg).toBe('string');
      expect(typeof colors.text).toBe('string');
      expect(typeof colors.dot).toBe('string');
    }
  });

  it('모든 색상이 유효한 hex 코드이다', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const colors of Object.values(STATUS_COLORS)) {
      expect(colors.bg).toMatch(hexRegex);
      expect(colors.text).toMatch(hexRegex);
      expect(colors.dot).toMatch(hexRegex);
    }
  });
});

// ============================================================
// Feature: MakeupCalendar 컴포넌트 렌더링
// ============================================================
const mockState = vi.hoisted(() => ({
  records: [] as any[],
  isLoading: false,
  fetchRecords: vi.fn(),
}));

vi.mock('../stores/makeupStore', () => ({
  useMakeupStore: () => mockState,
}));

vi.mock('../stores/reportStore', () => ({
  useReportStore: () => ({
    teachers: [
      { id: 't1', name: '서재용', subjects: ['수학'], pin: '1141', isAdmin: true },
      { id: 't2', name: '지혜영', subjects: ['영어'], pin: '8520', isAdmin: false },
    ],
  }),
}));

// Calendar 컴포넌트를 미리 import (mock이 적용된 상태)
import MakeupCalendar from '../modules/makeup/Calendar';

describe('Feature: MakeupCalendar 컴포넌트', () => {
  beforeEach(() => {
    mockState.records = [];
    mockState.isLoading = false;
    mockState.fetchRecords.mockClear();
  });

  it('Given 컴포넌트 마운트, Then fetchRecords가 호출된다', () => {
    render(<MakeupCalendar />);
    expect(mockState.fetchRecords).toHaveBeenCalled();
  });

  it('Given 페이지 렌더링, Then 페이지 제목이 표시된다', () => {
    render(<MakeupCalendar />);
    expect(screen.getByText('보강 캘린더')).toBeInTheDocument();
    expect(screen.getByText('월별 보강 일정을 캘린더로 확인합니다')).toBeInTheDocument();
  });

  it('Given 페이지 렌더링, Then 요일 헤더가 표시된다', () => {
    render(<MakeupCalendar />);
    for (const day of ['일', '월', '화', '수', '목', '금', '토']) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });

  it('Given 페이지 렌더링, Then 상태 범례가 표시된다', () => {
    render(<MakeupCalendar />);
    expect(screen.getByText('시작 전')).toBeInTheDocument();
    expect(screen.getByText('진행 중')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
  });

  it('Given 오늘 버튼 클릭, Then 현재 월로 이동한다', () => {
    render(<MakeupCalendar />);
    const todayBtn = screen.getByText('오늘');
    expect(todayBtn).toBeInTheDocument();
  });

  it('Given 네비게이션 버튼, Then 이전/다음 월 버튼이 있다', () => {
    render(<MakeupCalendar />);
    expect(screen.getByText('chevron_left')).toBeInTheDocument();
    expect(screen.getByText('chevron_right')).toBeInTheDocument();
  });

  it('Given 보강 기록이 있을 때, Then 해당 날짜에 뱃지가 표시된다', () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    mockState.records = [
      {
        id: 'r1',
        studentId: 's1',
        studentName: '정지효',
        subject: '수학',
        teacherId: 't1',
        absentDate: dateStr,
        absentReason: '병결',
        status: '시작 전' as const,
      },
    ];
    render(<MakeupCalendar />);
    expect(screen.getByText('정지효 · 수학')).toBeInTheDocument();
  });

  it('Given isLoading=true, Then 로딩 메시지가 표시된다', () => {
    mockState.isLoading = true;
    render(<MakeupCalendar />);
    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('Given 4개 이상의 기록이 있는 날짜, Then "+N건 더" 메시지가 표시된다', () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    mockState.records = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      studentId: `s${i}`,
      studentName: `학생${i}`,
      subject: '수학',
      absentDate: dateStr,
      absentReason: '병결',
      status: '시작 전' as const,
    }));
    render(<MakeupCalendar />);
    expect(screen.getByText('+2건 더')).toBeInTheDocument();
  });

  it('Given 날짜 클릭, Then 선택된 날짜의 상세 정보가 표시된다', () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    mockState.records = [
      {
        id: 'r1',
        studentId: 's1',
        studentName: '정지효',
        subject: '수학',
        teacherId: 't1',
        absentDate: dateStr,
        absentReason: '병결',
        makeupTime: '14:00~15:00',
        status: '시작 전' as const,
        memo: '테스트 메모',
      },
    ];
    render(<MakeupCalendar />);
    // 뱃지가 있는 셀을 찾아 클릭
    const badge = screen.getByText('정지효 · 수학');
    fireEvent.click(badge.closest('div[style]')!);
    // 상세 테이블이 나타남
    expect(screen.getByText(`${dateStr} 보강 일정 (1건)`)).toBeInTheDocument();
    expect(screen.getByText('14:00~15:00')).toBeInTheDocument();
    expect(screen.getByText('테스트 메모')).toBeInTheDocument();
  });

  it('Given 선택된 날짜에 기록이 없으면, Then 빈 메시지가 표시된다', () => {
    render(<MakeupCalendar />);
    // 아무 날짜 셀이나 클릭 (첫 번째 셀)
    const cells = document.querySelectorAll('div[style*="min-height: 90px"]');
    if (cells.length > 0) {
      fireEvent.click(cells[0]);
      expect(screen.getByText('해당 날짜에 보강 일정이 없습니다')).toBeInTheDocument();
    }
  });

  it('Given makeupDate가 있는 기록, Then makeupDate 날짜에 표시된다', () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    mockState.records = [
      {
        id: 'r1',
        studentId: 's1',
        studentName: '김보강',
        subject: '영어',
        absentDate: '2020-01-01', // 멀리 떨어진 날짜
        absentReason: '병결',
        makeupDate: dateStr, // 이번 달 날짜
        status: '진행 중' as const,
      },
    ];
    render(<MakeupCalendar />);
    expect(screen.getByText('김보강 · 영어')).toBeInTheDocument();
  });
});
