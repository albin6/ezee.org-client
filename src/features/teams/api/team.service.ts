import { apiClient } from '@/shared/api/axios';

export interface Team {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'BLOCKED';
  createdAt: string;
  updatedAt: string;
}

export interface GetTeamsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TeamsResponse {
  data: Team[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export const teamService = {
  getTeams: async (params?: GetTeamsParams): Promise<TeamsResponse> => {
    const response = await apiClient.get('/teams', { params });
    return response.data;
  },

  getTeam: async (id: string): Promise<Team> => {
    const response = await apiClient.get(`/teams/${id}`);
    return response.data.data;
  },

  createTeam: async (data: Partial<Team>): Promise<Team> => {
    const response = await apiClient.post('/teams', data);
    return response.data.data;
  },

  updateTeam: async (id: string, data: Partial<Team>): Promise<Team> => {
    const response = await apiClient.patch(`/teams/${id}`, data);
    return response.data.data;
  },

  deleteTeam: async (id: string): Promise<void> => {
    await apiClient.delete(`/teams/${id}`);
  },

  blockTeam: async (id: string): Promise<Team> => {
    const response = await apiClient.patch(`/teams/${id}/block`);
    return response.data.data;
  },

  // --- Permissions ---
  getTeamPermissions: async (teamId: string): Promise<string[]> => {
    const response = await apiClient.get(`/teams/${teamId}/permissions`);
    return response.data.data;
  },
  updateTeamPermissions: async (teamId: string, permissions: string[]): Promise<string[]> => {
    const response = await apiClient.put(`/teams/${teamId}/permissions`, { permissions });
    return response.data.data;
  },

  // --- Roles ---
  getTeamRoles: async (teamId: string): Promise<any[]> => {
    const response = await apiClient.get(`/teams/${teamId}/roles`);
    return response.data.data;
  },
  createTeamRole: async (teamId: string, data: { name: string; description?: string; permissions: string[] }): Promise<any> => {
    const response = await apiClient.post(`/teams/${teamId}/roles`, data);
    return response.data.data;
  },
  updateTeamRole: async (teamId: string, roleId: string, data: { name?: string; description?: string; permissions?: string[] }): Promise<any> => {
    const response = await apiClient.patch(`/teams/${teamId}/roles/${roleId}`, data);
    return response.data.data;
  },
  deleteTeamRole: async (teamId: string, roleId: string): Promise<void> => {
    await apiClient.delete(`/teams/${teamId}/roles/${roleId}`);
  },
  updateRoleHierarchy: async (teamId: string, hierarchy: { id: string; level: number }[]): Promise<void> => {
    await apiClient.put(`/teams/${teamId}/roles/hierarchy`, hierarchy);
  },

  // --- Members ---
  getTeamMembers: async (teamId: string, params?: { page?: number; limit?: number; search?: string }): Promise<any> => {
    const response = await apiClient.get(`/teams/${teamId}/members`, { params });
    return response.data; // Includes .data and .meta
  },
  addTeamMember: async (teamId: string, data: { name: string; email: string; designation: string; roleId: string; password?: string }): Promise<any> => {
    const response = await apiClient.post(`/teams/${teamId}/members`, data);
    return response.data.data;
  },
  updateMemberRole: async (teamId: string, userId: string, roleId: string): Promise<any> => {
    const response = await apiClient.patch(`/teams/${teamId}/members/${userId}/role`, { roleId });
    return response.data.data;
  },
  removeTeamMember: async (teamId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/teams/${teamId}/members/${userId}`);
  },
  blockTeamMember: async (teamId: string, userId: string): Promise<void> => {
    await apiClient.patch(`/teams/${teamId}/members/${userId}/block`);
  },
  unblockTeamMember: async (teamId: string, userId: string): Promise<void> => {
    await apiClient.patch(`/teams/${teamId}/members/${userId}/unblock`);
  },
};
