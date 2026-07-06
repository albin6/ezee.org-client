import { apiClient as api } from '@/shared/api/axios';
import type { User, GetUsersParams, CreateUserPayload, UpdateUserPayload, UsersResponse } from '../types';

export const userService = {
  getUsers: async (params?: GetUsersParams): Promise<UsersResponse> => {
    const { data } = await api.get('/users', { params });
    return data;
  },

  getUser: async (id: string): Promise<User> => {
    const { data } = await api.get(`/users/${id}`);
    return data.data;
  },

  createUser: async (payload: CreateUserPayload): Promise<User> => {
    const { data } = await api.post('/users', payload);
    return data.data;
  },

  updateUser: async (id: string, payload: UpdateUserPayload): Promise<User> => {
    const { data } = await api.patch(`/users/${id}`, payload);
    return data.data;
  },

  changeUserStatus: async (id: string, status: 'ACTIVE' | 'BLOCKED'): Promise<User> => {
    const { data } = await api.patch(`/users/${id}/status`, { status });
    return data.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};
