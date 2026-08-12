import { create } from 'zustand';
import { rbacService } from '../api/rbac.service';
import type { Role, Permission } from '../api/rbac.service';

interface RbacState {
  roles: Role[];
  permissions: Permission[];
  isLoading: boolean;
  error: string | null;
  fetchRoles: () => Promise<void>;
  fetchPermissions: () => Promise<void>;
  createRole: (data: { name: string; description?: string }) => Promise<Role>;
  updateRole: (id: string, data: { name: string; description?: string }) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
  assignPermissions: (roleId: string, permissionIds: string[]) => Promise<void>;
  updateHierarchy: (roles: Role[]) => Promise<void>;
}

export const useRbacStore = create<RbacState>((set, get) => ({
  roles: [],
  permissions: [],
  isLoading: false,
  error: null,

  fetchRoles: async () => {
    set({ isLoading: true, error: null });
    try {
      const roles = await rbacService.getRoles();
      set({ roles, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to fetch roles', isLoading: false });
    }
  },

  fetchPermissions: async () => {
    try {
      const permissions = await rbacService.getPermissions();
      set({ permissions });
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  },

  createRole: async (data: { name: string; description?: string }): Promise<Role> => {
    set({ isLoading: true, error: null });
    try {
      const role = await rbacService.createRole(data);
      await get().fetchRoles();
      return role;
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to create role', isLoading: false });
      throw error;
    }
  },

  updateRole: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await rbacService.updateRole(id, data);
      await get().fetchRoles();
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to update role', isLoading: false });
      throw error;
    }
  },

  deleteRole: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await rbacService.deleteRole(id);
      await get().fetchRoles();
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to delete role', isLoading: false });
      throw error;
    }
  },

  assignPermissions: async (roleId, permissionIds) => {
    set({ isLoading: true, error: null });
    try {
      await rbacService.assignPermissions(roleId, permissionIds);
      await get().fetchRoles();
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to assign permissions', isLoading: false });
      throw error;
    }
  },

  updateHierarchy: async (orderedRoles: Role[]) => {
    // Optimistic UI update
    set({ roles: orderedRoles });
    
    try {
      const hierarchy = orderedRoles.map((role, index) => ({ id: role.id, level: index }));
      await rbacService.updateHierarchy(hierarchy);
      await get().fetchRoles();
    } catch (error) {
      set({ error: (error as Error).message || 'Failed to update hierarchy', isLoading: false });
      await get().fetchRoles(); // Revert on failure
      throw error;
    }
  },
}));
