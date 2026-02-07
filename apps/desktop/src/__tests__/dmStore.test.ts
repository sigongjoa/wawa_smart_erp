import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDMStore } from '../stores/dmStore';
import type { DirectMessage, Teacher } from '../types';

// Mock notion service
vi.mock('../services/notion', () => ({
  fetchDMMessages: vi.fn(),
  sendDMMessage: vi.fn(),
  fetchRecentDMForUser: vi.fn(),
}));

import { fetchDMMessages, sendDMMessage, fetchRecentDMForUser } from '../services/notion';

const mockTeachers: Teacher[] = [
  { id: 'tea-1', name: '서재용', subjects: ['수학'], pin: '1234', isAdmin: true },
  { id: 'tea-2', name: '지혜영', subjects: ['영어'], pin: '5678', isAdmin: false },
  { id: 'tea-3', name: '김수학', subjects: ['과학'], pin: '0000', isAdmin: false },
];

const mockMessages: DirectMessage[] = [
  { id: 'msg-1', senderId: 'tea-1', receiverId: 'tea-2', content: '안녕하세요', createdAt: '2026-02-07T10:00:00Z' },
  { id: 'msg-2', senderId: 'tea-2', receiverId: 'tea-1', content: '네 안녕하세요!', createdAt: '2026-02-07T10:01:00Z' },
  { id: 'msg-3', senderId: 'tea-1', receiverId: 'tea-2', content: '내일 보강 가능할까요?', createdAt: '2026-02-07T10:02:00Z' },
];

describe('DMStore', () => {
  beforeEach(() => {
    useDMStore.setState({
      isOpen: false,
      currentChatPartnerId: null,
      messages: [],
      contacts: [],
      unreadTotal: 0,
      isLoading: false,
      pollingTimer: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    useDMStore.getState().stopPolling();
  });

  // ========== 유즈케이스: 위젯 토글 ==========
  describe('toggleWidget - 위젯 열기/닫기', () => {
    it('위젯을 열 수 있다', () => {
      useDMStore.getState().toggleWidget();
      expect(useDMStore.getState().isOpen).toBe(true);
    });

    it('위젯을 닫을 수 있다', () => {
      useDMStore.setState({ isOpen: true });
      useDMStore.getState().toggleWidget();
      expect(useDMStore.getState().isOpen).toBe(false);
    });

    it('closeWidget은 상태를 초기화한다', () => {
      useDMStore.setState({ isOpen: true, currentChatPartnerId: 'tea-2', messages: mockMessages });
      useDMStore.getState().closeWidget();
      expect(useDMStore.getState().isOpen).toBe(false);
      expect(useDMStore.getState().currentChatPartnerId).toBeNull();
      expect(useDMStore.getState().messages).toEqual([]);
    });
  });

  // ========== 유즈케이스: 연락처 선택/뒤로가기 ==========
  describe('selectContact / goBackToContacts', () => {
    it('연락처를 선택하면 chatPartnerId가 설정된다', () => {
      useDMStore.getState().selectContact('tea-2');
      expect(useDMStore.getState().currentChatPartnerId).toBe('tea-2');
      expect(useDMStore.getState().isLoading).toBe(true);
    });

    it('뒤로가기 하면 연락처 목록으로 돌아간다', () => {
      useDMStore.setState({ currentChatPartnerId: 'tea-2', messages: mockMessages });
      useDMStore.getState().goBackToContacts();
      expect(useDMStore.getState().currentChatPartnerId).toBeNull();
      expect(useDMStore.getState().messages).toEqual([]);
    });
  });

  // ========== 유즈케이스: 메시지 조회 ==========
  describe('fetchMessages - 메시지 조회', () => {
    it('두 선생님 사이의 메시지를 가져온다', async () => {
      vi.mocked(fetchDMMessages).mockResolvedValue(mockMessages);
      await useDMStore.getState().fetchMessages('tea-1', 'tea-2');

      expect(fetchDMMessages).toHaveBeenCalledWith('tea-1', 'tea-2');
      expect(useDMStore.getState().messages).toHaveLength(3);
      expect(useDMStore.getState().isLoading).toBe(false);
    });

    // 엣지케이스
    it('대화 내역이 없으면 빈 배열을 반환한다', async () => {
      vi.mocked(fetchDMMessages).mockResolvedValue([]);
      await useDMStore.getState().fetchMessages('tea-1', 'tea-3');
      expect(useDMStore.getState().messages).toEqual([]);
    });

    it('API 에러 시 로딩만 해제한다', async () => {
      vi.mocked(fetchDMMessages).mockRejectedValue(new Error('Network error'));
      useDMStore.setState({ isLoading: true });
      await useDMStore.getState().fetchMessages('tea-1', 'tea-2');
      expect(useDMStore.getState().isLoading).toBe(false);
    });
  });

  // ========== 유즈케이스: 메시지 전송 ==========
  describe('sendMessage - 메시지 전송', () => {
    it('메시지를 성공적으로 전송한다 (optimistic update)', async () => {
      const serverMsg: DirectMessage = {
        id: 'msg-server-1',
        senderId: 'tea-1',
        receiverId: 'tea-2',
        content: '테스트 메시지',
        createdAt: '2026-02-07T12:00:00Z',
      };
      vi.mocked(sendDMMessage).mockResolvedValue({ success: true, data: serverMsg });

      const result = await useDMStore.getState().sendMessage('tea-1', 'tea-2', '테스트 메시지');

      expect(result).toBe(true);
      const messages = useDMStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-server-1'); // temp ID가 서버 ID로 교체됨
      expect(messages[0].content).toBe('테스트 메시지');
    });

    it('전송 실패 시 optimistic 메시지를 제거한다', async () => {
      vi.mocked(sendDMMessage).mockResolvedValue({
        success: false,
        error: { message: '전송 실패' },
      });

      const result = await useDMStore.getState().sendMessage('tea-1', 'tea-2', '실패 메시지');

      expect(result).toBe(false);
      expect(useDMStore.getState().messages).toHaveLength(0);
    });

    // 엣지케이스
    it('빈 메시지도 API에 전달한다 (UI에서 검증)', async () => {
      vi.mocked(sendDMMessage).mockResolvedValue({
        success: true,
        data: { id: 'msg-x', senderId: 'tea-1', receiverId: 'tea-2', content: '', createdAt: '2026-02-07T12:00:00Z' },
      });

      const result = await useDMStore.getState().sendMessage('tea-1', 'tea-2', '');
      expect(result).toBe(true);
    });

    it('긴 메시지도 전송할 수 있다', async () => {
      const longContent = '가'.repeat(2000);
      vi.mocked(sendDMMessage).mockResolvedValue({
        success: true,
        data: { id: 'msg-long', senderId: 'tea-1', receiverId: 'tea-2', content: longContent, createdAt: '2026-02-07T12:00:00Z' },
      });

      const result = await useDMStore.getState().sendMessage('tea-1', 'tea-2', longContent);
      expect(result).toBe(true);
      expect(useDMStore.getState().messages[0].content).toHaveLength(2000);
    });
  });

  // ========== 유즈케이스: 연락처 목록 구성 ==========
  describe('buildContacts - 연락처 목록 구성', () => {
    it('선생님 목록에서 자신을 제외한 연락처를 구성한다', async () => {
      vi.mocked(fetchRecentDMForUser).mockResolvedValue([]);

      await useDMStore.getState().buildContacts('tea-1', mockTeachers);

      const contacts = useDMStore.getState().contacts;
      expect(contacts).toHaveLength(2); // 자신(tea-1) 제외
      expect(contacts.map((c) => c.teacherId)).not.toContain('tea-1');
    });

    it('최근 메시지가 있는 연락처가 상단에 정렬된다', async () => {
      vi.mocked(fetchRecentDMForUser).mockResolvedValue([
        { id: 'msg-1', senderId: 'tea-3', receiverId: 'tea-1', content: '최근 메시지', createdAt: '2026-02-07T12:00:00Z' },
      ]);

      await useDMStore.getState().buildContacts('tea-1', mockTeachers);

      const contacts = useDMStore.getState().contacts;
      expect(contacts[0].teacherId).toBe('tea-3'); // 최근 메시지가 있는 선생님이 상단
    });

    it('미읽은 메시지 수를 계산한다', async () => {
      vi.mocked(fetchRecentDMForUser).mockResolvedValue([
        { id: 'msg-1', senderId: 'tea-2', receiverId: 'tea-1', content: '읽지 않음 1', createdAt: '2026-02-07T10:00:00Z' },
        { id: 'msg-2', senderId: 'tea-2', receiverId: 'tea-1', content: '읽지 않음 2', createdAt: '2026-02-07T10:01:00Z' },
        { id: 'msg-3', senderId: 'tea-1', receiverId: 'tea-2', content: '내가 보낸 것', createdAt: '2026-02-07T10:02:00Z' },
      ]);

      await useDMStore.getState().buildContacts('tea-1', mockTeachers);

      const tea2Contact = useDMStore.getState().contacts.find((c) => c.teacherId === 'tea-2');
      expect(tea2Contact?.unreadCount).toBe(2); // 내가 받은 것만 count
      expect(useDMStore.getState().unreadTotal).toBe(2);
    });

    // 엣지케이스
    it('선생님이 혼자일 때 빈 연락처 목록을 반환한다', async () => {
      vi.mocked(fetchRecentDMForUser).mockResolvedValue([]);
      await useDMStore.getState().buildContacts('tea-1', [mockTeachers[0]]);
      expect(useDMStore.getState().contacts).toHaveLength(0);
    });

    it('API 에러 시 기존 상태를 유지한다', async () => {
      vi.mocked(fetchRecentDMForUser).mockRejectedValue(new Error('Error'));
      await useDMStore.getState().buildContacts('tea-1', mockTeachers);
      // 에러여도 크래시 안남
      expect(useDMStore.getState().contacts).toEqual([]);
    });
  });

  // ========== 유즈케이스: 폴링 ==========
  describe('startPolling / stopPolling', () => {
    it('폴링을 시작하고 중지할 수 있다', () => {
      vi.mocked(fetchRecentDMForUser).mockResolvedValue([]);
      useDMStore.getState().startPolling('tea-1', mockTeachers);
      expect(useDMStore.getState().pollingTimer).not.toBeNull();

      useDMStore.getState().stopPolling();
      expect(useDMStore.getState().pollingTimer).toBeNull();
    });

    it('중복 폴링 시작 시 이전 타이머를 정리한다', () => {
      vi.mocked(fetchRecentDMForUser).mockResolvedValue([]);
      useDMStore.getState().startPolling('tea-1', mockTeachers);
      const timer1 = useDMStore.getState().pollingTimer;

      useDMStore.getState().startPolling('tea-1', mockTeachers);
      const timer2 = useDMStore.getState().pollingTimer;

      expect(timer1).not.toBe(timer2); // 새 타이머 생성
    });
  });
});
