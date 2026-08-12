export interface SuperAdminPayload {
  type: 'super_admin';
  identifier: string;
}

export interface UserPayload {
  type: 'user';
  id: string;
  email: string;
  name: string;
  permissions?: string[];
  [key: string]: any;
}

export interface AuthResponse {
  status: string;
  message: string;
  data: {
    accessToken: string;
  };
}

export interface ProfileResponse {
  status: string;
  message: string;
  data: SuperAdminPayload | UserPayload;
}
