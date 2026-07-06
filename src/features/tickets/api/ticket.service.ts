import { apiClient } from '@/shared/api/axios';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  teamId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  createdBy?: { id: string; name: string; email: string };
  team?: { id: string; name: string };
  assignees?: { user: { id: string; name: string; email: string } }[];
  messages?: { id: string; content: string; createdAt: string; user: { id: string; name: string } }[];
}

export const ticketService = {
  getTickets: async (params: any) => {
    const { data } = await apiClient.get('/tickets', { params });
    return data;
  },

  getTicket: async (id: string) => {
    const { data } = await apiClient.get(`/tickets/${id}`);
    return data;
  },

  createTicket: async (payload: { title: string; description?: string; teamId: string; assignees?: string[] }) => {
    const { data } = await apiClient.post('/tickets', payload);
    return data;
  },

  updateStatus: async (id: string, status: string) => {
    const { data } = await apiClient.patch(`/tickets/${id}/status`, { status });
    return data;
  },

  addMessage: async (id: string, content: string) => {
    const { data } = await apiClient.post(`/tickets/${id}/messages`, { content });
    return data;
  }
};
