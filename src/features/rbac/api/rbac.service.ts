import { apiClient as api } from '@/shared/api/axios';

export interface Permission {
  id: string;
  name: string;
  module: string;
  description: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  level?: number;
  parentRoleIds?: string[];
  permissions: string[]; // List of permission names
  teamId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface RoleHierarchyNode {
  id: string;
  name: string;
  description: string | null;
  level: number;
  parentRoleIds: string[];
  childRoleIds: string[];
  teamId?: string | null;
}

export const rbacService = {
  getRoles: async (): Promise<Role[]> => {
    const response = await api.get('/rbac/roles');
    return response.data.data;
  },

  createRole: async (data: {
    name: string;
    description?: string;
    parentRoleIds?: string[];
  }): Promise<Role> => {
    const response = await api.post('/rbac/roles', data);
    return response.data.data;
  },

  updateRole: async (
    id: string,
    data: { name: string; description?: string; parentRoleIds?: string[] },
  ): Promise<Role> => {
    const response = await api.put(`/rbac/roles/${id}`, data);
    return response.data.data;
  },

  deleteRole: async (id: string): Promise<void> => {
    await api.delete(`/rbac/roles/${id}`);
  },

  assignPermissions: async (roleId: string, permissionIds: string[]): Promise<void> => {
    await api.post(`/rbac/roles/${roleId}/permissions`, { permissionIds });
  },

  updateHierarchy: async (
    hierarchy: { id: string; level?: number; parentRoleIds?: string[] }[],
  ): Promise<void> => {
    await api.put('/rbac/roles/hierarchy', hierarchy);
  },

  getHierarchyTree: async (): Promise<RoleHierarchyNode[]> => {
    const response = await api.get('/rbac/roles/hierarchy/tree');
    return response.data.data;
  },

  getPermissions: async (): Promise<Permission[]> => {
    const response = await api.get('/rbac/permissions');
    return response.data.data;
  },
};
