import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDMStore } from '../stores/dmStore';
import type { Teacher } from '../types';

// Mock notion service
vi.mock('../services/notion', () => ({
  fetchDMMessages: vi.fn(),
  sendDMMessage: vi.fn(),
  fetchRecentDMForUser: vi.fn(),
}));

import { sendDMMessage, fetchRecentDMForUser } from '../services/notion';

const mockTeachers: Teacher[] = [
  { id: 'tea-1', name: '서재용', subjects: ['수학'], pin: '1234', isAdmin: true },
  { id: 'tea-2', name: '지혜영', subjects: ['영어'], pin: '5678', isAdmin: false },
];

// ============================================================
// Edge Case: DMStore sendMessage - 네트워크 예외
// ============================================================
describe('Edge: DMStore sendMessage 네트워크 예외', () => {
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

  it('sendDMMessage가 throw하면 optimistic 메시지가 남을 수 있다 (현재 동작 확인)', async () => {
    // sendMessage에는 try-catch가 없으므로 예외가 전파됨
    vi.mocked(sendDMMessage).mockRejectedValue(new Error('Network error'));

    await expect(
      useDMStore.getState().sendMessage('tea-1', 'tea-2', '테스트')
    ).rejects.toThrow('Network error');

    // optimistic 메시지가 state에 남아있음 (버그 확인용 테스트)
    const messages = useDMStore.getState().messages;
    expect(messages).toHaveLength(1); // temp 메시지가 제거되지 않음
    expect(messages[0].id).toMatch(/^temp-/);
  });
});

// ============================================================
// Edge Case: DMStore buildContacts - 특수 상황
// ============================================================
describe('Edge: DMStore buildContacts 특수 상황', () => {
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

  it('빈 선생님 배열 → 빈 연락처', async () => {
    vi.mocked(fetchRecentDMForUser).mockResolvedValue([]);
    await useDMStore.getState().buildContacts('tea-1', []);
    expect(useDMStore.getState().contacts).toHaveLength(0);
  });

  it('자기 자신만 있는 선생님 배열 → 빈 연락처', async () => {
    vi.mocked(fetchRecentDMForUser).mockResolvedValue([]);
    await useDMStore.getState().buildContacts('tea-1', [mockTeachers[0]]);
    expect(useDMStore.getState().contacts).toHaveLength(0);
  });

  it('lastMessage가 없는 연락처는 이름순 정렬', async () => {
    vi.mocked(fetchRecentDMForUser).mockResolvedValue([]);
    const teachers: Teacher[] = [
      { id: 'tea-1', name: '서재용', subjects: ['수학'], pin: '1234', isAdmin: true },
      { id: 'tea-c', name: '최영희', subjects: ['영어'], pin: '0000', isAdmin: false },
      { id: 'tea-b', name: '김철수', subjects: ['국어'], pin: '0000', isAdmin: false },
    ];
    await useDMStore.getState().buildContacts('tea-1', teachers);
    const contacts = useDMStore.getState().contacts;
    expect(contacts).toHaveLength(2);
    // 한국어 이름순: 김철수 < 최영희
    expect(contacts[0].teacherName).toBe('김철수');
    expect(contacts[1].teacherName).toBe('최영희');
  });

  it('같은 사람에게서 여러 메시지 → unread 누적', async () => {
    vi.mocked(fetchRecentDMForUser).mockResolvedValue([
      { id: 'msg-1', senderId: 'tea-2', receiverId: 'tea-1', content: '메시지1', createdAt: '2026-02-07T10:00:00Z' },
      { id: 'msg-2', senderId: 'tea-2', receiverId: 'tea-1', content: '메시지2', createdAt: '2026-02-07T10:01:00Z' },
      { id: 'msg-3', senderId: 'tea-2', receiverId: 'tea-1', content: '메시지3', createdAt: '2026-02-07T10:02:00Z' },
    ]);
    await useDMStore.getState().buildContacts('tea-1', mockTeachers);
    const contact = useDMStore.getState().contacts.find(c => c.teacherId === 'tea-2');
    expect(contact?.unreadCount).toBe(3);
    expect(useDMStore.getState().unreadTotal).toBe(3);
  });
});
