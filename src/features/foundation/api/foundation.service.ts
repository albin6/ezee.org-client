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

export interface StudentCoordinator {
  id: string;
  name: string;
  batchNumber: string;
  studentNumber: string;
  password?: string;
  createdAt: string;
}

export interface Thread {
  id: string;
  title: string;
  status: 'OPEN' | 'RESOLVED' | 'CLOSED';
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    name: string;
  };
  messageCount?: number;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  senderId: string;
  message: string;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
  };
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

  // Coordinators
  getCoordinators: async (params: any) => {
    const res = await apiClient.get('/foundation/coordinators', { params });
    // This endpoint returns data, total, page, limit directly in json instead of wrapped in { success, data, message } based on our controller structure
    // Wait, the other endpoints are wrapped with ApiResponse.success(res, data) which wraps it in { success: true, data: ... }. 
    // Wait, in my StudentCoordinatorController I wrote `res.json({ data: result.data, total: result.total, page, limit })`. 
    // And for create I wrote `res.status(201).json(coordinator)`. Let's just return res.data.
    return res.data;
  },
  createCoordinator: async (data: any) => {
    const res = await apiClient.post('/foundation/coordinators', data);
    return res.data;
  },
  createCoordinatorsBulk: async (data: any[]) => {
    const res = await apiClient.post('/foundation/coordinators/bulk', { coordinators: data });
    return res.data;
  },
  updateCoordinator: async (id: string, data: any) => {
    const res = await apiClient.patch(`/foundation/coordinators/${id}`, data);
    return res.data;
  },
  deleteCoordinator: async (id: string) => {
    const res = await apiClient.delete(`/foundation/coordinators/${id}`);
    return res.data;
  },

  // Student Coordinators
  getStudentCoordinators: async () => {
    const res = await apiClient.get('/foundation/coordinators');
    return res.data.data || res.data;
  },

  // Threads
  getThreads: async (params: any) => {
    const res = await apiClient.get('/foundation/threads', { params });
    return res.data;
  },
  getThread: async (id: string) => {
    const res = await apiClient.get(`/foundation/threads/${id}`);
    return res.data;
  },
  createThread: async (data: any) => {
    const res = await apiClient.post('/foundation/threads', data);
    return res.data;
  },
  updateThreadStatus: async (id: string, status: 'OPEN' | 'RESOLVED' | 'CLOSED') => {
    const res = await apiClient.patch(`/foundation/threads/${id}/status`, { status });
    return res.data;
  },
  getThreadMessages: async (id: string) => {
    const res = await apiClient.get(`/foundation/threads/${id}/messages`);
    return res.data;
  },
  createMessage: async (id: string, message: string) => {
    const res = await apiClient.post(`/foundation/threads/${id}/messages`, { message });
    return res.data;
  },
  
  getThreadCoordinators: async (id: string) => {
    const res = await apiClient.get(`/foundation/threads/${id}/coordinators`);
    return res.data;
  },
  addThreadCoordinator: async (id: string, coordinatorId: string) => {
    const res = await apiClient.post(`/foundation/threads/${id}/coordinators`, { coordinatorId });
    return res.data;
  },
  getThreadAssignments: async (id: string) => {
    const res = await apiClient.get(`/foundation/threads/${id}/assignments`);
    return res.data;
  },
  runThreadAutoAssign: async (id: string) => {
    const res = await apiClient.post(`/foundation/threads/${id}/auto-assign`);
    return res.data;
  },

  // Overview
  getOverviewMetrics: async () => {
    const res = await apiClient.get('/foundation/overview');
    return res.data;
  },

  // Evaluations
  getEvaluationsByStudent: async (studentId: string) => {
    const res = await apiClient.get(`/foundation/evaluations/student/${studentId}`);
    return res.data;
  },
  getEvaluationsByBatch: async (batchId: string, dayNumber?: number) => {
    const params = dayNumber ? { dayNumber } : {};
    const res = await apiClient.get(`/foundation/evaluations/batch/${batchId}`, { params });
    return res.data;
  },
  submitEvaluation: async (data: any) => {
    const res = await apiClient.post('/foundation/evaluations', data);
    return res.data;
  },
  updateEvaluation: async (id: string, data: any) => {
    const res = await apiClient.patch(`/foundation/evaluations/${id}`, data);
    return res.data;
  },

  // Exams
  getExamsByStudent: async (studentId: string) => {
    const res = await apiClient.get(`/foundation/exams/student/${studentId}`);
    return res.data;
  },
  recordExam: async (data: any) => {
    const res = await apiClient.post('/foundation/exams', data);
    return res.data;
  },
  updateExam: async (id: string, data: any) => {
    const res = await apiClient.patch(`/foundation/exams/${id}`, data);
    return res.data;
  }
};
