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
  messages?: { id: string; content: string; audioUrl?: string; createdAt: string; isSystem: boolean; user: { id: string; name: string }; replyTo?: any; reactions?: any[] }[];
  version: number;
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

  updateStatus: async (id: string, status: string, version?: number) => {
    const { data } = await apiClient.patch(`/tickets/${id}/status`, { status, version });
    return data;
  },

  addMessage: async (ticketId: string, content: string, statusChange?: 'CLOSED' | 'REOPENED', replyToId?: string, audioUrl?: string) => {
    const payload: any = { content };
    if (statusChange) payload.statusChange = statusChange;
    if (replyToId) payload.replyToId = replyToId;
    if (audioUrl) payload.audioUrl = audioUrl;
    const { data } = await apiClient.post(`/tickets/${ticketId}/messages`, payload);
    return data;
  },

  uploadAudio: async (audioBlob: Blob): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-message.webm');
    
    // We send this as multipart/form-data
    const { data } = await apiClient.post('/upload/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data.data; // ApiResponse format: { status: 'success', data: { url: '...' } }
  },

  toggleReaction: async (ticketId: string, messageId: string, reaction: string) => {
    const { data } = await apiClient.post(`/tickets/${ticketId}/messages/${messageId}/reactions`, { reaction });
    return data;
  }
};
