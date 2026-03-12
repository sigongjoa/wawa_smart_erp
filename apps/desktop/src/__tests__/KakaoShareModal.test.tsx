import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KakaoShareModal from '../modules/makeup/components/KakaoShareModal';
import type { MakeupRecord } from '../types';

vi.mock('../stores/toastStore', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}));

Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

const mockRecords: MakeupRecord[] = [
  {
    id: '1', studentId: 's1', studentName: '홍길동', subject: '수학',
    absentDate: '2026-02-10', absentReason: '감기', makeupDate: '2026-02-19',
    makeupTime: '14:00~15:00', status: '시작 전',
  },
  {
    id: '2', studentId: 's2', studentName: '김철수', subject: '영어',
    absentDate: '2026-02-11', absentReason: '병원', makeupDate: '2026-02-19',
    status: '시작 전',
  },
];

const onClose = vi.fn();

beforeEach(() => { onClose.mockClear(); });

describe('KakaoShareModal', () => {
  it('헤더에 날짜가 표시된다', () => {
    render(<KakaoShareModal date="2026-02-19" records={mockRecords} onClose={onClose} />);
    // h3 헤더에 날짜 포함 여부 확인
    const header = screen.getByRole('heading', { level: 3 });
    expect(header.textContent).toContain('2월 19일');
  });

  it('records가 없으면 안내 메시지 p 태그가 렌더링된다', () => {
    render(<KakaoShareModal date="2026-02-19" records={[]} onClose={onClose} />);
    const msg = document.querySelector('p');
    expect(msg?.textContent).toBe('해당 날짜에 보강 일정이 없습니다.');
  });

  it('전체 선택 체크박스와 개별 체크박스가 렌더링된다', () => {
    render(<KakaoShareModal date="2026-02-19" records={mockRecords} onClose={onClose} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(3); // 전체선택 1 + 개별 2
  });

  it('학생명 레이블이 표시된다', () => {
    render(<KakaoShareModal date="2026-02-19" records={mockRecords} onClose={onClose} />);
    // label for="record-0", for="record-1"에 학생명 포함
    const label0 = document.querySelector('label[for="record-0"]');
    const label1 = document.querySelector('label[for="record-1"]');
    expect(label0?.textContent).toContain('홍길동');
    expect(label1?.textContent).toContain('김철수');
  });

  it('makeupTime이 없는 항목은 레이블에 시간 미정으로 표시된다', () => {
    render(<KakaoShareModal date="2026-02-19" records={mockRecords} onClose={onClose} />);
    const label1 = document.querySelector('label[for="record-1"]');
    expect(label1?.textContent).toContain('시간 미정');
  });

  it('취소 버튼 클릭 시 onClose가 호출된다', () => {
    render(<KakaoShareModal date="2026-02-19" records={mockRecords} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('전체 선택 해제 시 복사 버튼이 비활성화된다', () => {
    render(<KakaoShareModal date="2026-02-19" records={mockRecords} onClose={onClose} />);
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(selectAllCheckbox);
    const copyBtn = screen.getByRole('button', { name: /복사하기/ });
    expect(copyBtn).toHaveProperty('disabled', true);
  });

  it('미리보기 textarea가 렌더링된다', () => {
    render(<KakaoShareModal date="2026-02-19" records={mockRecords} onClose={onClose} />);
    const textarea = screen.getByLabelText('미리보기');
    expect(textarea).toBeTruthy();
  });
});
