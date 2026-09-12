import { apiClient as api } from '@/shared/api/axios';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'VERIFIED' | 'CANCELLED' | 'REJECTED';
  completionType?: 'INDIVIDUAL' | 'SHARED';
  deadline: string;
  teamId: string;
  createdById: string;
  createdBy?: { id: string; name: string };
  recurrencePattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  assignees: any[];
  createdAt: string;
}

export const taskApi = {
  createTask: async (data: any) => {
    const response = await api.post('/tasks', data);
    return response.data.data;
  },

  updateTask: async (id: string, data: any) => {
    const response = await api.put(`/tasks/${id}`, data);
    return response.data.data;
  },

  getTask: async (id: string) => {
    const response = await api.get(`/tasks/${id}`);
    return response.data.data;
  },

  getTasks: async (params: any) => {
    const response = await api.get('/tasks', { params });
    return response.data;
  },

  getDashboardMetrics: async (params: any) => {
    const response = await api.get('/tasks/dashboard', { params });
    return response.data.data;
  },

  deleteTask: async (id: string) => {
    await api.delete(`/tasks/${id}`);
  },

  delegateTask: async (id: string, toUserId: string) => {
    const response = await api.post(`/tasks/${id}/delegate`, { toUserId });
    return response.data;
  }
};
