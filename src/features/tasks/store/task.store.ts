import { create } from 'zustand';
import { taskApi } from '../api/task.api';
import type { Task } from '../api/task.api';

interface TabCache {
  tasks: Task[];
  total: number;
}

interface TaskState {
  tasks: Task[];
  total: number;
  loading: boolean;
  error: string | null;
  activeFilter: string;
  tasksByTab: Record<string, TabCache>;
  fetchTasks: (params: any) => Promise<void>;
  createTask: (data: any, currentUserId?: string) => Promise<Task>;
  updateTask: (id: string, data: any) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  delegateTask: (id: string, toUserId: string) => Promise<void>;
  setTab: (tab: string) => void;
}

const prependUnique = (list: Task[] = [], item: Task) => [
  item,
  ...list.filter((t) => t.id !== item.id),
];

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  total: 0,
  loading: false,
  error: null,
  activeFilter: 'all',
  tasksByTab: {},

  setTab: (tab: string) => {
    const cached = get().tasksByTab[tab];
    if (cached) {
      set({ tasks: cached.tasks, total: cached.total, activeFilter: tab });
    } else {
      set({ activeFilter: tab });
    }
  },

  fetchTasks: async (params: any) => {
    const tabKey = params?.filter || 'all';
    const cached = get().tasksByTab[tabKey];

    // If cache is present for this tab, switch visible data immediately to avoid flash of empty content
    if (cached && get().activeFilter !== tabKey) {
      set({ tasks: cached.tasks, total: cached.total, activeFilter: tabKey, loading: true, error: null });
    } else {
      set({ loading: true, error: null, activeFilter: tabKey });
    }

    try {
      const response = await taskApi.getTasks(params);
      const fetchedTasks: Task[] = response.data || [];
      const fetchedTotal: number = response.meta?.total || 0;

      set((state) => ({
        tasks: fetchedTasks,
        total: fetchedTotal,
        loading: false,
        tasksByTab: {
          ...state.tasksByTab,
          [tabKey]: { tasks: fetchedTasks, total: fetchedTotal },
        },
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to fetch tasks', loading: false });
    }
  },

  createTask: async (data: any, currentUserId?: string) => {
    try {
      const newTask: Task = await taskApi.createTask(data);

      const isAssignedToMe = currentUserId
        ? (newTask.assignees?.some((a: any) => (a.userId || a.user?.id) === currentUserId) ||
           data.assigneeIds?.includes(currentUserId))
        : false;

      const isAssignedByMe = currentUserId ? newTask.createdById === currentUserId : true;

      set((state) => {
        const newByTab = { ...state.tasksByTab };

        if (isAssignedByMe) {
          const prev = newByTab['assigned_by_me'] || { tasks: [], total: 0 };
          newByTab['assigned_by_me'] = {
            tasks: prependUnique(prev.tasks, newTask),
            total: prev.total + 1,
          };
        }

        if (isAssignedToMe) {
          const prev = newByTab['assigned_to_me'] || { tasks: [], total: 0 };
          newByTab['assigned_to_me'] = {
            tasks: prependUnique(prev.tasks, newTask),
            total: prev.total + 1,
          };
        }

        if (newByTab['all']) {
          newByTab['all'] = {
            tasks: prependUnique(newByTab['all'].tasks, newTask),
            total: newByTab['all'].total + 1,
          };
        }

        const filter = state.activeFilter;
        const shouldShowInCurrentView =
          filter === 'all' ||
          (filter === 'assigned_to_me' && isAssignedToMe) ||
          (filter === 'assigned_by_me' && isAssignedByMe);

        let currentVisibleTasks = state.tasks;
        let currentTotal = state.total;

        if (shouldShowInCurrentView) {
          currentVisibleTasks = prependUnique(state.tasks, newTask);
          currentTotal = state.total + 1;
        }

        return {
          tasksByTab: newByTab,
          tasks: currentVisibleTasks,
          total: currentTotal,
        };
      });

      return newTask;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to create task');
    }
  },

  updateTask: async (id: string, data: any) => {
    try {
      const updatedTask: Task = await taskApi.updateTask(id, data);

      set((state) => {
        const updateList = (list: Task[] = []) =>
          list.map((t) => (t.id === id ? { ...t, ...updatedTask } : t));

        const newByTab: Record<string, TabCache> = {};
        Object.keys(state.tasksByTab).forEach((k) => {
          newByTab[k] = {
            tasks: updateList(state.tasksByTab[k].tasks),
            total: state.tasksByTab[k].total,
          };
        });

        return {
          tasksByTab: newByTab,
          tasks: updateList(state.tasks),
        };
      });

      return updatedTask;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to update task');
    }
  },

  deleteTask: async (id: string) => {
    try {
      await taskApi.deleteTask(id);

      set((state) => {
        const removeList = (list: Task[] = []) => list.filter((t) => t.id !== id);

        const newByTab: Record<string, TabCache> = {};
        Object.keys(state.tasksByTab).forEach((k) => {
          newByTab[k] = {
            tasks: removeList(state.tasksByTab[k].tasks),
            total: Math.max(0, state.tasksByTab[k].total - 1),
          };
        });

        return {
          tasksByTab: newByTab,
          tasks: removeList(state.tasks),
          total: Math.max(0, state.total - 1),
        };
      });
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to delete task');
    }
  },

  delegateTask: async (id: string, toUserId: string) => {
    try {
      await taskApi.delegateTask(id, toUserId);
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to delegate task');
    }
  }
}));
