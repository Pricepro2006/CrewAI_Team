/**
 * User Model Types and Interfaces
 * Defines the structure for user-related data models in the authentication system
 */

export interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: "user" | "admin" | "moderator";
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;

  // Computed properties for convenience
  isAdmin?: boolean;
  rateLimits?: {
    requests: number;
    windowMs: number;
    lastReset: Date;
  };
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: "user" | "admin" | "moderator";
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;

  // Computed properties for convenience
  isAdmin?: boolean;
  rateLimits?: {
    requests: number;
    windowMs: number;
    lastReset: Date;
  };
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role?: "user" | "admin" | "moderator";
}

export interface UpdateUserInput {
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role?: "user" | "admin" | "moderator";
  is_active?: boolean;
  is_verified?: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked: boolean;
  created_at: string;
  last_used_at?: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  created_at: string;
  last_activity_at: string;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface EmailVerificationToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
  jti?: string; // JWT ID
}

export interface RefreshTokenPayload {
  sub: string; // user id
  tokenId: string;
  iat: number;
  exp: number;
}

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: "user" | "admin" | "moderator";
  is_active?: boolean;
  is_verified?: boolean;
  sort_by?:
    | "created_at"
    | "updated_at"
    | "last_login_at"
    | "email"
    | "username";
  sort_order?: "asc" | "desc";
}

export interface UserListResponse {
  users: PublicUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
