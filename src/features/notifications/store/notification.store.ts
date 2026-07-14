import { create } from 'zustand';
import { inAppNotificationService } from '../api/notification.service';
import type { InAppNotification } from "../api/notification.service"
import { message } from 'antd';
import { socketService } from '@/shared/services/socket.service';

interface NotificationState {
  notifications: InAppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  isSocketConnected: boolean;

  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  isSocketConnected: false,

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

  connectSocket: () => {
    const { isSocketConnected } = get();
    if (isSocketConnected) return;

    try {
      const socket = socketService.connect();
      
      socket.off('NEW_NOTIFICATION');
      socket.on('NEW_NOTIFICATION', (newNotif: InAppNotification) => {
        set((state) => ({
          notifications: [newNotif, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        message.info({
          content: newNotif.title,
          onClick: () => {
            if (newNotif.linkUrl) {
              window.location.href = newNotif.linkUrl;
            }
            get().markAsRead(newNotif.id);
          }
        });
      });

      set({ isSocketConnected: true });
    } catch (err) {
      console.error('Failed to connect socket for notifications', err);
    }
  },

  disconnectSocket: () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.off('NEW_NOTIFICATION');
      // We don't necessarily want to disconnect the entire socket here 
      // because other features (tickets) might use it.
      // The auth store logout will handle socketService.disconnect()
    }
    set({ isSocketConnected: false });
  }
}));
