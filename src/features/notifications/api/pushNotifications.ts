import { api } from '@/shared/api/axios';

export const pushNotificationsApi = {
  getVapidPublicKey: async (): Promise<{ data: { publicKey: string } }> => {
    const response = await api.get('/notifications/vapid-public-key');
    return response.data;
  },

  subscribe: async (subscription: PushSubscription): Promise<void> => {
    await api.post('/notifications/subscribe', { subscription });
  },

  unsubscribe: async (endpoint: string): Promise<void> => {
    await api.post('/notifications/unsubscribe', { endpoint });
  },
};
