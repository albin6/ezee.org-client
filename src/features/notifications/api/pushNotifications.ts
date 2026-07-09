import { apiClient } from '@/shared/api/axios';

export const pushNotificationsApi = {
  getVapidPublicKey: async (): Promise<{ data: { publicKey: string } }> => {
    const response = await apiClient.get('/notifications/vapid-public-key');
    return response.data;
  },

  subscribe: async (subscription: PushSubscription): Promise<void> => {
    await apiClient.post('/notifications/subscribe', { subscription });
  },

  unsubscribe: async (endpoint: string): Promise<void> => {
    await apiClient.post('/notifications/unsubscribe', { endpoint });
  },
};
