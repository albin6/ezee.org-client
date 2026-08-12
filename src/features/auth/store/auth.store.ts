import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SuperAdminPayload, UserPayload } from '../types/auth.types';

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  user: SuperAdminPayload | UserPayload | null;
  login: (token: string) => void;
  logout: () => void;
  setUser: (user: SuperAdminPayload | UserPayload) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      isAuthenticated: false,
      user: null,

      login: (token: string) => set({ accessToken: token, isAuthenticated: true }),
      
      logout: () => set({ accessToken: null, isAuthenticated: false, user: null }),
      
      setUser: (user: SuperAdminPayload | UserPayload) => set({ user }),
    }),
    {
      name: 'auth-storage', // key in localStorage
    }
  )
);
