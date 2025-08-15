import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type {
  User,
  PublicUser,
  CreateUserInput,
  UpdateUserInput,
  RefreshToken,
  UserSession,
  PasswordResetToken,
  EmailVerificationToken,
  UserListQuery,
  UserListResponse,
  ChangePasswordInput,
} from "../../database/models/User.js";
import { passwordManager } from "../utils/password.js";
import { jwtManager } from "../utils/jwt.js";
import appConfig from "../../config/app.config.js";

// Re-export types that tests need
export type { User, PublicUser } from "../../database/models/User.js";
export type { JWTPayload } from "../utils/jwt.js";
export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  MODERATOR = "moderator",
}

/**
 * UserService - Manages user authentication and user data operations
 * Provides comprehensive user management functionality including CRUD operations,
 * authentication, token management, and session handling
 */

export class UserService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath || appConfig?.database?.path;
    this.db = new Database(path);
  }

  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<PublicUser> {
    // Validate password strength
    const passwordValidation = passwordManager.validatePasswordStrength(
      input.password,
    );
    if (!passwordValidation.isValid) {
      throw new Error(
        `Password validation failed: ${passwordValidation?.errors?.join(", ")}`,
      );
    }

    // Check if user already exists
    const existingUser =
      this.getUserByEmail(input.email) ||
      this.getUserByUsername(input.username);
    if (existingUser) {
      throw new Error("User with this email or username already exists");
    }

    // Hash password
    const passwordHash = await passwordManager.hashPassword(input.password);

    // Create user record
    const userId = randomUUID();
    const now = new Date().toISOString();

    const stmt = this?.db?.prepare(`
      INSERT INTO users (
        id, email, username, password_hash, first_name, last_name, 
        avatar_url, role, is_active, is_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      input?.email?.toLowerCase(),
      input.username,
      passwordHash,
      input.first_name || null,
      input.last_name || null,
      input.avatar_url || null,
      input.role || "user",
      true,
      false,
      now,
      now,
    );

    const user = this.getUserById(userId);
    if (!user) {
      throw new Error("Failed to create user");
    }

    return this.toPublicUser(user);
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): User | null {
    const stmt = this?.db?.prepare("SELECT * FROM users WHERE id = ?");
    return stmt.get(id) as User | null;
  }

  /**
   * Get user by ID (alias for getUserById for compatibility)
   */
  getById(id: string): User | null {
    return this.getUserById(id);
  }

  /**
   * Verify token and return user
   */
  async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwtManager.verifyAccessToken(token);
      const user = this.getUserById(decoded.sub);

      if (!user || !user.is_active) {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): User | null {
    const stmt = this?.db?.prepare("SELECT * FROM users WHERE email = ?");
    return stmt.get(email.toLowerCase()) as User | null;
  }

  /**
   * Get user by username
   */
  getUserByUsername(username: string): User | null {
    const stmt = this?.db?.prepare("SELECT * FROM users WHERE username = ?");
    return stmt.get(username) as User | null;
  }

  /**
   * Update user
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<PublicUser> {
    const user = this.getUserById(id);
    if (!user) {
      throw new Error("User not found");
    }

    // Check for duplicate email/username if they're being changed
    if (input.email && input.email !== user.email) {
      const existingUser = this.getUserByEmail(input.email);
      if (existingUser) {
        throw new Error("Email already in use");
      }
    }

    if (input.username && input.username !== user.username) {
      const existingUser = this.getUserByUsername(input.username);
      if (existingUser) {
        throw new Error("Username already in use");
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (input.email !== undefined) {
      updateFields.push("email = ?");
      updateValues.push(input?.email?.toLowerCase());
    }
    if (input.username !== undefined) {
      updateFields.push("username = ?");
      updateValues.push(input.username);
    }
    if (input.first_name !== undefined) {
      updateFields.push("first_name = ?");
      updateValues.push(input.first_name);
    }
    if (input.last_name !== undefined) {
      updateFields.push("last_name = ?");
      updateValues.push(input.last_name);
    }
    if (input.avatar_url !== undefined) {
      updateFields.push("avatar_url = ?");
      updateValues.push(input.avatar_url);
    }
    if (input.role !== undefined) {
      updateFields.push("role = ?");
      updateValues.push(input.role);
    }
    if (input.is_active !== undefined) {
      updateFields.push("is_active = ?");
      updateValues.push(input.is_active);
    }
    if (input.is_verified !== undefined) {
      updateFields.push("is_verified = ?");
      updateValues.push(input.is_verified);
    }

    updateFields.push("updated_at = ?");
    updateValues.push(new Date().toISOString());
    updateValues.push(id);

    const stmt = this?.db?.prepare(`
      UPDATE users SET ${updateFields.join(", ")} WHERE id = ?
    `);
    stmt.run(...updateValues);

    const updatedUser = this.getUserById(id);
    return this.toPublicUser(updatedUser!);
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await passwordManager.verifyPassword(
      input.currentPassword,
      user.password_hash,
    );
    if (!isCurrentPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // Validate new password
    const passwordValidation = passwordManager.validatePasswordStrength(
      input.newPassword,
    );
    if (!passwordValidation.isValid) {
      throw new Error(
        `Password validation failed: ${passwordValidation?.errors?.join(", ")}`,
      );
    }

    // Hash new password
    const newPasswordHash = await passwordManager.hashPassword(
      input.newPassword,
    );

    // Update password
    const stmt = this?.db?.prepare(`
      UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(newPasswordHash, new Date().toISOString(), userId);

    // Revoke all refresh tokens for security
    this.revokeAllUserRefreshTokens(userId);
  }

  /**
   * Authenticate user with email/username and password
   */
  async authenticateUser(
    emailOrUsername: string,
    password: string,
  ): Promise<User | null> {
    let user = this.getUserByEmail(emailOrUsername);
    if (!user) {
      user = this.getUserByUsername(emailOrUsername);
    }

    if (!user) {
      return null;
    }

    if (!user.is_active) {
      throw new Error("Account is deactivated");
    }

    const isPasswordValid = await passwordManager.verifyPassword(
      password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      return null;
    }

    // Update last login time
    const stmt = this?.db?.prepare(`
      UPDATE users SET last_login_at = ? WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), user.id);

    return user;
  }

  /**
   * List users with pagination and filtering
   */
  listUsers(query: UserListQuery = {}): UserListResponse {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      is_active,
      is_verified,
      sort_by = "created_at",
      sort_order = "desc",
    } = query;

    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push(
        "(email LIKE ? OR username LIKE ? OR first_name LIKE ? OR last_name LIKE ?)",
      );
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (role) {
      conditions.push("role = ?");
      params.push(role);
    }

    if (is_active !== undefined) {
      conditions.push("is_active = ?");
      params.push(is_active);
    }

    if (is_verified !== undefined) {
      conditions.push("is_verified = ?");
      params.push(is_verified);
    }

    const whereClause =
      conditions?.length || 0 > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderClause = `ORDER BY ${sort_by} ${sort_order.toUpperCase()}`;

    // Get total count
    const countStmt = this?.db?.prepare(`
      SELECT COUNT(*) as total FROM users ${whereClause}
    `);
    const { total } = countStmt.get(...params) as { total: number };

    // Get users
    const usersStmt = this?.db?.prepare(`
      SELECT * FROM users ${whereClause} ${orderClause} LIMIT ? OFFSET ?
    `);
    const users = usersStmt.all(...params, limit, offset) as User[];

    const pages = Math.ceil(total / limit);

    return {
      users: users?.map((user: any) => this.toPublicUser(user)),
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Delete user (soft delete by deactivating)
   */
  async deleteUser(id: string): Promise<void> {
    const user = this.getUserById(id);
    if (!user) {
      throw new Error("User not found");
    }

    // Deactivate instead of hard delete
    const stmt = this?.db?.prepare(`
      UPDATE users SET is_active = false, updated_at = ? WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), id);

    // Revoke all tokens
    this.revokeAllUserRefreshTokens(id);
    this.revokeAllUserSessions(id);
  }

  /**
   * Create refresh token
   */
  createRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): RefreshToken {
    const tokenId = randomUUID();
    const tokenHash = jwtManager.hashToken(token);
    const now = new Date().toISOString();

    const stmt = this?.db?.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(tokenId, userId, tokenHash, expiresAt.toISOString(), now);

    return {
      id: tokenId,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      revoked: false,
      created_at: now,
    };
  }

  /**
   * Get refresh token by ID
   */
  getRefreshToken(tokenId: string): RefreshToken | null {
    const stmt = this?.db?.prepare(
      "SELECT * FROM refresh_tokens WHERE id = ? AND revoked = false",
    );
    return stmt.get(tokenId) as RefreshToken | null;
  }

  /**
   * Revoke refresh token
   */
  revokeRefreshToken(tokenId: string): void {
    const stmt = this?.db?.prepare(`
      UPDATE refresh_tokens SET revoked = true WHERE id = ?
    `);
    stmt.run(tokenId);
  }

  /**
   * Revoke all user refresh tokens
   */
  revokeAllUserRefreshTokens(userId: string): void {
    const stmt = this?.db?.prepare(`
      UPDATE refresh_tokens SET revoked = true WHERE user_id = ?
    `);
    stmt.run(userId);
  }

  /**
   * Cleanup expired tokens
   */
  cleanupExpiredTokens(): void {
    const now = new Date().toISOString();

    try {
      // Check if tables exist before attempting cleanup
      const tables = [
        "refresh_tokens",
        "user_sessions",
        "password_reset_tokens",
        "email_verification_tokens",
      ];

      for (const table of tables) {
        try {
          // Check if table exists
          const checkStmt = this?.db?.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name=?
          `);
          const tableExists = checkStmt.get(table);

          if (tableExists) {
            // Delete expired tokens from this table
            const deleteStmt = this?.db?.prepare(`
              DELETE FROM ${table} WHERE expires_at < ?
            `);
            deleteStmt.run(now);
          }
        } catch (error) {
          // Log table-specific errors but continue with other tables
          console.warn(
            `Token cleanup warning for table ${table}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    } catch (error) {
      // Log general cleanup errors but don't throw
      console.warn(
        "Token cleanup warning:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Create user session
   */
  createUserSession(
    userId: string,
    sessionToken: string,
    deviceInfo?: {
      ip_address?: string;
      user_agent?: string;
      device_info?: string;
    },
    expiresAt?: Date,
  ): UserSession {
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const expires = expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const stmt = this?.db?.prepare(`
      INSERT INTO user_sessions (
        id, user_id, session_token, device_info, ip_address, user_agent,
        expires_at, created_at, last_activity_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      userId,
      sessionToken,
      deviceInfo?.device_info || null,
      deviceInfo?.ip_address || null,
      deviceInfo?.user_agent || null,
      expires.toISOString(),
      now,
      now,
    );

    return {
      id: sessionId,
      user_id: userId,
      session_token: sessionToken,
      device_info: deviceInfo?.device_info,
      ip_address: deviceInfo?.ip_address,
      user_agent: deviceInfo?.user_agent,
      expires_at: expires.toISOString(),
      created_at: now,
      last_activity_at: now,
    };
  }

  /**
   * Revoke all user sessions
   */
  revokeAllUserSessions(userId: string): void {
    const stmt = this?.db?.prepare(`
      DELETE FROM user_sessions WHERE user_id = ?
    `);
    stmt.run(userId);
  }

  /**
   * Convert User to PublicUser (removing sensitive data)
   */
  private toPublicUser(user: User): PublicUser {
    const { password_hash, ...publicUser } = user;
    return publicUser;
  }

  /**
   * Close database connection
   */
  close(): void {
    this?.db?.close();
  }
}
