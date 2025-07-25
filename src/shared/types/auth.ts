export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  refreshToken?: string;
}
