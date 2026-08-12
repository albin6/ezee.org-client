import { create } from 'zustand';
import { userService } from '../api/user.service';
import type { User, GetUsersParams, CreateUserPayload, UpdateUserPayload } from '../types';

interface UserState {
  users: User[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  error: string | null;
  fetchUsers: (params?: GetUsersParams) => Promise<void>;
  createUser: (payload: CreateUserPayload) => Promise<User>;
  updateUser: (id: string, payload: UpdateUserPayload) => Promise<User>;
  changeUserStatus: (id: string, status: 'ACTIVE' | 'BLOCKED') => Promise<User>;
  deleteUser: (id: string) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  total: 0,
  page: 1,
  limit: 10,
  isLoading: false,
  error: null,

  fetchUsers: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await userService.getUsers(params);
      set({ 
        users: response.data, 
        total: response.meta.total,
        page: response.meta.page,
        limit: response.meta.limit,
        isLoading: false 
      });
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to fetch users', isLoading: false });
    }
  },

  createUser: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const user = await userService.createUser(payload);
      await get().fetchUsers({ page: get().page, limit: get().limit });
      return user;
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to create user', isLoading: false });
      throw error;
    }
  },

  updateUser: async (id, payload) => {
    set({ isLoading: true, error: null });
    try {
      const user = await userService.updateUser(id, payload);
      set((state) => ({
        users: state.users.map(u => u.id === id ? { ...u, ...user } : u),
        isLoading: false
      }));
      return user;
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to update user', isLoading: false });
      throw error;
    }
  },

  changeUserStatus: async (id, status) => {
    set({ isLoading: true, error: null });
    try {
      const user = await userService.changeUserStatus(id, status);
      set((state) => ({
        users: state.users.map(u => u.id === id ? { ...u, ...user } : u),
        isLoading: false
      }));
      return user;
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to change user status', isLoading: false });
      throw error;
    }
  },

  deleteUser: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await userService.deleteUser(id);
      await get().fetchUsers({ page: get().page, limit: get().limit });
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to delete user', isLoading: false });
      throw error;
    }
  },
}));
