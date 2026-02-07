import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMakeupStore } from '../stores/makeupStore';
import type { MakeupRecord } from '../types';

// Mock notion service
vi.mock('../services/notion', () => ({
  fetchMakeupRecords: vi.fn(),
  createMakeupRecord: vi.fn(),
  updateMakeupRecord: vi.fn(),
  deleteMakeupRecord: vi.fn(),
}));

import { fetchMakeupRecords, createMakeupRecord, updateMakeupRecord, deleteMakeupRecord } from '../services/notion';

const mockRecords: MakeupRecord[] = [
  {
    id: 'rec-1',
    studentId: 'stu-1',
    studentName: '홍길동',
    subject: '수학',
    teacherId: 'tea-1',
    absentDate: '2026-02-05',
    absentReason: '감기',
    makeupDate: '',
    makeupTime: '',
    status: '시작 전',
    memo: '',
    createdAt: '2026-02-05T00:00:00Z',
  },
  {
    id: 'rec-2',
    studentId: 'stu-2',
    studentName: '김철수',
    subject: '영어',
    teacherId: 'tea-2',
    absentDate: '2026-02-03',
    absentReason: '가족여행',
    makeupDate: '2026-02-10',
    makeupTime: '14:00~15:00',
    status: '진행 중',
    memo: '',
    createdAt: '2026-02-03T00:00:00Z',
  },
  {
    id: 'rec-3',
    studentId: 'stu-3',
    studentName: '이영희',
    subject: '국어',
    teacherId: 'tea-1',
    absentDate: '2026-01-20',
    absentReason: '병원',
    makeupDate: '2026-01-25',
    makeupTime: '16:00~17:00',
    status: '완료',
    memo: '완료됨',
    createdAt: '2026-01-20T00:00:00Z',
  },
];

describe('MakeupStore', () => {
  beforeEach(() => {
    // Reset store
    useMakeupStore.setState({ records: [], isLoading: false });
    vi.clearAllMocks();
  });

  // ========== 유즈케이스: 데이터 조회 ==========
  describe('fetchRecords - 보강 기록 조회', () => {
    it('전체 보강 기록을 가져온다', async () => {
      vi.mocked(fetchMakeupRecords).mockResolvedValue(mockRecords);
      await useMakeupStore.getState().fetchRecords();
      expect(useMakeupStore.getState().records).toHaveLength(3);
      expect(useMakeupStore.getState().isLoading).toBe(false);
    });

    it('상태별 필터링으로 조회한다', async () => {
      vi.mocked(fetchMakeupRecords).mockResolvedValue([mockRecords[0]]);
      await useMakeupStore.getState().fetchRecords('시작 전');
      expect(fetchMakeupRecords).toHaveBeenCalledWith('시작 전');
      expect(useMakeupStore.getState().records).toHaveLength(1);
    });

    it('로딩 상태가 올바르게 전환된다', async () => {
      vi.mocked(fetchMakeupRecords).mockImplementation(async () => {
        expect(useMakeupStore.getState().isLoading).toBe(true);
        return [];
      });
      await useMakeupStore.getState().fetchRecords();
      expect(useMakeupStore.getState().isLoading).toBe(false);
    });

    // 엣지케이스
    it('빈 결과를 처리한다', async () => {
      vi.mocked(fetchMakeupRecords).mockResolvedValue([]);
      await useMakeupStore.getState().fetchRecords();
      expect(useMakeupStore.getState().records).toEqual([]);
    });

    it('API 에러 시 빈 배열을 유지하고 로딩을 해제한다', async () => {
      vi.mocked(fetchMakeupRecords).mockRejectedValue(new Error('Network error'));
      await useMakeupStore.getState().fetchRecords();
      expect(useMakeupStore.getState().records).toEqual([]);
      expect(useMakeupStore.getState().isLoading).toBe(false);
    });
  });

  // ========== 유즈케이스: 결석 기록 추가 ==========
  describe('addRecord - 결석 기록 추가', () => {
    it('결석 기록을 성공적으로 추가한다', async () => {
      vi.mocked(createMakeupRecord).mockResolvedValue({
        success: true,
        data: mockRecords[0],
      });
      vi.mocked(fetchMakeupRecords).mockResolvedValue(mockRecords);

      const result = await useMakeupStore.getState().addRecord({
        studentId: 'stu-1',
        studentName: '홍길동',
        subject: '수학',
        absentDate: '2026-02-05',
        absentReason: '감기',
      });

      expect(result).toBe(true);
      expect(createMakeupRecord).toHaveBeenCalledWith(expect.objectContaining({
        studentId: 'stu-1',
        studentName: '홍길동',
      }));
    });

    it('API 실패 시 false를 반환한다', async () => {
      vi.mocked(createMakeupRecord).mockResolvedValue({
        success: false,
        error: { message: 'DB 오류' },
      });

      const result = await useMakeupStore.getState().addRecord({
        studentId: 'stu-1',
        studentName: '홍길동',
        subject: '수학',
        absentDate: '2026-02-05',
        absentReason: '감기',
      });

      expect(result).toBe(false);
    });

    // 엣지케이스
    it('선택 필드 없이도 추가할 수 있다', async () => {
      vi.mocked(createMakeupRecord).mockResolvedValue({ success: true, data: mockRecords[0] });
      vi.mocked(fetchMakeupRecords).mockResolvedValue([]);

      const result = await useMakeupStore.getState().addRecord({
        studentId: 'stu-1',
        studentName: '홍길동',
        subject: '수학',
        absentDate: '2026-02-05',
        absentReason: '감기',
        // teacherId, makeupDate, makeupTime, memo 모두 생략
      });

      expect(result).toBe(true);
    });
  });

  // ========== 유즈케이스: 보강 기록 수정 ==========
  describe('updateRecord - 보강 기록 수정', () => {
    it('보강 일정을 등록하고 상태를 진행 중으로 변경한다', async () => {
      vi.mocked(updateMakeupRecord).mockResolvedValue({ success: true, data: true });
      vi.mocked(fetchMakeupRecords).mockResolvedValue([]);

      const result = await useMakeupStore.getState().updateRecord('rec-1', {
        makeupDate: '2026-02-10',
        makeupTime: '14:00~15:00',
        status: '진행 중',
      });

      expect(result).toBe(true);
      expect(updateMakeupRecord).toHaveBeenCalledWith('rec-1', {
        makeupDate: '2026-02-10',
        makeupTime: '14:00~15:00',
        status: '진행 중',
      });
    });

    it('완료 처리를 한다', async () => {
      vi.mocked(updateMakeupRecord).mockResolvedValue({ success: true, data: true });
      vi.mocked(fetchMakeupRecords).mockResolvedValue([]);

      const result = await useMakeupStore.getState().updateRecord('rec-2', { status: '완료' });
      expect(result).toBe(true);
    });

    // 엣지케이스
    it('존재하지 않는 레코드 수정 시 false를 반환한다', async () => {
      vi.mocked(updateMakeupRecord).mockResolvedValue({
        success: false,
        error: { message: 'Not found' },
      });

      const result = await useMakeupStore.getState().updateRecord('non-existent', { status: '완료' });
      expect(result).toBe(false);
    });
  });

  // ========== 유즈케이스: 보강 기록 삭제 ==========
  describe('deleteRecord - 보강 기록 삭제', () => {
    it('보강 기록을 삭제한다', async () => {
      vi.mocked(deleteMakeupRecord).mockResolvedValue({ success: true, data: true });
      vi.mocked(fetchMakeupRecords).mockResolvedValue([]);

      const result = await useMakeupStore.getState().deleteRecord('rec-1');
      expect(result).toBe(true);
    });

    // 엣지케이스
    it('삭제 실패 시 false를 반환한다', async () => {
      vi.mocked(deleteMakeupRecord).mockResolvedValue({
        success: false,
        error: { message: '삭제 실패' },
      });

      const result = await useMakeupStore.getState().deleteRecord('rec-1');
      expect(result).toBe(false);
    });
  });
});
