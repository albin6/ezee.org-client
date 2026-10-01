import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleHierarchyView } from '../RoleHierarchyView';
import type { Role } from '../../api/rbac.service';

// Mock matchMedia for Ant Design responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock permissions hook
vi.mock('@/shared/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: () => true,
    userRole: 'Super Admin',
  }),
}));

describe('RoleHierarchyView', () => {
  const sampleRoles: Role[] = [
    {
      id: 'role-a',
      name: 'Role A',
      description: 'Executive Director',
      level: 0,
      parentRoleIds: [],
      permissions: ['users:read', 'users:write'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'role-b',
      name: 'Role B',
      description: 'Engineering Lead',
      level: 1,
      parentRoleIds: ['role-a'],
      permissions: ['tasks:read'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'role-c',
      name: 'Role C',
      description: 'Product Lead',
      level: 1,
      parentRoleIds: ['role-a'],
      permissions: ['tickets:read'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'role-d',
      name: 'Role D',
      description: 'Full Stack Engineer',
      level: 2,
      parentRoleIds: ['role-b', 'role-c'],
      permissions: ['tasks:read'],
      createdAt: new Date().toISOString(),
    },
  ];

  it('renders the hierarchy tiers with corresponding role cards and inheritance labels', () => {
    render(
      <RoleHierarchyView
        roles={sampleRoles}
        isLoading={false}
        onEditRole={vi.fn()}
        onUpdateHierarchy={vi.fn().mockResolvedValue(undefined)}
        scopeLabel="Platform"
      />,
    );

    // Check tier headers
    expect(screen.getByText(/Root Tier \(Highest Authority\)/i)).toBeDefined();
    expect(screen.getByText(/Tier Level 1 Subordinates/i)).toBeDefined();
    expect(screen.getByText(/Tier Level 2 Subordinates/i)).toBeDefined();

    // Check role names (Role A appears as title and in parent tags for B and C)
    expect(screen.getAllByText('Role A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Role B').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Role C').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Role D').length).toBeGreaterThanOrEqual(1);

    // Check parent labels
    expect(screen.getByText('None (Root)')).toBeDefined();
  });

  it('shows empty state when no roles are configured', () => {
    render(
      <RoleHierarchyView
        roles={[]}
        isLoading={false}
        onEditRole={vi.fn()}
        onUpdateHierarchy={vi.fn().mockResolvedValue(undefined)}
        scopeLabel="Platform"
      />,
    );

    expect(screen.getByText(/No platform roles configured yet/i)).toBeDefined();
  });
});
