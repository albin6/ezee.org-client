export interface User {
  id: string;
  email: string;
  name: string;
  designation: string | null;
  status: 'ACTIVE' | 'BLOCKED';
  roleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  roleId?: string;
  teamId?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  designation?: string;
  password?: string;
  roleId?: string | null;
  status?: 'ACTIVE' | 'BLOCKED';
}

export interface UpdateUserPayload {
  name?: string;
  designation?: string;
  roleId?: string | null;
  status?: 'ACTIVE' | 'BLOCKED';
}

export interface UsersResponse {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
