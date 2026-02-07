import { create } from 'zustand';
import type { DirectMessage, DMContact, Teacher } from '../types';
import { fetchDMMessages, sendDMMessage, fetchRecentDMForUser } from '../services/notion';

interface DMState {
  isOpen: boolean;
  currentChatPartnerId: string | null;
  messages: DirectMessage[];
  contacts: DMContact[];
  unreadTotal: number;
  isLoading: boolean;
  pollingTimer: ReturnType<typeof setInterval> | null;

  toggleWidget: () => void;
  closeWidget: () => void;
  selectContact: (teacherId: string) => void;
  goBackToContacts: () => void;
  sendMessage: (senderId: string, receiverId: string, content: string) => Promise<boolean>;
  fetchMessages: (userId: string, partnerId: string) => Promise<void>;
  buildContacts: (userId: string, teachers: Teacher[]) => Promise<void>;
  startPolling: (userId: string, teachers: Teacher[]) => void;
  stopPolling: () => void;
}

export const useDMStore = create<DMState>((set, get) => ({
  isOpen: false,
  currentChatPartnerId: null,
  messages: [],
  contacts: [],
  unreadTotal: 0,
  isLoading: false,
  pollingTimer: null,

  toggleWidget: () => set((s) => ({ isOpen: !s.isOpen })),
  closeWidget: () => set({ isOpen: false, currentChatPartnerId: null, messages: [] }),

  selectContact: (teacherId: string) => {
    set({ currentChatPartnerId: teacherId, messages: [], isLoading: true });
  },

  goBackToContacts: () => set({ currentChatPartnerId: null, messages: [] }),

  sendMessage: async (senderId, receiverId, content) => {
    // Optimistic update
    const tempMsg: DirectMessage = {
      id: `temp-${Date.now()}`,
      senderId,
      receiverId,
      content,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, tempMsg] }));

    const result = await sendDMMessage(senderId, receiverId, content);
    if (result.success && result.data) {
      set((s) => ({
        messages: s.messages.map((m) => (m.id === tempMsg.id ? result.data! : m)),
      }));
      return true;
    } else {
      set((s) => ({ messages: s.messages.filter((m) => m.id !== tempMsg.id) }));
      return false;
    }
  },

  fetchMessages: async (userId, partnerId) => {
    set({ isLoading: true });
    try {
      const messages = await fetchDMMessages(userId, partnerId);
      set({ messages, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  buildContacts: async (userId, teachers) => {
    try {
      const recentMessages = await fetchRecentDMForUser(userId);

      const contactMap = new Map<string, DMContact>();
      // Initialize all teachers as contacts
      for (const t of teachers) {
        if (t.id === userId) continue;
        contactMap.set(t.id, {
          teacherId: t.id,
          teacherName: t.name,
          unreadCount: 0,
        });
      }

      // Enrich with recent message data
      for (const msg of recentMessages) {
        const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        const contact = contactMap.get(partnerId);
        if (contact && !contact.lastMessage) {
          contact.lastMessage = msg.content;
          contact.lastMessageAt = msg.createdAt;
        }
        // Count unread (messages where I'm receiver)
        if (msg.receiverId === userId && contact) {
          contact.unreadCount++;
        }
      }

      const contacts = Array.from(contactMap.values()).sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt);
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return a.teacherName.localeCompare(b.teacherName);
      });

      const unreadTotal = contacts.reduce((sum, c) => sum + c.unreadCount, 0);
      set({ contacts, unreadTotal });
    } catch (error) {
      console.error('[DMStore] buildContacts failed:', error);
    }
  },

  startPolling: (userId, teachers) => {
    const { stopPolling } = get();
    stopPolling();

    const poll = () => {
      if (document.visibilityState !== 'visible') return;

      const { currentChatPartnerId } = get();
      if (currentChatPartnerId) {
        get().fetchMessages(userId, currentChatPartnerId);
      }
      get().buildContacts(userId, teachers);
    };

    poll(); // Initial fetch
    const timer = setInterval(poll, 10000);
    set({ pollingTimer: timer });
  },

  stopPolling: () => {
    const { pollingTimer } = get();
    if (pollingTimer) {
      clearInterval(pollingTimer);
      set({ pollingTimer: null });
    }
  },
}));
