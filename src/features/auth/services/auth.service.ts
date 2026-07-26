import { apiClient } from '@/shared/api/axios';
import type { AuthResponse, ProfileResponse } from '../types/auth.types';
import { z } from 'zod';
import { adminLoginSchema } from '../schemas/auth.schema';

type LoginPayload = z.infer<typeof adminLoginSchema>;

export const authService = {
  login: async (data: LoginPayload): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/admin/login', data);
    return response.data;
  },

  userLogin: async (data: LoginPayload): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  getProfile: async (): Promise<ProfileResponse> => {
    const response = await apiClient.get<ProfileResponse>('/auth/admin/profile');
    return response.data;
  },

  getUserProfile: async (): Promise<ProfileResponse> => {
    const response = await apiClient.get<ProfileResponse>('/auth/profile');
    return response.data;
  },

  coordinatorLogin: async (data: LoginPayload): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/coordinator/login', data);
    return response.data;
  },
};
