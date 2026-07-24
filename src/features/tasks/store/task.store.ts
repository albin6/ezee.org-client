import { create } from 'zustand';
import { taskApi } from '../api/task.api';
import type { Task } from '../api/task.api';

interface TaskState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  fetchTasks: (params: any) => Promise<void>;
  createTask: (data: any) => Promise<void>;
  updateTask: (id: string, data: any) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  delegateTask: (id: string, toUserId: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async (params: any) => {
    set({ loading: true, error: null });
    try {
      const tasks = await taskApi.getTasks(params);
      set({ tasks, loading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to fetch tasks', loading: false });
    }
  },

  createTask: async (data: any) => {
    try {
      const newTask = await taskApi.createTask(data);
      set((state) => ({ tasks: [newTask, ...state.tasks] }));
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to create task');
    }
  },

  updateTask: async (id: string, data: any) => {
    try {
      const updatedTask = await taskApi.updateTask(id, data);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updatedTask : t)),
      }));
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to update task');
    }
  },

  deleteTask: async (id: string) => {
    try {
      await taskApi.deleteTask(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      }));
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to delete task');
    }
  },

  delegateTask: async (id: string, toUserId: string) => {
    try {
      await taskApi.delegateTask(id, toUserId);
      // Refetch or update optimistic state could go here
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to delegate task');
    }
  }
}));
