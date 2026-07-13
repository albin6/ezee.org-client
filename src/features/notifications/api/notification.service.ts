import { apiClient } from '@/shared/api/axios';

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string | null;
  isRead: boolean;
  linkUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export const inAppNotificationService = {
  getMyNotifications: async (limit = 50) => {
    const { data } = await apiClient.get('/notifications/my-notifications', { params: { limit } });
    return data;
  },

  markAsRead: async (id: string) => {
    const { data } = await apiClient.patch(`/notifications/my-notifications/${id}/read`);
    return data;
  },

  markAllAsRead: async () => {
    const { data } = await apiClient.patch('/notifications/my-notifications/read-all');
    return data;
  }
};
