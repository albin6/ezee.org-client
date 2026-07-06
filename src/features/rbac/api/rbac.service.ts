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
  permissions: string[]; // List of permission names
  teamId?: string | null;
  createdAt: string;
}

export const rbacService = {
  getRoles: async (): Promise<Role[]> => {
    const response = await api.get('/rbac/roles');
    return response.data.data;
  },

  createRole: async (data: { name: string; description?: string }): Promise<Role> => {
    const response = await api.post('/rbac/roles', data);
    return response.data.data;
  },

  updateRole: async (id: string, data: { name: string; description?: string }): Promise<Role> => {
    const response = await api.put(`/rbac/roles/${id}`, data);
    return response.data.data;
  },

  deleteRole: async (id: string): Promise<void> => {
    await api.delete(`/rbac/roles/${id}`);
  },

  assignPermissions: async (roleId: string, permissionIds: string[]): Promise<void> => {
    await api.post(`/rbac/roles/${roleId}/permissions`, { permissionIds });
  },

  getPermissions: async (): Promise<Permission[]> => {
    const response = await api.get('/rbac/permissions');
    return response.data.data;
  },
};
