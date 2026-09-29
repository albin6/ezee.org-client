import { apiClient } from '@/shared/api/axios';
import type { AuthResponse, ProfileResponse } from '../types/auth.types';
import { z } from 'zod';
import { adminLoginSchema } from '../schemas/auth.schema';

type LoginPayload = z.infer<typeof adminLoginSchema>;

export interface ForgotPasswordOtpResponse {
  status: string;
  message: string;
  data: {
    success: boolean;
    message: string;
    expiresIn: number;
  };
}

export interface VerifyOtpResponse {
  status: string;
  message: string;
  data: {
    success: boolean;
    message: string;
    resetToken: string;
    resetLink: string;
    expiresIn: number;
  };
}

export interface SimpleAuthActionResponse {
  status: string;
  message: string;
  data: {
    success?: boolean;
    valid?: boolean;
    message: string;
  };
}

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

  requestPasswordResetLink: async (email: string): Promise<SimpleAuthActionResponse> => {
    const response = await apiClient.post<SimpleAuthActionResponse>('/auth/forgot-password', { email });
    return response.data;
  },

  requestPasswordResetOtp: async (email: string): Promise<ForgotPasswordOtpResponse> => {
    const response = await apiClient.post<ForgotPasswordOtpResponse>('/auth/forgot-password/request-otp', { email });
    return response.data;
  },

  verifyPasswordResetOtp: async (email: string, otp: string): Promise<VerifyOtpResponse> => {
    const response = await apiClient.post<VerifyOtpResponse>('/auth/forgot-password/verify-otp', { email, otp });
    return response.data;
  },

  resetPassword: async (data: {
    token: string;
    email: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<SimpleAuthActionResponse> => {
    const response = await apiClient.post<SimpleAuthActionResponse>('/auth/reset-password', data);
    return response.data;
  },

  verifyCurrentPassword: async (currentPassword: string): Promise<SimpleAuthActionResponse> => {
    const response = await apiClient.post<SimpleAuthActionResponse>('/auth/verify-current-password', {
      currentPassword,
    });
    return response.data;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<SimpleAuthActionResponse> => {
    const response = await apiClient.post<SimpleAuthActionResponse>('/auth/change-password', data);
    return response.data;
  },
};
