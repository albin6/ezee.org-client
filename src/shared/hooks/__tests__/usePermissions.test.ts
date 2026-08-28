import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '../usePermissions';
import { useAuthStore } from '@/features/auth/store/auth.store';

describe('usePermissions Hook', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('returns true for any permission when user is super_admin', () => {
    useAuthStore.setState({
      user: {
        type: 'super_admin',
        sub: 'admin@example.com',
        role: 'Super Admin',
      } as any,
      isAuthenticated: true,
      accessToken: 'test-admin-token',
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasPermission('tickets:delete')).toBe(true);
    expect(result.current.hasPermission('roles:write')).toBe(true);
    expect(result.current.hasPermission('foundation:admin')).toBe(true);
    expect(result.current.hasPermission('any_arbitrary_permission')).toBe(true);
  });

  it('returns true only for permissions present in standard user permissions array', () => {
    useAuthStore.setState({
      user: {
        type: 'user',
        sub: 'user-123',
        permissions: ['tickets:read', 'tasks:create', 'tasks:read'],
      } as any,
      isAuthenticated: true,
      accessToken: 'test-user-token',
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasPermission('tickets:read')).toBe(true);
    expect(result.current.hasPermission('tasks:create')).toBe(true);
    expect(result.current.hasPermission('tickets:delete')).toBe(false);
    expect(result.current.hasPermission('roles:write')).toBe(false);
  });

  it('returns false when no user is authenticated', () => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      accessToken: null,
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasPermission('tickets:read')).toBe(false);
  });
});
