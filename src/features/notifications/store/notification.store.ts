import { create } from 'zustand';
import { inAppNotificationService } from '../api/notification.service';
import type { InAppNotification } from "../api/notification.service"
import { message } from 'antd';

interface NotificationState {
  notifications: InAppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  eventSource: EventSource | null;

  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  connectSSE: (token: string) => void;
  disconnectSSE: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  eventSource: null,

  fetchNotifications: async () => {
    set({ loading: true, error: null });
    try {
      const response = await inAppNotificationService.getMyNotifications();
      const notifications = response.data || [];
      const unreadCount = notifications.filter((n: InAppNotification) => !n.isRead).length;
      set({ notifications, unreadCount, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch notifications', loading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await inAppNotificationService.markAsRead(id);
      set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        return {
          notifications,
          unreadCount: notifications.filter((n) => !n.isRead).length,
        };
      });
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await inAppNotificationService.markAllAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  },

  connectSSE: (token: string) => {
    const { eventSource } = get();
    if (eventSource) return; // Already connected

    // Use token in query param or rely on cookie depending on backend auth strategy
    // We append the token to the URL for SSE since we can't set headers easily in EventSource
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
    const source = new EventSource(`${baseUrl}/notifications/stream?token=${token}`);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'NEW_NOTIFICATION') {
          const newNotif = payload.data as InAppNotification;

          set((state) => ({
            notifications: [newNotif, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }));

          // Show Toast
          message.info({
            content: newNotif.title,
            onClick: () => {
              if (newNotif.linkUrl) {
                window.location.href = newNotif.linkUrl;
              }
              get().markAsRead(newNotif.id);
            }
          });
        }
      } catch (err) {
        console.error('Error parsing SSE data', err);
      }
    };

    source.onerror = (err) => {
      console.error('SSE connection error:', err);
      source.close();
      set({ eventSource: null });

      // Auto-reconnect logic could go here
      setTimeout(() => {
        const store = get();
        if (!store.eventSource && token) {
          store.connectSSE(token);
        }
      }, 5000);
    };

    set({ eventSource: source });
  },

  disconnectSSE: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null });
    }
  }
}));
