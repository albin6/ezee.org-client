import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../auth.store';

describe('useAuthStore State & Persistence', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('initializes with default unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('updates state on successful login', () => {
    useAuthStore.getState().login('jwt-access-token-xyz');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('jwt-access-token-xyz');
    expect(state.isAuthenticated).toBe(true);
  });

  it('sets user profile data correctly', () => {
    const mockUser = {
      type: 'user' as const,
      sub: 'usr-999',
      email: 'member@example.com',
      role: 'Engineer',
    };

    useAuthStore.getState().setUser(mockUser as any);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
  });

  it('clears credentials and resets state on logout', () => {
    useAuthStore.getState().login('sample-token');
    useAuthStore.getState().setUser({ type: 'super_admin', sub: 'admin@example.com' } as any);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});
