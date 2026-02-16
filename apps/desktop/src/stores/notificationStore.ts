import { create } from 'zustand';
import type { AppNotification, NotificationStatus } from '../types';
import { fetchNotifications, updateNotificationStatus } from '../services/notion';

interface NotificationState {
    notifications: AppNotification[];
    unreadCount: number;
    isLoading: boolean;
    pollingTimer: ReturnType<typeof setInterval> | null;

    fetchNotifications: (teacherId: string) => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: (teacherId: string) => Promise<void>;
    startPolling: (teacherId: string) => void;
    stopPolling: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    pollingTimer: null,

    fetchNotifications: async (teacherId) => {
        if (!teacherId) return;
        set({ isLoading: true });
        try {
            const notifications = await fetchNotifications(teacherId);
            const unreadCount = notifications.filter((n) => n.status === 'unread').length;
            set({ notifications, unreadCount, isLoading: false });
        } catch (error) {
            console.error('[NotificationStore] fetchNotifications failed:', error);
            set({ isLoading: false });
        }
    },

    markAsRead: async (id) => {
        const { notifications } = get();
        // Optimistic update
        set({
            notifications: notifications.map((n) =>
                n.id === id ? { ...n, status: 'read', readAt: new Date().toISOString() } : n
            ),
            unreadCount: notifications.filter((n) => n.id !== id && n.status === 'unread').length,
        });

        await updateNotificationStatus(id, 'read');
    },

    markAllAsRead: async (teacherId) => {
        const { notifications } = get();
        const unread = notifications.filter((n) => n.status === 'unread');
        if (unread.length === 0) return;

        // Optimistic update
        const now = new Date().toISOString();
        set({
            notifications: notifications.map((n) => ({ ...n, status: 'read', readAt: now })),
            unreadCount: 0,
        });

        await Promise.all(unread.map((n) => updateNotificationStatus(n.id, 'read')));
        get().fetchNotifications(teacherId); // Sync with server
    },

    startPolling: (teacherId) => {
        const { stopPolling } = get();
        stopPolling();

        const poll = () => {
            if (document.visibilityState !== 'visible') return;
            get().fetchNotifications(teacherId);
        };

        poll(); // Initial fetch
        const timer = setInterval(poll, 15000); // 15 seconds
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
