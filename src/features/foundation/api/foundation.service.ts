import { apiClient } from '@/shared/api/axios';

export interface Batch {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'BLOCKED';
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  batchId: string;
  status: 'ACTIVE' | 'BLOCKED';
  createdAt: string;
}

export const foundationService = {
  // Batches
  getBatches: async (params: any) => {
    const res = await apiClient.get('/foundation/batches', { params });
    return res.data.data;
  },
  createBatch: async (data: any) => {
    const res = await apiClient.post('/foundation/batches', data);
    return res.data.data;
  },
  updateBatch: async (id: string, data: any) => {
    const res = await apiClient.patch(`/foundation/batches/${id}`, data);
    return res.data.data;
  },
  deleteBatch: async (id: string) => {
    const res = await apiClient.delete(`/foundation/batches/${id}`);
    return res.data;
  },
  blockBatch: async (id: string, block: boolean) => {
    const res = await apiClient.patch(`/foundation/batches/${id}/block`, { block });
    return res.data.data;
  },

  // Students
  getStudents: async (params: any) => {
    const res = await apiClient.get('/foundation/students', { params });
    return res.data.data;
  },
  createStudent: async (data: any) => {
    const res = await apiClient.post('/foundation/students', data);
    return res.data.data;
  },
  updateStudent: async (id: string, data: any) => {
    const res = await apiClient.patch(`/foundation/students/${id}`, data);
    return res.data.data;
  },
  deleteStudent: async (id: string) => {
    const res = await apiClient.delete(`/foundation/students/${id}`);
    return res.data;
  },
  blockStudent: async (id: string, block: boolean) => {
    const res = await apiClient.patch(`/foundation/students/${id}/block`, { block });
    return res.data.data;
  },
  bulkImportStudents: async (data: string, batchId: string) => {
    const res = await apiClient.post('/foundation/students/bulk-import', { data, batchId });
    return res.data.data;
  },
};
